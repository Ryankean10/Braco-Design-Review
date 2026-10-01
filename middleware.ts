import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function extractCompanySlug(_request: NextRequest): string {
  return process.env.NEXT_PUBLIC_COMPANY_SLUG ?? 'boreaspower'
}

export async function middleware(request: NextRequest) {
  const companySlug = extractCompanySlug(request)

  // Pass company slug to server components via request headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-company-slug', companySlug)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Webhook/cron endpoints secured by their own secret header — bypass auth
  if (
    pathname.startsWith('/api/construction/inbound-email') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/onboard') ||
    pathname.startsWith('/api/client-upload') ||
    pathname.startsWith('/api/timesheet') ||
    pathname.startsWith('/timesheet')
  ) {
    return supabaseResponse
  }

  if (!user && pathname !== '/login' && !pathname.startsWith('/onboard') && !pathname.startsWith('/client-upload') && !pathname.startsWith('/timesheet')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Company access enforcement — runs before the login→dashboard redirect to avoid loops.
  // Use service-role client to bypass RLS.
  if (user) {
    const admin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const userCompanyId = profile?.company_id

    if (role !== 'superadmin') {
      const { data: subdomainCompany } = await admin
        .from('companies')
        .select('id')
        .eq('slug', companySlug)
        .single()

      const authorised = subdomainCompany && userCompanyId === subdomainCompany.id

      if (!authorised) {
        if (pathname !== '/login') {
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('error', 'unauthorized')
          return NextResponse.redirect(url)
        }
        return supabaseResponse
      }
    }

    // User is authorised — redirect away from login to dashboard
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.searchParams.delete('error')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
