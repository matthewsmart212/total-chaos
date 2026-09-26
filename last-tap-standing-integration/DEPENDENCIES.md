# Dependencies and compatibility

Do not copy the preview app's package.json over your app. Reuse your installed
React, React Native and Expo versions. Ask Expo for compatible package versions:

```sh
npx expo install expo-linear-gradient expo-font
```

The module directly uses `react`, `react-native`, `expo-linear-gradient` and
`expo-font` (the supplied wrapper). Expo web also needs its normal `react-dom`,
`react-native-web` and Metro runtime setup. No new backend or paid service is needed.
The Lilita One font is bundled; the Google Fonts package is not required.

The source preview used Expo `~57.0.19`, React `19.2.3`, React Native `0.86.3`,
expo-linear-gradient `~57.0.1` and React Native Web `^0.21.2`. These are provenance,
not instructions to upgrade an existing app wholesale.

TypeScript needs `allowImportingTsExtensions: true` with `noEmit: true` because
the shared model imports another `.ts` model explicitly (also used by Node tests).
Merge these settings into your existing tsconfig instead of replacing it.
The supplied `tsconfig.integration.json` is for checking this folder in an Expo
project; it is not the host app's root configuration.

Compatibility points for Cursor:

- Modern `boxShadow`, flex `gap`, `Array.at()` and `Array.findLastIndex()` are used.
  Older React Native/JS runtimes may need local fallbacks. Keep layout parity.
- Web-only style properties are platform-guarded where appropriate. Review native
  shadow support on your specific RN version. Native device QA is still required.
- Keep the Metro static `require()` asset paths; do not convert them to remote URLs.
- Font family alias is `TotalChaosLilita`. The wrapper loads it; callers mounting
  the raw component must load it themselves before rendering the game.

## Tests

From this folder, with your host dependencies installed:

```sh
node --test scripts/test-beat-panic.mjs scripts/test-last-tap.mjs
node --test scripts/test-last-tap-render.cjs
npx tsc --project tsconfig.integration.json --noEmit
```

Use Node 22.18+ or a compatible modern Node with TypeScript type stripping.
Render tests additionally require `react-dom`, `@babel/core`,
`@babel/plugin-transform-typescript`, `@babel/plugin-transform-react-jsx`, and
`@babel/plugin-transform-modules-commonjs`. These may already be present through
your Expo development tooling. Add missing ones as dev dependencies only.

The render tests verify the component tree, artwork paths, geometry and state
flows using mocked native views. They are not live browser screenshots or native
end-to-end tests.
