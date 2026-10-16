import type { NextApiRequest, NextApiResponse } from "next";
import { cookie, fetchMemberSession, readCookie, SESSION_COOKIE } from "@/lib/auth-server";

export default async function session(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    const response = await fetchMemberSession(token);
    if (response.status === 401) {
      res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return res.status(401).json({ error: "session_expired" });
    }
    if (response.status === 403) return res.status(403).json({ error: "discord_membership_required", in_guild: false });
    if (!response.ok) return res.status(503).json({ error: "membership_check_unavailable" });
    const user = await response.json();
    if (user.in_guild !== true || typeof user.id !== "string" || typeof user.username !== "string") return res.status(503).json({ error: "invalid_session_response" });
    return res.status(200).json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar, in_guild: true });
  } catch {
    return res.status(503).json({ error: "membership_check_unavailable" });
  }
}
