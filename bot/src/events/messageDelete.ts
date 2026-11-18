import { Events, Message, EmbedBuilder } from "discord.js";

const truncate = (str: string, max = 1000) => (str.length > max ? str.slice(0, max) + "..." : str);

export default {
  name: Events.MessageDelete,
  async execute(message: Message) {
    if (!message.guild || message.author?.bot) return;

    const content = message.content ? truncate(message.content) : "*No content*";

    const attachments = message.attachments.size
      ? message.attachments.map((a) => a.url).join("\n")
      : null;

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Message Deleted")
      .setColor(0xe74c3c)
      .setThumbnail(message.author?.displayAvatarURL() || null)
      .addFields(
        {
          name: "👤 User",
          value: `${message.author}`,
          inline: true,
        },
        {
          name: "📍 Channel",
          value: `${message.channel}`,
          inline: true,
        },
        {
          name: "💬 Content",
          value: content,
        },
        ...(attachments
          ? [
              {
                name: "📎 Attachments",
                value: truncate(attachments),
              },
            ]
          : []),
      )
      .setTimestamp();

    const channel = message.guild.channels.cache.get("1487261871361757184");

    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  },
};
