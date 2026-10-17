export type ServerStatus = { players_online: number; updated_at: string };

export function isServerStatus(value: unknown): value is ServerStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<ServerStatus>;
  return Number.isSafeInteger(status.players_online) && status.players_online! >= 0 &&
    typeof status.updated_at === "string" && Number.isFinite(Date.parse(status.updated_at));
}
