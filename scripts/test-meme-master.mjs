import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, MONSTER_IDS, makeCaptions, createPlayers, canVote, castVote, simulateBallots, resultsFor, gameLayout, formatTime, MEME_MASTER_PACING, winnerRevealPlan } from '../src/memeMasterModel.ts';

test('voting goes directly from locked captions without a judge countdown', () => assert.equal(PHASES[PHASES.indexOf('locked')+1],'vote'));

test('podium reveals low to high, all voters individually, then holds the final card',()=>{
  const p=createPlayers('grumble','Me'),c=makeCaptions('grumble','Mine','gaming');
  const b=simulateBallots(p,c,'grumble');
  const plan=winnerRevealPlan(p,c,b);
  assert.equal(plan.entries.length,3);
  assert(plan.entries.every((e,i)=>!i||e.rank<=plan.entries[i-1].rank));
  for(const [i,e] of plan.entries.entries()) {
    assert.equal(e.voters.length,e.voteTimes.length);
    assert.equal(e.cardAt-e.start,1750,'Placement gets its own readable entrance before the caption');
    assert(e.voteTimes.every(t=>t>=e.cardAt+1400),'Voters must wait until the caption has landed');
    assert(e.voteTimes.every((t,j)=>!j||t-e.voteTimes[j-1]===750));
    assert(e.start>=(i?plan.entries[i-1].settledAt+1700:1800));
    assert(e.bonusAt>=(e.voteTimes.at(-1)??e.start)+750);
    const score=resultsFor(p,c,b).rows.find(row=>row.id===e.author.id);
    assert.equal(e.voters.length*50+e.bonus,score.points);
  }
  assert.equal(plan.duration-plan.completeAt,6500);
  assert(!('winnerSeconds' in MEME_MASTER_PACING),'A fixed phase timer must not cut the reveal short');
});

test('ties are not presented as invented second or third places',()=>{
  const p=createPlayers('grumble','Me'),c=makeCaptions('grumble','Mine','gaming');
  const b=c.slice(0,4).map(caption=>({voterId:'grumble',captionId:caption.id}));
  const plan=winnerRevealPlan(p,c,b);
  assert.equal(plan.entries.length,4,'Include every jointly winning caption');
  assert(plan.entries.every(e=>e.rank===1&&e.tied&&e.bonus===100));
});

test('the simplified flow has seven phases', () => assert.deepEqual(PHASES, ['intro','rules','compose','locked','vote','winner','scores']));
test('all local monsters preserve names, caption, image and anonymity order', () => {
  for (const id of MONSTER_IDS) {
    const players = createPlayers(id, 'My player');
    assert.equal(players.find(p => p.id === id).name, 'My player');
    const captions = makeCaptions(id, 'My custom caption', 'pool');
    assert.equal(captions.length, 8);
    assert.equal(captions.find(c => c.authorId === id).text, 'My custom caption');
    assert.equal(captions.find(c => c.authorId === id).image, 'pool');
  }
});
test('two distinct votes, no self-vote, no duplicate, no third vote', () => {
  const c = makeCaptions('grumble', 'Mine', 'gaming');
  assert.equal(canVote([], 'grumble', c.find(x => x.authorId === 'grumble')), false);
  let votes = castVote([], 'grumble', c[0]);
  votes = castVote(votes, 'grumble', c[0]);
  assert.equal(votes.length, 1);
  votes = castVote(votes, 'grumble', c[1]);
  assert.equal(votes.length, 2);
  assert.equal(castVote(votes, 'grumble', c[2]), votes);
});
test('all simulated ballots are valid for every selected character', () => {
  for (const id of MONSTER_IDS) {
    const p = createPlayers(id, 'Me'); const c = makeCaptions(id, 'My caption', 'gaming');
    const b = simulateBallots(p, c, id);
    assert.equal(b.length, 14);
    for (const voter of p.filter(x => x.id !== id)) {
      const votes = b.filter(x => x.voterId === voter.id);
      assert.equal(new Set(votes.map(v => v.captionId)).size, 2);
      assert(votes.every(v => c.find(x => x.id === v.captionId).authorId !== voter.id));
    }
    const r = resultsFor(p, c, b);
    assert.equal(r.rows.length, 8);
    assert.equal(r.rows.reduce((n, row) => n + row.votes, 0), 14);
    assert.equal(r.rows.reduce((n, row) => n + row.points, 0), 700 + r.winners.length * 100);
  }
});
test('empty and long captions are handled without a dead end', () => {
  assert.equal(makeCaptions('grumble', '   ', 'gaming').length, 7);
  assert.equal(makeCaptions('grumble', 'X'.repeat(200), 'gaming').find(c => c.authorId === 'grumble').text.length, 140);
});
test('ties get the same winner bonus and scores remain sorted', () => {
  const p = createPlayers('grumble', 'Me'); const c = makeCaptions('grumble', 'Hello', 'gaming');
  const r = resultsFor(p, c, [{ voterId:'grumble', captionId:c[0].id }, { voterId:'grumble', captionId:c[1].id }]);
  assert.equal(r.winners.length, 2);
  assert(r.rows.filter(x => x.votes === 1).every(x => x.points === 150));
  assert(r.rows.every((row, i) => !i || row.total <= r.rows[i-1].total));
});
test('phone, short phone and desktop bounds never overflow', () => {
  for (const [w,h] of [[393,706],[375,667],[430,932],[320,568],[1440,900],[709,1536]]) {
    const l = gameLayout(w,h); assert(l.width <= w); assert(l.height <= h);
    assert(Math.abs(l.sx*709-l.width)<.001); assert(Math.abs(l.sy*1536-l.height)<.001);
  }
  assert.equal(formatTime(60), '01:00'); assert.equal(formatTime(9), '00:09'); assert.equal(formatTime(-1), '00:00');
});
