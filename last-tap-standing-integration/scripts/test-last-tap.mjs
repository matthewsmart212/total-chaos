import test from 'node:test';
import assert from 'node:assert/strict';
import { createTapPlayers, eliminatePlayer, makeSnapSequence, makeTapSequence, modeForRound, reactionAt, resolveTapRound, simulateRivals, targetForRound, TAP_PACING, predictionPoints, lastTapScoreRows } from '../src/lastTapModel.ts';
import { tapRevealTiming } from '../src/lastTapPresentation.ts';
import { GAME_ORDERS } from '../src/lastTapModel.ts';

test('all six test orders repeat and Beat rivals use timing-error scores even in round one',()=>{
  assert.equal(new Set(GAME_ORDERS.map(order=>order.join(','))).size,6);
  for(const order of GAME_ORDERS){
    assert.equal(new Set(order).size,3);
    for(let round=1;round<=7;round++)assert.equal(modeForRound(round,order),order[(round-1)%3]);
  }
  const players=createTapPlayers('grumble','Tester');
  assert.equal(simulateRivals(players,'grumble',1,()=>.5,'beat')[0].ms,3220);
  assert.notEqual(simulateRivals(players,'grumble',3,()=>.5,'target')[0].ms,1400);
});

test('temporary demo count supports short games through the final with matching scores', () => {
  for (let count = 1; count <= 7; count++) {
    let players = createTapPlayers('bop', 'Tester', count);
    assert.equal(players.length, count + 1);
    assert.equal(new Set(players.map(p => p.id)).size, count + 1);
    assert.equal(players[0].name, 'Tester');
    for (let round = 1; round <= count; round++) {
      const active = players.filter(p => p.eliminatedRound === null);
      const result = resolveTapRound(round, active.map((p, i) => ({id:p.id, ms:200+i*100, wrongTaps:0})));
      players = eliminatePlayer(players, result);
    }
    assert.equal(players.filter(p => p.eliminatedRound === null).length, 1);
    assert.equal(players[0].score, count * 100);
    assert.equal(createTapPlayers('bop', 'Tester', players.length - 1).length, count + 1);
  }
  assert.equal(createTapPlayers('bop', 'Tester', 0).length, 2);
  assert.equal(createTapPlayers('bop', 'Tester', 99).length, 8);
  assert.equal(createTapPlayers('bop', 'Tester', NaN).length, 8);
});

test('reading and input windows survive the entrance and elimination animations', () => {
  assert.equal(TAP_PACING.remember,7);
  assert.equal(TAP_PACING.locked,5);
  assert.equal(TAP_PACING.final,5);
  for(const count of [2,3,4,5,6,7,8]) {
    const t=tapRevealTiming(count);
    assert(t.spotlightAt-t.tableSettled>=2400,'all rows stay readable before the spotlight');
    assert(t.stampAt-t.spotlightAt>=3900,'moment of shame holds for an extra two seconds');
    assert(t.kickAt-t.stampAt>=3000,'the eliminated name and stamp have a readable hold');
    assert(t.end-t.kickAt>=1000,'incoming countdown settles before it ticks');
    assert(tapRevealTiming(count,false).end<t.end,'ties skip the elimination performance');
  }
});

test('predictions reward tied fastest valid taps, never misses or no choice', () => {
  const results = [{id:'snicker',ms:250,wrongTaps:0},{id:'gloop',ms:250,wrongTaps:0},{id:'brrr',ms:300,wrongTaps:0},{id:'peepers',ms:null,wrongTaps:0}];
  assert.equal(predictionPoints('snicker',results),25);
  assert.equal(predictionPoints('gloop',results),25);
  assert.equal(predictionPoints('brrr',results),0);
  assert.equal(predictionPoints('peepers',results),0);
  assert.equal(predictionPoints(null,results),0);
  assert.equal(predictionPoints('peepers',[results[3]]),0);
  assert.equal(predictionPoints('snicker',[]),0);
});

