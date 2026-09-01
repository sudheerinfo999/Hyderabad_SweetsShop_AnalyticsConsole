import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, homePathForRole } from "@/lib/access";
import type { AppRole } from "@/lib/supabase/types";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth"];

function missingEnvResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")) {
    return NextResponse.next({ request });
  }
  url.pathname = "/login";
  url.searchParams.set("error", "config");
  return NextResponse.redirect(url);
}

type ProfileSnapshot = {
  id: string;
  role: AppRole;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
};

async function fetchProfileSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  fallbackEmail?: string | null,
): Promise<ProfileSnapshot> {
  const { data } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, is_active")
    .eq("id", userId)
    .maybeSingle();

  const role: AppRole = data?.role === "admin" ? "admin" : "staff";
  return {
    id: userId,
    role,
    email: data?.email ?? fallbackEmail ?? null,
    full_name: data?.full_name ?? null,
    is_active: data?.is_active ?? true,
  };
}

function withProfileHeaders(request: NextRequest, profile: ProfileSnapshot) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-user-id", profile.id);
  requestHeaders.set("x-app-role", profile.role);
  requestHeaders.set("x-app-email", profile.email ?? "");
  requestHeaders.set("x-app-name", profile.full_name ?? "");
  requestHeaders.set("x-app-active", profile.is_active ? "true" : "false");
  return requestHeaders;
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

    if (user) {
      const profile = await fetchProfileSnapshot(supabase, user.id, user.email);
      const requestHeaders = withProfileHeaders(request, profile);

      if (url.pathname === "/login") {
        url.pathname = homePathForRole(profile.role);
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (!isPublic && !canAccessPath(profile.role, url.pathname)) {
        url.pathname = homePathForRole(profile.role);
        url.search = "";
        return NextResponse.redirect(url);
      }

      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return response;
  } catch (error) {
    console.error("[middleware] session update failed:", error);
    return missingEnvResponse(request);
  }
}
