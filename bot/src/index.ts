import {
  REST,
  Routes,
  Interaction,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

import fs from "fs";
import path from "path";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import Logger from "./utils/logger.js";
import { ExtendedClient } from "./types/client.js";
import { rolePanel } from "./data/rolePanel.js";
import playerAnalyticsClient from "./utils/playerAnalyticsClient.js";
import {
  buildPluginUpdateComponents,
  buildPluginUpdateEmbed,
  pluginUpdateRefreshButtonId,
} from "./utils/pluginUpdateEmbeds.js";
import { runPluginCheck } from "./utils/pluginUpdates.js";

Logger.start();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const start = async () => {
  const client = new ExtendedClient({
    intents: ["Guilds", "GuildMessages", "DirectMessages", "MessageContent", "GuildMembers"],
    allowedMentions: { parse: [] },
  });

  // Load commands
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, "slash-commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of commandFiles) {
    const { default: command } = await import(`./slash-commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  // Register slash commands
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  (async () => {
    try {
      Logger.info("Registering slash commands...");
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body: commands },
      );
      Logger.info("Slash commands registered.");
    } catch (error) {
      Logger.error(`${error}`);
    }
  })();

  (async () => {
    try {
      await playerAnalyticsClient.login();
    } catch (error) {
      Logger.error(`Error logging into Plan API: ${error}`);
    }
  })();

  // Handle interactions
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.guild) return;

    // BUTTON INTERACTIONS
    if (interaction.isButton()) {
      if (!interaction.guild) return;

      if (interaction.customId === pluginUpdateRefreshButtonId) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            content: "You need Manage Server permission to refresh plugin updates.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferUpdate();
        try {
          const report = await runPluginCheck(true);
          const entries = report.results.filter((plugin) =>
            ["update_available", "manual", "review", "unknown_installed", "error"].includes(
              plugin.status,
            ),
          );
          const { embed } = buildPluginUpdateEmbed(report, entries);
          await interaction.message.edit({
            embeds: [embed],
            components: buildPluginUpdateComponents(),
            allowedMentions: { parse: [] },
          });
        } catch (error) {
          Logger.error(`Plugin update refresh failed: ${error}`);
          await interaction.followUp({
            content: "Couldn't refresh plugin updates. Check the bot logs and Plan connection.",
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      const roleConfig = rolePanel.roles.find((r) => r.customId === interaction.customId);
      if (!roleConfig) return;

      // Fetch the member to ensure full GuildMember
      const member = await interaction.guild.members.fetch(interaction.user.id);

      let action: "added" | "removed" = "added"; // track action

      if (!member.roles.cache.has("1480686298380632135"))
        return await interaction.reply({
          content: `You must connect your account via minecraft before interacting with this server.`,
          flags: MessageFlags.Ephemeral,
        });

      if (member.roles.cache.has(roleConfig.roleId)) {
        await member.roles.remove(roleConfig.roleId);
        action = "removed";
      } else {
        await member.roles.add(roleConfig.roleId);
        action = "added";
      }

      // Send dynamic feedback
      await interaction.reply({
        content: `✅ You have **${action}** the role <@&${roleConfig.roleId}>.`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    // SLASH COMMANDS
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Error executing command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Error executing command.",
          ephemeral: true,
        });
      }
    }
  });

  const eventFiles = await readdir(join(__dirname, "./events"));
  for (const file of eventFiles) {
    const { default: event } = await import(`./events/${file}`);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  client
    .login(config.DISCORD_TOKEN)
    .then(() => Logger.info("Logged into Discord successfully"))
    .catch((err) => {
      Logger.error("Error logging into Discord", err);
      process.exit();
    });
};

void start();
