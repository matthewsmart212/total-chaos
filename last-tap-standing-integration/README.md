# Beat Panic — integration bundle

Beat Panic is Total Chaos's rhythm-knockout game. Players follow a four-lane
chart, build the lowest timing error they can, and eliminate the weakest
performer after every round until one champion remains.

## Gameplay

- Four directional lanes: left, up, down and right.
- Tap notes, double taps and hold notes with visible trails.
- Longer charts that become denser and less predictable each round.
- One player eliminated per round; surviving players earn 100 points.
- Eliminated players stay involved through Watch Party predictions.
- A longer, harder final chart for the last two players.
- Existing elimination reveals, survivor scoring and crowned winner finale.

Target Hunt, Chaos Snap and the post-elimination practice screen have been
removed. Beat Panic is now the full game rather than one mode in a rotation.

## Main files

| Path | Purpose |
| --- | --- |
| `LastTapStandingScreen.tsx` | Font loading and available-screen wrapper |
| `LastTapStandingGame.tsx` | Knockout flow, predictions, results and finale |
| `src/BeatPanic.tsx` | Four-lane playable rhythm chart |
| `src/beatPanicModel.ts` | Deterministic chart generation and timing scoring |
| `src/lastTapModel.ts` | Players, elimination, rivals and points |
| `src/beatAudio.ts` | Web percussion scheduled to the active chart |

The older internal `LastTapStanding*` filenames and route key remain for
integration compatibility; all player-facing branding says Beat Panic.

## Local preview limits

- Opponents are simulated locally; multiplayer transport is not included.
- `onFinish()` and `onExit()` are navigation callbacks without a score payload.
- Synthesized Beat Panic percussion is web-only. Native builds need an
  Expo-compatible audio implementation, but chart timing does not depend on it.
- Gameplay is designed for portrait mobile layouts.

## Quick mount

```tsx
import {LastTapStandingScreen} from './last-tap-standing-integration';

<LastTapStandingScreen
  playerId="snicker"
  playerName="Player"
  soundOn
  onExit={() => navigateToLobby()}
  onFinish={() => navigateToNextGame()}
/>
```
