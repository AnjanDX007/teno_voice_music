import type { User } from "discord.js";
import { getLavalink } from "./lavalink.js";
import { resolveYoutubeAudio } from "./resolveYoutubeAudio.js";

export interface QueueTrackOptions {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  query: string;
  requestedBy: User;
}

// Resolves a query via yt-dlp and queues it on the guild's player,
// creating the player/connection if one doesn't already exist. Returns
// the track's title. Throws with a user-facing message on failure.
export async function queueTrack(opts: QueueTrackOptions): Promise<string> {
  const manager = getLavalink();

  const player =
    manager.getPlayer(opts.guildId) ??
    manager.createPlayer({
      guildId: opts.guildId,
      voiceChannelId: opts.voiceChannelId,
      textChannelId: opts.textChannelId,
      selfDeaf: false,
    });

  if (!player.connected) {
    await player.connect();
  }

  const resolved = await resolveYoutubeAudio(opts.query);
  const result = await player.search({ query: resolved.url }, opts.requestedBy);

  if (result.loadType === "error" || result.tracks.length === 0) {
    throw new Error(`Found "${resolved.title}" but couldn't load its audio.`);
  }

  const track = result.tracks[0];
  // Raw stream URLs don't carry nice metadata — use yt-dlp's title instead.
  track.info.title = resolved.title;
  await player.queue.add(track);

  if (!player.playing) {
    await player.play();
  }

  return track.info.title;
}

// Returns the skipped track's title, or null if nothing was playing.
export function skipTrack(guildId: string): string | null {
  const player = getLavalink().getPlayer(guildId);
  if (!player || !player.playing) {
    return null;
  }
  const title = player.queue.current?.info.title ?? "current track";
  player.skip();
  return title;
}

// Returns whether there was a player to stop.
export async function stopPlayback(guildId: string): Promise<boolean> {
  const player = getLavalink().getPlayer(guildId);
  if (!player) {
    return false;
  }
  await player.destroy();
  return true;
}
