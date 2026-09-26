import { Platform } from 'react-native';

type SoundName =
  | 'click'
  | 'spinner'
  | 'spinnerStop'
  | 'gameSpinnerIntro'
  | 'memeMasterSpinner'
  | 'teleport'
  | 'memeMaster'
  | 'lastTapStanding'
  | 'memeMasterWelcome'
  | 'memeMasterRulesPart1'
  | 'memeMasterRulesPart2'
  | 'memeMasterCaptionTease'
  | 'memeMasterVoting'
  | 'memeMasterFirstPlace'
  | 'memeMasterSecondPlace'
  | 'memeMasterThirdPlace'
  | 'lockedIn'
  | 'playerReady'
  | 'voteCast'
  | 'swipe'
  | 'pointsAppearing'
  | 'winningCheers'
  | 'runnerUp'
  | 'winner';
type NarrationName =
  | 'gameSpinnerIntro'
  | 'memeMasterSpinner'
  | 'memeMasterWelcome'
  | 'memeMasterRulesPart1'
  | 'memeMasterRulesPart2'
  | 'memeMasterCaptionTease'
  | 'memeMasterVoting'
  | 'memeMasterFirstPlace'
  | 'memeMasterSecondPlace'
  | 'memeMasterThirdPlace';
type NativePlayer = {
  loop: boolean;
  volume: number;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<unknown> | unknown;
  addListener: (event: 'playbackStatusUpdate', listener: (status: { didJustFinish: boolean }) => void) => { remove: () => void };
};

function source(name: SoundName) {
  if (name === 'click') return require('../assets/audio/standard-click.mp3');
  if (name === 'spinner') return require('../assets/audio/game-spinner.mp3');
  if (name === 'spinnerStop') return require('../assets/audio/spinner-stop.mp3');
  if (name === 'gameSpinnerIntro') return require('../assets/audio/game-spinner-intro.mp3');
  if (name === 'memeMasterSpinner') return require('../assets/audio/meme-master-spinner.mp3');
  if (name === 'memeMaster') return require('../assets/audio/meme-master.mp3');
  if (name === 'lastTapStanding') return require('../assets/audio/last-tap-standing-audio/main-background-song.mp3');
  if (name === 'memeMasterWelcome') return require('../assets/audio/meme-master-welcome.mp3');
  if (name === 'memeMasterRulesPart1') return require('../assets/audio/meme-master-rules-part-1.mp3');
  if (name === 'memeMasterRulesPart2') return require('../assets/audio/meme-master-rules-part-2.mp3');
  if (name === 'memeMasterCaptionTease') return require('../assets/audio/meme-master-caption-tease.mp3');
  if (name === 'memeMasterVoting') return require('../assets/audio/meme-master-voting.mp3');
  if (name === 'memeMasterFirstPlace') return require('../assets/audio/meme-master-first-place.mp3');
  if (name === 'memeMasterSecondPlace') return require('../assets/audio/meme-master-second-place.mp3');
  if (name === 'memeMasterThirdPlace') return require('../assets/audio/meme-master-third-place.mp3');
  if (name === 'lockedIn') return require('../assets/audio/locked-in.mp3');
  if (name === 'playerReady') return require('../assets/audio/player-ready.mp3');
  if (name === 'voteCast') return require('../assets/audio/vote-cast.mp3');
  if (name === 'swipe') return require('../assets/audio/swipe.mp3');
  if (name === 'pointsAppearing') return require('../assets/audio/points-appearing.mp3');
  if (name === 'winningCheers') return require('../assets/audio/winning-cheers.mp3');
  if (name === 'runnerUp') return require('../assets/audio/runner-up-sound.mp3');
  if (name === 'winner') return require('../assets/audio/winner-sound.mp3');
  return require('../assets/audio/teleport.mp3');
}

function soundtrackSource() {
  return require('../assets/audio/main-soundtrack.mp3');
}

const webPlayers: Partial<Record<SoundName, HTMLAudioElement>> = {};
const nativePlayers: Partial<Record<SoundName, NativePlayer>> = {};
const narrationNames: NarrationName[] = [
  'gameSpinnerIntro', 'memeMasterSpinner', 'memeMasterWelcome',
  'memeMasterRulesPart1', 'memeMasterRulesPart2', 'memeMasterCaptionTease',
  'memeMasterVoting', 'memeMasterFirstPlace', 'memeMasterSecondPlace',
  'memeMasterThirdPlace',
];
let webSoundtrack: HTMLAudioElement | null = null;
let nativeSoundtrack: NativePlayer | null = null;
let nativeModeReady = false;
type MiniGameTrack = 'memeMaster' | 'lastTapStanding';
type MiniGamePlayback = {
  fade: ReturnType<typeof setInterval> | null;
  start: ReturnType<typeof setTimeout> | null;
  wanted: boolean;
};
const miniGame: Record<MiniGameTrack, MiniGamePlayback> = {
  memeMaster: { fade: null, start: null, wanted: false },
  lastTapStanding: { fade: null, start: null, wanted: false },
};
let rulesVoiceoverWanted = false;