test('eight unique players retain their slots as eliminations accumulate', () => {
  for (const local of ['grumble', 'snicker', 'bop']) {
    let players = createTapPlayers(local, 'Matthias');
    assert.equal(players.length, 8); assert.equal(new Set(players.map(p => p.id)).size, 8);
    assert.equal(players[0].name, 'Matthias');
    const originalOrder = players.map(p => p.id);
    for (let round = 1; round <= 7; round++) {
      const active = players.filter(p => p.eliminatedRound === null);
      const result = resolveTapRound(round, active.map((p, i) => ({ id: p.id, ms: 200 + i * 100, wrongTaps: 0 })));
      players = eliminatePlayer(players, result);
      assert.deepEqual(players.map(p => p.id), originalOrder);
      assert.equal(players.filter(p => p.eliminatedRound !== null).length, round);
    }
    assert.equal(players.filter(p => p.eliminatedRound === null)[0].id, local);
  }
});
test('reaction uses target display time and rejects premature, locked and late taps', () => {
  assert.equal(reactionAt(1400, null, 0), null);
  assert.equal(reactionAt(999, 1000, 0), null);
  assert.equal(reactionAt(1284, 1000, 0), 284);
  assert.equal(reactionAt(1284, 1000, 1600), null);
  assert.equal(reactionAt(1700, 1000, 1600), 700);
  assert.equal(reactionAt(1001 + TAP_PACING.targetWindowMs, 1000, 0), null);
});
test('missed targets rank after valid taps; last-place ties replay without arbitrary elimination', () => {
  const make = (id, ms) => ({ id, ms, wrongTaps: 0 });
  const missed = resolveTapRound(1, [make('bop', null), make('gloop', 850), make('brrr', 201)]);
  assert.equal(missed.eliminatedId, 'bop'); assert.equal(missed.results[0].id, 'brrr');
  for (const time of [null, 420]) {
    const tie = resolveTapRound(1, [make('bop', time), make('gloop', time)]);
    assert.equal(tie.tied, true); assert.equal(tie.eliminatedId, null);
  }
});
test('target occurs once with unpredictable distractors before and three seconds of cycling after', () => {
  for (let round = 1; round <= 7; round++) {
    const target = targetForRound(round);
    for (const random of [() => 0, () => .999]) {
      const seq = makeTapSequence(target, round, random);
      const targetIndex = seq.cards.indexOf(target);
      assert(targetIndex >= 7 && targetIndex <= 13);
      assert((seq.cards.length - targetIndex - 1) * seq.intervalMs >= TAP_PACING.targetWindowMs);
      assert.equal(seq.cards.filter(c => c === target).length, 1);
      assert(seq.cards.at(-1) !== target);
      assert(seq.cards.every((c, i) => i === 0 || c !== seq.cards[i - 1]));
      assert(seq.intervalMs >= 230 && seq.intervalMs <= 410);
    }
  }
});
test('Chaos Snap alternates with Target Hunt and deals one fair match window', () => {
  assert.deepEqual(Array.from({length:7},(_,i)=>modeForRound(i+1)), ['target','snap','beat','target','snap','beat','target']);
  assert.equal(TAP_PACING.snapIntro,5);
  for (let round = 2; round <= 8; round += 2) {
    for (const random of [() => 0, () => .999]) {
      const seq = makeSnapSequence(round, random);
      assert(seq.snapIndex >= 7 && seq.snapIndex <= 12, 'the snap must arrive after an unpredictable run-up');
      assert.equal(seq.cards[seq.snapIndex], seq.cards[seq.snapIndex - 1]);
      assert.equal(seq.cards.filter((card,i)=>i>0&&card===seq.cards[i-1]).length, 1, 'only the authored pair may match');
      assert((seq.cards.length - seq.snapIndex - 1) * seq.intervalMs >= TAP_PACING.targetWindowMs, 'the response window stays alive after the pair');
      assert(seq.intervalMs >= 360 && seq.intervalMs <= 610);
    }
  }
});
test('demo rivals never replace local measured input or revive eliminated players', () => {
  const players = createTapPlayers('grumble', 'YOU'); players[2].eliminatedRound = 1;
  const rivals = simulateRivals(players, 'grumble', 2, () => .5);
  assert.equal(rivals.length, 6); assert(!rivals.some(r => r.id === 'grumble' || r.id === players[2].id));
  assert(rivals.every(r => r.ms > 0));
});


test('survival points settle once, exclude eliminated players and total 700 for the champion', () => {
  let players = createTapPlayers('grumble', '  TaylorSwiftTap  ');
  assert.equal(players[0].name, 'TaylorSwiftTap');
  assert(players.slice(1).every(p => p.name.toLowerCase() !== p.id));
  for (let round = 1; round <= 7; round++) {
    const alive = players.filter(p => p.eliminatedRound === null);
    const result = resolveTapRound(round, alive.map((p,i) => ({id:p.id,ms:200+i*50,wrongTaps:0})));
    const before = players;
    players = eliminatePlayer(players,result);
    for(const p of players){
      const old = before.find(x=>x.id===p.id);
      assert.equal(p.score,old.score+(old.eliminatedRound===null&&p.id!==result.eliminatedId?100:0));
    }
    assert.deepEqual(eliminatePlayer(players,result),players,'repeated reveal must not double award');
  }
  assert.equal(players[0].score,700);
  assert.equal(players.at(-1).score,0);
  const tiedPlayers=createTapPlayers('grumble','Matthias');
  const tie=resolveTapRound(1,tiedPlayers.map(p=>({id:p.id,ms:400,wrongTaps:0})));
  assert.deepEqual(eliminatePlayer(tiedPlayers,tie),tiedPlayers,'a replay must not farm survival points');
});


test('score recap combines earned survival and prediction points without inventing rival bonuses',()=>{
  let players=createTapPlayers('grumble','Matthias');
  for(let round=1;round<=7;round++)players=eliminatePlayer(players,resolveTapRound(round,players.filter(p=>p.eliminatedRound===null).map((p,i)=>({id:p.id,ms:200+i*50,wrongTaps:0}))));
  const rows=lastTapScoreRows(players,'bop',75);
  assert.equal(rows.find(p=>p.id==='bop').total,75);assert.equal(rows.find(p=>p.id==='grumble').total,700);
  assert.equal(rows.filter(p=>p.champion).length,1);assert.equal(rows.find(p=>p.champion).id,'grumble');
  assert(rows.filter(p=>p.id!=='bop').every(p=>p.bonus===0));assert(rows.every((p,i)=>i===0||rows[i-1].total>=p.total));
});
