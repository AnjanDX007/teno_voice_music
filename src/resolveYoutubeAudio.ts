import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ResolvedAudio {
  url: string;
  title: string;
}

// Lavalink's bundled youtube-plugin has an ongoing PO-token problem that
// frequently blocks playback ("This video requires login"). yt-dlp is
// patched far more aggressively against YouTube's changes, so instead of
// asking Lavalink to talk to YouTube directly, we resolve the audio URL
// ourselves with yt-dlp (a Python zipapp — the Docker image installs
// python3 alongside it) and hand Lavalink a plain HTTP stream to play.
export async function resolveYoutubeAudio(query: string): Promise<ResolvedAudio> {
  const target = query.startsWith("http") ? query : `ytsearch1:${query}`;

  const { stdout } = await execFileAsync("yt-dlp", [
    "--no-playlist",
    "--dump-json",
    "-f",
    "bestaudio",
    target,
  ]);

  const info = JSON.parse(stdout);
  return { url: info.url, title: info.title };
}
