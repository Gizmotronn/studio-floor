/**
 * Carla voice — bridge to Morning's local Chatterbox voice server.
 *
 * Morning (~/Documents/NotOnce/Morning) hosts a local zero-shot voice-cloning
 * TTS server (`scripts/local_voice/server.py`, Chatterbox turbo) that renders
 * Carla's cloned voice. Cold start is ~15-20s (model load + reference-wav
 * conditioning), which is fine for a batch render but far too slow to eat on
 * the first line of a live reply. So instead of starting the server lazily on
 * the first `carla:speak`, `index.ts`'s fleet-snapshot beat (~8s cadence)
 * calls `ensureCarlaVoiceWarm()` whenever Carla's hive agent shows recent
 * activity — by the time she actually has something to say, the server is
 * already up and the reference is already preloaded.
 *
 * Benchmarked on an M4 Pro (2026-08-27): CPU + turbo model synthesizes at
 * roughly real-time (RTF ~1.0-1.1). MPS was measured SLOWER (RTF ~1.46) and
 * multi-process parallelism was measured much slower still (RTF ~8, likely
 * memory-bandwidth contention between duplicate model copies) — so this
 * intentionally runs one CPU-backed server instance and does not attempt
 * either.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, fstatSync, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VOICE_PORT = 8765;
const HEALTH_URL = `http://127.0.0.1:${VOICE_PORT}/health`;
const SYNTHESIZE_URL = `http://127.0.0.1:${VOICE_PORT}/synthesize`;
const REWARM_COOLDOWN_MS = 5_000;
const READY_POLL_MS = 2_000;
const READY_POLL_ATTEMPTS = 30; // ~60s ceiling — comfortably above the ~20s cold start
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;

function defaultMorningRoot(): string {
  return join(homedir(), 'Documents', 'NotOnce', 'Morning');
}

function carlaReferencePath(morningRoot: string): string {
  return join(morningRoot, 'Resources/VoiceReferences/CarlaOstmann/carla-ostmann-long-accent-reference.wav');
}

let serverChild: ChildProcess | null = null;
let weSpawnedIt = false;
let warmPromise: Promise<boolean> | null = null;
let lastAttemptAt = 0;
let speechQueue: Promise<void> = Promise.resolve();

export interface CarlaTranscriptResponse {
  text: string;
  /** Stable transcript record identity, used to avoid speaking duplicate Stop hooks. */
  key: string;
}

function textFromAssistantRecord(record: unknown): string {
  if (!record || typeof record !== 'object') return '';
  const message = (record as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is { type?: unknown; text?: unknown } => !!block && typeof block === 'object')
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim();
}

/** Extract the newest textual assistant record from a Claude JSONL transcript.
 *  Kept pure so the turn-selection rule can be tested without Electron or the
 *  local voice model. The transcript's `uuid` is preferred because repeated
 *  identical responses still need to be spoken when they are new turns. */
export function latestAssistantResponseFromTranscript(transcript: string): CarlaTranscriptResponse | null {
  let latest: CarlaTranscriptResponse | null = null;
  const lines = transcript.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    let record: { type?: unknown; uuid?: unknown; message?: unknown };
    try { record = JSON.parse(line) as typeof record; } catch { continue; }
    // A Stop hook can follow a user turn that produced no textual answer (for
    // example a command or a cleared prompt). Reset here so an older response
    // from the same long-lived transcript is never repeated as new speech.
    if (record.type === 'user') {
      latest = null;
      continue;
    }
    if (record.type !== 'assistant') continue;
    const text = textFromAssistantRecord(record);
    if (!text) continue;
    const id = typeof record.uuid === 'string' && record.uuid
      ? record.uuid
      : typeof (record.message as { id?: unknown } | undefined)?.id === 'string'
        ? (record.message as { id: string }).id
        : `line-${index}`;
    latest = { text, key: id };
  }
  return latest;
}

/** Read only the tail of a transcript: Stop fires after the response is written,
 *  and this avoids loading a multi-megabyte long-lived session into main memory. */
