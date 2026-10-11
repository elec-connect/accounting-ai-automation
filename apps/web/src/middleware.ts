import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════
//  ROUTES PROTÉGÉES
// ═══════════════════════════════════════════════════════════════

const ADMIN_ROUTES = [
  "/dashboard/audit",
  "/dashboard/settings/users",
  "/dashboard/settings/email",
];

const SUPER_ADMIN_ROUTES = [
  "/super-admin",
  "/api/super-admin",
];

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/api/cron",
  "/api/documents",
  "/api/settings",
  "/api/search",
  "/api/dashboard",
  "/api/inbound-email",
  "/api/audit",
  "/api/reports",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // ═══════════════════════════════════════════════════════════════
  //  ROUTES PUBLIQUES
  // ═══════════════════════════════════════════════════════════════

  const isPublic = PUBLIC_ROUTES.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // ═══════════════════════════════════════════════════════════════
  //  REDIRECTION APRÈS LOGIN (⭐ MODIFIÉ)
  //  - Super-admin → /super-admin/licenses
  //  - Autres users → /dashboard
  // ═══════════════════════════════════════════════════════════════

  if (user && (path === "/login" || path === "/signup")) {
    // Vérifier si super-admin
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = superAdmin ? "/super-admin/licenses" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // ═══════════════════════════════════════════════════════════════
  //  SUPER ADMIN — protection des routes /super-admin et /api/super-admin
  // ═══════════════════════════════════════════════════════════════

  if (user && SUPER_ADMIN_ROUTES.some((route) => path.startsWith(route))) {
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (!superAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ADMIN (accepte admin ET super_admin)
  // ═══════════════════════════════════════════════════════════════

  if (user && ADMIN_ROUTES.some((route) => path.startsWith(route))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    // ⭐ Accepter admin ET super_admin
    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";

    if (!profile || !isAdmin || !profile.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};