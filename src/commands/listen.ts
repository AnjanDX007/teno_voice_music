import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { startListening } from "../voiceSession.js";

export const data = new SlashCommandBuilder()
  .setName("listen")
  .setDescription("Start listening to your voice until you run /stoplisten");

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: "Join a voice channel first.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply("Listening — say something, then run /stoplisten.");

  try {
    await startListening({
      guildId: interaction.guildId!,
      voiceChannel,
      userId: interaction.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't start listening.";
    await interaction.editReply(message);
  }
}
