export { safeReturnTo } from "./auth";

export const SESSION_COOKIE = "mc_session";
export const STATE_COOKIE = "mc_oauth_state";
export const RETURN_COOKIE = "mc_oauth_return";
export const API_BASE_URL = process.env.API_BASE_URL || "https://api.mountaineercraft.net";
export const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "https://mountaineercraft.net/oauth/discord";

export function readCookie(header: string | undefined, name: string): string | undefined {
  const value = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="))?.slice(name.length + 1);
  try { return value === undefined ? undefined : decodeURIComponent(value); } catch { return undefined; }
}

export function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function fetchMemberSession(token: string) {
  return fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}
