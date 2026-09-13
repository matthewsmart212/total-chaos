import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/lilita-one';
import React, { ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MemeTeleport } from './src/gameMotion';
import { haptic, type HapticCue } from './src/haptics';
import { MonsterId, MONSTER_IDS } from './src/memeMasterModel';
import { BODY_FONT, DISPLAY_FONT, DISPLAY_FONT_CSS, DISPLAY_FONT_NAME, DISPLAY_FONT_SOURCE, loadWebDisplayFont, TOTAL_CHAOS_LOGO } from './src/brand';
import { playNarration, playSound, preloadSound, stopAllNarration, stopAllSounds, stopSound, setSoundtrackWanted, playSoundtrack, pauseSoundtrack, playMemeMasterMusic, setMemeMasterMusicWanted } from './src/sounds';
import { assetUri } from './src/assetUri';

const MemeMasterGame = React.lazy(() => import('./MemeMasterGame'));

type Screen =
  | 'home'
  | 'mode'
  | 'join'
  | 'character'
  | 'hostLobby'
  | 'playerLobby'
  | 'spinner'
  | 'round'
  | 'memeMaster'
  | 'winner'
  | 'standings'
  | 'progress'
  | 'podium';

type FlowScreen = Exclude<Screen, 'home' | 'mode' | 'join' | 'character' | 'spinner' | 'memeMaster'>;

type GameMode = 'quick' | 'full' | 'custom';

