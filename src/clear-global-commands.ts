import "dotenv/config";
import { REST, Routes, RESTGetAPIApplicationCommandsResult } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env");
}

const rest = new REST().setToken(token);

// Bulk-overwriting global commands with [] fails if the app has an "Entry
// Point" command (type 4, used for Discord Activities) — Discord won't let
// a bulk operation remove that one. So instead: list every global command,
// then delete each one individually, skipping type 4.
const existing = (await rest.get(
  Routes.applicationCommands(clientId)
)) as RESTGetAPIApplicationCommandsResult;

const ENTRY_POINT_TYPE = 4;
const toDelete = existing.filter((cmd) => cmd.type !== ENTRY_POINT_TYPE);

for (const cmd of toDelete) {
  await rest.delete(Routes.applicationCommand(clientId, cmd.id));
  console.log(`Deleted global command: ${cmd.name}`);
}

console.log(
  `Done. Deleted ${toDelete.length} global command(s); left ${
    existing.length - toDelete.length
  } Entry Point command(s) untouched.`
);
