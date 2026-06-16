import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Using Next.js v16 'proxy' named export for middleware replacement
export const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isAdminLoginRoute = nextUrl.pathname === "/admin/login";
  const isAdminRoute = nextUrl.pathname.startsWith("/admin") && !isAdminLoginRoute;
  const isAuthRoute = ["/login", "/register"].includes(nextUrl.pathname);
  const isSellerRoute = nextUrl.pathname.startsWith("/listings/new") || 
                        nextUrl.pathname.startsWith("/properties/new");

  // 1. Redirect logged-in users away from /login and /register
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // 2. Redirect logged-in admins to /admin, others to /
  if (isAdminLoginRoute) {
    if (isLoggedIn) {
      if (userRole === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", nextUrl));
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // 3. Protect Admin Route - redirect to /admin/login
  if (isAdminRoute) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(nextUrl.pathname);
      return NextResponse.redirect(new URL(`/admin/login?callbackUrl=${callbackUrl}`, nextUrl));
    }
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  // 4. Protect Property Listing creation (restrict to authenticated users)
  if (isSellerRoute) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(nextUrl.pathname);
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Match all request paths except api routes, static files, and favicons
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
