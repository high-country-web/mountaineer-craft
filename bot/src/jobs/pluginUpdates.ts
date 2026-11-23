import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Job } from "../types/job.js";
import { runPluginCheck } from "../utils/pluginUpdates.js";
import { buildPluginUpdateEmbed } from "../utils/pluginUpdateEmbeds.js";
import logger from "../utils/logger.js";

let running = false;
const job: Job = {
  name: "pluginUpdates",
  interval: 60 * 60 * 1000,
  runOnStart: true,
  async run(client) {
    const channelID = process.env.PLUGIN_UPDATES_CHANNEL_ID?.trim();
    if (!channelID || running) return;
    running = true;
    try {
      const report = await runPluginCheck();
      const path = resolve(
        process.env.PLUGIN_UPDATES_STATE_FILE || "src/data/plugin-update-state.json",
      );
      let messageId: string | undefined;
      try {
        const data: unknown = JSON.parse(await readFile(path, "utf8"));
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("Invalid alert state");
        const storedMessageId = (data as { messageId?: unknown }).messageId;
        if (typeof storedMessageId === "string") messageId = storedMessageId;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
          throw new Error("Could not read plugin alert state; alerts paused to avoid duplicates");
      }
      const entries = report.results.filter((plugin) =>
        ["update_available", "manual", "review", "unknown_installed", "error"].includes(
          plugin.status,
        ),
      );
      const channel = await client.channels.fetch(channelID);
      if (
        !channel?.isSendable() ||
        !("guildId" in channel) ||
        channel.guildId !== process.env.DISCORD_GUILD_ID
      )
        throw new Error("Plugin update channel must be a sendable channel in the configured guild");
      const { embed } = buildPluginUpdateEmbed(report, entries);
      if (messageId) {
        try {
          const existing = await channel.messages.fetch(messageId);
          await existing.edit({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (error) {
          // Discord error 10008 means the saved message was deleted.
          if (error && typeof error === "object" && "code" in error && error.code === 10008)
            messageId = undefined;
          else throw error;
        }
      }
      if (!messageId) {
        const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        messageId = message.id;
      }
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path + ".tmp", JSON.stringify({ messageId }, null, 2) + "\n", "utf8");
      await rename(path + ".tmp", path);
    } catch {
      logger.warn(
        "Plugin update check failed; check source access, channel permissions, and alert state storage.",
      );
    } finally {
      running = false;
    }
  },
};
export default job;
