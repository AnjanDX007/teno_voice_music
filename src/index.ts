import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { commands } from "./commands/index.js";
import { initLavalink } from "./lavalink.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

// Intents = which events Discord will actually send us. GuildVoiceStates is
// required for Lavalink to know who's in which voice channel.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// A lookup so we can find the right handler when an interaction comes in.
const commandsByName = new Map(commands.map((c) => [c.data.name, c]));

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Teno is online as ${readyClient.user.tag}`);

  // The gateway (websocket) connection being up doesn't mean the REST API
  // connection is warm — that's a separate HTTPS connection, established
  // lazily on first use. Without this, the very first slash command reply
  // pays for DNS + TLS handshake setup on top of the actual request, which
  // can push it past Discord's 3-second interaction window. Fetching our
  // own user is a cheap, harmless call whose only purpose is to force that
  // handshake to happen now instead of during someone's first /play.
  try {
    await readyClient.user.fetch();
    console.log("Discord REST connection warmed up.");
  } catch (err) {
    console.warn("REST warm-up call failed (non-fatal):", err);
  }

  const lavalink = initLavalink(client);
  // init() tells lavalink-client "the bot is ready, here's its user info" —
  // it then connects out to the Lavalink node(s) defined in lavalink.ts.
  lavalink.init({ id: readyClient.user.id, username: readyClient.user.username });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandsByName.get(interaction.commandName);
  if (!command) {
    console.warn(`No handler for command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error running /${interaction.commandName}:`, err);
    const errorMessage = "Something went wrong running that command.";
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (reportErr) {
      // The interaction token itself may already be invalid/expired (e.g.
      // Discord's "Unknown interaction" / "already acknowledged" errors) —
      // nothing more we can do for the user, but this must not crash the bot.
      console.error("Also failed to report the error to Discord:", reportErr);
    }
  }
});

client.login(token);
