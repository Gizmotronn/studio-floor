# Custom avatar handoff

This fork is prepared for a future custom roster. No custom likenesses or source photos are included yet,
and the existing Office-themed characters still render exactly as upstream does.

## Intake area

- Put private reference photos in `src/renderer/src/assets/custom-avatars/source/` only while they are
  being worked on. That directory is ignored by Git, so a photo cannot be committed accidentally.
- Use `src/renderer/src/assets/custom-avatars/roster.example.json` as the starting point for the roster
  once people, display names, and avatar IDs are chosen. Copy it to `roster.json`; the real roster is
  also ignored by Git until it contains only information you want to publish.
- Keep generated, final pixel-avatar artwork separate from the photos. Final artwork may be committed
  after its owner has approved it.

## Current avatar architecture

The app uses procedural pixel art rather than an image-per-character sprite folder.

| Responsibility | Current location | Custom-roster change later |
| --- | --- | --- |
| Avatar IDs, labels, accent colours, picker roster | `src/renderer/src/scene/office/cast.ts` | Replace the Office IDs and metadata with the approved custom roster. |
| Portrait and walking-frame recipes | `src/renderer/src/scene/office/portraitArt.ts` | Add a recipe for each custom avatar, or replace the procedural composer with generated sprite-sheet frames. |
| Avatar selection in the UI | `src/renderer/src/components/AddAgentModal.tsx`, `src/renderer/src/components/EditAgentModal.tsx` | These consume the cast roster; they update once the roster changes. |
| Name-to-avatar fallback | `src/renderer/src/hooks/useHive.ts` | Preserve explicit avatar IDs; remove the show-character name inference. |
| Show-specific social text | `src/renderer/src/scene/office/cafeteriaLines.ts` | Replace with neutral workplace lines or remove the keyed dialogue. |

The floor map and licensed LimeZu furniture tiles are independent of the character portraits. They do not
need to be replaced to change the people on the floor.

## Future sprite brief

The renderer currently paints 18x28 portraits and 18x32 in-floor characters. A custom avatar should
provide a front and back pose plus stand, left-step, and right-step frames. Keep the result pixelated and
readable at the small in-app size; headshot likeness is a reference, not an asset to display directly.

Before making the switch, decide:

1. The public display name and stable lowercase avatar ID for each person.
2. Whether each final sprite may be committed to the repository.
3. The preferred clothing, hairstyle, glasses/facial-hair details, and accent colour.
4. Whether to keep the existing office map or create a new studio/workplace setting.

Once reference images are supplied, the next implementation can create the custom pixel avatars, wire the
approved roster into the picker, and remove the Office-specific fallbacks as one coherent change.
