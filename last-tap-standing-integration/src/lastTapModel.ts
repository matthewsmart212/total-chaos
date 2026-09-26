import type { MonsterId } from './monsterTypes';
import {beatChartForRound,beatEventCount} from './beatPanicModel.ts';

export const LAST_TAP_PHASES = ['welcome', 'rules', 'target', 'playing', 'locked', 'results', 'final', 'eliminated', 'winner'] as const;
export type LastTapPhase = typeof LAST_TAP_PHASES[number];
export type TapPlayer = { id: MonsterId; name: string; eliminatedRound: number | null; score: number; awardedThroughRound: number };
export type TapResult = { id: MonsterId; ms: number | null; wrongTaps: number };
export type TapRound = { round: number; results: TapResult[]; eliminatedId: MonsterId | null; tied: boolean };
export const TAP_PACING = { preview: 6, locked: 3, final: 5, entryMs:720, exitMs:180 } as const;

export function createTapPlayers(localId: MonsterId, name: string, opponentCount = 7): TapPlayer[] {
  const count = Number.isFinite(opponentCount) ? Math.max(1, Math.min(7, Math.floor(opponentCount))) : 7;
  const order: MonsterId[] = [localId, ...(['snicker', 'gloop', 'brrr', 'grumble', 'scraps', 'dozy', 'peepers', 'bop'] as MonsterId[]).filter(id => id !== localId)];
  const demoNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Taylor', 'Riley', 'Jamie'];
  return order.slice(0, count + 1).map((id, index) => ({ id, name: index === 0 ? name.trim() || 'Player' : demoNames[index - 1], eliminatedRound: null, score: 0, awardedThroughRound: 0 }));
}

/** Demo rivals face the same chart shape. Their total timing error tightens as
 * rounds progress while retaining enough variance for a party-game preview. */
export function simulateRivals(players: TapPlayer[], localId: MonsterId, round: number, random = Math.random, finalRound = false): TapResult[] {
  const events = beatEventCount(beatChartForRound(round, finalRound));
  const floor = Math.max(28, 72 - round * 5);
  const spread = Math.max(72, 175 - round * 9);
  return players.filter(p => p.eliminatedRound === null && p.id !== localId).map(p => ({
    id: p.id,
    ms: Math.round(events * (floor + random() * spread)),
    wrongTaps: 0,
  }));
}

/** Highest timing error is knocked out. Exact last-place ties replay so the
 * game never eliminates somebody arbitrarily. */
export function resolveTapRound(round: number, results: TapResult[]): TapRound {
  const score = (result: TapResult) => result.ms === null ? Infinity : result.ms;
  const sorted = [...results].sort((a, b) => score(a) - score(b));
  const slowest = sorted.at(-1);
  const tied = !!slowest && sorted.filter(result => score(result) === score(slowest)).length > 1;
  return { round, results: sorted, eliminatedId: tied ? null : slowest?.id ?? null, tied };
}

export function eliminatePlayer(players: TapPlayer[], result: TapRound): TapPlayer[] {
  if (!result.eliminatedId || result.tied) return players;
  const participants = new Set(result.results.map(row => row.id));
  return players.map(player => {
    if (player.eliminatedRound !== null || player.awardedThroughRound >= result.round || !participants.has(player.id)) return player;
    return {
      ...player,
      eliminatedRound: player.id === result.eliminatedId ? result.round : null,
      score: player.score + (player.id === result.eliminatedId ? 0 : 100),
      awardedThroughRound: result.round,
    };
  });
}

export function formatReaction(ms: number | null | undefined): string {
  return ms == null ? 'MISSED' : `${ms} ms`;
}

/** Any tied best timing score wins the spectator prediction. */
export function predictionPoints(pick: MonsterId | null, results: TapResult[]): number {
  const valid = results.filter(result => result.ms !== null);
  if (!pick || !valid.length) return 0;
  const fastest = Math.min(...valid.map(result => result.ms!));
  return valid.some(result => result.id === pick && result.ms === fastest) ? 25 : 0;
}

export function lastTapScoreRows(players: TapPlayer[], localId: MonsterId, localBonus: number) {
  return players.map(player => ({
    ...player,
    bonus: player.id === localId ? localBonus : 0,
    total: player.score + (player.id === localId ? localBonus : 0),
    champion: player.eliminatedRound === null,
  })).sort((a,b) => b.total-a.total || Number(b.champion)-Number(a.champion));
}
