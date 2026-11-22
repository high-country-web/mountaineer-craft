import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import semver from "semver";

type Source =
  | { type: "github"; repo: string }
  | { type: "modrinth"; project: string; loaders: string[] }
  | { type: "spiget"; resource: number }
  | { type: "manual"; reason: string; url?: string };
export type TrackedPlugin = {
  name: string;
  installedVersion: string | null;
  aliases?: string[];
  stripSuffixes?: string[];
  source: Source;
};
export type PluginManifest = {
  schemaVersion: 1;
  minecraftVersion: string | null;
  plugins: TrackedPlugin[];
};
export type UpdateStatus =
  "update_available" | "up_to_date" | "ahead" | "unknown_installed" | "review" | "manual" | "error";
export type PluginResult = {
  name: string;
  installed: string | null;
  latest: string | null;
  status: UpdateStatus;
  url?: string;
  note?: string;
};
export type PluginReport = { checkedAt: string; results: PluginResult[]; notes: string[] };
export type RequestJSON = (url: string, github?: boolean) => Promise<unknown>;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const safeURL = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

export function parsePluginManifest(value: unknown): PluginManifest {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !(value.minecraftVersion === null || text(value.minecraftVersion)) ||
    !Array.isArray(value.plugins) ||
    value.plugins.length > 200
  )
    throw new Error("Invalid plugin tracking file");
  const names = new Set<string>();
  for (const plugin of value.plugins) {
    if (
      !object(plugin) ||
      !text(plugin.name) ||
      !(plugin.installedVersion === null || text(plugin.installedVersion)) ||
      (plugin.aliases !== undefined && !strings(plugin.aliases)) ||
      (plugin.stripSuffixes !== undefined && !strings(plugin.stripSuffixes)) ||
      !object(plugin.source)
    )
      throw new Error("Invalid plugin entry");
    const name = plugin.name.toLowerCase();
    if (names.has(name)) throw new Error("Duplicate tracked plugin name");
    names.add(name);
    const source = plugin.source;
    const valid =
      source.type === "github"
        ? typeof source.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(source.repo)
        : source.type === "modrinth"
          ? typeof source.project === "string" &&
            /^[\w-]+$/.test(source.project) &&
            strings(source.loaders) &&
            source.loaders.length > 0
          : source.type === "spiget"
            ? Number.isSafeInteger(source.resource) && (source.resource as number) > 0
            : source.type === "manual" &&
              text(source.reason) &&
              (source.url === undefined || safeURL(source.url));
    if (!valid) throw new Error(`Invalid update source for ${plugin.name}`);
  }
  return value as unknown as PluginManifest;
}

export function comparePluginVersions(
  installed: string,
  latest: string,
  suffixes: string[] = [],
): "update_available" | "up_to_date" | "ahead" | "review" {
  const normalize = (input: string) => {
    let version = input.trim().replace(/^v(?=\d)/i, "");
    for (const suffix of suffixes)
      if (version.endsWith(suffix)) version = version.slice(0, -suffix.length);
    return version;
  };
  const current = normalize(installed),
    available = normalize(latest);
  if (current === available) return "up_to_date";
  let comparison: number;
  if (semver.valid(current) && semver.valid(available))
    comparison = semver.compare(current, available);
  else if (/^\d+(?:\.\d+){1,3}$/.test(current) && /^\d+(?:\.\d+){1,3}$/.test(available)) {
    const a = current.split(".").map(BigInt),
      b = available.split(".").map(BigInt);
    comparison = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] ?? 0n) !== (b[i] ?? 0n)) {
        comparison = (a[i] ?? 0n) < (b[i] ?? 0n) ? -1 : 1;
        break;
      }
    }
  } else return "review";
  return comparison < 0 ? "update_available" : comparison > 0 ? "ahead" : "up_to_date";
}

