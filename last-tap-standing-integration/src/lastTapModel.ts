import type { MonsterId } from './monsterTypes';
import {BEAT_NOTES} from './beatPanicModel.ts';

export const LAST_TAP_PHASES = ['welcome', 'rules', 'target', 'playing', 'locked', 'results', 'final', 'eliminated', 'practice', 'winner'] as const;
export type LastTapPhase = typeof LAST_TAP_PHASES[number];
export type TapPlayer = { id: MonsterId; name: string; eliminatedRound: number | null; score: number; awardedThroughRound: number };
export type TapResult = { id: MonsterId; ms: number | null; wrongTaps: number };
export type TapRound = { round: number; results: TapResult[]; eliminatedId: MonsterId | null; tied: boolean };
export const TARGETS = ['toast', 'banana', 'toilet', 'broccoli', 'sock', 'teacup', 'pizza', 'pigeon'] as const;
export type TargetId = typeof TARGETS[number];
export const SNAP_CARDS = ['toaster', 'broccoli', 'pigeon', 'toilet', 'banana', 'teacup', 'sock', 'duck'] as const;
export type SnapCardId = typeof SNAP_CARDS[number];
export type TapRoundMode = 'target' | 'snap' | 'beat';
export const TAP_PACING = { remember: 7, snapIntro: 5, locked: 5, final: 5, entryMs:720, exitMs:180, wrongLockoutMs: 600, targetWindowMs: 3000 } as const;

export function createTapPlayers(localId: MonsterId, name: string, opponentCount = 7): TapPlayer[] {
  const count = Number.isFinite(opponentCount) ? Math.max(1, Math.min(7, Math.floor(opponentCount))) : 7;
  const order: MonsterId[] = [localId, ...(['snicker', 'gloop', 'brrr', 'grumble', 'scraps', 'dozy', 'peepers', 'bop'] as MonsterId[]).filter(id => id !== localId)];
  // These are explicit demo usernames, not monster labels or connected players.
  const demoNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Taylor', 'Riley', 'Jamie'];
  return order.slice(0, count + 1).map((id, index) => ({ id, name: index === 0 ? name.trim() || 'Player' : demoNames[index - 1], eliminatedRound: null, score: 0, awardedThroughRound: 0 }));
}

export function targetForRound(round: number): TargetId {
  return TARGETS[(round - 1) % TARGETS.length];
}

export const GAME_ORDERS: readonly (readonly TapRoundMode[])[] = [
  ['target','snap','beat'], ['target','beat','snap'],
  ['snap','target','beat'], ['snap','beat','target'],
  ['beat','target','snap'], ['beat','snap','target'],
];
/** Repeat the selected testing order without changing the survival round number. */
export function modeForRound(round: number, order: readonly TapRoundMode[] = GAME_ORDERS[0]): TapRoundMode {
  return order[(round-1)%order.length];
}

/** A random delay and no adjacent duplicate cards prevent a predictable rhythm. */
export function makeTapSequence(target: TargetId, round: number, random = Math.random): { cards: TargetId[]; intervalMs: number } {
  const count = 7 + Math.floor(random() * 7);
  const cards: TargetId[] = [];
  for (let i = 0; i < count; i++) {
    const choices = TARGETS.filter(id => id !== target && id !== cards[i - 1]);
    cards.push(choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]);
  }
  const intervalMs = Math.max(230, 410 - (round - 1) * 24);
  cards.push(target);
  // Keep distractors moving throughout the entire response window.
  for (let i = 0; i < Math.ceil(TAP_PACING.targetWindowMs / intervalMs) + 1; i++) {
    const choices = TARGETS.filter(id => id !== target && id !== cards.at(-1));
    cards.push(choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]);
  }
  return { cards, intervalMs };
}

