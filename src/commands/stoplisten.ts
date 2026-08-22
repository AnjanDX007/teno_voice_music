import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { stopListeningAndTranscribe } from "../voiceSession.js";
import { queueTrack, skipTrack, stopPlayback } from "../musicActions.js";

export const data = new SlashCommandBuilder()
  .setName("stoplisten")
  .setDescription("Stop listening and see what Teno heard");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply("Transcribing...");

  let transcript: string;
  try {
    transcript = await stopListeningAndTranscribe(interaction.guildId!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    await interaction.editReply(message);
    return;
  }

  if (!transcript) {
    await interaction.editReply("Didn't catch anything.");
    return;
  }

  await interaction.editReply(`🎙️ Heard: "${transcript}"`);

  // Minimal first pass at actually reacting to what was heard, on top of
  // just showing the transcript. This is intentionally simple pattern
  // matching, not real intent parsing — that's the next step up from here.
  const lower = transcript.toLowerCase();
  const member = interaction.member as GuildMember;
  const voiceChannelId = member.voice.channelId;

  try {
    if (lower.startsWith("play ") && voiceChannelId) {
      const query = transcript.slice(5).trim();
      const title = await queueTrack({
        guildId: interaction.guildId!,
        voiceChannelId,
        textChannelId: interaction.channelId,
        query,
        requestedBy: interaction.user,
      });
      await interaction.followUp(`Queued: **${title}**`);
    } else if (lower.includes("skip")) {
      const title = skipTrack(interaction.guildId!);
      await interaction.followUp(title ? `Skipped **${title}**.` : "Nothing is playing.");
    } else if (lower.includes("stop")) {
      const stopped = await stopPlayback(interaction.guildId!);
      await interaction.followUp(stopped ? "Stopped." : "Nothing to stop.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't act on that.";
    await interaction.followUp(message);
  }
}
