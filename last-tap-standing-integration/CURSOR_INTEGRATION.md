# Cursor integration instructions

## 1. Inspect the host first

Find the app entry point, navigation/spinner flow, selected character and username,
safe-area container, audio preferences, scoreboard and Expo SDK. Integrate this as
one feature module. Preserve all other app functionality and the existing lockfile.
Do not merge the preview app's shell into the host or replace the host's versions.

## 2. Register the screen

Import `LastTapStandingScreen` from this folder. Mount in an existing flex:1
safe-area content container. Hide unnecessary navigation chrome during gameplay.
The wrapper measures its actual content area, loads the bundled font and renders
the game. It does not provide another SafeAreaProvider or NavigationContainer.

Pass `playerName` and a supported `playerId`:
`grumble`, `gloop`, `brrr`, `peepers`, `dozy`, `bop`, `snicker`, `scraps`.
Map your host's character identifier explicitly; do not pass arbitrary account IDs.
Map `onExit` to the lobby/back action and `onFinish` to the main-app continuation.
These callbacks currently have no arguments. A new mount resets game state.

If you already handle fonts and dimensions, mount the default export of
`LastTapStandingGame.tsx` directly with `viewportWidth`, `viewportHeight`,
`playerId`, `playerName`, `soundOn`, `onExit` and `onFinish`.
`initialPhase` is an optional development aid, not a restored multiplayer session.

## 3. Preserve mechanics and current presentation

Keep the three modes, selected order, 20-second Beat Panic chart, lane-specific
input, early/late absolute timing error, miss (+500 ms) and extra/wrong (+350 ms)
penalties. Lowest timing error is best. Preserve last-place tie replays and the
single-settlement survival points. Keep the final reveal before the points recap.
Retain native-view arrows, the expanded card pile, cropped assets and per-monster
crown anchors. Do not substitute full-screen mockups for interactive elements.

Keep temporary player-count and order controls while testing. The development
user needs to start Beat Panic first without playing through other modes.

## 4. Main-app scoring seam (not implemented by this bundle)

The preview only routes on completion. Do not treat `onFinish` as if it already
returns scores. If the host needs totals, add a typed result callback at this seam
using existing `lastTapScoreRows` and the settled players/bonus values:

- Inspect `FinaleReveal`, `onSettled`, `eliminatePlayer`, `bonusPoints`, and
  `lastTapScoreRows` before changing the callback signature.
- The final survival award must be settled exactly once before exporting totals.
  Avoid adding the final 100 points twice or reading stale state after setState.
- Include a host-provided session ID and use it to prevent duplicate credits.
- Separate per-game earned points from existing overall app totals.
- Only the local user's predictions are recorded in this demo; do not manufacture
  prediction bonuses for simulated opponents.
- Returning to the lobby or restarting must not credit an unfinished game.

Do not pretend this small navigation integration also implements multiplayer.
Real multiplayer needs stable player IDs separate from character IDs, one shared
round chart/sequence, synchronized phases, per-device inputs, disconnection rules,
and an authoritative result/settlement path.

## 5. Audio

`src/sounds.ts` provides click and elimination-whoosh effects; map it to your app's existing
sound/mute handling if available. `src/beatAudio.ts` schedules percussion in Web
Audio. It is a no-op on native. Keep the existing user-gesture unlock for Safari.
Implement native audio separately with the host's supported audio service, keeping
note timing and cleanup synchronized. No audio downloads or external API keys are
required for the web version.

## 6. Verify and report

Check every local import and required asset. Run typecheck and supplied tests.
Test a two-player game, an eight-player game, each mode first, a missed round,
wrong-side taps, a tie/rematch, spectator predictions, final points, exit/restart,
background/resume, sound off and reduced motion. Check narrow phones and all eight
crowns. Verify that your app's existing games/lobby still work.

Report what was connected, any host compatibility changes, and what remains for
real multiplayer, native audio or app-wide scoring. Do not claim native verification
without running a native build on a device/simulator.
