import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { SlashCommand } from "../types/command";
import playerAnalyticsClient from "../utils/playerAnalyticsClient.js";
import logger from "../utils/logger.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("whois")
    .setDescription("Look up a player")
    .addUserOption((option) =>
      option.setName("player").setDescription("Discord user").setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.options.getMember("player") as GuildMember;
    const player = member.nickname ?? member.user.username;
    await interaction.deferReply();

    const res = await playerAnalyticsClient.request(`/v1/player?player=${player}`);
    const playerData = await res.json();

    if (playerData.error) {
      if (playerData.error === "Given 'player' was not found in the database.") {
        await interaction.editReply(`❌ Player not found.`);
        return;
      }
      await interaction.editReply(`❌ An error occurred while fetching player data.`);
      logger.error(`Error fetching player data for ${player}: ${playerData.error}`);
      return;
    }

    console.log(playerData);
    let MCJoinedOn = "Unknown";
    if (playerData.info.registered) {
      MCJoinedOn = `<t:${Math.floor(playerData.info.registered / 1000)}:R>`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${playerData.info.name}`)
      .setColor(0xf1c40f)
      .setThumbnail("https://crafthead.net/helm/" + playerData.info.name)
      .setDescription(
        `Currently In-Game: ${playerData.info.inGame ? "Yes" : "No"}
            Deaths: ${playerData.info.death_count}
            Sessions: ${playerData.info.session_count}
            Joined Our Discord: <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>
            Joined MountaineerCraft: ${MCJoinedOn}
            Last Seen: <t:${Math.floor(playerData.info.last_seen / 1000)}:R>
            `,
      )
      .setFooter({ text: "This command is still a Work In Progress" })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  },
};

export default command;