export async function readResponse(response: Response, maxBytes: number): Promise<string> {
  if (!response.ok) throw new Error(`Update source returned HTTP ${response.status}`);
  if (!response.body) throw new Error("Empty source response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Source response exceeded size limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function requestJSON(url: string, github = false): Promise<unknown> {
  const headers: Record<string, string> = {
    "User-Agent": "MountaineerCraft-PluginChecker/1.0 (https://mountaineercraft.net)",
    Accept: "application/json",
  };
  if (github && new URL(url).origin === "https://api.github.com" && process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const response = await fetch(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    return JSON.parse(await readResponse(response, 4 << 20));
  } catch (error) {
    // Never include raw fetch errors: they can contain URLs or credentials.
    if (error instanceof Error && /^Update source returned HTTP \d+$/.test(error.message))
      throw error;
    throw new Error("Source unavailable or returned invalid data");
  }
}

export async function latestPluginVersion(
  plugin: TrackedPlugin,
  minecraftVersion: string | null,
  request: RequestJSON = requestJSON,
): Promise<{ version: string; url: string }> {
  const source = plugin.source;
  if (source.type === "github") {
    const result = await request(
      `https://api.github.com/repos/${source.repo}/releases/latest`,
      true,
    );
    if (
      !object(result) ||
      !text(result.tag_name) ||
      result.draft !== false ||
      result.prerelease !== false
    )
      throw new Error("No stable GitHub release found");
    return { version: result.tag_name, url: `https://github.com/${source.repo}/releases/latest` };
  }
  if (source.type === "modrinth") {
    const query = new URLSearchParams({
      loaders: JSON.stringify(source.loaders),
      include_changelog: "false",
    });
    if (minecraftVersion) query.set("game_versions", JSON.stringify([minecraftVersion]));
    const result = await request(
      `https://api.modrinth.com/v2/project/${source.project}/version?${query}`,
    );
    if (!Array.isArray(result)) throw new Error("Invalid Modrinth version response");
    const releases = result.filter(
      (item): item is Record<string, unknown> =>
        object(item) &&
        item.version_type === "release" &&
        text(item.id) &&
        text(item.version_number) &&
        typeof item.date_published === "string" &&
        Number.isFinite(Date.parse(item.date_published)) &&
        Array.isArray(item.loaders) &&
        source.loaders.some((loader) => (item.loaders as unknown[]).includes(loader)) &&
        (!minecraftVersion ||
          (Array.isArray(item.game_versions) && item.game_versions.includes(minecraftVersion))),
    );
    releases.sort(
      (a, b) => Date.parse(b.date_published as string) - Date.parse(a.date_published as string),
    );
    const latest = releases[0];
    if (!latest) throw new Error("No compatible stable Modrinth release found");
    return {
      version: latest.version_number as string,
      url: `https://modrinth.com/plugin/${source.project}/version/${encodeURIComponent(latest.id as string)}`,
    };
  }
  if (source.type === "spiget") {
    const result = await request(
      `https://api.spiget.org/v2/resources/${source.resource}/versions/latest`,
    );
    if (!object(result) || !text(result.name)) throw new Error("No Spigot version found");
    return { version: result.name, url: `https://www.spigotmc.org/resources/${source.resource}/` };
  }
  throw new Error("Manual update source");
}

// Only parse startup version announcements, never arbitrary chat or command output.
export function installedVersionsFromLog(log: string): Map<string, string> {
  const versions = new Map<string, string>();
  for (const raw of log.split(/\r?\n/)) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, "");
    const match = line.match(
      /^(?:\[\d{2}:\d{2}:\d{2}\] \[(?:Server thread|ServerMain|main)\/INFO\]|\[\d{2}:\d{2}:\d{2} INFO\]): \[[^\]]+\] (?:Enabling|Loading(?: server plugin)?) ([A-Za-z0-9_+.-]+) v([^\r\n]+)$/,
    );
    if (match && match[2].length <= 200) versions.set(match[1].toLowerCase(), match[2].trim());
  }
  return versions;
}

async function panelInstalledVersions(): Promise<Map<string, string> | null> {
  const panel = process.env.PTERODACTYL_PANEL_URL?.trim(),
    server = process.env.PTERODACTYL_MINECRAFT_SERVER_ID?.trim(),
    key = process.env.PTERODACTYL_CLIENT_API_KEY?.trim();
  if (!panel && !server && !key) return null;
  if (!panel || !server || !key || !/^[0-9a-f]{8}$/i.test(server) || !safeURL(panel))
    throw new Error("Incomplete bot Panel configuration");
  const url = new URL(panel);
  if (url.search || url.hash) throw new Error("Invalid bot Panel URL");
  url.pathname = url.pathname.replace(/\/$/, "") + `/api/client/servers/${server}/files/contents`;
  url.searchParams.set("file", "/logs/latest.log");
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.pterodactyl.v1+json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    const log = await readResponse(response, 4 << 20);
    return installedVersionsFromLog(log);
  } catch {
    throw new Error(
      "Could not read startup versions from Panel; check file-read access and log size",
    );
  }
}

