import test from 'node:test';
import assert from 'node:assert/strict';
import {BEAT_DURATION,BEAT_APPROACH,BEAT_NOTES,BEAT_WINDOW,freshBeatScore,recordBeat,beatTotal} from '../src/beatPanicModel.ts';
test('20-second chart has varied intervals and balanced, playable lanes',()=>{
  assert.equal(BEAT_DURATION,20000);assert.equal(BEAT_NOTES.length,28);
  assert(BEAT_NOTES[0].at>=BEAT_APPROACH);assert(BEAT_NOTES.at(-1).at+BEAT_WINDOW<BEAT_DURATION);
  const intervals=BEAT_NOTES.slice(1).map((n,i)=>n.at-BEAT_NOTES[i].at);
  assert(Math.min(...intervals)>=250);assert(new Set(intervals).size>=4);
  for(const lane of [0,1]){const notes=BEAT_NOTES.filter(n=>n.lane===lane);assert.equal(notes.length,14);for(let i=1;i<notes.length;i++)assert(notes[i].at-notes[i-1].at>=500);}
});
test('on-beat taps score zero and early/late errors add equally',()=>{
  for(const offset of [0,-100,100]){let score=freshBeatScore();for(const note of BEAT_NOTES)score=recordBeat(score,note.at+offset,note.lane).score;assert.equal(beatTotal(score),Math.abs(offset)*28);}
});
test('misses and duplicate taps incur penalties; mashing cannot win',()=>{
  assert.equal(beatTotal(freshBeatScore()),14000);
  let score=recordBeat(freshBeatScore(),1500,0).score;score=recordBeat(score,1501,0).score;
  assert.equal(beatTotal(score),13850);
  let mash=freshBeatScore();for(let at=0;at<BEAT_DURATION;at+=50)for(const lane of [0,1])mash=recordBeat(mash,at,lane).score;
  assert(beatTotal(mash)>14000);
});
test('wrong-side taps never consume the other lane and recovery is possible',()=>{
  const wrong=recordBeat(freshBeatScore(),1500,1);
  assert.equal(wrong.wrongLane,true);assert.equal(wrong.error,null);assert.equal(wrong.score.errors[0],null);assert.equal(wrong.score.extras,1);
  const correct=recordBeat(wrong.score,1500,0);assert.equal(correct.error,0);assert.equal(correct.score.errors[0],0);assert.equal(beatTotal(correct.score,1500),350);
});
test('live misses are only charged after their window closes',()=>{
  assert.equal(beatTotal(freshBeatScore(),1500+BEAT_WINDOW),0);
  assert.equal(beatTotal(freshBeatScore(),1501+BEAT_WINDOW),500);
});
