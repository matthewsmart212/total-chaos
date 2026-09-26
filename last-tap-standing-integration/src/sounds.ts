import { Platform } from 'react-native';

type SoundName = 'click' | 'teleport';
function source(name: SoundName) {
  // Keep binary imports lazy so non-web render tests can load the component
  // tree without attempting to parse MP3 bytes as JavaScript.
  if (name === 'teleport') return require('../assets/audio/teleport.mp3');
  return require('../assets/audio/standard-click.mp3');
}

const players: Partial<Record<SoundName, HTMLAudioElement>> = {};

function getPlayer(name: SoundName) {
  let player = players[name];
  if (!player) {
    player = new Audio(source(name) as string);
    player.preload = 'auto';
    player.loop = false;
    players[name] = player;
  }
  return player;
}

export function preloadSound(name: SoundName) {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') return;
  getPlayer(name).load();
}

/** Small, best-effort sound effects for the web shell. Native can add a
 * platform audio backend later without changing button/animation call sites. */
export function playSound(name: SoundName) {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') return;
  const player = getPlayer(name);
  player.currentTime = 0;
  void player.play().catch(() => undefined);
}

export function stopSound(name: SoundName) {
  const player = players[name];
  if (!player) return;
  player.pause();
  player.currentTime = 0;
}
