import { NextRequest, NextResponse } from "next/server";
import { cookie, fetchMemberSession, SESSION_COOKIE } from "@/lib/auth-server";
import { requiresMembership } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const destinations: Record<string, string> = { "/discord": "https://discord.gg/57E8HMCnGw", "/map": "https://map.mountaineercraft.net", "/analytics": "https://analytics.mountaineercraft.net" };
  if (destinations[pathname]) return NextResponse.redirect(destinations[pathname]);
  if (!requiresMembership(pathname)) return NextResponse.next();
  const next = pathname + request.nextUrl.search;
  const redirect = (destination: string) => {
    const url = new URL(destination, request.url);
    url.searchParams.set("next", next);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirect("/login");
  try {
    const response = await fetchMemberSession(token);
    if (response.status === 401) {
      const result = redirect("/login");
      result.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return result;
    }
    if (response.status === 403) return redirect("/join-discord");
    if (!response.ok) return redirect("/access-unavailable");
    const user = await response.json();
    if (user.in_guild !== true) return redirect("/access-unavailable");
    const result = NextResponse.next();
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  } catch {
    return redirect("/access-unavailable");
  }
}

// Account HTML and normalized Next.js account-data requests remain protected.
// Public browsing and server-resource redirects never require authentication.
export const config = {
  matcher: ["/me/:path*", "/discord", "/map", "/analytics"],
};
