import { randomUUID } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { cookie, DISCORD_REDIRECT_URI, RETURN_COOKIE, safeReturnTo, STATE_COOKIE } from "@/lib/auth-server";

export default function login(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const state = randomUUID();
  res.setHeader("Set-Cookie", [cookie(STATE_COOKIE, state, 600), cookie(RETURN_COOKIE, safeReturnTo(req.query.next), 600)]);
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "1465494022150684769",
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code", scope: "identify guilds email", state,
  });
  res.redirect(302, `https://discord.com/oauth2/authorize?${params}`);
}
