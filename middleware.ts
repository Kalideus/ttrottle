import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
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

    const { data } = await supabase.auth.getUser()
    const isLoggedIn = !!data.user
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
  } catch (err) {
    // TEMPORARY: surface the real error in the response instead of a generic 500,
    // so it can be read directly in the browser without digging through Vercel's logs UI.
    return NextResponse.json(
      {
        middlewareError: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasPublishableKey: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
      { status: 500 }
    )
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
