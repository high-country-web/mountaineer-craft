import type { NextApiRequest, NextApiResponse } from "next";
import { API_BASE_URL } from "@/lib/auth-server";
import { isServerStats } from "@/lib/server-stats";

export default async function stats(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    const response = await fetch(`${API_BASE_URL}/stats`, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Stats unavailable");
    const data: unknown = await response.json();
    if (!isServerStats(data)) throw new Error("Invalid stats response");
    // Keep the public response restricted even if the backend adds more fields.
    return res.status(200).json({
      state: data.state,
      uptime_ms: data.uptime_ms,
      memory_bytes: data.memory_bytes,
      cpu_percent: data.cpu_percent,
      disk_bytes: data.disk_bytes,
      network_rx_bytes: data.network_rx_bytes,
      network_tx_bytes: data.network_tx_bytes,
      updated_at: data.updated_at,
    });
  } catch {
    console.error(
      "[server-stats] Backend stats unavailable; check backend Panel configuration and connectivity",
    );
    return res.status(503).json({ error: "server_stats_unavailable" });
  }
}
