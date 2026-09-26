export const BEAT_WINDOW = 220;
export const BEAT_APPROACH = 1500;
export const DOUBLE_GAP = 150;
export const MISS_PENALTY = 500;
export const EXTRA_PENALTY = 350;

export type BeatLane = 0 | 1 | 2 | 3;
export type BeatNoteKind = 'tap' | 'double' | 'hold';
export type BeatNote = {
  id: string;
  at: number;
  lane: BeatLane;
  kind: BeatNoteKind;
  duration: number;
};
export type BeatChart = {
  approach: number;
  duration: number;
  notes: BeatNote[];
  round: number;
  subtitle: string;
};
export type BeatScore = {
  errors: number[][];
  extras: number;
  releases: (number | null)[];
};

const LANE_PATTERNS: readonly (readonly BeatLane[])[] = [
  [0, 1, 2, 3, 1, 0, 3, 2],
  [3, 1, 0, 2, 0, 3, 2, 1],
  [0, 2, 1, 3, 2, 0, 3, 1],
  [1, 3, 0, 2, 3, 1, 2, 0],
];

function roundSubtitle(round: number, finalRound: boolean) {
  if (finalRound) return 'PANIC MODE · LAST ONE STANDING';
  if (round === 1) return 'KEEP UP · SINGLE TAPS';
  if (round === 2) return 'DOUBLE TROUBLE · TAP ×2';
  if (round === 3) return 'HOLD ON · PRESS AND RELEASE';
  if (round === 4) return 'FOUR-WAY FRENZY';
  return 'NO CHILL · MIXED PATTERNS';
}

/** Every player receives the same deterministic chart locally. Difficulty comes
 * from denser musical sections and new note grammar, never random fake-outs. */
export function beatChartForRound(round: number, finalRound = false): BeatChart {
  const level = finalRound ? 7 : Math.max(1, Math.min(7, Math.floor(round)));
  const duration = finalRound ? 34000 : Math.min(30000, 20000 + level * 2000);
  const pattern = LANE_PATTERNS[(level - 1) % LANE_PATTERNS.length];
  const notes: BeatNote[] = [];
  let at = 1700;
  let index = 0;

  while (at < duration - 1050) {
    const section = Math.floor((at - 1700) / 4800) % 3;
    const base = Math.max(390, 720 - level * 43);
    const interval = Math.round(base * (section === 1 ? .72 : section === 2 ? 1.22 : 1));
    const lane = pattern[(index + level) % pattern.length];
    const canHold = level >= 3 && index % 11 === 8;
    const canDouble = level >= 2 && index % 8 === 5;
    const holdDuration = Math.min(1250, 650 + level * 80);
    const kind: BeatNoteKind = canHold && at + holdDuration + BEAT_WINDOW < duration
      ? 'hold'
      : canDouble
        ? 'double'
        : 'tap';

    notes.push({id:`r${round}-${index}`, at, lane, kind, duration:kind === 'hold' ? holdDuration : 0});

    // Later rounds occasionally ask for two directions at the same moment, but
    // never alongside a hold: mobile web views do not reliably combine a held
    // pointer with a second control press.
    if (kind !== 'hold' && level >= 4 && index % 13 === 9) {
      const partner = ((lane + 2) % 4) as BeatLane;
      notes.push({id:`r${round}-${index}-chord`, at, lane:partner, kind:'tap', duration:0});
    }

    // A hold owns the hit line until its tail ends. The following note may land
    // immediately on release, keeping the rhythm dense without requiring
    // multi-touch input.
    at += kind === 'hold' ? holdDuration : interval + (kind === 'double' ? DOUBLE_GAP : 0);
    index++;
  }

  // Never end a round on a hold/release gesture. A decisive final tap is easier
  // to read and cannot leave an iPhone player holding through the transition.
  const last = notes.at(-1);
  if (last?.kind === 'hold') notes[notes.length - 1] = {...last, kind:'tap', duration:0};

  return {approach:BEAT_APPROACH, duration, notes, round, subtitle:roundSubtitle(round, finalRound)};
}

