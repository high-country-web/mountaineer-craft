import { API_BASE_URL } from "@/lib/auth-server";
import { isPlayer, type Player } from "@/lib/players";

export async function fetchPlayers(slug?: string): Promise<{ players: Player[]; unavailable: boolean; notFound: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/players${slug ? `/${encodeURIComponent(slug)}` : ""}`, {
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(13000),
    });
    if (slug && response.status === 404) return { players: [], unavailable: false, notFound: true };
    if (!response.ok) throw new Error("upstream unavailable");
    const data: unknown = await response.json();
    if (slug) {
      if (!isPlayer(data) || data.uuid.toLowerCase() !== slug.toLowerCase()) throw new Error("invalid player");
      return { players: [data], unavailable: false, notFound: false };
    }
    const players = (data as { players?: unknown })?.players;
    if (!Array.isArray(players) || !players.every(isPlayer)) throw new Error("invalid directory");
    return { players, unavailable: false, notFound: false };
  } catch {
    console.error("[players] Backend player data is unavailable or invalid");
    return { players: [], unavailable: true, notFound: false };
  }
}
