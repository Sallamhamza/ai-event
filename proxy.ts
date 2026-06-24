import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  isAccessGateEnabled,
  isValidAccessCookie,
} from "@/lib/access-control";

function isAccessRoute(pathname: string): boolean {
  return pathname === "/access" || pathname === "/api/access" || pathname.startsWith("/api/access/");
}

function getRedirectPath(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

export async function proxy(request: NextRequest) {
  if (!isAccessGateEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isAuthorized = await isValidAccessCookie(
    request.cookies.get(ACCESS_COOKIE_NAME)?.value
  );

  if (isAuthorized && pathname === "/access") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAccessRoute(pathname) || isAuthorized) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.searchParams.set("next", getRedirectPath(request));

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};