export function requiredTaps(note: BeatNote) {
  return note.kind === 'double' ? 2 : 1;
}

export const freshBeatScore = (chart: BeatChart): BeatScore => ({
  errors: chart.notes.map(() => []),
  extras: 0,
  releases: chart.notes.map(() => null),
});

export function noteComplete(score: BeatScore, note: BeatNote, index: number) {
  if (score.errors[index].length < requiredTaps(note)) return false;
  return note.kind !== 'hold' || score.releases[index] !== null;
}

export function recordBeat(chart: BeatChart, score: BeatScore, at: number, lane: BeatLane) {
  let index = -1;
  let distance = Infinity;
  let expected = 0;

  chart.notes.forEach((note, noteIndex) => {
    const hitCount = score.errors[noteIndex].length;
    if (note.lane !== lane || hitCount >= requiredTaps(note)) return;
    const expectedAt = note.at + hitCount * DOUBLE_GAP;
    const candidate = Math.abs(expectedAt - at);
    if (candidate <= BEAT_WINDOW && candidate < distance) {
      index = noteIndex;
      distance = candidate;
      expected = expectedAt;
    }
  });

  if (index < 0) {
    const wrongLane = chart.notes.some((note, noteIndex) => {
      const hitCount = score.errors[noteIndex].length;
      return note.lane !== lane && hitCount < requiredTaps(note) && Math.abs(note.at + hitCount * DOUBLE_GAP - at) <= BEAT_WINDOW;
    });
    return {score:{...score, extras:score.extras + 1}, error:null, wrongLane, note:null, noteIndex:-1, expectedAt:null};
  }

  const errors = score.errors.map(values => [...values]);
  errors[index].push(Math.round(distance));
  return {
    score:{...score, errors},
    error:Math.round(distance),
    wrongLane:false,
    note:chart.notes[index],
    noteIndex:index,
    expectedAt:expected,
  };
}

export function releaseBeat(chart: BeatChart, score: BeatScore, at: number, lane: BeatLane) {
  let index = -1;
  let distance = Infinity;
  let offset = 0;
  chart.notes.forEach((note, noteIndex) => {
    if (note.kind !== 'hold' || note.lane !== lane || score.errors[noteIndex].length === 0 || score.releases[noteIndex] !== null) return;
    const expectedAt = note.at + note.duration;
    const candidate = Math.abs(expectedAt - at);
    if (candidate < distance) { index = noteIndex; distance = candidate; offset = Math.round(at - expectedAt); }
  });
  if (index < 0) return {score, error:null, offset:null, note:null, noteIndex:-1};
  const releases = [...score.releases];
  releases[index] = Math.min(MISS_PENALTY, Math.round(distance));
  return {score:{...score, releases}, error:releases[index], offset, note:chart.notes[index], noteIndex:index};
}

export function beatTotal(chart: BeatChart, score: BeatScore, elapsed = chart.duration) {
  let total = score.extras * EXTRA_PENALTY;
  chart.notes.forEach((note, index) => {
    const taps = requiredTaps(note);
    total += score.errors[index].reduce((sum, error) => sum + error, 0);
    for (let tapIndex = score.errors[index].length; tapIndex < taps; tapIndex++) {
      if (elapsed > note.at + tapIndex * DOUBLE_GAP + BEAT_WINDOW) total += MISS_PENALTY;
    }
    if (note.kind === 'hold' && score.releases[index] !== null) total += score.releases[index]!;
    else if (note.kind === 'hold' && elapsed > note.at + note.duration + BEAT_WINDOW) total += MISS_PENALTY;
  });
  return total;
}

export function beatEventCount(chart: BeatChart) {
  return chart.notes.reduce((total, note) => total + requiredTaps(note) + (note.kind === 'hold' ? 1 : 0), 0);
}

// Round one remains exported for small integrations that only need a demo chart.
export const BEAT_NOTES = beatChartForRound(1).notes;
export const BEAT_DURATION = beatChartForRound(1).duration;
