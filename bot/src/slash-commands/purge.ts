import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { SlashCommand } from "../types/command";

const REQUIRED_ROLE_ID = "1475316727943270562";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);

    // Role check
    if (!member?.roles.cache.has(REQUIRED_ROLE_ID)) {
      await interaction.reply({
        content: "❌ You don't have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);

    if (amount < 1 || amount > 100) {
      await interaction.reply({
        content: "⚠️ Amount must be between 1 and 100.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;

    if (!channel || !channel.isTextBased() || !("bulkDelete" in channel)) {
      await interaction.reply({
        content: "❌ This command can only be used in text channels that support bulk deletion.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await channel.bulkDelete(amount, true);

    await interaction.reply({
      content: `🧹 Deleted ${amount} messages.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
