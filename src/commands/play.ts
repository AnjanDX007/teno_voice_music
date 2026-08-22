import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { queueTrack } from "../musicActions.js";

export const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a song by name or YouTube URL")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Song name or YouTube URL")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const voiceChannelId = member.voice.channelId;

  if (!voiceChannelId) {
    await interaction.reply({
      content: "Join a voice channel first.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply("Searching...");

  const query = interaction.options.getString("query", true);

  try {
    const title = await queueTrack({
      guildId: interaction.guildId!,
      voiceChannelId,
      textChannelId: interaction.channelId,
      query,
      requestedBy: interaction.user,
    });
    await interaction.editReply(`Queued: **${title}**`);
  } catch (err) {
    console.error(`Failed to queue "${query}":`, err);
    const message = err instanceof Error ? err.message : "Couldn't find or load that.";
    await interaction.editReply(message);
  }
}
