import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function extractCompanySlug(request: NextRequest): string {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')

  // braco.yacht-gitana.com → 'braco'
  // Exclude localhost and Vercel preview URLs
  if (
    parts.length >= 3 &&
    !hostname.startsWith('localhost') &&
    !hostname.includes('vercel.app')
  ) {
    return parts[0]
  }

  // Dev / Vercel preview: fall back to env var or 'braco'
  return process.env.DEFAULT_COMPANY_SLUG ?? 'braco'
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
    pathname.startsWith('/api/cron/')
  ) {
    return supabaseResponse
  }

  if (!user && pathname !== '/login') {
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
    const isAuthorized = role === 'superadmin' || (() => false)()

    if (role !== 'superadmin') {
      const { data: subdomainCompany } = await admin
        .from('companies')
        .select('id')
        .eq('slug', companySlug)
        .single()

      const authorised = subdomainCompany && userCompanyId === subdomainCompany.id

      if (!authorised) {
        // Not allowed on this subdomain — send to login with error and stop
        if (pathname !== '/login') {
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('error', 'unauthorized')
          return NextResponse.redirect(url)
        }
        // Already on login — serve it (show the error banner), don't redirect to dashboard
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
