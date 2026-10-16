import { NextRequest, NextResponse } from "next/server";
import { cookie, fetchMemberSession, SESSION_COOKIE } from "@/lib/auth-server";

const publicPaths = new Set(["/login", "/oauth/discord", "/join-discord", "/logout", "/access-unavailable", "/api/auth/login", "/api/auth/logout", "/api/auth/session"]);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (publicPaths.has(pathname)) return NextResponse.next();
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
    const destinations: Record<string, string> = { "/discord": "https://discord.gg/57E8HMCnGw", "/map": "https://map.mountaineercraft.net", "/analytics": "https://analytics.mountaineercraft.net" };
    if (destinations[pathname]) return NextResponse.redirect(destinations[pathname]);
    const result = NextResponse.next();
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  } catch {
    return redirect("/access-unavailable");
  }
}

// Page HTML and Next.js data requests are protected; only public branding and
// framework assets bypass the gate. Do not exempt /_next/data or /api broadly.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|server-icon\\.png|logo\\.png|minecraftDot\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png).*)"],
};
