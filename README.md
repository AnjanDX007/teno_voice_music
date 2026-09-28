# Teno — from scratch

Deliberately minimal. Every file here does exactly one thing, and nothing
runs that you can't trace by reading it top to bottom.

## What's in here

- `src/index.ts` — the bot process. Connects to Discord, listens for
  interactions, dispatches to the right command, and (once ready) starts
  up the Lavalink connection.
- `src/register-commands.ts` — a one-off script (not the bot itself) that
  tells Discord which slash commands exist. Run it whenever you add or
  change a command.
- `src/musicActions.ts` — the actual queue/skip/stop logic, shared by
  the slash commands and by voice-triggered reactions (see `stoplisten.ts`)
  so there's one implementation instead of two copies.
- `src/lavalink.ts` — owns the connection to the Lavalink server. Nothing
  else talks to Lavalink directly; commands call `getLavalink()`.
- `src/resolveYoutubeAudio.ts` — shells out to `yt-dlp` (bundled into the
  Docker image) to turn a search query or YouTube URL into a direct,
  playable audio stream URL + title. Lavalink's own bundled YouTube
  support has an ongoing problem (YouTube now requires a "PO token" that
  the plugin doesn't generate); `yt-dlp` is patched far more aggressively
  against YouTube's changes, so we resolve the URL ourselves and hand
  Lavalink a plain HTTP stream instead of asking it to talk to YouTube
  directly.
- `src/transcribe.ts` — talks to the `whisper` service (a separate
  container running `whisper-server`) over HTTP. Replaces an earlier
  approach that spawned `whisper-cli` fresh per call, which reloaded the
  whole model from disk every single time — that reload was the actual
  source of transcription lag, not the audio pipeline itself.
- `src/voiceSession.ts` — owns manual listen sessions: joins the voice
  channel, captures your audio, converts it, and sends it to the whisper
  service for transcription. `/listen` starts a session, `/stoplisten`
  ends it and returns the transcript.
- `src/llm.ts` — Teno's actual "brain": sends the transcript to a
  self-hosted LLM (Ollama) and asks it to classify what was meant
  (play/skip/stop/just chatting) and draft a short reply, instead of
  matching literal keywords.
- `src/commands/listen.ts` / `stoplisten.ts` — the manual wake commands.
  `/stoplisten` sends the transcript to the LLM and reacts based on what
  it decides, on top of showing the raw transcript.
- `src/commands/ping.ts` — one command. `data` describes it to Discord,
  `execute` is what runs when someone uses it.
- `src/commands/play.ts` / `skip.ts` / `stop.ts` — music commands, all
  following the same `data` + `execute` shape as `ping.ts`.
- `src/commands/index.ts` — the list of every command. Add new commands
  here explicitly — no auto-scanning magic to trace later.
- `lavalink/application.yml` — config for the Lavalink server itself
  (a separate Java process, not your Node code). Includes the
  `youtube-plugin` because Lavalink dropped built-in YouTube support.

## What Lavalink actually is

Discord voice is real-time audio over UDP — decoding/encoding and
streaming that is a different problem from "run a Node bot." Lavalink is
a standalone audio server (Java) that does that work; your bot just tells
it "join this channel, play this URL" over a websocket. That's why
`docker-compose.yml` now runs two containers: `lavalink` (the audio
engine) and `teno` (your bot, which is a *client* of it).

## A real limitation right now

Music playback (Lavalink) and voice listening (`/listen`) each open their
own voice connection, and Discord only allows **one** voice session per
bot per server. So right now you can't use both at the same time in the
same server — `/listen` will refuse to start while music is playing, and
you'd need `/stop` first. Worth knowing going in, not a bug to chase.

## Setup

1. Discord Developer Portal (discord.com/developers/applications) → New
   Application → note the Application ID → Bot tab → Reset Token, copy it.
2. Bot tab → make sure "Public Bot" matches what you want; no privileged
   intents needed yet (we're only using slash commands).
3. OAuth2 → URL Generator → scopes: `bot`, `applications.commands` →
   permissions: `Send Messages`, `Use Slash Commands`, `Connect`,
   `Speak` → open the generated URL, invite it to your test server.
4. `cp .env.example .env` and fill in the three values (token, client id,
   your test server's ID — right-click the server icon with Developer Mode
   on).

## Run it

```bash
docker compose build
docker compose run --rm teno npm run clear-global   # one-time cleanup, see below
docker compose run --rm teno npm run register        # registers all commands
docker compose up
```

**About `clear-global`:** if an earlier bot iteration ever registered
commands *globally* (via `applicationCommands` instead of
`applicationGuildCommands`), those persist independently of anything
`register-commands.ts` does — Discord can end up with a stale global
`/play` and your current guild-scoped `/play` both existing, and the
client isn't always predictable about which one it sends. `clear-global`
wipes every global command for this application so only the guild
commands you actually control remain. You only need to run this once,
or again if you ever suspect a stale global command has crept back in.

You should see `Teno is online as <botname>` then `Lavalink node "main"
connected` in the logs. If you only see the first line, Lavalink isn't
reachable yet — check `docker compose logs lavalink` for its own startup
errors before assuming your bot code is wrong.

Try in Discord: join a voice channel, then `/play <song name>`, `/skip`,
`/stop`. If a slash command's fields look wrong or out of date after a
re-register, fully reload the Discord client (Cmd+R desktop, hard
refresh in browser) — it caches command schemas locally.

**One-time step for the LLM brain:** Ollama's image ships with no model
built in — pull one after the containers are up:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

`llama3.2:3b` is a reasonable balance of speed and quality for a Mac.
If it feels slow, `llama3.2:1b` is faster but less sharp at understanding
what you meant; either way, whatever you pull must match `OLLAMA_MODEL`
in your `.env`.

Add these three lines to `.env`:

```
OLLAMA_HOST=ollama
OLLAMA_PORT=11434
OLLAMA_MODEL=llama3.2:3b
```

For voice listening: join a voice channel (with no music playing),
`/listen`, say something, `/stoplisten`. You should see the transcript,
then Teno's LLM-generated reply, and if it understood a play/skip/stop
request it'll actually act on it — including loosely-phrased requests
("can you skip this") or corrected garbled song names, not just exact
keyword matches.

## Next step

Real wake-word detection (saying "Teno" instead of running `/listen`
manually) — this is where a proper wake-word model (Porcupine or
openWakeWord) plugs in on top of the same voice-capture pipeline.
