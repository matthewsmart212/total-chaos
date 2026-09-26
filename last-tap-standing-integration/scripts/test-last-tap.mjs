import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTapPlayers, eliminatePlayer, lastTapScoreRows, LAST_TAP_PHASES,
  predictionPoints, resolveTapRound, simulateRivals, TAP_PACING,
} from '../src/lastTapModel.ts';
import {beatChartForRound, beatEventCount} from '../src/beatPanicModel.ts';
import {tapRevealTiming} from '../src/lastTapPresentation.ts';

test('Beat Panic exposes only the knockout flow phases', () => {
  assert.deepEqual(LAST_TAP_PHASES, ['welcome','rules','target','playing','locked','results','final','eliminated','winner']);
  assert.deepEqual(TAP_PACING, {preview:6,locked:3,final:5,entryMs:720,exitMs:180});
});

test('demo player count supports short games through an eight-player bracket', () => {
  for (let opponents = 1; opponents <= 7; opponents++) {
    let players = createTapPlayers('bop', 'Tester', opponents);
    assert.equal(players.length, opponents + 1);
    assert.equal(new Set(players.map(player => player.id)).size, opponents + 1);
    for (let round = 1; round <= opponents; round++) {
      const active = players.filter(player => player.eliminatedRound === null);
      players = eliminatePlayer(players, resolveTapRound(round, active.map((player, index) => ({id:player.id,ms:200+index*100,wrongTaps:0}))));
    }
    assert.equal(players.filter(player => player.eliminatedRound === null).length, 1);
    assert.equal(players[0].score, opponents * 100);
  }
  assert.equal(createTapPlayers('bop', 'Tester', 0).length, 2);
  assert.equal(createTapPlayers('bop', 'Tester', 99).length, 8);
});

test('simulated rivals play the active Beat Panic chart and tighten by round', () => {
  const players = createTapPlayers('grumble', 'Tester');
  const roundOne = simulateRivals(players, 'grumble', 1, () => .5);
  const roundFive = simulateRivals(players, 'grumble', 5, () => .5);
  assert.equal(roundOne.length, 7);
  assert(roundOne.every(result => result.ms === roundOne[0].ms && result.ms > 0));
  assert.equal(roundOne[0].ms, Math.round(beatEventCount(beatChartForRound(1)) * (67 + 166 / 2)));
  assert(roundFive[0].ms / beatEventCount(beatChartForRound(5)) < roundOne[0].ms / beatEventCount(beatChartForRound(1)));
  players[2].eliminatedRound = 1;
  assert(!simulateRivals(players, 'grumble', 2, () => .5).some(result => result.id === players[2].id || result.id === 'grumble'));
});

test('highest timing error is eliminated and exact last-place ties replay', () => {
  const make = (id, ms) => ({id, ms, wrongTaps:0});
  const result = resolveTapRound(1, [make('bop', null), make('gloop', 850), make('brrr', 201)]);
  assert.equal(result.eliminatedId, 'bop');
  assert.equal(result.results[0].id, 'brrr');
  for (const score of [null, 420]) {
    const tie = resolveTapRound(1, [make('bop', score), make('gloop', score)]);
    assert.equal(tie.tied, true);
    assert.equal(tie.eliminatedId, null);
  }
});

test('survival points settle once and total 700 for an eight-player champion', () => {
  let players = createTapPlayers('grumble', '  Taylor  ');
  assert.equal(players[0].name, 'Taylor');
  for (let round = 1; round <= 7; round++) {
    const active = players.filter(player => player.eliminatedRound === null);
    const result = resolveTapRound(round, active.map((player, index) => ({id:player.id,ms:200+index*50,wrongTaps:0})));
    players = eliminatePlayer(players, result);
    assert.deepEqual(eliminatePlayer(players, result), players);
  }
  assert.equal(players[0].score, 700);
  assert.equal(players.at(-1).score, 0);
});

test('watch-party predictions and final score recap stay deterministic', () => {
  const results = [{id:'snicker',ms:250,wrongTaps:0},{id:'gloop',ms:250,wrongTaps:0},{id:'brrr',ms:300,wrongTaps:0},{id:'peepers',ms:null,wrongTaps:0}];
  assert.equal(predictionPoints('snicker', results), 25);
  assert.equal(predictionPoints('gloop', results), 25);
  assert.equal(predictionPoints('brrr', results), 0);
  assert.equal(predictionPoints('peepers', results), 0);
  assert.equal(predictionPoints(null, results), 0);

  let players = createTapPlayers('grumble', 'Tester');
  for (let round = 1; round <= 7; round++) {
    const active = players.filter(player => player.eliminatedRound === null);
    players = eliminatePlayer(players, resolveTapRound(round, active.map((player, index) => ({id:player.id,ms:200+index*50,wrongTaps:0}))));
  }
  const rows = lastTapScoreRows(players, 'bop', 75);
  assert.equal(rows.find(player => player.id === 'bop').total, 75);
  assert.equal(rows.find(player => player.id === 'grumble').total, 700);
  assert.equal(rows.filter(player => player.champion).length, 1);
});

test('elimination reveal pacing keeps every key moment readable', () => {
  for (const count of [2,3,4,5,6,7,8]) {
    const timing = tapRevealTiming(count);
    assert(timing.spotlightAt - timing.tableSettled >= 1500);
    assert(timing.stampAt - timing.spotlightAt >= 2300);
    assert(timing.kickAt - timing.stampAt >= 1800);
    assert(timing.end - timing.kickAt >= 800);
  }
});
