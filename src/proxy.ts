import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getClaims verifies the JWT locally (no auth-server round trip) when the project uses asymmetric signing keys,
  // and falls back to a server check otherwise; it refreshes an expired session like getUser did.
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = !!data?.claims
  const pathname = request.nextUrl.pathname

  if (
    !isLoggedIn &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/signup') &&
    !pathname.startsWith('/api/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // static images and the app manifest don't need an auth check
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)'],
}
