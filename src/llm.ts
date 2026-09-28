// Teno's actual "brain" for reacting to speech: instead of matching
// literal keywords like "play"/"skip"/"stop", this sends the transcript
// to a self-hosted LLM (via Ollama) and asks it to classify what the
// person wants and draft a short spoken-style reply.

export interface LlmIntent {
  action: "play" | "skip" | "stop" | "chat";
  query?: string;
  reply: string;
}

const SYSTEM_PROMPT = `You are Teno, a Discord voice assistant. The person just spoke to you; what you're given is a speech-to-text transcript of that, which may contain minor recognition errors (garbled words, wrong homophone, etc).

Decide what they want and respond with ONLY a JSON object, nothing else, in exactly this shape:
{"action": "play" | "skip" | "stop" | "chat", "query": "<song or artist search terms, ONLY when action is play>", "reply": "<a short, natural, spoken-style reply, one sentence>"}

Rules:
- "play": they want a specific song/artist played. Put the song/artist in "query" — if the transcript garbled a name but you can confidently tell what they meant (e.g. a well-known song title), correct it in "query" rather than repeating the garbled version.
- "skip": they want the current track skipped.
- "stop": they want playback stopped and the bot to leave.
- "chat": anything else — casual talk, a question, unclear audio. Just give a short, friendly reply and no music action.
Always include "reply", even for play/skip/stop (e.g. "Playing it now.", "Skipping.", "Stopping — see you later.").
Respond with ONLY the JSON object.`;

export async function interpretTranscript(transcript: string): Promise<LlmIntent> {
  const host = process.env.OLLAMA_HOST;
  const port = process.env.OLLAMA_PORT;
  const model = process.env.OLLAMA_MODEL;
  if (!host || !port || !model) {
    throw new Error("Missing OLLAMA_HOST, OLLAMA_PORT, or OLLAMA_MODEL in .env");
  }

  const response = await fetch(`http://${host}:${port}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      prompt: transcript,
      format: "json", // constrains Ollama's output to valid JSON
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { response: string };

  let parsed: Partial<LlmIntent>;
  try {
    parsed = JSON.parse(data.response);
  } catch {
    throw new Error(`Ollama's response wasn't valid JSON: ${data.response}`);
  }

  if (
    parsed.action !== "play" &&
    parsed.action !== "skip" &&
    parsed.action !== "stop" &&
    parsed.action !== "chat"
  ) {
    throw new Error(`Ollama returned an unrecognized action: ${JSON.stringify(parsed)}`);
  }

  return {
    action: parsed.action,
    query: parsed.query,
    reply: parsed.reply ?? "",
  };
}
