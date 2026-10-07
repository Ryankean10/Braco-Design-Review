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

  // Maintenance mode for boreaspower — shown to all users (holiday booking exempt)
  if (companySlug === 'boreaspower' && !pathname.startsWith('/api/') && pathname !== '/login' && pathname !== '/holiday') {
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Under Maintenance — Boreas Power</title><style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:system-ui,sans-serif;color:#f1f5f9}.card{text-align:center;padding:3rem 2rem;max-width:480px}.icon{font-size:3rem;margin-bottom:1.5rem}h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}p{color:#94a3b8;line-height:1.6;font-size:.95rem}</style></head><body><div class="card"><div class="icon">🔧</div><h1>Site Under Maintenance</h1><p>The Boreas Power portal is currently undergoing scheduled maintenance. Please check back shortly.</p></div></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html', 'Retry-After': '3600' } }
    )
  }

  // Webhook/cron endpoints secured by their own secret header — bypass auth
  if (
    pathname.startsWith('/api/construction/inbound-email') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/onboard') ||
    pathname.startsWith('/api/client-upload') ||
    pathname.startsWith('/api/holiday-booking') ||
    pathname.startsWith('/api/timesheet') ||
    pathname.startsWith('/timesheet') ||
    pathname.startsWith('/holiday')
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
