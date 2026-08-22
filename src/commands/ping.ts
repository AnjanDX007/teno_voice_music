import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

// The "shape" Discord needs to register this as a slash command (/ping).
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check that Teno is alive and measure response time");

// What actually happens when someone runs /ping in Discord.
export async function execute(interaction: ChatInputCommandInteraction) {
  const sentAt = Date.now();

  // deferReply buys us time — Discord requires *some* response within 3s,
  // this shows "Teno is thinking..." immediately.
  await interaction.reply("Pinging...");

  const roundTripMs = Date.now() - sentAt;
  const wsLatencyMs = interaction.client.ws.ping;

  await interaction.editReply(
    `Pong! Round trip: ${roundTripMs}ms | Gateway latency: ${wsLatencyMs}ms`
  );
}