export async function checkPlugins(
  manifest: PluginManifest,
  installed: Map<string, string> = new Map(),
  request: RequestJSON = requestJSON,
): Promise<PluginResult[]> {
  const results: PluginResult[] = [];
  const requests = new Map<string, Promise<unknown>>();
  const sharedRequest: RequestJSON = (url, github) => {
    if (!requests.has(url)) requests.set(url, request(url, github));
    return requests.get(url)!;
  };
  // Three requests at a time; one failed provider never hides other plugins.
  for (let offset = 0; offset < manifest.plugins.length; offset += 3) {
    results.push(
      ...(await Promise.all(
        manifest.plugins.slice(offset, offset + 3).map(async (plugin): Promise<PluginResult> => {
          const current =
            plugin.installedVersion ??
            [plugin.name, ...(plugin.aliases ?? [])]
              .map((name) => installed.get(name.toLowerCase()))
              .find(Boolean) ??
            null;
          if (plugin.source.type === "manual")
            return {
              name: plugin.name,
              installed: current,
              latest: null,
              status: "manual",
              note: plugin.source.reason,
              url: plugin.source.url,
            };
          try {
            const latest = await latestPluginVersion(
              plugin,
              manifest.minecraftVersion,
              sharedRequest,
            );
            return {
              name: plugin.name,
              installed: current,
              latest: latest.version,
              status: current
                ? comparePluginVersions(current, latest.version, plugin.stripSuffixes)
                : "unknown_installed",
              url: latest.url,
            };
          } catch (error) {
            return {
              name: plugin.name,
              installed: current,
              latest: null,
              status: "error",
              note: error instanceof Error ? error.message : "Source check failed",
            };
          }
        }),
      )),
    );
  }
  return results;
}

let cached: { raw: string; until: number; report: PluginReport } | undefined;
let pending: Promise<PluginReport> | undefined;
export function runPluginCheck(): Promise<PluginReport> {
  if (pending) return pending;
  pending = (async () => {
    const path = resolve(process.env.PLUGIN_UPDATES_FILE || "data/plugins.json");
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      throw new Error("Cannot read plugin tracking file; configure PLUGIN_UPDATES_FILE");
    }
    if (cached && cached.raw === raw && cached.until > Date.now()) return cached.report;
    let manifest: PluginManifest;
    try {
      manifest = parsePluginManifest(JSON.parse(raw));
    } catch {
      throw new Error("Invalid plugin tracking JSON; check its names and source settings");
    }
    const notes: string[] = [];
    let installed = new Map<string, string>();
    try {
      const detected = await panelInstalledVersions();
      if (detected) installed = detected;
      else
        notes.push(
          "Set installedVersion in the tracking file or configure the bot's Panel variables to read startup versions.",
        );
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Installed versions unavailable");
    }
    if (!manifest.minecraftVersion)
      notes.push(
        "Minecraft version is not configured. Releases are not filtered for your server's Minecraft version; review compatibility before installing.",
      );
    const report = {
      checkedAt: new Date().toISOString(),
      results: await checkPlugins(manifest, installed),
      notes,
    };
    cached = { raw, until: Date.now() + 5 * 60000, report };
    return report;
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}

export function pluginReportText(report: PluginReport): string {
  return [
    `Mountaineer Craft plugin updates — ${report.checkedAt}`,
    ...report.notes,
    "",
    ...report.results.map(
      (plugin) =>
        `${plugin.name}: ${plugin.status}\n  Installed: ${plugin.installed ?? "unknown"} | Latest: ${plugin.latest ?? "unknown"}${plugin.note ? `\n  ${plugin.note}` : ""}${plugin.url ? `\n  ${plugin.url}` : ""}`,
    ),
    "",
    "No plugins were downloaded or installed. Confirm release compatibility before updating.",
  ].join("\n");
}