type DesignPlate = {
  width: number;
  height: number;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ArtPressableProps = {
  accessibilityLabel: string;
  box: Box;
  children?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  scale: number;
  selected?: boolean;
  showSelectionRing?: boolean;
  source: ImageSourcePropType;
  sound?: boolean;
  hapticCue?: HapticCue | false;
};

type FlowLayer = {
  box: Box;
  source: ImageSourcePropType;
};

type FlowAction = FlowLayer & {
  label: string;
  next?: Screen;
};

type FlowScreenConfig = {
  actions: FlowAction[];
  height: number;
  layers: FlowLayer[];
  width: number;
};

const DESIGN_WIDTH = 853;
const DESIGN_HEIGHT = 1844;
const JOIN_WIDTH = 875;
const JOIN_HEIGHT = 1798;

const plates: Record<Screen, DesignPlate> = {
  home: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  mode: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  join: { width: JOIN_WIDTH, height: JOIN_HEIGHT },
  character: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  hostLobby: { width: DESIGN_WIDTH, height: 2130 },
  playerLobby: { width: 794, height: 1981 },
  spinner: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  round: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  memeMaster: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  winner: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  standings: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  progress: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  podium: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
};

const homeArt = {
  background: require('./assets/packed/layers/home-background.jpg'),
  host: require('./assets/packed/layers/home-host-button.webp'),
  join: require('./assets/packed/layers/home-join-button.webp'),
  logo: TOTAL_CHAOS_LOGO,
  playerCount: require('./assets/packed/layers/home-player-count.webp'),
  settings: require('./assets/packed/layers/home-settings.webp'),
  sound: require('./assets/packed/layers/home-sound.webp'),
  monster: require('./assets/packed/monsters/grumble.webp'),
};

function getModeArt() {
  return {
  background: require('./assets/packed/layers/mode-background.jpg'),
  back: require('./assets/packed/layers/mode-back.webp'),
  continue: require('./assets/packed/layers/mode-continue-button.webp'),
  custom: require('./assets/packed/layers/mode-custom-card.webp'),
  full: require('./assets/packed/layers/mode-full-card.webp'),
  quick: require('./assets/packed/layers/mode-quick-card.webp'),
  title: require('./assets/packed/layers/mode-title.webp'),
  };
}

function getJoinArt() {
  return {
  back: require('./assets/packed/layers/join-back.webp'),
  background: require('./assets/packed/layers/join-background.jpg'),
  button: require('./assets/packed/layers/join-button.webp'),
  codePanel: require('./assets/packed/layers/join-code-panel.webp'),
  title: require('./assets/packed/layers/join-title.webp'),
  };
}

function getCharacterArt() {
  return {
  back: require('./assets/packed/layers/character-back.webp'),
  background: require('./assets/packed/layers/mode-background.jpg'),
  cards: [
    require('./assets/packed/layers/character-grumble-card.webp'),
    require('./assets/packed/layers/character-gloop-card.webp'),
    require('./assets/packed/layers/character-brrr-card.webp'),
    require('./assets/packed/layers/character-peepers-card.webp'),
    require('./assets/packed/layers/character-dozy-card.webp'),
    require('./assets/packed/layers/character-bop-card.webp'),
    require('./assets/packed/layers/character-snicker-card.webp'),
    require('./assets/packed/layers/character-scraps-card.webp'),
  ],
  namePanel: require('./assets/packed/layers/character-name-panel.webp'),
  picker: require('./assets/packed/layers/character-picker.webp'),
  ready: require('./assets/packed/layers/character-ready-button.webp'),
  selectionBorder: require('./assets/packed/layers/character-selection-border.webp'),
  selectionCheck: require('./assets/packed/layers/character-selection-check.webp'),
  title: require('./assets/packed/layers/character-title.webp'),
  };
}

const MEME_SPINNER_POSTER = require('./assets/packed/meme-master-blue/spinner-card.webp');

type SpinnerPose = 'flat' | 'left' | 'right';
type SpinnerPoses = Record<SpinnerPose, ImageSourcePropType>;

function getSpinnerArt() {
  return {
  button: require('./assets/packed/flow/spinner-button.webp'),
  posters: [
    MEME_SPINNER_POSTER,
    require('./assets/packed/spinner/chaos-tap.webp'),
    require('./assets/packed/spinner/tipsy-doodles.webp'),
  ],
  // Pre-projected cards for native (see scripts/make-spinner-cards.mjs).
  poses: [
    {
      flat: require('./assets/packed/spinner/poses/meme-master-flat.webp'),
      left: require('./assets/packed/spinner/poses/meme-master-left.webp'),
      right: require('./assets/packed/spinner/poses/meme-master-right.webp'),
    },
    {
      flat: require('./assets/packed/spinner/poses/chaos-tap-flat.webp'),
      left: require('./assets/packed/spinner/poses/chaos-tap-left.webp'),
      right: require('./assets/packed/spinner/poses/chaos-tap-right.webp'),
    },
    {
      flat: require('./assets/packed/spinner/poses/tipsy-doodles-flat.webp'),
      left: require('./assets/packed/spinner/poses/tipsy-doodles-left.webp'),
      right: require('./assets/packed/spinner/poses/tipsy-doodles-right.webp'),
    },
  ] as SpinnerPoses[],
  title: require('./assets/packed/flow/spinner-title.webp'),
  };
}

function getFlowScreens(): Record<FlowScreen, FlowScreenConfig> {
  return {
  hostLobby: {
    width: DESIGN_WIDTH,
    height: 2130,
    layers: [
      { box: { x: 180, y: 104, width: 495, height: 166 }, source: require('./assets/packed/flow/host-title.webp') },
      { box: { x: 42, y: 906, width: 770, height: 136 }, source: require('./assets/packed/flow/host-player-1.webp') },
      { box: { x: 42, y: 1044, width: 770, height: 137 }, source: require('./assets/packed/flow/host-player-2.webp') },
      { box: { x: 42, y: 1184, width: 770, height: 137 }, source: require('./assets/packed/flow/host-player-3.webp') },
      { box: { x: 42, y: 1324, width: 770, height: 137 }, source: require('./assets/packed/flow/host-player-4.webp') },
      { box: { x: 42, y: 1463, width: 770, height: 138 }, source: require('./assets/packed/flow/host-player-5.webp') },
      { box: { x: 42, y: 1604, width: 770, height: 139 }, source: require('./assets/packed/flow/host-player-6.webp') },
    ],
    actions: [
      { box: { x: 25, y: 30, width: 110, height: 106 }, source: require('./assets/packed/flow/host-back.webp'), label: 'Back', next: 'character' },
      { box: { x: 711, y: 30, width: 115, height: 107 }, source: require('./assets/packed/flow/host-invite-icon.webp'), label: 'Invite a player' },
      { box: { x: 84, y: 1765, width: 686, height: 175 }, source: require('./assets/packed/flow/host-start.webp'), label: 'Start game', next: 'spinner' },
      { box: { x: 150, y: 1947, width: 553, height: 149 }, source: require('./assets/packed/flow/host-invite.webp'), label: 'Invite players' },
    ],
  },
  playerLobby: {
    width: 794,
    height: 1981,
    layers: [
      { box: { x: 88, y: 106, width: 634, height: 176 }, source: require('./assets/packed/flow/player-title.webp') },
      { box: { x: 222, y: 278, width: 350, height: 466 }, source: homeArt.monster },
      { box: { x: 128, y: 742, width: 538, height: 126 }, source: require('./assets/packed/flow/player-name.webp') },
      { box: { x: 28, y: 892, width: 738, height: 732 }, source: require('./assets/packed/flow/player-wait-panel.webp') },
    ],
    actions: [
      { box: { x: 54, y: 1665, width: 688, height: 237 }, source: require('./assets/packed/flow/player-ready.webp'), label: 'Ready', next: 'spinner' },
    ],
  },
  round: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    layers: [
      { box: { x: 229, y: 94, width: 395, height: 90 }, source: require('./assets/packed/flow/round-pill.webp') },
      { box: { x: 79, y: 185, width: 696, height: 347 }, source: require('./assets/packed/flow/round-title.webp') },
      { box: { x: 42, y: 548, width: 772, height: 1012 }, source: require('./assets/packed/flow/round-hero.webp') },
    ],
    actions: [
      { box: { x: 75, y: 1572, width: 703, height: 193 }, source: require('./assets/packed/flow/round-button.webp'), label: 'Get ready', next: 'memeMaster' },
    ],
  },
  winner: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    layers: [
      { box: { x: 48, y: 118, width: 762, height: 244 }, source: require('./assets/packed/flow/winner-title.webp') },
      { box: { x: 170, y: 338, width: 526, height: 634 }, source: require('./assets/packed/flow/winner-monster.webp') },
      { box: { x: 41, y: 973, width: 773, height: 225 }, source: require('./assets/packed/flow/winner-score.webp') },
      { box: { x: 342, y: 1198, width: 172, height: 76 }, source: require('./assets/packed/flow/winner-votes-title.webp') },
      { box: { x: 27, y: 1283, width: 156, height: 228 }, source: require('./assets/packed/flow/winner-vote-1.webp') },
      { box: { x: 188, y: 1283, width: 157, height: 228 }, source: require('./assets/packed/flow/winner-vote-2.webp') },
      { box: { x: 350, y: 1283, width: 158, height: 228 }, source: require('./assets/packed/flow/winner-vote-3.webp') },
      { box: { x: 512, y: 1283, width: 158, height: 228 }, source: require('./assets/packed/flow/winner-vote-4.webp') },
      { box: { x: 674, y: 1283, width: 157, height: 228 }, source: require('./assets/packed/flow/winner-vote-5.webp') },
    ],
    actions: [
      { box: { x: 44, y: 1547, width: 765, height: 191 }, source: require('./assets/packed/flow/winner-button.webp'), label: 'See standings', next: 'standings' },
    ],
  },
  standings: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    layers: [
      { box: { x: 77, y: 103, width: 702, height: 255 }, source: require('./assets/packed/flow/standings-title.webp') },
      { box: { x: 250, y: 362, width: 356, height: 82 }, source: require('./assets/packed/flow/standings-round.webp') },
      { box: { x: 31, y: 469, width: 790, height: 200 }, source: require('./assets/packed/flow/standings-row-1.webp') },
      { box: { x: 31, y: 686, width: 790, height: 165 }, source: require('./assets/packed/flow/standings-row-2.webp') },
      { box: { x: 31, y: 859, width: 790, height: 168 }, source: require('./assets/packed/flow/standings-row-3.webp') },
      { box: { x: 31, y: 1034, width: 790, height: 162 }, source: require('./assets/packed/flow/standings-row-4.webp') },
      { box: { x: 31, y: 1202, width: 790, height: 163 }, source: require('./assets/packed/flow/standings-row-5.webp') },
      { box: { x: 31, y: 1373, width: 790, height: 162 }, source: require('./assets/packed/flow/standings-row-6.webp') },
    ],
    actions: [
      { box: { x: 78, y: 1571, width: 698, height: 180 }, source: require('./assets/packed/flow/standings-button.webp'), label: 'Continue', next: 'progress' },
    ],
  },
  progress: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    layers: [
      { box: { x: 72, y: 105, width: 731, height: 265 }, source: require('./assets/packed/flow/progress-title.webp') },
      { box: { x: 24, y: 414, width: 805, height: 1118 }, source: require('./assets/packed/flow/progress-track.webp') },
    ],
    actions: [
      { box: { x: 53, y: 1572, width: 750, height: 182 }, source: require('./assets/packed/flow/progress-button.webp'), label: 'Next round', next: 'podium' },
    ],
  },
  podium: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    layers: [
      { box: { x: 87, y: 87, width: 702, height: 343 }, source: require('./assets/packed/flow/podium-title.webp') },
      { box: { x: 24, y: 414, width: 806, height: 992 }, source: require('./assets/packed/flow/podium-results.webp') },
    ],
    actions: [
      { box: { x: 53, y: 1403, width: 750, height: 187 }, source: require('./assets/packed/flow/podium-play.webp'), label: 'Play again', next: 'home' },
      { box: { x: 78, y: 1607, width: 702, height: 130 }, source: require('./assets/packed/flow/podium-share.webp'), label: 'Share results' },
    ],
  },
  };
}

function characterImageSources(): ImageSourcePropType[] {
  const characterArt = getCharacterArt();
  return [
    characterArt.back,
    characterArt.background,
    characterArt.namePanel,
    characterArt.picker,
    characterArt.ready,
    characterArt.selectionBorder,
    characterArt.selectionCheck,
    characterArt.title,
    ...characterArt.cards,
  ];
}

function sourcesForFlowScreens(screens: FlowScreen[]): ImageSourcePropType[] {
  return screens.flatMap((screen) => {
    const config = getFlowScreens()[screen];
    return [
      ...config.layers.map((layer) => layer.source),
      ...config.actions.map((action) => action.source),
    ];
  });
}

let appImageWarmup: Promise<void> | null = null;

async function warmImageGroup(
  sources: ImageSourcePropType[],
  warmedUris: Set<string>,
): Promise<void> {
  const pendingUris = sources
    .map((source) => assetUri(source))
    .filter((uri): uri is string => typeof uri === 'string' && !warmedUris.has(uri));

  pendingUris.forEach((uri) => warmedUris.add(uri));

  let nextIndex = 0;
  const workerCount = Math.min(4, pendingUris.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < pendingUris.length) {
      const uri = pendingUris[nextIndex];
      nextIndex += 1;
      try {
        await Image.prefetch(uri);
      } catch {
        // A failed warm-up must never stop the game. The visible Image will
        // retry normally if the browser or operating system evicts its cache.
      }
    }
  });

  await Promise.all(workers);
}

