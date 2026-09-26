export const BEAT_DURATION=20000;
export const BEAT_WINDOW=220;
export const BEAT_APPROACH=1500;
export type BeatLane=0|1;
export const BEAT_NOTES:{at:number;lane:BeatLane}[]=[
  [1500,0],[2500,1],[3500,0],[4250,1],[5000,0],[5500,1],[6500,1],
  [7000,0],[7750,1],[8000,0],[8750,1],[9250,0],[10500,0],[11000,1],
  [11250,0],[12000,1],[12750,0],[13000,1],[14000,0],[14750,1],[15250,0],
  [15500,1],[16250,0],[16750,1],[17750,0],[18000,1],[18500,0],[19000,1],
].map(([at,lane])=>({at,lane:lane as BeatLane}));
export type BeatScore={errors:(number|null)[];extras:number};
export const freshBeatScore=():BeatScore=>({errors:BEAT_NOTES.map(()=>null),extras:0});
export function recordBeat(score:BeatScore,at:number,lane:BeatLane){
  let index=-1,distance=Infinity;
  BEAT_NOTES.forEach((note,i)=>{const d=Math.abs(note.at-at);if(note.lane===lane&&score.errors[i]===null&&d<=BEAT_WINDOW&&d<distance){index=i;distance=d;}});
  if(index<0)return {score:{...score,extras:score.extras+1},error:null,wrongLane:BEAT_NOTES.some((note,i)=>note.lane!==lane&&score.errors[i]===null&&Math.abs(note.at-at)<=BEAT_WINDOW)};
  const errors=[...score.errors];errors[index]=Math.round(distance);
  return {score:{...score,errors},error:Math.round(distance),wrongLane:false};
}
export function beatTotal(score:BeatScore,elapsed=BEAT_DURATION){
  return score.extras*350+score.errors.reduce<number>((sum,error,i)=>sum+(error??(elapsed>BEAT_NOTES[i].at+BEAT_WINDOW?500:0)),0);
}
