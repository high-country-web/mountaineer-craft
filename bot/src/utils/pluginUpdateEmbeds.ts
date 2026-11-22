import { EmbedBuilder, escapeMarkdown } from "discord.js";
import type { PluginReport } from "./pluginUpdates.js";

export const PLUGINS_PER_EMBED = 4;

// Four fields leave room for long version strings and setup notices.
export function pluginUpdateEmbeds(
  report: PluginReport,
  updates = report.results.filter((plugin) => plugin.status === "update_available"),
): EmbedBuilder[] {
  const unresolved = report.results.filter((plugin) =>
    ["manual", "review", "unknown_installed", "error"].includes(plugin.status),
  ).length;
  const pages = Math.max(1, Math.ceil(updates.length / PLUGINS_PER_EMBED));
  const clean = (value: string) => escapeMarkdown(value.replace(/[\r\n]/g, " ").slice(0, 120));
  const embeds: EmbedBuilder[] = [];
  for (let page = 0; page < pages; page++) {
    const embed = new EmbedBuilder()
      .setTitle(
        updates.length ? "Minecraft plugin updates available" : "Minecraft plugin update check",
      )
      .setColor(updates.length ? 0xffcc00 : 0x7b9e87)
      .setDescription(
        [
          updates.length
            ? `**${updates.length} plugin update(s) available.**`
            : "No confirmed plugin updates were found.",
          `${report.results.length} plugins checked${unresolved ? `; ${unresolved} need version information or review` : ""}.`,
          "Review Minecraft compatibility before installing.",
          ...report.notes.map((note) => escapeMarkdown(note).slice(0, 350)),
        ]
          .join("\n")
          .slice(0, 1000),
      )
      .setTimestamp(new Date(report.checkedAt))
      .setFooter({
        text: `Mountaineer Craft | Page ${page + 1}/${pages} | No plugins installed automatically`,
      });
    for (const plugin of updates.slice(page * PLUGINS_PER_EMBED, (page + 1) * PLUGINS_PER_EMBED)) {
      embed.addFields({
        name: clean(plugin.name).slice(0, 100),
        value:
          `Installed: **${clean(plugin.installed ?? "unknown")}**\nLatest: **${clean(plugin.latest ?? "unknown")}**${plugin.url ? `\n[View release](${plugin.url})` : ""}`.slice(
            0,
            1024,
          ),
        inline: false,
      });
    }
    embeds.push(embed);
  }
  return embeds;
}
