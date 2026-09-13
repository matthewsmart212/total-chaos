/** Pure game rules. The transport is still the app's local demo party. */
export const PHASES = ['intro', 'rules', 'compose', 'locked', 'vote', 'winner', 'scores'] as const;
export type MemePhase = typeof PHASES[number];
export const MONSTER_IDS = ['grumble', 'gloop', 'brrr', 'peepers', 'dozy', 'bop', 'snicker', 'scraps'] as const;
export type MonsterId = typeof MONSTER_IDS[number];
export type MemeImage = 'gaming' | 'pool' | 'party' | 'work';
export type Player = { id: MonsterId; name: string; previousScore: number };
export type Caption = { id: string; authorId: MonsterId; text: string; image: MemeImage };
export type Ballot = { voterId: MonsterId; captionId: string };
export const CAPTION_LIMIT = 140;
export const VOTES_PER_PLAYER = 2;
export const POINTS_PER_VOTE = 50;
export const WINNER_BONUS = 100;
export const MEME_MASTER_PACING = {
  composeSeconds: 60,
  lockedSeconds: 9,
  voteSeconds: 60,
  scoresSeconds: 12,
} as const;

export function createPlayers(localId: MonsterId, name: string): Player[] {
  const scores = [140, 175, 140, 40, 75, 120, 190, 110];
  const demoNames: Record<MonsterId,string> = {
    grumble: 'MATTHIAS',
    gloop: 'ANITAID',
    brrr: 'CRYSTALINA',
    peepers: 'BON BEE',
    dozy: 'SCARLETTO',
    bop: 'MILO',
    snicker: 'JESS',
    scraps: 'RILEY',
  };
  return MONSTER_IDS.map((id, i) => ({ id, name: id === localId ? name.trim() || demoNames[id] : demoNames[id], previousScore: scores[i] }));
}

export function makeCaptions(localId: MonsterId, text: string, image: MemeImage): Caption[] {
  const prompts: Record<MonsterId, [string, MemeImage]> = {
    grumble: ['My social battery has entered low power mode.', 'work'],
    gloop: ['POV: you said you were having a quiet night.', 'party'],
    brrr: ['Me practising for a conversation that will never happen.', 'gaming'],
    peepers: ['Out of office. Out of brain cells.', 'pool'],
    dozy: ['One more game. Famous last words.', 'gaming'],
    bop: ["I'm not late, I'm in beta.", 'work'],
    snicker: ['When you say “I’m just having one drink”.', 'party'],
    scraps: ['My responsibilities can’t swim.', 'pool'],
  };
  // Fixed anonymous order is reproducible in the demo; names remain hidden.
  const order: MonsterId[] = ['snicker', 'brrr', 'bop', 'dozy', 'peepers', 'grumble', 'scraps', 'gloop'];
  return order.flatMap(id => {
    const [caption, scene] = id === localId ? [text.trim().slice(0, CAPTION_LIMIT), image] : prompts[id];
    return caption ? [{ id: `caption-${id}`, authorId: id, text: caption, image: scene as MemeImage }] : [];
  });
}

export function canVote(ballots: Ballot[], voterId: MonsterId, caption: Caption): boolean {
  const votes = ballots.filter(v => v.voterId === voterId);
  return caption.authorId !== voterId && votes.length < VOTES_PER_PLAYER && !votes.some(v => v.captionId === caption.id);
}

export function castVote(ballots: Ballot[], voterId: MonsterId, caption: Caption): Ballot[] {
  return canVote(ballots, voterId, caption) ? [...ballots, { voterId, captionId: caption.id }] : ballots;
}

export function simulateBallots(players: Player[], captions: Caption[], localId: MonsterId): Ballot[] {
  let ballots: Ballot[] = [];
  players.filter(p => p.id !== localId).forEach((p, index) => {
    const favourite = captions.find(c => c.authorId === 'bop' && c.authorId !== p.id);
    if (favourite) ballots = castVote(ballots, p.id, favourite);
    const candidates = captions.filter(c => canVote(ballots, p.id, c));
    if (candidates.length) ballots = castVote(ballots, p.id, candidates[index % candidates.length]);
    const extra = captions.find(c => canVote(ballots, p.id, c));
    if (extra) ballots = castVote(ballots, p.id, extra);
  });
  return ballots;
}

export function resultsFor(players: Player[], captions: Caption[], ballots: Ballot[]) {
  const count = (id: string) => ballots.filter(v => v.captionId === id).length;
  const rankedCaptions = [...captions].sort((a, b) => count(b.id) - count(a.id));
  const highest = rankedCaptions[0] ? count(rankedCaptions[0].id) : 0;
  const winners = rankedCaptions.filter(c => highest > 0 && count(c.id) === highest);
  const previousOrder = [...players].sort((a, b) => b.previousScore - a.previousScore);
  const rows = players.map(p => {
    const caption = captions.find(c => c.authorId === p.id);
    const votes = caption ? count(caption.id) : 0;
    const bonus = winners.some(c => c.authorId === p.id) ? WINNER_BONUS : 0;
    const points = votes * POINTS_PER_VOTE + bonus;
    return { ...p, votes, points, total: p.previousScore + points, movement: 0 };
  }).sort((a, b) => b.total - a.total || MONSTER_IDS.indexOf(a.id) - MONSTER_IDS.indexOf(b.id))
    .map((p, i) => ({ ...p, movement: previousOrder.findIndex(old => old.id === p.id) - i }));
  return { rows, winners, rankedCaptions, highest };
}

/** One shared schedule drives the cards, voter arrivals, points and completion.
 * Tied captions retain their real competition rank (never invent a tie-break). */
export function winnerRevealPlan(players: Player[], captions: Caption[], ballots: Ballot[]) {
  const result=resultsFor(players,captions,ballots);
  const selected=result.rankedCaptions.slice(0,Math.max(3,result.winners.length));
  let cursor=1800;
  const entries=[...selected].reverse().map(caption=>{
    const voters=ballots.filter(v=>v.captionId===caption.id).map(v=>players.find(p=>p.id===v.voterId)!);
    const rank=1+result.rankedCaptions.filter(c=>ballots.filter(v=>v.captionId===c.id).length>voters.length).length;
    const tied=result.rankedCaptions.filter(c=>ballots.filter(v=>v.captionId===c.id).length===voters.length).length>1;
    const bonus=result.winners.some(c=>c.id===caption.id)?WINNER_BONUS:0;
    const start=cursor;
    const cardAt=start+1750;
    const voteTimes=voters.map((_,i)=>cardAt+1400+i*750);
    const bonusAt=cardAt+1400+voters.length*750;
    const settledAt=bonusAt+900;
    cursor=settledAt+1700;
    return {caption,author:players.find(p=>p.id===caption.authorId)!,voters,rank,tied,bonus,start,cardAt,voteTimes,bonusAt,settledAt};
  });
  const completeAt=entries.at(-1)?.settledAt??1800;
  return {entries,completeAt,duration:completeAt+6500};
}

export function formatTime(seconds: number) {
  return `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
}

/** Design-space bounds stay full width; only vertical whitespace is compressed. */
export function gameLayout(width: number, height: number) {
  const canvasWidth = Math.min(709, width, height * .7);
  const sx = canvasWidth / 709;
  const canvasHeight = Math.min(height, 1536 * sx);
  const sy = canvasHeight / 1536;
  return { width: canvasWidth, height: canvasHeight, sx, sy, unit: Math.min(sx, sy * 1.12) };
}