function isMiniGameTrack(name: SoundName): name is MiniGameTrack {
  return name === 'memeMaster' || name === 'lastTapStanding';
}

function isWeb() {
  return Platform.OS === 'web' && typeof Audio !== 'undefined';
}

function getWebPlayer(name: SoundName) {
  let player = webPlayers[name];
  if (!player) {
    player = new Audio(source(name) as string);
    player.preload = 'auto';
    player.loop = isMiniGameTrack(name);
    if (name === 'spinner') {
      player.addEventListener('ended', () => playSound('spinnerStop'));
    }
    if (name === 'memeMasterRulesPart1') {
      player.addEventListener('ended', () => {
        if (rulesVoiceoverWanted) playNarration('memeMasterRulesPart2');
      });
    }
    webPlayers[name] = player;
  }
  return player;
}

function expoAudio() {
  return require('expo-audio') as {
    createAudioPlayer: (source: unknown) => NativePlayer;
    setAudioModeAsync: (mode: { playsInSilentMode?: boolean; interruptionMode?: string }) => Promise<void>;
  };
}

async function ensureNativeMode() {
  if (nativeModeReady || isWeb()) return;
  nativeModeReady = true;
  try {
    await expoAudio().setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    nativeModeReady = false;
  }
}

function getNativePlayer(name: SoundName) {
  let player = nativePlayers[name];
  if (!player) {
    player = expoAudio().createAudioPlayer(source(name));
    player.loop = isMiniGameTrack(name);
    player.volume = name === 'click' ? 0.8 : 1;
    if (name === 'spinner') {
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) playSound('spinnerStop');
      });
    }
    if (name === 'memeMasterRulesPart1') {
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish && rulesVoiceoverWanted) playNarration('memeMasterRulesPart2');
      });
    }
    nativePlayers[name] = player;
  }
  return player;
}

export function preloadSound(name: SoundName) {
  if (Platform.OS === 'web' && typeof Audio === 'undefined') return;
  if (isWeb()) {
    getWebPlayer(name).load();
    return;
  }
  void ensureNativeMode().then(() => {
    getNativePlayer(name);
  });
}

export function playSound(name: SoundName) {
  if (Platform.OS === 'web' && typeof Audio === 'undefined') return;
  if (isWeb()) {
    const player = getWebPlayer(name);
    player.currentTime = 0;
    void player.play().catch(() => undefined);
    return;
  }
  void ensureNativeMode().then(() => {
    const player = getNativePlayer(name);
    void Promise.resolve(player.seekTo(0)).finally(() => {
      player.play();
      if (soundtrackWanted) playSoundtrack();
    });
  });
}

export function stopSound(name: SoundName) {
  if (isMiniGameTrack(name)) {
    const playback = miniGame[name];
    if (playback.fade) clearInterval(playback.fade);
    if (playback.start) clearTimeout(playback.start);
    playback.fade = null;
    playback.start = null;
  }
  if (Platform.OS === 'web' && typeof Audio === 'undefined') return;
  if (isWeb()) {
    const player = webPlayers[name];
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    return;
  }
  const player = nativePlayers[name];
  if (!player) return;
  player.pause();
  void player.seekTo(0);
}

export function stopAllSounds() {
  stopAllNarration();
  ([
    'click', 'spinner', 'spinnerStop', 'gameSpinnerIntro', 'memeMasterSpinner',
    'teleport', 'memeMaster', 'lastTapStanding', 'memeMasterWelcome',
    'memeMasterRulesPart1', 'memeMasterRulesPart2', 'memeMasterCaptionTease',
    'memeMasterVoting', 'memeMasterFirstPlace', 'memeMasterSecondPlace',
    'memeMasterThirdPlace', 'lockedIn',
    'playerReady', 'voteCast', 'swipe', 'pointsAppearing', 'winningCheers',
    'runnerUp', 'winner',
  ] as SoundName[]).forEach(stopSound);
}

function stopNarrationPlayers(except?: NarrationName) {
  narrationNames.forEach(name => {
    if (name !== except) stopSound(name);
  });
}

export function playNarration(name: NarrationName) {
  stopNarrationPlayers(name);
  playSound(name);
}

export function stopAllNarration() {
  rulesVoiceoverWanted = false;
  stopNarrationPlayers();
}

export function playMemeMasterRulesVoiceover() {
  rulesVoiceoverWanted = true;
  stopNarrationPlayers();
  playSound('memeMasterRulesPart1');
}

export function stopMemeMasterRulesVoiceover() {
  rulesVoiceoverWanted = false;
  stopSound('memeMasterRulesPart1');
  stopSound('memeMasterRulesPart2');
}

