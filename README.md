# Total Chaos

A universal party-game app prototype built with Expo and React Native. The same TypeScript source runs on iOS, Android, and the web.

## Included flow

- Host or join a game
- Choose a game mode
- Enter a room code and player name
- Select one of eight monster characters
- View the shared lobby and mock players
- Spin a horizontal carousel of game posters
- See round intro, winner, standings, progression, and final podium screens

The multiplayer data and mini-games are intentionally simulated in this first visual prototype. They are ready to be replaced by a real room service and individual game modules.

## Run locally

```bash
npm install
npm run web
```

For device development, use `npm run ios` or `npm run android` with the appropriate simulator or Expo-compatible device setup.

## Validate

```bash
npm run typecheck
npm run build:web
```
