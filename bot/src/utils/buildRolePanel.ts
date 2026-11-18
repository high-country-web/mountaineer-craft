import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { rolePanel } from "../data/rolePanel.js";

export function buildRolePanel() {
  const embed = new EmbedBuilder()
    .setTitle("🎯 Choose Your Roles")
    .setDescription(
      "Click a button below to toggle your roles. Roles give you access to channels, annoucements and more!",
    )
    .setColor(0xffb81c)
    .setFooter({ text: "You can change your roles anytime!" });

  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const role of rolePanel.roles) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(role.customId)
        .setLabel(role.label)
        .setStyle(ButtonStyle.Secondary),
    );

    embed.addFields({
      name: role.label,
      value: `<@&${role.roleId}>`,
      inline: true,
    });
  }

  return { embed, row };
}
