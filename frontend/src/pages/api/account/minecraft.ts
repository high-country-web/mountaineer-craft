import type { NextApiRequest, NextApiResponse } from "next";
import { API_BASE_URL, readCookie, SESSION_COOKIE } from "@/lib/auth-server";
import { isPlayer, isPlayerSlug } from "@/lib/players";

export default async function minecraft(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    const response = await fetch(`${API_BASE_URL}/me/minecraft`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403)
      return res.status(response.status).json({ error: "access_required" });
    if (!response.ok) throw new Error("Account lookup unavailable");
    const data = await response.json();
    if (["not_configured", "not_linked"].includes(data.status))
      return res.status(200).json({ status: data.status });
    if (
      data.status !== "linked" ||
      typeof data.uuid !== "string" ||
      !isPlayerSlug(data.uuid) ||
      (data.player !== null &&
        (!isPlayer(data.player) || data.player.uuid.toLowerCase() !== data.uuid.toLowerCase()))
    ) {
      throw new Error("Invalid account response");
    }
    return res.status(200).json({ status: "linked", uuid: data.uuid, player: data.player });
  } catch {
    return res.status(503).json({ error: "minecraft_account_unavailable" });
  }
}