function preloadUpcomingImages(): Promise<void> {
  if (!appImageWarmup) {
    appImageWarmup = (async () => {
      const warmedUris = new Set<string>();
      await warmImageGroup(Object.values(homeArt), warmedUris);
      await warmImageGroup([
        ...Object.values(getModeArt()),
        ...Object.values(getJoinArt()),
      ], warmedUris);
      await warmImageGroup(characterImageSources(), warmedUris);
    })();
  }

  return appImageWarmup;
}

const characterNames = ['GRUMBLE', 'GLOOP', 'BRRR', 'PEEPERS', 'DOZY', 'BOP', 'SNICKER', 'SCRAPS'];

const characterBoxes: Box[] = [
  { x: 24, y: 661, width: 197, height: 333 },
  { x: 222, y: 661, width: 201, height: 333 },
  { x: 425, y: 661, width: 200, height: 333 },
  { x: 628, y: 661, width: 201, height: 333 },
  { x: 23, y: 1006, width: 198, height: 329 },
  { x: 222, y: 1006, width: 201, height: 329 },
  { x: 425, y: 1006, width: 200, height: 329 },
  { x: 628, y: 1006, width: 201, height: 329 },
];

function layoutBox(box: Box, scale: number): ViewStyle {
  return {
    height: box.height * scale,
    left: box.x * scale,
    position: 'absolute',
    top: box.y * scale,
    width: box.width * scale,
  };
}

function LayerImage({
  box,
  scale,
  source,
  style,
}: {
  box: Box;
  scale: number;
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[layoutBox(box, scale), style]}>
      <Image source={source} resizeMode="stretch" style={styles.fullImage} />
    </View>
  );
}

function ArtPressable({
  accessibilityLabel,
  box,
  children,
  disabled = false,
  onPress,
  scale: layoutScale,
  selected = false,
  showSelectionRing = true,
  source,
  sound = true,
  hapticCue = 'selection',
}: ArtPressableProps) {
  const pressed = useRef(new Animated.Value(0)).current;
  const buttonScale = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, selected ? 0.975 : 0.965],
  });

  const animate = (toValue: number) => {
    Animated.spring(pressed, {
      damping: 15,
      mass: 0.55,
      stiffness: 310,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        layoutBox(box, layoutScale),
        selected && showSelectionRing && styles.selectedArtwork,
        { opacity: disabled ? 0.72 : 1, transform: [{ scale: buttonScale }] },
      ]}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (!disabled) {
            if (sound) playSound('click');
            if (hapticCue) haptic(hapticCue);
            animate(1);
          }
        }}
        onPressOut={() => {
          if (!disabled) {
            animate(0);
          }
        }}
        style={styles.fill}
      >
        <Image source={source} resizeMode="stretch" style={styles.fullImage} />
        {selected && showSelectionRing ? (
          <View pointerEvents="none" style={styles.selectionRing} />
        ) : null}
        {children}
      </Pressable>
    </Animated.View>
  );
}

function HomeScreen({
  go,
  scale,
  setIsHost,
  soundOn,
  onToggleSound,
}: {
  go: (screen: Screen) => void;
  scale: number;
  setIsHost: (isHost: boolean) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return (
    <View style={[styles.fill, styles.layeredScreen]}>
      <Image source={homeArt.background} resizeMode="stretch" fadeDuration={0} style={styles.fullImage} />
      <View
        style={[
          styles.layerFrame,
          { height: DESIGN_HEIGHT * scale, width: DESIGN_WIDTH * scale },
        ]}
      >
        <ArtPressable
          accessibilityLabel={soundOn ? 'Mute sound' : 'Turn sound on'}
          box={{ x: 30, y: 46, width: 122, height: 122 }}
          onPress={onToggleSound}
          scale={scale}
          source={homeArt.sound}
        >
          {!soundOn ? <View pointerEvents="none" style={styles.mutedSlash} /> : null}
        </ArtPressable>

        <ArtPressable
          accessibilityLabel="Settings"
          box={{ x: 702, y: 44, width: 122, height: 122 }}
          onPress={() => undefined}
          scale={scale}
          source={homeArt.settings}
        />

        <LayerImage
          box={{ x: 106, y: 203, width: 641, height: 337 }}
          scale={scale}
          source={homeArt.logo}
        />
        <LayerImage
          box={{ x: 198, y: 558, width: 457, height: 628 }}
          scale={scale}
          source={homeArt.monster}
        />

        <ArtPressable
          accessibilityLabel="Host a game"
          box={{ x: 80, y: 1240, width: 693, height: 179 }}
          hapticCue="light"
          onPress={() => {
            setIsHost(true);
            go('mode');
          }}
          scale={scale}
          source={homeArt.host}
        />
        <ArtPressable
          accessibilityLabel="Join a game"
          box={{ x: 84, y: 1433, width: 686, height: 174 }}
          hapticCue="light"
          onPress={() => {
            setIsHost(false);
            go('join');
          }}
          scale={scale}
          source={homeArt.join}
        />

        <LayerImage
          box={{ x: 237, y: 1650, width: 379, height: 54 }}
          scale={scale}
          source={homeArt.playerCount}
        />
      </View>
    </View>
  );
}

function ModeScreen({ go, scale }: { go: (screen: Screen) => void; scale: number }) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('full');

  return (
    <View style={[styles.fill, styles.layeredScreen]}>
      <Image source={getModeArt().background} resizeMode="stretch" style={styles.fullImage} />
      <View
        style={[
          styles.layerFrame,
          { height: DESIGN_HEIGHT * scale, width: DESIGN_WIDTH * scale },
        ]}
      >
        <ArtPressable
          accessibilityLabel="Back to home"
          box={{ x: 22, y: 72, width: 123, height: 110 }}
          onPress={() => go('home')}
          scale={scale}
          source={getModeArt().back}
        />
        <LayerImage
          box={{ x: 91, y: 194, width: 671, height: 286 }}
          scale={scale}
          source={getModeArt().title}
        />

        <ArtPressable
          accessibilityLabel="Quick Chaos, 10 minutes"
          box={{ x: 39, y: 532, width: 776, height: 331 }}
          onPress={() => setSelectedMode('quick')}
          scale={scale}
          selected={selectedMode === 'quick'}
          source={getModeArt().quick}
        />
        <ArtPressable
          accessibilityLabel="Full Chaos, 25 minutes"
          box={{ x: 34, y: 878, width: 785, height: 324 }}
          onPress={() => setSelectedMode('full')}
          scale={scale}
          selected={selectedMode === 'full'}
          source={getModeArt().full}
        />
        <ArtPressable
          accessibilityLabel="Custom Chaos"
          box={{ x: 40, y: 1215, width: 775, height: 279 }}
          onPress={() => setSelectedMode('custom')}
          scale={scale}
          selected={selectedMode === 'custom'}
          source={getModeArt().custom}
        />
        <ArtPressable
          accessibilityLabel={`Continue with ${selectedMode} chaos`}
          box={{ x: 86, y: 1546, width: 683, height: 181 }}
          onPress={() => go('character')}
          scale={scale}
          source={getModeArt().continue}
        />
      </View>
    </View>
  );
}

