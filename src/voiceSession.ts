import {
  joinVoiceChannel,
  EndBehaviorType,
  type VoiceConnection,
} from "@discordjs/voice";
import prism from "prism-media";
import { spawn } from "node:child_process";
import type { VoiceBasedChannel } from "discord.js";
import { getLavalink } from "./lavalink.js";
import { transcribeWithWhisperServer } from "./transcribe.js";

interface ListenSession {
  connection: VoiceConnection;
  wavPath: string;
  ffmpeg: ReturnType<typeof spawn>;
}

// One listen session per guild at a time — matches how /listen and
// /stoplisten are meant to be used (single manual session, not concurrent).
const sessions = new Map<string, ListenSession>();

export function isListening(guildId: string): boolean {
  return sessions.has(guildId);
}

export interface StartListeningOptions {
  guildId: string;
  voiceChannel: VoiceBasedChannel;
  userId: string;
}

export async function startListening(opts: StartListeningOptions): Promise<void> {
  if (sessions.has(opts.guildId)) {
    throw new Error("Already listening — run /stoplisten first.");
  }

  // Lavalink owns its own voice connection for music playback, separate
  // from the one we're about to open here with @discordjs/voice. Discord
  // only allows one voice session per bot per server, so the two would
  // fight over it. Simplest safe rule for now: don't allow both at once.
  const existingPlayer = getLavalink().getPlayer(opts.guildId);
  if (existingPlayer?.connected) {
    throw new Error(
      "Can't listen while music is playing right now — run /stop first, then /listen."
    );
  }

  const connection = joinVoiceChannel({
    channelId: opts.voiceChannel.id,
    guildId: opts.guildId,
    adapterCreator: opts.voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false, // must actually receive audio, not just send it
  });

  const wavPath = `/tmp/listen-${opts.guildId}.wav`;

  // whisper-cli needs 16kHz mono WAV. Discord gives us 48kHz stereo Opus.
  // ffmpeg does that conversion, reading raw PCM from stdin (after we
  // decode the Opus ourselves) and writing a finished WAV file.
  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "-i", "pipe:0",
    "-ar", "16000",
    "-ac", "1",
    wavPath,
  ]);

  if (!ffmpeg.stdin) {
    throw new Error("Failed to open ffmpeg's stdin pipe.");
  }

  const opusStream = connection.receiver.subscribe(opts.userId, {
    // Manual = the stream stays open until we explicitly stop it,
    // rather than auto-closing after a pause in speech. That's what
    // makes this a *manual* wake command: you control start and stop.
    end: { behavior: EndBehaviorType.Manual },
  });

  const decoder = new prism.opus.Decoder({
    frameSize: 960,
    channels: 2,
    rate: 48000,
  });

  opusStream.pipe(decoder).pipe(ffmpeg.stdin);

  sessions.set(opts.guildId, { connection, wavPath, ffmpeg });
}

// Stops the session, finalizes the WAV file, sends it to whisper-server
// for transcription, and returns the transcript (may be an empty string
// if nothing was said).
export async function stopListeningAndTranscribe(guildId: string): Promise<string> {
  const session = sessions.get(guildId);
  if (!session) {
    throw new Error("Not currently listening.");
  }
  sessions.delete(guildId);

  // Ending ffmpeg's stdin lets it finalize the WAV header/length and exit.
  session.ffmpeg.stdin!.end();
  await new Promise<void>((resolve) => session.ffmpeg.once("close", () => resolve()));

  session.connection.destroy();

  try {
    return await transcribeWithWhisperServer(session.wavPath);
  } catch (err) {
    throw new Error(
      `Transcription failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
