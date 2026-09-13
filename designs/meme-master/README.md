# Meme Master — blue redesign

These eight supplied portraits are the design references, not UI backgrounds.
The app uses the individual cutouts in `assets/meme-master-blue`, produced by
`scripts/extract_meme_blue.py`. Only the clean, text-free background was
reconstructed with image generation. Foreground artwork preserves its aspect
ratio; the backdrop alone fills the complete viewport.

The eight game phases are intro, rules, compose, locked, judge, vote, winner,
and scores. The old orange transitions are no longer in the flow. The spinner
enters the new intro; Next Round returns to the existing party progression.

Dynamic content is native React Native UI: captions (140 characters), avatar
selection, player names, ready states, countdowns, two distinct votes, authors,
voters, points, rankings, and movement. Images never sit over the caption input.
The image icon cycles the four extracted meme scenes. Input remains at least
16 CSS pixels on web to avoid Safari focus zoom. Keyboard entry can scroll;
normal gameplay is sized to the current viewport.

This remains a local demo party with seven simulated peers, not online rooms.
The selected player name and monster now carry into Meme Master. Each voter
has two votes, cannot vote twice for a meme, and cannot vote for themselves.
Every vote gives its author 50 points; winners receive a 100-point bonus (each
tied winner also receives it). Scores and voter portraits are computed from
the same ballots; the reference's example numbers are not baked in.

Pacing: rules wait for the player; writing 60s; locked 9s; judging 15s; voting
60s; winner 12s; scores 12s. Explicit buttons may advance earlier. Timers pause
in the options dialog and when the app/tab is not active. A missed caption
stays on the same waiting page and still allows voting.

Validation: `npm run typecheck`, `npm test`, `npm run build`. Model tests cover
all eight player identities, empty and long captions, invalid votes, ties,
score conservation and phone/desktop design bounds.