function JoinScreen({ go, scale }: { go: (screen: Screen) => void; scale: number }) {
  const [code, setCode] = useState('CH4OS');
  const codeInput = useRef<TextInput>(null);

  const updateCode = (value: string) => {
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
  };

  const pasteCode = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        const clipboardValue = await navigator.clipboard.readText();
        const cleaned = clipboardValue.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        if (cleaned) {
          setCode(cleaned);
          return;
        }
      } catch {
        // Browser clipboard permission can be denied; focusing still lets the
        // player paste from the native keyboard menu.
      }
    }
    codeInput.current?.focus();
  };

  return (
    <View style={[styles.fill, styles.layeredScreen]}>
      <Image source={getJoinArt().background} resizeMode="stretch" style={styles.fullImage} />
      <View
        style={[
          styles.layerFrame,
          { height: JOIN_HEIGHT * scale, width: JOIN_WIDTH * scale },
        ]}
      >
        <ArtPressable
          accessibilityLabel="Back to home"
          box={{ x: 42, y: 78, width: 101, height: 103 }}
          onPress={() => go('home')}
          scale={scale}
          source={getJoinArt().back}
        />
        <LayerImage
          box={{ x: 104, y: 274, width: 671, height: 310 }}
          scale={scale}
          source={getJoinArt().title}
        />
        <LayerImage
          box={{ x: 25, y: 684, width: 825, height: 501 }}
          scale={scale}
          source={getJoinArt().codePanel}
        />

        <Pressable
          accessibilityLabel="Enter room code"
          accessibilityRole="button"
          onPress={() => {haptic('selection');codeInput.current?.focus();}}
          style={[layoutBox({ x: 58, y: 835, width: 759, height: 205 }, scale), styles.codeHitArea]}
        >
          <View style={styles.codeCharacters}>
            {Array.from({ length: 5 }, (_, index) => (
              <View key={index} style={[styles.codeCharacterCell, { width: 141 * scale }]}>
                <Text
                  style={[
                    styles.codeCharacter,
                    { fontSize: 80 * scale, lineHeight: 96 * scale },
                  ]}
                >
                  {code[index] ?? ''}
                </Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={codeInput}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={5}
            onChangeText={updateCode}
            returnKeyType="done"
            style={styles.hiddenInput}
            value={code}
          />
        </Pressable>

        <Pressable
          accessibilityLabel="Paste room code"
          accessibilityRole="button"
          onPress={()=>{haptic('selection');void pasteCode();}}
          style={layoutBox({ x: 295, y: 1090, width: 285, height: 71 }, scale)}
        />

        <ArtPressable
          accessibilityLabel="Join room"
          box={{ x: 116, y: 1288, width: 645, height: 184 }}
          hapticCue="medium"
          onPress={() => go('character')}
          scale={scale}
          source={getJoinArt().button}
        />
      </View>
    </View>
  );
}

function CharacterScreen({
  go,
  isHost,
  scale,
  onReady,
}: {
  go: (screen: Screen) => void;
  isHost: boolean;
  scale: number;
  onReady: (name: string, id: MonsterId) => void;
}) {
  const [name, setName] = useState('MATTHIAS');
  const [selected, setSelected] = useState(0);

  const cycle = (direction: number) => {
    setSelected((current) => (current + direction + characterNames.length) % characterNames.length);
  };

  return (
    <View style={[styles.fill, styles.layeredScreen]}>
      <Image source={getCharacterArt().background} resizeMode="stretch" style={styles.fullImage} />
      <View
        style={[
          styles.layerFrame,
          { height: DESIGN_HEIGHT * scale, width: DESIGN_WIDTH * scale },
        ]}
      >
        <ArtPressable
          accessibilityLabel="Back"
          box={{ x: 31, y: 48, width: 108, height: 102 }}
          onPress={() => go(isHost ? 'mode' : 'join')}
          scale={scale}
          source={getCharacterArt().back}
        />
        <LayerImage
          box={{ x: 47, y: 138, width: 767, height: 282 }}
          scale={scale}
          source={getCharacterArt().title}
        />
        <LayerImage
          box={{ x: 103, y: 448, width: 647, height: 181 }}
          scale={scale}
          source={getCharacterArt().namePanel}
        />
        <TextInput
          accessibilityLabel="Your name"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={14}
          onChangeText={(value) => setName(value.toUpperCase())}
          selectTextOnFocus
          testID="player-name-input"
          style={[
            layoutBox({ x: 127, y: 512, width: 599, height: 104 }, scale),
            styles.nameInput,
            { fontSize: 51 * scale, lineHeight: 62 * scale },
          ]}
          value={name}
        />

        {characterBoxes.map((box, index) => (
          <ArtPressable
            accessibilityLabel={`Choose ${characterNames[index]}`}
            box={box}
            key={characterNames[index]}
            onPress={() => setSelected(index)}
            scale={scale}
            selected={selected === index}
            showSelectionRing={false}
            source={getCharacterArt().cards[index]}
          >
            {selected === index ? (
              <>
                <Image
                  resizeMode="stretch"
                  source={getCharacterArt().selectionBorder}
                  style={styles.fullImage}
                />
                <Image
                  resizeMode="stretch"
                  source={getCharacterArt().selectionCheck}
                  style={{
                    height: 25 * scale,
                    left: 24 * scale + 1,
                    position: 'absolute',
                    top: 28 * scale + 1,
                    width: 30 * scale,
                  }}
                />
              </>
            ) : null}
          </ArtPressable>
        ))}

        <LayerImage
          box={{ x: 29, y: 1366, width: 795, height: 142 }}
          scale={scale}
          source={getCharacterArt().picker}
        />
        <Pressable
          accessibilityLabel="Previous monster"
          accessibilityRole="button"
          onPress={() => {haptic('selection');cycle(-1);}}
          style={layoutBox({ x: 48, y: 1388, width: 89, height: 98 }, scale)}
        />
        <Pressable
          accessibilityLabel="Next monster"
          accessibilityRole="button"
          onPress={() => {haptic('selection');cycle(1);}}
          style={layoutBox({ x: 716, y: 1388, width: 89, height: 98 }, scale)}
        />
        <View
          pointerEvents="none"
          style={[layoutBox({ x: 170, y: 1390, width: 513, height: 96 }, scale), styles.pickerNameWrap]}
        >
          <Text
            testID="selected-monster-name"
            style={[
              styles.pickerNameText,
              { fontSize: 51 * scale, lineHeight: 62 * scale },
            ]}
          >
            {characterNames[selected]}
          </Text>
        </View>

        <ArtPressable
          accessibilityLabel="I'm ready"
          box={{ x: 102, y: 1547, width: 649, height: 182 }}
          onPress={() => { onReady(name, MONSTER_IDS[selected]); go(isHost ? 'hostLobby' : 'playerLobby'); }}
          hapticCue="success"
          scale={scale}
          source={getCharacterArt().ready}
        />
      </View>
    </View>
  );
}

const POSTER_TOP = (DESIGN_HEIGHT - 780) / 2;
const SPINNER_GAP = 48;
const SPINNER_CARD_COUNT = 3;
// Web animates via CSS-equivalent JS updates; native runs the carousel on the
// UI thread. Native never uses perspective/rotate transforms: iOS renders them
// clipped, so the yaw is baked into the pose images and only translate, scale
// and opacity animate.
const SPINNER_NATIVE_DRIVER = Platform.OS !== 'web';
const SPINNER_UNIT = new Animated.Value(1);
// Pose images share one canvas padded by this many design units around the
// 390x780 card so glow and yaw overhang have room.
const SPINNER_POSE_PAD = 55;
// One continuous run. A multiple of the card count so it lands on Meme Master.
const SPIN_SLOTS = 24;
const SPIN_DURATION = 4200;
// Long enough for native to mount Meme Master under the spinner before the warp.
const SPINNER_LANDING_HOLD = 800;
// A card's slot relative to centre: -1.5 (gone left) .. 0 (centre) .. 1.5 (gone right).
const SLOT_RANGE = [-1.5, -1, 0, 1, 1.5];

function SpinnerCard({
  index,
  landing,
  landingScale,
  position,
  poses,
  scale,
  source,
  zIndex,
}: {
  index: number;
  landing: boolean;
  landingScale: Animated.Value;
  position: Animated.Value;
  poses: SpinnerPoses;
  scale: number;
  source: ImageSourcePropType;
  zIndex: number;
}) {
  const motion = useMemo(() => {
    // Wrap this card's slot into [-1.5, 1.5) so after it leaves on the left it
    // re-enters from the right; both extremes are fully transparent.
    const slot = Animated.subtract(
      Animated.modulo(Animated.subtract(index + 1.5, position), SPINNER_CARD_COUNT),
      1.5,
    );
    const at = (outputRange: number[] | string[]) =>
      slot.interpolate({ extrapolate: 'clamp', inputRange: SLOT_RANGE, outputRange });
    const fade = (inputRange: number[], outputRange: number[]) =>
      slot.interpolate({ extrapolate: 'clamp', inputRange, outputRange });
    return {
      opacity: at([0, 0.64, 1, 0.64, 0]),
      poseFlat: fade([-0.65, -0.35, 0.35, 0.65], [0, 1, 1, 0]),
      poseLeft: fade([-0.65, -0.35], [1, 0]),
      poseRight: fade([0.35, 0.65], [0, 1]),
      rotateY: at(['-26deg', '-15deg', '0deg', '15deg', '26deg']),
      rotateZ: at(['-8deg', '-4deg', '0deg', '4deg', '8deg']),
      scale: Animated.multiply(at([0.52, 0.72, 1, 0.72, 0.52]), landing ? landingScale : SPINNER_UNIT),
      translateX: at([-520, -300, 0, 300, 520].map((v) => v * scale)),
      translateY: at([70, 34, 0, 34, 70].map((v) => v * scale)),
    };
  }, [index, landing, landingScale, position, scale]);

  const isMeme = source === MEME_SPINNER_POSTER;
  const testID = isMeme ? 'meme-spinner-poster' : undefined;
  const onError = () => console.warn(`Spinner poster ${index} failed to load`);
  const slotBox = {
    height: 780 * scale,
    left: ((DESIGN_WIDTH - 390) / 2) * scale,
    top: POSTER_TOP * scale,
    width: 390 * scale,
  };

  if (Platform.OS !== 'web') {
    const poseBox = {
      height: (780 + SPINNER_POSE_PAD * 2) * scale,
      left: -SPINNER_POSE_PAD * scale,
      position: 'absolute' as const,
      top: -SPINNER_POSE_PAD * scale,
      width: (390 + SPINNER_POSE_PAD * 2) * scale,
    };
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.spinnerPoster,
          slotBox,
          {
            opacity: motion.opacity,
            zIndex,
            transform: [{ translateX: motion.translateX }, { translateY: motion.translateY }, { scale: motion.scale }],
          },
        ]}
      >
        <Animated.Image onError={onError} resizeMode="contain" source={poses.left} style={[poseBox, { opacity: motion.poseLeft }]} />
        <Animated.Image onError={onError} resizeMode="contain" source={poses.right} style={[poseBox, { opacity: motion.poseRight }]} />
        <Animated.Image testID={testID} onError={onError} resizeMode="contain" source={poses.flat} style={[poseBox, { opacity: motion.poseFlat }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spinnerPoster,
        styles.spinnerPosterShadow,
        slotBox,
        {
          opacity: motion.opacity,
          zIndex,
          transform: [
            { perspective: 1100 },
            { translateX: motion.translateX },
            { translateY: motion.translateY },
            { scale: motion.scale },
            { rotateY: motion.rotateY },
            { rotateZ: motion.rotateZ },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.fill,
          isMeme
            ? ({
                filter: `drop-shadow(0 0 ${7 * scale}px #46edff) drop-shadow(0 0 ${17 * scale}px #a429ff)`,
              } as ViewStyle)
            : null,
        ]}
      >
        <Image testID={testID} onError={onError} resizeMode="contain" source={source} style={styles.fullImage} />
      </View>
    </Animated.View>
  );
}

function SpinnerScreen({
  go,
  onLanded,
  scale,
}: {
  go: (screen: Screen) => void;
  onLanded?: () => void;
  scale: number;
}) {
  const [frontIndex, setFrontIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const frontRef = useRef(0);
  const cancelled = useRef(false);
  const landingGlow = useRef(new Animated.Value(0)).current;
  const landingScale = useRef(new Animated.Value(1)).current;
  const position = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // The only thing React needs to know mid-spin is which card is nearest the
    // centre, so it can draw on top of its neighbours.
    const id = position.addListener(({ value }) => {
      const next = ((Math.round(value) % SPINNER_CARD_COUNT) + SPINNER_CARD_COUNT) % SPINNER_CARD_COUNT;
      if (next !== frontRef.current) {
        frontRef.current = next;
        setFrontIndex(next);
      }
    });
    return () => {
      position.removeListener(id);
      cancelled.current = true;
      position.stopAnimation();
      landingGlow.stopAnimation();
      landingScale.stopAnimation();
    };
  }, [landingGlow, landingScale, position]);

  useEffect(() => {
    const intro = setTimeout(() => playNarration('gameSpinnerIntro'), 2000);
    return () => {
      clearTimeout(intro);
      stopAllNarration();
    };
  }, []);

  useEffect(() => {
    // Warm every card (and the Meme Master intro art) before the first spin so
    // no decode happens mid-motion. Best effort: warm-up must never take down
    // the spinner.
    preloadSound('spinner');
    preloadSound('spinnerStop');
    preloadSound('teleport');
    void warmImageGroup(
      [
        ...getSpinnerArt().posters,
        ...(Platform.OS === 'web' ? [] : getSpinnerArt().poses.flatMap((pose) => [pose.flat, pose.left, pose.right])),
        require('./assets/packed/meme-master-blue/background.jpg'),
        TOTAL_CHAOS_LOGO,
        require('./assets/packed/meme-master-blue/intro-title.webp'),
        require('./assets/packed/meme-master-blue/intro-cast.webp'),
      ],
      new Set<string>(),
    );
  }, []);

  const startSpin = () => {
    if (spinning) {
      return;
    }

    cancelled.current = false;
    playSound('spinner');
    landingGlow.setValue(0);
    landingScale.setValue(1);
    position.setValue(0);
    setSpinning(true);

    // One run with constant deceleration, like a wheel under friction: a fast
    // blur at first, then every card takes longer than the last until Meme
    // Master settles in the centre. No per-step restarts, so nothing snaps.
    Animated.timing(position, {
      duration: SPIN_DURATION,
      easing: Easing.out(Easing.quad),
      toValue: SPIN_SLOTS,
      useNativeDriver: SPINNER_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (!finished || cancelled.current) {
        return;
      }

      haptic('success');
      playNarration('memeMasterSpinner');
      Animated.parallel([
        Animated.sequence([
          Animated.spring(landingScale, {
            damping: 7,
            mass: 0.7,
            stiffness: 260,
            toValue: 1.065,
            useNativeDriver: SPINNER_NATIVE_DRIVER,
          }),
          Animated.spring(landingScale, {
            damping: 9,
            mass: 0.65,
            stiffness: 230,
            toValue: 1,
            useNativeDriver: SPINNER_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(landingGlow, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(landingGlow, {
            duration: 620,
            easing: Easing.out(Easing.cubic),
            toValue: 0.24,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        if (cancelled.current) {
          return;
        }
        onLanded?.();
      });
    });
  };

  const glowOpacity = landingGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.9],
  });
  const glowScale = landingGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.08],
  });
  const zIndexFor = (index: number) =>
    index === frontIndex ? 3 : index === (frontIndex + 1) % SPINNER_CARD_COUNT ? 2 : 1;

  return (
    <View testID="game-spinner" style={[styles.fill, styles.layeredScreen]}>
      <Image source={getModeArt().background} resizeMode="stretch" style={styles.fullImage} />
      <View style={[styles.layerFrame, { height: DESIGN_HEIGHT * scale, overflow: 'visible', width: DESIGN_WIDTH * scale }]}>
        <LayerImage
          box={{ x: 32, y: POSTER_TOP - SPINNER_GAP - 172, width: 790, height: 172 }}
          scale={scale}
          source={getSpinnerArt().title}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            layoutBox({ x: 251, y: POSTER_TOP + 790, width: 351, height: 16 }, scale),
            styles.spinnerStage,
            { opacity: glowOpacity, transform: [{ scaleX: glowScale }], borderRadius: 100 * scale, ...(Platform.OS === 'web' ? { boxShadow: `0 0 ${28 * scale}px ${10 * scale}px #43caff70` } : {}) },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            layoutBox({ x: 237, y: POSTER_TOP + 48, width: 379, height: 665 }, scale),
            styles.spinnerCentreGlow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />

        {getSpinnerArt().posters.map((source, index) => (
          <SpinnerCard
            index={index}
            key={index}
            landing={index === SPIN_SLOTS % SPINNER_CARD_COUNT}
            landingScale={landingScale}
            position={position}
            poses={getSpinnerArt().poses[index]}
            scale={scale}
            source={source}
            zIndex={zIndexFor(index)}
          />
        ))}

        <ArtPressable
          accessibilityLabel={spinning ? 'Game spinner is spinning' : 'Spin for the next game'}
          box={{ x: 136, y: POSTER_TOP + 780 + SPINNER_GAP, width: 583, height: 188 }}
          disabled={spinning}
          onPress={startSpin}
          hapticCue="medium"
          sound={false}
          scale={scale}
          source={getSpinnerArt().button}
        />
      </View>
    </View>
  );
}

const HOST_ROOM_CODE = 'CH400S';

function FakeQrCode({ scale }: { scale: number }) {
  const size=21;
  const cell=7.1*scale;
  const finder=(row:number,column:number,top:number,left:number)=>{
    const y=row-top,x=column-left;
    if(x<0||x>6||y<0||y>6)return false;
    return x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4);
  };
  return (
    <View
      accessibilityLabel="QR code to join room"
      style={{backgroundColor:'#f6f0ff',borderRadius:28*scale,padding:14*scale,borderWidth:3*scale,borderColor:'#d4b3ff'}}
    >
      {Array.from({length:size},(_,row)=>(
        <View key={row} style={{flexDirection:'row'}}>
          {Array.from({length:size},(_,column)=>{
            const dark=finder(row,column,1,1)||finder(row,column,1,13)||finder(row,column,13,1)||((row*3+column*5+row*column)%11<4&&!(row<9&&column<9)&&!(row<9&&column>11)&&!(row>11&&column<9));
            return <View key={column} style={{width:cell,height:cell,backgroundColor:dark?'#1a0a2e':'#f6f0ff'}}/>;
          })}
        </View>
      ))}
    </View>
  );
}

function copyRoomCode() {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(HOST_ROOM_CODE);
  }
}

