# Studio roadmap

This fork is now branded **Studio**. The current build keeps the existing local-first Electron/React renderer while making the high-value interaction surfaces easier to use.

## Delivered in this pass

- Product/window/splash branding changed to Studio.
- New high-contrast coral tile + cream S icon wired into the renderer and macOS package resources.
- Default context sidebar widened from 420px to 520px; conversation messages now show a larger readable excerpt before expansion.
- Kanban board can open in a dedicated full-size `Studio — Kanban` window from Command Center.
- Carla, Nick, and Engineer use the custom walking sheets for floor animation and portraits.

## Findings and next slices

- **Swift:** a rewrite is unlikely to make the current workload faster by itself. The expensive work is PTY/CLI process I/O, model latency, and Pixi/Chromium rendering. A Swift shell could reduce idle memory, but it would require replacing the React renderer, preload bridge, and native PTY/integration surface. Keep Electron for now and measure memory/CPU before considering a native renderer.
- **Linear:** the integration registry already includes a Linear GraphQL template. The next safe slice is a read-only “Import from Linear” action that maps selected issues into `tasks.json` with source links and deduplication.
- **Codex:** Codex is already represented as a first-class provider in the provider catalog and spawn path. Remaining work is UI parity and a packaged end-to-end smoke test on the installed CLI.
- **Roleplay:** standup scheduling and cafeteria/watercooler line infrastructure already exist. The next slice should add explicit “Start standup” and “Watercooler” actions that produce bounded, opt-in messages rather than background chatter.
- **Carla voice / Morning:** Morning has a local Carla renderer at `~/Documents/NotOnce/Morning/render_carla_voiceover.sh` and a local voice server. Studio uses the server for completed Carla turns and keeps generated WAV segments under the hive voice directory.

## Carla voice integration (delivered)

- `src/main/carlaVoice.ts` bridges to Morning's local Chatterbox server (`http://127.0.0.1:8765`). `ensureCarlaVoiceWarm()` checks `/health`, spawns `start_server.sh` (turbo model, Carla's reference wav preloaded) if it's down, and polls until ready (~60s ceiling; measured cold start is ~15-20s once the turbo weights are cached locally).
- `writeFleetSnapshot()` in `index.ts` (the existing ~8s fleet beat) now calls `ensureCarlaVoiceWarm()` whenever a non-archived agent named `Carla` shows `lastActiveSecAgo <= 30`. Registry ids are per-spawn (`carla-<rand>`), so this matches on `name`, not `id`. This hides the cold-start latency behind her actual working time instead of eating it on the first spoken line.
- New IPC: `carla:speak(text)` → `window.cth.carlaSpeak(text)`. Renders one line via the warm server, plays it through the Mac speaker, and writes it to `<hiveRoot>/voice/carla/<ts>.wav`; returns `{ ok, outputPath }`. Carla's completed Claude turns now take this same render-and-play path automatically; duplicate hook deliveries are deduplicated by transcript record id.
- New config: `carlaVoiceEnabled` (default on) and `morningVoiceRoot` (default `~/Documents/NotOnce/Morning`) in `HarnessConfig`, matching the `freeflowEnabled` / `realtimeVoiceEnabled` pattern.
- **Benchmarked on the M4 Pro (2026-08-27) — do not re-attempt these without new evidence:** CPU + turbo is already ~real-time (RTF ~1.0-1.1). MPS measured *slower* (RTF ~1.46) — matches the existing README warning about Metal aborts, so `auto` device selection staying on CPU for macOS is correct as-is. Multi-process parallel synthesis (3 workers × 4 threads) was measured much worse (RTF ~8), almost certainly memory-bandwidth contention between duplicate model copies — do not add worker-pool parallelism for batch rendering.
- **Not yet built:** a live speech-to-speech loop for Carla (à la Realtime Michael's OpenAI `gpt-realtime-2` path). Carla's voice is a local clone, not something OpenAI's realtime model can produce, so wiring her into a live conversational loop needs a different design (local STT + LLM turn + local TTS, chained manually) rather than reusing `realtime.ts`. Worth a dedicated pass once Andrew/Mike voices are scoped, since all three would share that same non-OpenAI pipeline.
