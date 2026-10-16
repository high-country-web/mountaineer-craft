import type { NextApiRequest, NextApiResponse } from "next";
import { API_BASE_URL, cookie, readCookie, SESSION_COOKIE, STATE_COOKIE, RETURN_COOKIE } from "@/lib/auth-server";

export default async function logout(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  // Only accept same-origin browser requests, not cross-site logout forms.
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).end(); }
    catch { return res.status(403).end(); }
  }
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  res.setHeader("Set-Cookie", [cookie(SESSION_COOKIE, "", 0), cookie(STATE_COOKIE, "", 0), cookie(RETURN_COOKIE, "", 0)]);
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    } catch { /* The browser session is cleared even if the API is unavailable. */ }
  }
  res.status(204).end();
}
