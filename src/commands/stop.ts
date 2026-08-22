import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { stopPlayback } from "../musicActions.js";

export const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop playback, clear the queue, and leave the channel");

export async function execute(interaction: ChatInputCommandInteraction) {
  const stopped = await stopPlayback(interaction.guildId!);

  if (!stopped) {
    await interaction.reply({
      content: "I'm not in a voice channel.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply("Stopped and left the channel.");
}
