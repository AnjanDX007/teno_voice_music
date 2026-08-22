import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { skipTrack } from "../musicActions.js";

export const data = new SlashCommandBuilder()
  .setName("skip")
  .setDescription("Skip the current track");

export async function execute(interaction: ChatInputCommandInteraction) {
  const title = skipTrack(interaction.guildId!);

  if (!title) {
    await interaction.reply({
      content: "Nothing is playing.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply(`Skipped **${title}**.`);
}
