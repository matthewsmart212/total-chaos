import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAT_APPROACH, BEAT_WINDOW, DOUBLE_GAP, EXTRA_PENALTY, MISS_PENALTY,
  beatChartForRound, beatEventCount, beatTotal, freshBeatScore, noteComplete,
  recordBeat, releaseBeat, requiredTaps,
} from '../src/beatPanicModel.ts';

test('charts grow longer and add the promised rhythm grammar', () => {
  const rounds = Array.from({length:5}, (_, index) => beatChartForRound(index + 1));
  assert.deepEqual(rounds.map(chart => chart.duration), [22000, 24000, 26000, 28000, 30000]);
  for (const chart of rounds) {
    assert.equal(chart.approach, BEAT_APPROACH);
    assert(chart.notes[0].at >= BEAT_APPROACH);
    assert(chart.notes.at(-1).at + BEAT_WINDOW < chart.duration);
    assert.deepEqual([...new Set(chart.notes.map(note => note.lane))].sort(), [0, 1, 2, 3]);
    assert.equal(new Set(chart.notes.map(note => note.id)).size, chart.notes.length);
  }
  assert(rounds[1].notes.some(note => note.kind === 'double'));
  assert(rounds[2].notes.some(note => note.kind === 'hold'));
  assert(rounds[3].notes.some((note, index, notes) => notes.some((other, otherIndex) => otherIndex !== index && other.at === note.at)));
  const final = beatChartForRound(7, true);
  assert.equal(final.duration, 34000);
  assert(final.notes.length > rounds.at(-1).notes.length);
  assert.match(final.subtitle, /PANIC MODE/);
});

test('holds never overlap another input and never finish a round', () => {
  const charts = [
    ...Array.from({length:7}, (_, index) => beatChartForRound(index + 1)),
    beatChartForRound(7, true),
  ];

  for (const chart of charts) {
    const last = chart.notes.at(-1);
    assert.notEqual(last.kind, 'hold');

    for (const hold of chart.notes.filter(note => note.kind === 'hold')) {
      const overlapping = chart.notes.filter(note =>
        note.id !== hold.id && note.at >= hold.at && note.at < hold.at + hold.duration
      );
      assert.deepEqual(overlapping, [], `${hold.id} overlaps another required input`);

      const following = chart.notes.find(note => note.at > hold.at);
      if (following) assert(following.at >= hold.at + hold.duration);
    }
  }
});

test('perfect taps, doubles and hold releases can score zero', () => {
  const chart = beatChartForRound(3);
  let score = freshBeatScore(chart);
  chart.notes.forEach((note, index) => {
    for (let tap = 0; tap < requiredTaps(note); tap++) {
      score = recordBeat(chart, score, note.at + tap * DOUBLE_GAP, note.lane).score;
    }
    if (note.kind === 'hold') score = releaseBeat(chart, score, note.at + note.duration, note.lane).score;
    assert(noteComplete(score, note, index));
  });
  assert.equal(beatTotal(chart, score), 0);
  assert.equal(beatEventCount(chart), chart.notes.reduce((sum, note) => sum + requiredTaps(note) + (note.kind === 'hold' ? 1 : 0), 0));
});

test('early and late timing errors are symmetric', () => {
  const chart = beatChartForRound(1);
  for (const offset of [-100, 100]) {
    let score = freshBeatScore(chart);
    for (const note of chart.notes) score = recordBeat(chart, score, note.at + offset, note.lane).score;
    assert.equal(beatTotal(chart, score), chart.notes.length * Math.abs(offset));
  }
});

test('tap, double and hold timing use the exact chart windows', () => {
  const tap = beatChartForRound(1).notes[0];
  const tapChart = {...beatChartForRound(1), notes:[tap]};
  for (const offset of [-BEAT_WINDOW, BEAT_WINDOW]) {
    const hit = recordBeat(tapChart, freshBeatScore(tapChart), tap.at + offset, tap.lane);
    assert.equal(hit.error, BEAT_WINDOW);
    assert.equal(beatTotal(tapChart, hit.score), BEAT_WINDOW);
  }
  const outside = recordBeat(tapChart, freshBeatScore(tapChart), tap.at + BEAT_WINDOW + 1, tap.lane);
  assert.equal(outside.error, null);
  assert.equal(beatTotal(tapChart, outside.score), MISS_PENALTY + EXTRA_PENALTY);

  const double = beatChartForRound(2).notes.find(note => note.kind === 'double');
  const doubleChart = {...beatChartForRound(2), notes:[double]};
  let doubleScore = recordBeat(doubleChart, freshBeatScore(doubleChart), double.at, double.lane).score;
  doubleScore = recordBeat(doubleChart, doubleScore, double.at + DOUBLE_GAP, double.lane).score;
  assert.equal(beatTotal(doubleChart, doubleScore), 0);

  const hold = beatChartForRound(3).notes.find(note => note.kind === 'hold');
  const holdChart = {...beatChartForRound(3), notes:[hold]};
  for (const offset of [-137, 137]) {
    const pressed = recordBeat(holdChart, freshBeatScore(holdChart), hold.at, hold.lane).score;
    const released = releaseBeat(holdChart, pressed, hold.at + hold.duration + offset, hold.lane);
    assert.equal(released.error, 137);
    assert.equal(released.offset, offset);
    assert.equal(beatTotal(holdChart, released.score), 137);
  }
  assert.equal(beatTotal(holdChart, freshBeatScore(holdChart)), MISS_PENALTY * 2);
});

test('wrong directions and mashing add penalties without consuming valid notes', () => {
  const chart = beatChartForRound(1);
  const first = chart.notes[0];
  const wrongLane = ((first.lane + 1) % 4);
  const wrong = recordBeat(chart, freshBeatScore(chart), first.at, wrongLane);
  assert.equal(wrong.wrongLane, true);
  assert.equal(wrong.error, null);
  assert.equal(wrong.score.extras, 1);
  const recovered = recordBeat(chart, wrong.score, first.at, first.lane);
  assert.equal(recovered.error, 0);
  assert.equal(beatTotal(chart, recovered.score, first.at), EXTRA_PENALTY);

  let mash = freshBeatScore(chart);
  for (let at = 0; at < chart.duration; at += 50) {
    for (const lane of [0, 1, 2, 3]) mash = recordBeat(chart, mash, at, lane).score;
  }
  assert(beatTotal(chart, mash) > chart.notes.length * MISS_PENALTY);
});

test('misses are charged only after their timing window closes', () => {
  const chart = beatChartForRound(1);
  const first = chart.notes[0];
  assert.equal(beatTotal(chart, freshBeatScore(chart), first.at + BEAT_WINDOW), 0);
  assert.equal(beatTotal(chart, freshBeatScore(chart), first.at + BEAT_WINDOW + 1), MISS_PENALTY);
});
