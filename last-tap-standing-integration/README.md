# Last Tap Standing — integration bundle

This is the latest Last Tap Standing mini-game from the Total Chaos web preview,
including the screen cleanup and fitted crowns published on 26 September 2026.
Source commit: `e89d578ce4214cd78f324fe4cf2b39816e87af97`.

## Start here

1. Copy this entire `last-tap-standing` folder into your existing project, for
   example `src/features/last-tap-standing/`. Preserve the internal paths.
2. Open `CURSOR_INTEGRATION.md` in Cursor. Give Cursor the prompt below.
3. Let Cursor inspect your existing app and connect this module to its navigation.
   Do not replace your app root, package.json, assets, or other mini-games.

**Prompt to paste into Cursor:**

> Integrate the module in src/features/last-tap-standing into my existing Total
> Chaos app. First read its README.md, CURSOR_INTEGRATION.md and DEPENDENCIES.md,
> then inspect my current Expo/React Native versions, navigation, safe-area layout,
> player identity, fonts, audio and game scoring. Preserve my existing app and
> dependencies; make focused changes. Use LastTapStandingScreen as the entry point,
> wire onExit to my lobby and onFinish to the next game/app screen, and map my
> selected monster ID and username. Keep the exact artwork, screen flow, animation
> timing, 20-second two-lane Beat Panic and existing test controls. This bundle is
> a local demo with simulated rivals, not multiplayer. Do not invent a scores
> payload: onFinish currently has no arguments. If main-app score integration is
> needed, expose and settle the real final totals once as described in the guide.
> Verify the copied module's imports/assets, typecheck and run the supplied tests.
> Report native audio or compatibility work separately from completed web work.

## Included

| Path | Purpose |
| --- | --- |
| `LastTapStandingScreen.tsx` | New integration wrapper: fonts and available screen size |
| `LastTapStandingGame.tsx` | Complete mini-game flow, rules, predictions, results and crown reveal |
| `src/BeatPanic.tsx` | Two lanes, thumb controls, arrows and hit effects |
| `src/beatPanicModel.ts` | 20-second, 28-beat chart and timing-error scoring |
| `src/lastTapModel.ts` | Target Hunt, Chaos Snap, elimination, demo players and points |
| `src/lastTapPresentation.ts` | Reveal pacing and text |
| `src/gameMotion.tsx` | Shared animation clock used by this game |
| `src/brand.ts`, `src/sounds.ts`, `src/beatAudio.ts` | Local font and web audio helpers |
| `src/monsterTypes.ts` | Eight supported character IDs |
| `assets/` | All referenced artwork, the font, click sound and elimination whoosh |
| `scripts/` | Gameplay and render regression tests |
| `DEPENDENCIES.md` | Compatibility and install guidance |
| `MANIFEST.json` | Source provenance, export adaptations and file checksums |

This is an importable module, not a standalone Expo application. It deliberately
does not include your old app, node_modules, a lockfile, hosting configuration,
credentials, generated web bundles or unrelated Meme Master/Spinner screens.

## What already works

- Target Hunt, Chaos Snap and Beat Panic in selectable repeating order.
- Temporary pretend-player count and game-order controls on the welcome screen.
- Spectator predictions, survival points and local bonus points.
- Final showdown, winner crown, animated points recap and exit flow.
- Larger arrows, Perfect/Nice/Missed feedback and reduced-motion alternatives.
- Font loading wrapper and image preloading inside the game.

## Current limits

- Opponents are simulated locally. No lobby sync, network transport or authoritative
  multiplayer scoring is included. Character IDs currently double as player IDs.
- `onFinish()` and `onExit()` are navigation callbacks with no result argument.
  Scores shown in the mini-game are not automatically credited to your app.
- Click audio and synthesized Beat Panic percussion are web-only. Native builds
  need your audio service or an Expo-compatible native audio adapter. The arrows
  and scoring do not depend on sound.
- `soundOn` controls Beat Panic percussion; the existing click helper has no global
  mute binding. Connect that helper to your app's audio settings if required.
- Source was developed against Expo SDK 57 / React Native 0.86.3. Older versions
  may need style and API compatibility adjustments; see DEPENDENCIES.md.
- Gameplay is intended for portrait mobile layouts. Validate iOS/Android on-device
  after integrating; automated tests do not replace that check.

## Quick mount

```tsx
import {LastTapStandingScreen} from './src/features/last-tap-standing';

// Render inside a flex:1 container that already accounts for safe areas.
<LastTapStandingScreen
  playerId="snicker"
  playerName="Matthias"
  soundOn={true}
  onExit={() => navigateToLobby()}
  onFinish={() => navigateToNextGame()}
/>
```

The navigation functions above are placeholders: replace them with your existing
router/navigation actions. Pass a new React `key` for a fresh session if your
navigation keeps the screen mounted between games.