function fadeMiniGameIn(track: MiniGameTrack, player: { volume: number }) {
  const playback = miniGame[track];
  if (playback.fade) clearInterval(playback.fade);
  const startedAt = Date.now();
  player.volume = 0;
  playback.fade = setInterval(() => {
    if (!playback.wanted) {
      if (playback.fade) clearInterval(playback.fade);
      playback.fade = null;
      return;
    }
    player.volume = Math.min(1, (Date.now() - startedAt) / 3000);
    if (player.volume >= 1) {
      if (playback.fade) clearInterval(playback.fade);
      playback.fade = null;
    }
  }, 40);
}

function fadeMiniGameMusicTo(track: MiniGameTrack, targetVolume: number, durationMs: number, fromVolume?: number) {
  const playback = miniGame[track];
  if (!playback.wanted) return;
  const player = isWeb() ? webPlayers[track] : nativePlayers[track];
  if (!player) return;
  if (playback.fade) clearInterval(playback.fade);
  const from = fromVolume===undefined?player.volume:Math.max(0,Math.min(1,fromVolume));
  player.volume=from;
  const target = Math.max(0, Math.min(1, targetVolume));
  const startedAt = Date.now();
  playback.fade = setInterval(() => {
    if (!playback.wanted) {
      if (playback.fade) clearInterval(playback.fade);
      playback.fade = null;
      return;
    }
    const progress = Math.min(1, (Date.now() - startedAt) / Math.max(1, durationMs));
    player.volume = from + (target - from) * progress;
    if (progress >= 1) {
      if (playback.fade) clearInterval(playback.fade);
      playback.fade = null;
    }
  }, 40);
}

export function fadeMemeMasterMusicTo(targetVolume: number, durationMs: number, fromVolume?: number) {
  fadeMiniGameMusicTo('memeMaster', targetVolume, durationMs, fromVolume);
}

export function fadeLastTapMusicTo(targetVolume: number, durationMs: number, fromVolume?: number) {
  fadeMiniGameMusicTo('lastTapStanding', targetVolume, durationMs, fromVolume);
}

function playMiniGameMusic(track: MiniGameTrack) {
  const playback = miniGame[track];
  if (!playback.wanted) return;
  if (Platform.OS === 'web' && typeof Audio === 'undefined') return;
  if (playback.start) clearTimeout(playback.start);
  playback.start = setTimeout(() => {
    playback.start = null;
    if (!playback.wanted) return;
    if (isWeb()) {
      const player = getWebPlayer(track);
      player.currentTime = 0;
      fadeMiniGameIn(track, player);
      void player.play().catch(() => undefined);
      return;
    }
    void ensureNativeMode().then(() => {
      if (!playback.wanted) return;
      const player = getNativePlayer(track);
      void Promise.resolve(player.seekTo(0)).finally(() => {
        if (!playback.wanted) return;
        fadeMiniGameIn(track, player);
        player.play();
      });
    });
  }, 700);
}

function setMiniGameMusicWanted(track: MiniGameTrack, wanted: boolean) {
  miniGame[track].wanted = wanted;
  if (wanted) playMiniGameMusic(track);
  else stopSound(track);
}

export function playMemeMasterMusic() {
  playMiniGameMusic('memeMaster');
}

export function setMemeMasterMusicWanted(wanted: boolean) {
  setMiniGameMusicWanted('memeMaster', wanted);
}

export function playLastTapMusic() {
  playMiniGameMusic('lastTapStanding');
}

export function setLastTapMusicWanted(wanted: boolean) {
  setMiniGameMusicWanted('lastTapStanding', wanted);
}

let soundtrackWanted = false;

export function setSoundtrackWanted(wanted: boolean) {
  soundtrackWanted = wanted;
  if (!wanted) {
    pauseSoundtrack();
    return;
  }
  playSoundtrack();
}

export function playSoundtrack() {
  if (!soundtrackWanted) return;
  if (Platform.OS === 'web' && typeof Audio === 'undefined') return;
  if (isWeb()) {
    if (!webSoundtrack) {
      webSoundtrack = new Audio(soundtrackSource() as string);
      webSoundtrack.loop = true;
      webSoundtrack.preload = 'none';
      webSoundtrack.volume = 0.24;
    }
    void webSoundtrack.play().catch(() => undefined);
    return;
  }
  void ensureNativeMode().then(() => {
    if (!soundtrackWanted) return;
    if (!nativeSoundtrack) {
      nativeSoundtrack = expoAudio().createAudioPlayer(soundtrackSource());
      nativeSoundtrack.loop = true;
      nativeSoundtrack.volume = 0.24;
    }
    nativeSoundtrack.play();
  });
}

export function pauseSoundtrack() {
  webSoundtrack?.pause();
  nativeSoundtrack?.pause();
}
