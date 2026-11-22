import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../types/command.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Open your website profile using your verified Minecraft and Discord link"),

  async execute(interaction) {
    await interaction.reply({
      content:
        "Sign in to the website with this Discord account. Your existing Minecraft link will appear automatically on your profile. If you haven't linked Minecraft yet, join the Minecraft server and submit its verification code through the usual Discord linking process first.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Open your website profile")
            .setStyle(ButtonStyle.Link)
            .setURL("https://mountaineercraft.net/me"),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
