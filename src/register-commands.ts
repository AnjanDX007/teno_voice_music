import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env"
  );
}

const body = commands.map((c) => c.data.toJSON());
const rest = new REST().setToken(token);

// Registering to a specific guild (server) instead of globally means the
// command shows up instantly. Global registration can take up to an hour.
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });

console.log(`Registered ${body.length} command(s): ${body.map((c) => c.name).join(", ")}`);
