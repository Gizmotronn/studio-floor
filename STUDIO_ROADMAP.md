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
- **Carla voice / Morning:** Morning already has a local Carla renderer at `~/Documents/NotOnce/Morning/render_carla_voiceover.sh` and a local voice server. Studio should integrate through a small export/import contract (team report JSON + generated episode segment), not call the renderer on every app event.

