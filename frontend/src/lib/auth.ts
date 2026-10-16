export const publicPages = new Set(["/login", "/oauth/discord", "/join-discord", "/logout", "/access-unavailable"]);

export function requiresMembership(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return path === "/me" || path.startsWith("/me/");
}

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/me";
  const pathname = value.split(/[?#]/)[0];
  if (publicPages.has(pathname) || pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return "/me";
  return value;
}
