import type { NextApiRequest, NextApiResponse } from "next";
import { API_BASE_URL } from "@/lib/auth-server";
import { isServerStatus } from "@/lib/server-status";

export default async function status(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    const response = await fetch(`${API_BASE_URL}/status`, { signal: AbortSignal.timeout(13000), redirect: "error" });
    if (!response.ok) throw new Error("Status unavailable");
    const data: unknown = await response.json();
    if (!isServerStatus(data)) throw new Error("Invalid status");
    return res.status(200).json({ players_online: data.players_online, updated_at: data.updated_at });
  } catch {
    return res.status(503).json({ error: "server_status_unavailable" });
  }
}
