export type Player = {
  uuid: string;
  name: string;
  registered: number | null;
  last_seen: number | null;
  active_playtime: number | null;
  sessions: number | null;
  online?: boolean;
  deaths?: number | null;
  mob_kills?: number | null;
  player_kills?: number | null;
};

export const isPlayerSlug = (slug: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

export function isPlayer(value: unknown): value is Player {
  if (!value || typeof value !== "object") return false;
  const p = value as Player;
  const metric = (n: unknown) => n === null || (typeof n === "number" && Number.isSafeInteger(n) && n >= 0);
  return typeof p.uuid === "string" && isPlayerSlug(p.uuid) && typeof p.name === "string" && p.name.trim().length > 0 &&
    [p.registered, p.last_seen, p.active_playtime, p.sessions].every(metric) &&
    [p.deaths, p.mob_kills, p.player_kills].every(n => n === undefined || metric(n)) &&
    (p.online === undefined || typeof p.online === "boolean");
}

export function playerDate(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(timestamp);
}

export function playtime(milliseconds: number | null) {
  if (milliseconds === null) return "Not available";
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60).toLocaleString("en-US")}h ${minutes % 60}m`;
}
