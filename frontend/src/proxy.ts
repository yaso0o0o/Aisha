// Quick check before a dashboard page loads: no session cookie means go to sign in.
// The real check is on the backend, which refuses every /admin call without a valid session.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./data/api";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, lang, , page] = pathname.split("/");
  if (page === "login" || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL(`/${lang}/admin/login`, request.url));
}

export const config = {
  matcher: ["/:lang(ar|en)/admin", "/:lang(ar|en)/admin/:path*"],
};
