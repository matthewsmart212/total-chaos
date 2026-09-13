import { ImageSourcePropType } from 'react-native';

export type Screen = 'home' | 'mode' | 'join' | 'character' | 'lobby' | 'spinner' | 'round' | 'winner' | 'standings' | 'progress' | 'podium';
export type Monster = { name: string; image: ImageSourcePropType; color: string };

export const colors = {
  ink: '#170823', plum: '#2a0b3f', plum2: '#481060', cream: '#fff6e9', yellow: '#ffad08',
  orange: '#ff7517', pink: '#ff4ec7', cyan: '#16c9ef', green: '#63e62f', mint: '#78e6c1', white: '#fffaf1',
};

export const monsters: Monster[] = [
  { name: 'GRUMBLE', image: require('../assets/packed/monsters/grumble.webp'), color: '#ff7928' },
  { name: 'GLOOP', image: require('../assets/packed/monsters/gloop.webp'), color: '#8fda25' },
  { name: 'BRRR', image: require('../assets/packed/monsters/brrr.webp'), color: '#16a7df' },
  { name: 'PEEPERS', image: require('../assets/packed/monsters/peepers.webp'), color: '#ff4777' },
  { name: 'DOZY', image: require('../assets/packed/monsters/dozy.webp'), color: '#ffc51d' },
  { name: 'BOP', image: require('../assets/packed/monsters/bop.webp'), color: '#ff4d28' },
  { name: 'SNICKER', image: require('../assets/packed/monsters/snicker.webp'), color: '#a953c7' },
  { name: 'SCRAPS', image: require('../assets/packed/monsters/scraps.webp'), color: '#16b7aa' },
];

export const players = [
  { name: 'MATTHIAS', monster: 0, score: 1250, delta: '+1,250' },
  { name: 'BON BEE', monster: 3, score: 1050, delta: '+1,050' },
  { name: 'CRYSTALINA', monster: 2, score: 900, delta: '+900' },
  { name: 'ANITAID', monster: 1, score: 725, delta: '+725' },
  { name: 'SCARLETTO', monster: 4, score: 600, delta: '+600' },
  { name: 'JESS', monster: 6, score: 450, delta: '+450' },
];

export const games = [
  { title: 'MEME\nMASTER', kicker: 'Caption · Vote · Win', icon: '🤣', colors: ['#fe6f10', '#b7194d'] as const },
  { title: 'TIPSY\nDOODLES', kicker: 'Sketch · Guess · Regret', icon: '✍️', colors: ['#213096', '#6618a2'] as const },
  { title: 'CHAOS\nTAP', kicker: 'Tap · Panic · Repeat', icon: '🔥', colors: ['#ea2d29', '#8d163d'] as const },
  { title: 'ODD ONE\nOUT', kicker: 'Spot · Bluff · Survive', icon: '👀', colors: ['#6330ad', '#e62d78'] as const },
  { title: 'PANIC\nPOLL', kicker: 'Choose your chaos', icon: '⚡', colors: ['#dd286f', '#7a2eb5'] as const },
];
