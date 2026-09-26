// Keep the reading beats independent from the animation durations.
export const REVEAL_BEATS = { firstRow:650, rowStagger:480, rowArrival:320, tableRead:2400, spotlight:3900, stampHold:3000, exit:1100 } as const;
export function tapRevealTiming(playerCount:number, hasElimination=true) {
  const tableSettled=REVEAL_BEATS.firstRow+Math.max(0,playerCount-1)*REVEAL_BEATS.rowStagger+REVEAL_BEATS.rowArrival;
  const spotlightAt=tableSettled+REVEAL_BEATS.tableRead;
  const stampAt=spotlightAt+REVEAL_BEATS.spotlight;
  const kickAt=stampAt+REVEAL_BEATS.stampHold;
  return {tableSettled,spotlightAt,stampAt,kickAt,end:hasElimination?kickAt+REVEAL_BEATS.exit:spotlightAt+900};
}
const roasts=[
  'Grandma taps faster.',
  'Was your thumb buffering?',
  'Great tap. Wrong century.',
  'Your thumb was on annual leave.',
  'A strong result. For a sloth.',
  'Speed was more of a suggestion.',
  'Your thumb has left the chat.',
];
export const eliminationQuip=(round:number)=>roasts[Math.max(0,round-1)%roasts.length];
export function reactionQuip(ms:number|null) {
  if(ms===null)return 'Your thumb has left the chat.';
  if(ms<300)return 'Alright, show-off.';
  if(ms<500)return 'Look at you, doing things.';
  return 'Was your thumb buffering?';
}

export const FINALE_BEATS = { stamp:8000, exit:10500, champion:12000, scores:18500, rowStagger:330, count:1200, ready:24000, end:24500, tieEnd:9000 } as const;
