import { Events, ActivityType } from "discord.js";
import { ExtendedClient } from "../types/client";
import { deployRolePanel } from "../utils/deployRolePanel.js";
import { loadData, updateRulesMessage } from "../utils/rulesEmbed.js";
import chalk from "chalk";
import { loadJobs } from "../utils/jobLoader.js";
import Logger from "../utils/logger.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: ExtendedClient) {
    console.log(chalk.green.bold(`[Mountaineer Helper] Bot is up and ready to go!`));

    await deployRolePanel(client);

    const data = loadData();
    try {
      const channel = await client.channels.fetch(data.channelId);

      if (!channel || !channel.isTextBased()) {
        console.error("Invalid channel.");
        return;
      }

      await updateRulesMessage(channel);
    } catch (err) {
      console.error("Failed to update rules:", err);
    }

    (async () => {
      try {
        await loadJobs(client);
      } catch (error) {
        Logger.error(`Error loading jobs: ${error}`);
      }
    })();

    const statuses = [
      { name: "Watching you play...", type: ActivityType.Watching },
      {
        name: "Watching the chat for commands...",
        type: ActivityType.Watching,
      },
    ];

    let index = 0;

    const updateStatus = () => {
      const status = statuses[index];

      client.user?.setPresence({
        activities: [{ name: status.name, type: status.type }],
        status: "online",
      });

      index = (index + 1) % statuses.length;
    };

    updateStatus(); // set immediately
    setInterval(updateStatus, 5 * 60 * 1000); // every 5 minutes
  },
};
