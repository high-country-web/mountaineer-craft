import { EmbedBuilder, escapeMarkdown } from "discord.js";
import type { PluginReport, PluginResult, UpdateStatus } from "./pluginUpdates.js";

const priority: Record<UpdateStatus, number> = {
  update_available: 0,
  error: 1,
  review: 2,
  unknown_installed: 3,
  manual: 4,
  up_to_date: 5,
  ahead: 6,
};

export function buildPluginUpdateEmbed(
  report: PluginReport,
  entries = report.results.filter((plugin) => plugin.status === "update_available"),
): { embed: EmbedBuilder; shown: PluginResult[] } {
  const updates = entries.filter((plugin) => plugin.status === "update_available").length;
  const unresolved = report.results.filter((plugin) =>
    ["manual", "review", "unknown_installed", "error"].includes(plugin.status),
  ).length;
  const clean = (value: string, limit = 40) =>
    escapeMarkdown(value.replace(/[\r\n]/g, " ").slice(0, limit));
  const version = (value: string | null) =>
    (value ?? "unknown").replace(/[`\r\n]/g, "").slice(0, 32);
  const lines = [
    `**${updates} update(s) available** · ${report.results.length} checked${unresolved ? ` · ${unresolved} need review` : ""}`,
    ...report.notes.slice(0, 3).map((note) => clean(note, 160)),
    "",
  ];
  const shown: PluginResult[] = [];
  const sorted = [...entries].sort((a, b) => priority[a.status] - priority[b.status]);
  for (const plugin of sorted) {
    const name = clean(plugin.name);
    const linkedName =
      plugin.status === "update_available" && plugin.url && plugin.url.length <= 220
        ? `[${name}](<${plugin.url}>)`
        : name;
    let detail: string;
    switch (plugin.status) {
      case "update_available":
        detail = `\`${version(plugin.installed)} → ${version(plugin.latest)}\``;
        break;
      case "up_to_date":
        detail = `up to date · \`${version(plugin.installed)}\``;
        break;
      case "ahead":
        detail = `installed newer · \`${version(plugin.installed)}\``;
        break;
      case "unknown_installed":
        detail = `installed unknown · latest \`${version(plugin.latest)}\``;
        break;
      case "review":
        detail = `review · \`${version(plugin.installed)} → ${version(plugin.latest)}\``;
        break;
      case "manual":
        detail = `manual check${plugin.note ? ` · ${clean(plugin.note, 65)}` : ""}`;
        break;
      case "error":
        detail = `check failed${plugin.note ? ` · ${clean(plugin.note, 65)}` : ""}`;
        break;
    }
    const line = `• **${linkedName}** — ${detail}`;
    // Reserve space for an overflow notice; never split a row or a Markdown link.
    if (lines.join("\n").length + line.length + 1 > 3900) break;
    lines.push(line);
    shown.push(plugin);
  }
  const omitted = entries.length - shown.length;
  if (omitted)
    lines.push(`\n${omitted} additional result(s) omitted to keep this report in one embed.`);
  const embed = new EmbedBuilder()
    .setTitle(updates ? "Minecraft plugin updates" : "Minecraft plugin update check")
    .setColor(updates || unresolved ? 0xffcc00 : 0x7b9e87)
    .setDescription(lines.join("\n"))
    .setTimestamp(new Date(report.checkedAt))
    .setFooter({ text: "Mountaineer Craft | Check Minecraft compatibility before updating" });
  return { embed, shown };
}
