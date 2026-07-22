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

  // Webhook endpoints secured by their own secret header
  if (pathname.startsWith('/api/construction/inbound-email')) {
    return supabaseResponse
  }

  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