/** One intentional adjacent pair; every other adjacent card is different. */
export function makeSnapSequence(round: number, random = Math.random): { cards: SnapCardId[]; intervalMs: number; snapIndex: number } {
  const before = 6 + Math.floor(random() * 6);
  const cards: SnapCardId[] = [];
  const pickDifferent = (last?: SnapCardId) => {
    const choices = SNAP_CARDS.filter(id => id !== last);
    return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  };
  for (let i = 0; i < before; i++) cards.push(pickDifferent(cards.at(-1)));
  const match = pickDifferent(cards.at(-1));
  cards.push(match, match);
  const intervalMs = Math.max(360, 610 - (round - 1) * 22);
  for (let i = 0; i < Math.ceil(TAP_PACING.targetWindowMs / intervalMs) + 2; i++) cards.push(pickDifferent(cards.at(-1)));
  return { cards, intervalMs, snapIndex: before + 1 };
}

/** Only the local player's input is measured; the current app uses demo rivals. */
export function simulateRivals(players: TapPlayer[], localId: MonsterId, round: number, random = Math.random, mode: TapRoundMode = modeForRound(round)): TapResult[] {
  return players.filter(p => p.eliminatedRound === null && p.id !== localId).map(p => ({
    id: p.id, ms: mode==='beat'?Math.round(BEAT_NOTES.length*(45+random()*140)):Math.round(220 + random() * Math.max(160, 570 - round * 44)), wrongTaps: 0,
  }));
}

/** Missing the target ranks last. Ties for last replay; never eliminate arbitrarily. */
export function resolveTapRound(round: number, results: TapResult[]): TapRound {
  const score = (r: TapResult) => r.ms === null ? Infinity : r.ms;
  const sorted = [...results].sort((a, b) => score(a) - score(b));
  const slowest = sorted.at(-1);
  const tied = !!slowest && sorted.filter(r => score(r) === score(slowest)).length > 1;
  return { round, results: sorted, eliminatedId: tied ? null : slowest?.id ?? null, tied };
}

export function eliminatePlayer(players: TapPlayer[], result: TapRound): TapPlayer[] {
  // A tied round replays. Settle a completed round once, after its reveal.
  if (!result.eliminatedId || result.tied) return players;
  const participants = new Set(result.results.map(r => r.id));
  return players.map(p => {
    if (p.eliminatedRound !== null || p.awardedThroughRound >= result.round || !participants.has(p.id)) return p;
    return { ...p, eliminatedRound: p.id === result.eliminatedId ? result.round : null,
      score: p.score + (p.id === result.eliminatedId ? 0 : 100), awardedThroughRound: result.round };
  });
}

/** Null means no valid tap; duplicate taps and taps during lockout do not score. */
export function reactionAt(now: number, shownAt: number | null, lockedUntil: number): number | null {
  if (shownAt === null || now < shownAt || now < lockedUntil || now - shownAt > TAP_PACING.targetWindowMs) return null;
  return Math.max(1, Math.round(now - shownAt));
}

export function formatReaction(ms: number | null | undefined): string {
  return ms == null ? 'MISSED' : `${ms} ms`;
}

/** Any tied fastest valid tap wins; misses and no selection never earn points. */
export function predictionPoints(pick: MonsterId | null, results: TapResult[]): number {
  const valid = results.filter(r => r.ms !== null);
  if (!pick || !valid.length) return 0;
  const fastest = Math.min(...valid.map(r => r.ms!));
  return valid.some(r => r.id === pick && r.ms === fastest) ? 25 : 0;
}

/** Earned survival and prediction points; simulated rivals do not invent bonus picks. */
export function lastTapScoreRows(players: TapPlayer[], localId: MonsterId, localBonus: number) {
  return players.map(p => ({ ...p, bonus: p.id === localId ? localBonus : 0,
    total: p.score + (p.id === localId ? localBonus : 0), champion: p.eliminatedRound === null,
  })).sort((a,b) => b.total-a.total || Number(b.champion)-Number(a.champion));
}
