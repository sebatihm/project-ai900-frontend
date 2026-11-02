import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "ai901_session";

function isTokenAlive(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const data = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof data.exp !== "number") return true;
    return data.exp * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

function clearSession(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = isTokenAlive(token);
  const isLogin = pathname === "/login";

  if (isLogin) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/assistant", request.url));
    }
    return NextResponse.next();
  }

  const isPublicInvoiceAnalyzer =
    pathname === "/invoice-analyzer" ||
    pathname.startsWith("/invoice-analyzer/") ||
    pathname.startsWith("/chat/invoice-analyzer/");

  if (isPublicInvoiceAnalyzer) {
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    if (token) {
      loginUrl.searchParams.set("reason", "expired");
    }
    const response = NextResponse.redirect(loginUrl);
    if (token) clearSession(response);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