export function readLatestAssistantResponse(transcriptPath: string): CarlaTranscriptResponse | null {
  try {
    const fd = openSync(transcriptPath, 'r');
    try {
      const size = fstatSync(fd).size;
      const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
      if (length <= 0) return null;
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, size - length);
      // A tail can begin halfway through a JSONL record. The parser naturally
      // skips that first malformed line and evaluates all complete records after it.
      return latestAssistantResponseFromTranscript(buffer.toString('utf8'));
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    console.warn('[carla-voice] could not read transcript:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function isHealthy(timeoutMs = 1_500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(HEALTH_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function spawnServer(morningRoot: string): boolean {
  if (serverChild) return true;
  const startScript = join(morningRoot, 'scripts/local_voice/start_server.sh');
  if (!existsSync(startScript)) {
    console.warn(`[carla-voice] start script not found at ${startScript}`);
    return false;
  }
  const child = spawn('/bin/zsh', [startScript], {
    cwd: morningRoot,
    env: {
      ...process.env,
      MORNING_VOICE_MODEL: 'turbo',
      MORNING_VOICE_MAX_CHARS: '650',
      MORNING_VOICE_REFERENCE: carlaReferencePath(morningRoot)
    },
    stdio: 'ignore'
  });
  child.on('exit', () => {
    if (serverChild === child) { serverChild = null; weSpawnedIt = false; }
  });
  child.on('error', (err) => {
    console.error('[carla-voice] failed to spawn voice server:', err);
    if (serverChild === child) { serverChild = null; weSpawnedIt = false; }
  });
  serverChild = child;
  weSpawnedIt = true;
  return true;
}

/**
 * Ensure the local voice server is up and Carla's reference is preloaded.
 * Cheap and safe to call often (e.g. every fleet-snapshot beat) — no-ops if
 * already healthy or already warming, and debounced against spawn storms.
 * Fire-and-forget: callers on the hot path (the fleet beat) should not await
 * this; `speak()` below awaits it internally when synthesis actually happens.
 */
export function ensureCarlaVoiceWarm(morningRoot: string = defaultMorningRoot()): Promise<boolean> {
  const now = Date.now();
  if (warmPromise) return warmPromise;
  if (now - lastAttemptAt < REWARM_COOLDOWN_MS) return Promise.resolve(false);
  lastAttemptAt = now;

  warmPromise = (async () => {
    if (await isHealthy()) return true;
    if (!spawnServer(morningRoot)) return false;
    for (let i = 0; i < READY_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
      if (await isHealthy()) return true;
    }
    console.warn('[carla-voice] server did not become healthy within the wait window');
    return false;
  })();
  warmPromise.finally(() => { warmPromise = null; });
  return warmPromise;
}

/** Only stop the server if THIS process started it — never kill a voice
 *  server the user is running by hand for something else (e.g. `render_carla_fast.sh`). */
export function stopCarlaVoiceServerIfOwned(): void {
  if (serverChild && weSpawnedIt) {
    try { serverChild.kill(); } catch { /* noop */ }
  }
  serverChild = null;
  weSpawnedIt = false;
}

export interface CarlaSpeakResult {
  ok: boolean;
  outputPath?: string;
  error?: string;
}

/** Render one line of text in Carla's voice. Waits for the server to be warm
 *  first (a no-op if the fleet beat already got there), then synthesizes. */
export async function speak(
  text: string,
  outputPath: string,
  morningRoot: string = defaultMorningRoot()
): Promise<CarlaSpeakResult> {
  const warm = await ensureCarlaVoiceWarm(morningRoot);
  if (!warm) return { ok: false, error: 'voice server not available' };

  try {
    const res = await fetch(SYNTHESIZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        reference_audio_path: carlaReferencePath(morningRoot),
        output_path: outputPath
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `synthesize failed: ${res.status} ${body}`.trim() };
    }
    const data = (await res.json()) as { output_path?: string };
    return { ok: true, outputPath: data.output_path ?? outputPath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function playbackCommand(): { command: string; args: (path: string) => string[] } | null {
  if (process.platform === 'darwin') return { command: 'afplay', args: (path) => [path] };
  if (process.platform === 'linux') return { command: 'aplay', args: (path) => [path] };
  return null;
}

/** Play one rendered Carla response and wait for it to finish. Playback is
 *  intentionally main-side so a response is audible even when no Carla panel
 *  is mounted in the renderer. */
export function playAudio(outputPath: string): Promise<{ ok: boolean; error?: string }> {
  const player = playbackCommand();
  if (!player) return Promise.resolve({ ok: false, error: `audio playback is unsupported on ${process.platform}` });
  return new Promise((resolveResult) => {
    let settled = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      resolveResult(result);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(player.command, player.args(outputPath), { stdio: 'ignore' });
    } catch (err) {
      finish({ ok: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }
    child.once('error', (err) => finish({ ok: false, error: err.message }));
    child.once('exit', (code, signal) => finish(code === 0
      ? { ok: true }
      : { ok: false, error: `audio player exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}` }));
  });
}

/** Serialize synthesis and playback. The local server itself serializes model
 * work, but keeping the whole render→play unit queued prevents two Carla lines
 * from being synthesized in one order and heard in another. */
export function queueSpeech(
  text: string,
  outputPath: string,
  morningRoot: string = defaultMorningRoot()
): Promise<CarlaSpeakResult> {
  const task = speechQueue.then(async () => {
    const rendered = await speak(text, outputPath, morningRoot);
    if (!rendered.ok || !rendered.outputPath) return rendered;
    const played = await playAudio(rendered.outputPath);
    if (!played.ok) return { ...rendered, ok: false, error: played.error };
    return rendered;
  });
  speechQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function isWarming(): boolean {
  return warmPromise !== null;
}
