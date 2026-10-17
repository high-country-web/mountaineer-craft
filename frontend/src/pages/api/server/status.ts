import type { NextApiRequest, NextApiResponse } from "next";
import { API_BASE_URL } from "@/lib/auth-server";
import { isServerStatus } from "@/lib/server-status";

export default async function status(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    const response = await fetch(`${API_BASE_URL}/status`, { signal: AbortSignal.timeout(13000), redirect: "error" });
    if (!response.ok) {
      console.error(`[server-status] GET backend /status returned HTTP ${response.status}`);
      return res.status(503).json({ error: "server_status_unavailable" });
    }
    // Avoid logging upstream bodies or fetch errors that may contain URLs/secrets.
    const data: unknown = await response.json().catch(() => null);
    if (!isServerStatus(data)) {
      console.error("[server-status] GET backend /status returned an invalid status payload");
      return res.status(503).json({ error: "server_status_unavailable" });
    }
    return res.status(200).json({ players_online: data.players_online, updated_at: data.updated_at });
  } catch (error) {
    console.error("[server-status] GET backend /status failed:",
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "request timed out or was aborted" : "network, TLS, or redirect error; check API_BASE_URL and backend availability");
    return res.status(503).json({ error: "server_status_unavailable" });
  }
}
