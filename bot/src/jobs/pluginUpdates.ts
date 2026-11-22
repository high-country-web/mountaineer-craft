import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Job } from "../types/job.js";
import { runPluginCheck } from "../utils/pluginUpdates.js";
import { PLUGINS_PER_EMBED, pluginUpdateEmbeds } from "../utils/pluginUpdateEmbeds.js";
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
        process.env.PLUGIN_UPDATES_STATE_FILE || "data/plugin-update-state.json",
      );
      let sent: Record<string, string> = {};
      try {
        const data: unknown = JSON.parse(await readFile(path, "utf8"));
        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          !Object.values(data).every((value) => typeof value === "string")
        )
          throw new Error("Invalid alert state");
        sent = data as Record<string, string>;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
          throw new Error("Could not read plugin alert state; alerts paused to avoid duplicates");
      }
      const updates = report.results.filter(
        (plugin) =>
          plugin.status === "update_available" &&
          sent[plugin.name] !== JSON.stringify([plugin.installed, plugin.latest]),
      );
      if (!updates.length) return;
      const channel = await client.channels.fetch(channelID);
      if (
        !channel?.isSendable() ||
        !("guildId" in channel) ||
        channel.guildId !== process.env.DISCORD_GUILD_ID
      )
        throw new Error("Plugin update channel must be a sendable channel in the configured guild");
      const embeds = pluginUpdateEmbeds(report, updates);
      for (let page = 0; page < embeds.length; page++) {
        await channel.send({ embeds: [embeds[page]], allowedMentions: { parse: [] } });
        for (const plugin of updates.slice(
          page * PLUGINS_PER_EMBED,
          (page + 1) * PLUGINS_PER_EMBED,
        ))
          sent[plugin.name] = JSON.stringify([plugin.installed, plugin.latest]);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path + ".tmp", JSON.stringify(sent, null, 2) + "\n", "utf8");
        await rename(path + ".tmp", path);
      }
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
