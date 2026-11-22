import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../types/command.js";
import { runPluginCheck } from "../utils/pluginUpdates.js";
import { pluginUpdateEmbeds } from "../utils/pluginUpdateEmbeds.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("plugin-updates")
    .setDescription("Check installed Minecraft plugin versions against their release sources")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (
      !interaction.inGuild() ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: "You need Manage Server permission to check plugin updates.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply();
    try {
      const report = await runPluginCheck();
      const embeds = pluginUpdateEmbeds(report, report.results);
      await interaction.editReply({
        embeds: [embeds[0]],
        allowedMentions: { parse: [] },
      });
      for (const embed of embeds.slice(1)) {
        await interaction.followUp({
          embeds: [embed],
          allowedMentions: { parse: [] },
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: error instanceof Error ? error.message : "Plugin check unavailable.",
      });
    }
  },
};
export default command;
