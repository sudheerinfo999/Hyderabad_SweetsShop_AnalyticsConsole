import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth"];

function missingEnvResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  // Allow the login page through so we can show a clear configuration message there.
  if (url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")) {
    return NextResponse.next({ request });
  }
  url.pathname = "/login";
  url.searchParams.set("error", "config");
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return missingEnvResponse(request);
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const url = request.nextUrl.clone();
    const isPublic = PUBLIC_PATHS.some((p) => url.pathname.startsWith(p));

    if (!user && !isPublic) {
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    if (user && url.pathname === "/login") {
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    console.error("[middleware] session update failed:", error);
    // Fail open to the login page instead of crashing the whole request with 500.
    return missingEnvResponse(request);
  }
}
