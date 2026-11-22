export type ServerStats = {
  state: "running" | "offline" | "starting" | "stopping" | "suspended";
  uptime_ms: number | null;
  memory_bytes: number | null;
  cpu_percent: number | null;
  disk_bytes: number | null;
  network_rx_bytes: number | null;
  network_tx_bytes: number | null;
  updated_at: string;
};

export function isServerStats(value: unknown): value is ServerStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  return (
    ["running", "offline", "starting", "stopping", "suspended"].includes(stats.state as string) &&
    ["uptime_ms", "memory_bytes", "disk_bytes", "network_rx_bytes", "network_tx_bytes"].every(
      (key) =>
        stats[key] === null || (Number.isSafeInteger(stats[key]) && (stats[key] as number) >= 0),
    ) &&
    (stats.cpu_percent === null ||
      (typeof stats.cpu_percent === "number" &&
        Number.isFinite(stats.cpu_percent) &&
        stats.cpu_percent >= 0)) &&
    typeof stats.updated_at === "string" &&
    Number.isFinite(Date.parse(stats.updated_at))
  );
}

export function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const index =
    value === 0 ? 0 : Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toLocaleString("en-US", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

export function formatUptime(value: number | null): string {
  if (value === null) return "Unavailable";
  const minutes = Math.floor(value / 60000);
  if (minutes < 1) return "Less than a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days}d ${hours}h ${minutes % 60}m`;
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function networkRate(
  previous: ServerStats | undefined,
  current: ServerStats | undefined,
  key: "network_rx_bytes" | "network_tx_bytes",
): number | null {
  if (
    !previous ||
    !current ||
    previous.state !== "running" ||
    current.state !== "running" ||
    previous.uptime_ms === null ||
    current.uptime_ms === null ||
    current.uptime_ms <= previous.uptime_ms ||
    previous[key] === null ||
    current[key] === null ||
    current[key] < previous[key]
  )
    return null;
  return (current[key] - previous[key]) / ((current.uptime_ms - previous.uptime_ms) / 1000);
}