function LobbyPlayer({box,scale,source,visible}:{box:Box;scale:number;source:ImageSourcePropType;visible:boolean}) {
  const reveal=useRef(new Animated.Value(visible?1:0)).current;
  useEffect(()=>{
    if(!visible){reveal.setValue(0);return;}
    Animated.spring(reveal,{toValue:1,damping:13,stiffness:210,mass:.7,useNativeDriver:true}).start();
  },[reveal,visible]);
  return <Animated.View style={[layoutBox(box,scale),{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[28*scale,0]})},{scale:reveal.interpolate({inputRange:[0,1],outputRange:[.92,1]})}]}]}><Image source={source} resizeMode="stretch" style={styles.fullImage}/></Animated.View>;
}

function HostLobbyScreen({go,soundOn,viewportWidth}:{go:(screen:Screen)=>void;soundOn:boolean;viewportWidth:number}) {
  const config=getFlowScreens().hostLobby;
  const scale=Math.min(Math.max(1,viewportWidth)/config.width,1);
  const [joinedCount,setJoinedCount]=useState(1);
  const soundOnRef=useRef(soundOn);
  soundOnRef.current=soundOn;
  useEffect(()=>{
    const timers=[1200,2500,3900,5400,7000].map((delay,index)=>setTimeout(()=>{
      setJoinedCount(index+2);
      if(soundOnRef.current)playSound('playerReady');
    },delay));
    return()=>timers.forEach(clearTimeout);
  },[]);
  const playerLayers=config.layers.slice(1);
  return <View style={[styles.fill,styles.layeredScreen]}>
    <Image source={getModeArt().background} resizeMode="cover" style={styles.fullImage}/>
    <ScrollView style={styles.fill} contentContainerStyle={{alignItems:'center'}} showsVerticalScrollIndicator={false}>
      <View style={{position:'relative',width:config.width*scale,height:config.height*scale}}>
        <LayerImage box={config.layers[0].box} scale={scale} source={config.layers[0].source}/>
        <LinearGradient
          colors={['#241438', '#14081f', '#0c0614']}
          locations={[0, 0.45, 1]}
          style={[layoutBox({x:108,y:279,width:636,height:530},scale),{borderRadius:56*scale,borderWidth:4*scale,borderColor:'#d4b3ff',overflow:'hidden',alignItems:'center',paddingTop:24*scale,paddingBottom:28*scale,boxShadow:`0 ${8*scale}px 0 #2a1148, 0 0 ${28*scale}px #c084fc66`}]}
        >
          <Text style={{fontFamily:BODY_FONT,fontWeight:'700',fontSize:20*scale,letterSpacing:7*scale,color:'#e4c8ff'}}>ROOM CODE</Text>
          <Pressable
            accessibilityLabel="Copy room code"
            accessibilityRole="button"
            onPress={()=>{haptic('selection');playSound('click');copyRoomCode();}}
            style={{flexDirection:'row',alignItems:'center',gap:14*scale,marginTop:6*scale,marginBottom:18*scale}}
          >
            <Text style={{fontFamily:DISPLAY_FONT,fontSize:70*scale,lineHeight:78*scale,color:'#fff6ee',letterSpacing:1*scale}}>{HOST_ROOM_CODE}</Text>
            <View style={{width:42*scale,height:46*scale,marginTop:4*scale}}>
              <View style={{position:'absolute',right:0,top:0,width:28*scale,height:34*scale,borderRadius:7*scale,borderWidth:3*scale,borderColor:'#c59bff'}}/>
              <View style={{position:'absolute',left:0,top:8*scale,width:28*scale,height:34*scale,borderRadius:7*scale,borderWidth:3*scale,borderColor:'#f4e8ff',backgroundColor:'#1a0d2c'}}/>
            </View>
          </Pressable>
          <View style={{width:420*scale,height:3*scale,borderRadius:2*scale,backgroundColor:'#c59bff66',marginBottom:18*scale}}/>
          <Text style={{fontFamily:BODY_FONT,fontWeight:'700',fontSize:18*scale,letterSpacing:6*scale,color:'#e4c8ff',marginBottom:14*scale}}>SCAN TO JOIN</Text>
          <FakeQrCode scale={scale}/>
        </LinearGradient>
        <View style={[layoutBox({x:208,y:816,width:444,height:78},scale),{zIndex:4}]}>
          <View style={[{position:'absolute',left:0,right:0,top:5*scale,height:78*scale,backgroundColor:'#1a0528'},Platform.OS==='web'?{clipPath:'polygon(8% 0,92% 0,100% 50%,92% 100%,8% 100%,0 50%)'} as ViewStyle:{borderRadius:24*scale}]}/>
          <View style={[{position:'absolute',left:0,right:0,top:0,height:78*scale,alignItems:'center',justifyContent:'center',backgroundColor:'#2b0a42'},Platform.OS==='web'?{clipPath:'polygon(8% 0,92% 0,100% 50%,92% 100%,8% 100%,0 50%)'} as ViewStyle:{borderRadius:24*scale}]}>
            <Text style={{fontFamily:DISPLAY_FONT,fontSize:30*scale,letterSpacing:2.5*scale,color:'#ff79d2'}}>{`${joinedCount} OF 6 READY`}</Text>
          </View>
        </View>
        {playerLayers.map((layer,index)=><LobbyPlayer key={`host-player-${index}`} box={layer.box} scale={scale} source={layer.source} visible={index<joinedCount}/>)}
        {config.actions.map(action=><ArtPressable key={`host-${action.label}`} accessibilityLabel={action.label} box={action.box} scale={scale} source={action.source} onPress={()=>{if(action.next)go(action.next);}}/>)}
      </View>
    </ScrollView>
  </View>;
}

