import { readFile } from "node:fs/promises";

// whisper-server keeps the model loaded in memory permanently and answers
// over HTTP, instead of whisper-cli's approach of reloading the model
// from disk on every single invocation — that reload cost was the actual
// source of the transcription lag, not anything about the audio pipeline.
export async function transcribeWithWhisperServer(wavPath: string): Promise<string> {
  const host = process.env.WHISPER_HOST;
  const port = process.env.WHISPER_PORT;
  if (!host || !port) {
    throw new Error("Missing WHISPER_HOST or WHISPER_PORT in .env");
  }

  const fileBuffer = await readFile(wavPath);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer]), "audio.wav");
  form.append("response_format", "json");

  const response = await fetch(`http://${host}:${port}/inference`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`whisper-server returned ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}
