import { Client } from "discord.js";
import { LavalinkManager } from "lavalink-client";

let manager: LavalinkManager | undefined;

// Call once, after the Discord client logs in. Wires Lavalink's manager to
// the bot's gateway connection so voice state updates flow both ways.
export function initLavalink(client: Client): LavalinkManager {
  const host = process.env.LAVALINK_HOST;
  const port = process.env.LAVALINK_PORT;
  const password = process.env.LAVALINK_PASSWORD;

  if (!host || !port || !password) {
    throw new Error(
      "Missing LAVALINK_HOST, LAVALINK_PORT, or LAVALINK_PASSWORD in .env"
    );
  }

  manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host,
        port: Number(port),
        authorization: password,
      },
    ],
    // lavalink-client needs to send voice state updates through your bot's
    // own gateway connection — this is that bridge.
    sendToShard: (guildId, payload) =>
      client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: client.user!.id,
      username: client.user!.username,
    },
  });

  // Discord sends raw voice-related gateway events on the 'raw' event.
  // lavalink-client needs to see these to track voice connections.
  client.on("raw", (data) => manager!.sendRawData(data));

  manager.nodeManager.on("connect", (node) =>
    console.log(`Lavalink node "${node.id}" connected`)
  );
  manager.nodeManager.on("error", (node, error) =>
    console.error(`Lavalink node "${node.id}" error:`, error)
  );

  return manager;
}

// Commands call this to get the already-initialized manager. Throws loudly
// instead of silently returning undefined if something starts in the wrong order.
export function getLavalink(): LavalinkManager {
  if (!manager) {
    throw new Error("Lavalink manager not initialized yet");
  }
  return manager;
}
