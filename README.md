# Studio Floor

Studio Floor is a local-first desktop workspace for coordinating the coding agents you already use. It
runs real terminal CLIs in their own sessions, gives them memory and a shared task space, and visualises
their work on a friendly pixel-art floor.

## Included in this fork

- Studio Floor application name, package identity, deep-link scheme, and installer names.
- A custom original pixel-art application icon for macOS, Windows, Linux, and the running app.
- A neutral starter roster and generic studio dialogue.
- A private custom-avatar intake workflow ready for approved headshots and bespoke pixel sprites.

## Run locally

This checkout currently needs Node 20 because the pinned native SQLite dependency does not compile under
Node 26.

```bash
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm ci
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run dev
```

You need at least one supported coding-agent CLI on your `PATH`, such as `codex` or `claude`.

## Custom avatars

See [AVATAR_CUSTOMIZATION.md](./AVATAR_CUSTOMIZATION.md). Keep personal reference photos in
`src/renderer/src/assets/custom-avatars/source/`; this location is excluded from Git by default.

Final, approved sprites can then replace the temporary starter roster as one cohesive change.
