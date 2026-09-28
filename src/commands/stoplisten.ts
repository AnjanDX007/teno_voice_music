import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { stopListeningAndTranscribe } from "../voiceSession.js";
import { queueTrack, skipTrack, stopPlayback } from "../musicActions.js";
import { interpretTranscript } from "../llm.js";

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

  const member = interaction.member as GuildMember;
  const voiceChannelId = member.voice.channelId;

  let intent;
  try {
    intent = await interpretTranscript(transcript);
  } catch (err) {
    console.error("LLM interpretation failed:", err);
    await interaction.followUp("Couldn't figure out what you meant that time.");
    return;
  }

  if (intent.reply) {
    await interaction.followUp(intent.reply);
  }

  try {
    if (intent.action === "play" && intent.query && voiceChannelId) {
      const title = await queueTrack({
        guildId: interaction.guildId!,
        voiceChannelId,
        textChannelId: interaction.channelId,
        query: intent.query,
        requestedBy: interaction.user,
      });
      await interaction.followUp(`Queued: **${title}**`);
    } else if (intent.action === "skip") {
      const title = skipTrack(interaction.guildId!);
      await interaction.followUp(title ? `Skipped **${title}**.` : "Nothing is playing.");
    } else if (intent.action === "stop") {
      const stopped = await stopPlayback(interaction.guildId!);
      await interaction.followUp(stopped ? "Stopped." : "Nothing to stop.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't act on that.";
    await interaction.followUp(message);
  }
}