function FlowArtworkScreen({
  go,
  scale,
  screen,
}: {
  go: (screen: Screen) => void;
  scale: number;
  screen: FlowScreen;
}) {
  const config = getFlowScreens()[screen];

  return (
    <View style={[styles.fill, styles.layeredScreen]}>
      <Image source={getModeArt().background} resizeMode="stretch" style={styles.fullImage} />
      <View
        style={[
          styles.layerFrame,
          { height: config.height * scale, width: config.width * scale },
        ]}
      >
        {config.layers.map((layer, index) => (
          <LayerImage
            box={layer.box}
            key={`${screen}-layer-${index}`}
            scale={scale}
            source={layer.source}
          />
        ))}
        {config.actions.map((action) => (
          <ArtPressable
            accessibilityLabel={action.label}
            box={action.box}
            key={`${screen}-${action.label}`}
            onPress={() => {
              if (action.next) {
                go(action.next);
              }
            }}
            scale={scale}
            source={action.source}
          />
        ))}
      </View>
    </View>
  );
}

export default function App() {
  useFonts(Platform.OS === 'web' ? {} : { [DISPLAY_FONT_NAME]: DISPLAY_FONT_SOURCE });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadWebDisplayFont().catch(() => {
      console.warn('Display font could not load; using the rounded sans-serif fallback.');
    });
  }, []);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>('home');
  const [soundOn, setSoundOn] = useState(true);
  const [teleporting,setTeleporting]=useState(false);
  const [revealing,setRevealing]=useState(false);
  // Set by the spinner once its landing pop has finished, during the still hold
  // before the warp. Native uses it to mount Meme Master while nothing moves.
  const [staging,setStaging]=useState(false);
  const [isHost, setIsHost] = useState(true);
  const [playerIdentity, setPlayerIdentity] = useState<{ name: string; id: MonsterId }>({ name: 'MATTHIAS', id: 'grumble' });
  const fade = useRef(new Animated.Value(1)).current;
  const soundOnRef = useRef(soundOn);
  const screenRef = useRef(screen);
  const teleportingRef = useRef(false);
  const warpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  soundOnRef.current = soundOn;
  screenRef.current = screen;
  teleportingRef.current = teleporting;

  useEffect(() => {
    return () => {
      if (warpTimer.current) clearTimeout(warpTimer.current);
    };
  }, []);
  const plate = plates[screen];
  const containScale = Math.min(
    Math.max(1, viewportWidth) / plate.width,
    Math.max(1, viewportHeight) / plate.height,
  );

  useEffect(() => {
    const idleHandles: { timeout?: ReturnType<typeof setTimeout>; idle?: number } = {};
    const idle = (cb: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        idleHandles.idle = requestIdleCallback(cb, { timeout: 900 });
      } else {
        idleHandles.timeout = setTimeout(cb, 250);
      }
    };
    idle(() => {
      preloadSound('click');
      preloadSound('spinner');
      preloadSound('spinnerStop');
      preloadSound('gameSpinnerIntro');
      preloadSound('memeMasterSpinner');
      preloadSound('memeMaster');
      preloadSound('memeMasterWelcome');
      preloadSound('memeMasterRulesPart1');
      preloadSound('memeMasterRulesPart2');
      preloadSound('memeMasterCaptionTease');
      preloadSound('memeMasterVoting');
      preloadSound('memeMasterFirstPlace');
      preloadSound('memeMasterSecondPlace');
      preloadSound('memeMasterThirdPlace');
      preloadSound('lockedIn');
      preloadSound('playerReady');
      preloadSound('voteCast');
      preloadSound('swipe');
      preloadSound('pointsAppearing');
      preloadSound('winningCheers');
      preloadSound('runnerUp');
      preloadSound('winner');
      void preloadUpcomingImages();
      void import('./MemeMasterGame');
    });
    return () => {
      if (idleHandles.timeout) clearTimeout(idleHandles.timeout);
      if (idleHandles.idle != null) cancelIdleCallback(idleHandles.idle);
    };
  }, []);

  // The soundtrack belongs to the app shell, not a mini-game. Keep one audio
  // element alive while screens change so playback does not restart on every
  // navigation; pause it whenever Meme Master takes over.
  useEffect(() => {
    const wanted = soundOn && screen !== 'memeMaster';
    setMemeMasterMusicWanted(soundOn && screen === 'memeMaster');
    setSoundtrackWanted(wanted);
    if (!wanted) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const start = () => playSoundtrack();
    document.addEventListener('pointerdown', start, { once: true, passive: true });
    return () => document.removeEventListener('pointerdown', start);
  }, [screen, soundOn]);

  useEffect(() => {
    const pauseAll = () => {
      pauseSoundtrack();
      stopAllSounds();
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.hidden) {
          pauseAll();
          return;
        }
        if (soundOnRef.current && screenRef.current === 'memeMaster') playMemeMasterMusic();
        else if (soundOnRef.current) playSoundtrack();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', pauseAll);
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', pauseAll);
        pauseAll();
      };
    }

    const sub = AppState.addEventListener('change', (state: string) => {
      if (state !== 'active') {
        pauseAll();
        return;
      }
      if (soundOnRef.current && screenRef.current === 'memeMaster') playMemeMasterMusic();
      else if (soundOnRef.current) playSoundtrack();
    });
    return () => sub.remove();
  }, []);

  const toggleSound = () => {
    setSoundOn((current) => {
      const next = !current;
      setSoundtrackWanted(next && screen !== 'memeMaster');
      setMemeMasterMusicWanted(next && screen === 'memeMaster');
      if (!next) stopAllSounds();
      return next;
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const themeColor = screen === 'memeMaster' ? '#020444' : '#12001f';
    document.documentElement.style.backgroundColor = themeColor;
    document.documentElement.style.colorScheme = 'dark';
    document.body.style.backgroundColor = themeColor;

    let displayFontStyle = document.querySelector<HTMLStyleElement>(
      'style[data-total-chaos-display-font]',
    );
    if (!displayFontStyle) {
      displayFontStyle = document.createElement('style');
      displayFontStyle.dataset.totalChaosDisplayFont = 'true';
      document.head.appendChild(displayFontStyle);
    }
    displayFontStyle.textContent = `
      [data-testid="player-name-input"],
      [data-testid="selected-monster-name"] {
        font-family: ${DISPLAY_FONT_CSS} !important;
        font-weight: 400 !important;
      }
      [data-testid="meme-display-copy"],
      #meme-master-game textarea, #meme-master-game input {
        font-family: ${DISPLAY_FONT_CSS} !important;
        font-weight: 400 !important;
        font-synthesis: none;
        letter-spacing: 0;
      }
      [data-testid="meme-body-copy"] {
        font-family: ${BODY_FONT} !important;
      }
      #meme-master-game textarea, #meme-master-game input {
        -webkit-text-fill-color: #fffeff;
        caret-color: #37f5ff;
      }
    `;

    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeColor;
  }, [screen]);

  useEffect(() => {
    if (screen === 'home') {
      void preloadUpcomingImages();
    }
  }, [screen]);

  const go = (next: Screen) => {
    if(teleportingRef.current)return;
    if(next==='memeMaster'){setTeleporting(true);return;}
    setStaging(false);
    Animated.timing(fade, {
      duration: 90,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      setScreen(next);
      Animated.timing(fade, {
        duration: 170,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  };

  // Native mounts Meme Master beneath the outgoing screen before the warp
  // starts, so its heavy first render (Fabric mounts on the main thread) lands
  // in the spinner's static hold rather than stalling the warp or lengthening
  // the blackout. Web mounts instantly and its game root is fixed-position, so
  // it keeps the plain swap.
  const premountMeme =
    Platform.OS !== 'web' && ((staging && screen === 'spinner') || teleporting) && screen !== 'memeMaster';
  const showMeme = screen === 'memeMaster' || premountMeme;
  const currentScreen =
    screen === 'home' ? (
      <HomeScreen go={go} scale={containScale} setIsHost={setIsHost} soundOn={soundOn} onToggleSound={toggleSound} />
    ) : screen === 'mode' ? (
      <ModeScreen go={go} scale={containScale} />
    ) : screen === 'join' ? (
      <JoinScreen go={go} scale={containScale} />
    ) : screen === 'character' ? (
      <CharacterScreen go={go} isHost={isHost} scale={containScale} onReady={(name, id) => setPlayerIdentity({ name, id })} />
    ) : screen === 'hostLobby' ? (
      <HostLobbyScreen go={go} soundOn={soundOn} viewportWidth={viewportWidth} />
    ) : screen === 'spinner' ? (
      <SpinnerScreen
        go={go}
        onLanded={() => {
          // App owns the warp timer. Staging used to remount this screen on
          // native (new parent wrapper), which cancelled a local timeout and
          // left iOS stuck on the spinner.
          playSound('teleport');
          haptic('heavy');
          setStaging(true);
          if (warpTimer.current) clearTimeout(warpTimer.current);
          warpTimer.current = setTimeout(() => go('memeMaster'), SPINNER_LANDING_HOLD);
        }}
        scale={containScale}
      />
    ) : screen === 'memeMaster' ? null : (
      <FlowArtworkScreen go={go} scale={containScale} screen={screen} />
    );

  return (
    <View style={styles.viewport}>
      <Animated.View
        accessibilityLabel={`${screen} screen`}
        style={[
          styles.frame,
          {
            height: viewportHeight,
            opacity: fade,
            width: viewportWidth,
          },
        ]}
      >
        {showMeme && (
          <Suspense fallback={<View style={styles.viewport} />}>
          <MemeMasterGame
            entrancePaused={teleporting && !revealing}
            onFinish={() => go('progress')}
            onExit={() => go(isHost ? 'hostLobby' : 'playerLobby')}
            playerId={playerIdentity.id}
            playerName={playerIdentity.name}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
          />
          </Suspense>
        )}
        {screen === 'memeMaster' ? null : (
          <View style={premountMeme ? styles.outgoingScreen : styles.fill}>{currentScreen}</View>
        )}
      </Animated.View>
      <StatusBar hidden />
      {teleporting&&<MemeTeleport width={viewportWidth} height={viewportHeight} revealReady={screen==='memeMaster'} onCovered={()=>{setScreen('memeMaster');fade.setValue(1);}} onReveal={()=>{setRevealing(true);if(soundOnRef.current)playNarration('memeMasterWelcome');}} onDone={()=>{setTeleporting(false);setRevealing(false);setStaging(false);}}/>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: '100%',
    width: '100%',
  },
  frame: {
    alignItems: 'center',
    backgroundColor: '#10021f',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  outgoingScreen: {
    alignItems: 'center',
    backgroundColor: '#10021f',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  fullImage: {
    height: '100%',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  layeredScreen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerFrame: {
    position: 'relative',
  },
  codeCharacter: {
    color: '#fff8e9',
    fontFamily: DISPLAY_FONT,
    textAlign: 'center',
    textShadowColor: '#100019',
    textShadowOffset: { height: 5, width: 3 },
    textShadowRadius: 0,
  },
  codeCharacterCell: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
  },
  codeCharacters: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    justifyContent: 'space-between',
    width: '100%',
  },
  codeHitArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    height: '100%',
    left: 0,
    opacity: 0.01,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  nameInput: {
    backgroundColor: 'transparent',
    color: '#fff8e9',
    fontFamily: DISPLAY_FONT,
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    textShadowColor: '#100019',
    textShadowOffset: { height: 4, width: 3 },
    textShadowRadius: 0,
  },
  pickerNameText: {
    color: '#fff8e9',
    fontFamily: DISPLAY_FONT,
    textAlign: 'center',
    textShadowColor: '#100019',
    textShadowOffset: { height: 4, width: 3 },
    textShadowRadius: 0,
  },
  pickerNameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedSlash: {
    backgroundColor: '#ff9c16',
    borderColor: '#22052f',
    borderRadius: 8,
    borderWidth: 2,
    height: 8,
    left: '23%',
    position: 'absolute',
    top: '47%',
    transform: [{ rotate: '-43deg' }],
    width: '56%',
  },
  selectedArtwork: {
    shadowColor: '#ff7a00',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.92,
    shadowRadius: 14,
  },
  selectionRing: {
    borderColor: '#ffd13b',
    borderRadius: 30,
    borderWidth: 3,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  spinnerCentreGlow: {
    backgroundColor: 'rgba(93, 36, 183, 0.18)',
    borderRadius: 28,
    shadowColor: '#63dbff',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 28,
  },
  spinnerPoster: {
    overflow: 'visible',
    position: 'absolute',
  },
  spinnerPosterShadow: {
    shadowColor: '#07000f',
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 18,
  },
  spinnerStage: {
    backgroundColor: '#75cbff55',
  },
  viewport: {
    alignItems: 'center',
    backgroundColor: '#12001f',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
