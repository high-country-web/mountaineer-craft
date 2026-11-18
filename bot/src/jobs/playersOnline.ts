import { Job } from "../types/job";
import logger from "../utils/logger.js";
import playerAnalyticsClient from "../utils/playerAnalyticsClient.js";

let running = false;
let failures = 0;
let retryAt = 0;

const job: Job = {
  name: "playersOnline",
  interval: 60000, // every minute
  runOnStart: true,

  async run(client) {
    if (running || Date.now() < retryAt) return;
    running = true;
    try {
      const res = await playerAnalyticsClient.request("/v1/playersOnline");
      const players: unknown = await res.json();
      if (
        !Array.isArray(players) ||
        !players.every(
          (player): player is { name: string } =>
            !!player && typeof player.name === "string" && player.name.trim().length > 0,
        )
      ) {
        throw new Error("Plan API returned an invalid online-player list");
      }
      // Never change Discord roles until Plan has returned a valid player list.
      const onlineNames = new Set(players.map((player) => player.name.toLowerCase()));
      const guild = await client.guilds.fetch("1465492057408802846");
      const role = await guild.roles.fetch("1479960688146256124");
      if (!role) throw new Error("Online role not found");

      await guild.members.fetch();
      for (const member of guild.members.cache.values()) {
        const hasRole = member.roles.cache.has(role.id);
        const isOnline = onlineNames.has(member.displayName.toLowerCase());
        if (isOnline && !hasRole) {
          await member.roles.add(role);
          logger.info(`Added online role to ${member.displayName}`);
        } else if (!isOnline && hasRole) {
          await member.roles.remove(role);
          logger.info(`Removed online role from ${member.displayName}`);
        }
      }
      if (failures > 0) logger.info("playersOnline recovered; normal one-minute updates resumed");
      failures = 0;
      retryAt = 0;
    } catch (error) {
      failures = Math.min(failures + 1, 5);
      const delay = Math.min(60000 * 2 ** (failures - 1), 600000);
      retryAt = Date.now() + delay;
      const message = error instanceof Error ? error.message : "Unknown failure";
      throw new Error(`${message}. playersOnline will retry in ${delay / 60000} minute(s)`);
    } finally {
      running = false;
    }
  },
};

export default job;
