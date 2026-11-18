import { Events, Message, EmbedBuilder } from "discord.js";

const truncate = (str: string, max = 1000) => (str.length > max ? str.slice(0, max) + "..." : str);

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage: Message, newMessage: Message) {
    if (!newMessage.guild || newMessage.author?.bot) return;

    if (oldMessage.partial) await oldMessage.fetch();
    if (newMessage.partial) await newMessage.fetch();

    if (oldMessage.content === newMessage.content) return;

    const before = oldMessage.content ? truncate(oldMessage.content) : "*No content*";

    const after = newMessage.content ? truncate(newMessage.content) : "*No content*";

    const embed = new EmbedBuilder()
      .setTitle("✏️ Message Edited")
      .setColor(0xf1c40f)
      .setThumbnail(newMessage.author?.displayAvatarURL() || null)
      .addFields(
        {
          name: "👤 User",
          value: `${newMessage.author}`,
          inline: true,
        },
        {
          name: "📍 Channel",
          value: `${newMessage.channel}`,
          inline: true,
        },
        {
          name: "📝 Before",
          value: before,
        },
        {
          name: "📝 After",
          value: after,
        },
        {
          name: "🔗 Jump",
          value: `[Go to Message](${newMessage.url})`,
        },
      )
      .setTimestamp();

    const channel = newMessage.guild.channels.cache.get("1487261871361757184");

    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  },
};
