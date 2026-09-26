const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const babel = require('@babel/core');
const observed = [];
let motionTime=0, motionReduced=false;
const motionClock={interpolate({inputRange,outputRange}){
  if(motionTime<=inputRange[0])return outputRange[0];
  const last=inputRange.length-1;
  if(motionTime>=inputRange[last])return outputRange[last];
  const i=inputRange.findIndex(t=>t>motionTime)-1;
  return typeof outputRange[i]==='number'?outputRange[i]+(outputRange[i+1]-outputRange[i])*(motionTime-inputRange[i])/(inputRange[i+1]-inputRange[i]):outputRange[i];
}};
const component = kind => props => { observed.push({kind, ...props}); return React.createElement('div', null, props.children); };
const native = {
  View: component('View'), Text: component('Text'), Image: component('Image'), Pressable: component('Pressable'),
  Modal: ({visible, children}) => visible ? children : null, Platform: {OS:'web'},
  StyleSheet: {absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},
  Animated: {View:component('AnimatedView'),Value:class{constructor(v){this.value=v;}interpolate(){return 1;}}},
};
const realLoad = Module._load;
Module._load = function(id,parent,isMain){
  if(id==='./src/gameMotion')return {useMotionClock:()=>({clock:motionClock,now:motionTime,reduced:motionReduced})};
  if(id==='../src/sounds')return {playNarration(){},stopSound(){},stopAllNarration(){},fadeLastTapMusicTo(){}};
  if(id==='react-native')return native;
  if(id==='expo-linear-gradient')return {LinearGradient:component('Gradient')};
  return realLoad.call(this,id,parent,isMain);
};
for(const extension of ['.jpg','.webp','.png','.ttf']) Module._extensions[extension]=(mod,filename)=>{mod.exports={uri:filename.replace(/\\/g,'/')};};
for(const extension of ['.ts','.tsx']) Module._extensions[extension]=(mod,filename)=>{
  const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,plugins:[['@babel/plugin-transform-typescript',{isTSX:extension==='.tsx',allowDeclareFields:true}],['@babel/plugin-transform-react-jsx',{runtime:'classic'}],'@babel/plugin-transform-modules-commonjs']}).code;
  mod._compile(code,filename);
};
let forcedPlayers, forcedRound, forcedCardIndex, forcedSequence, forcedResult, forcedRevealed, forcedPrediction, forcedReaction, hook=0;
const originalState=React.useState;
React.useState=(initial)=>{const i=hook++;return originalState(i===1?forcedPlayers:i===2&&forcedRound!==undefined?forcedRound:i===4&&forcedCardIndex!==undefined?forcedCardIndex:i===5&&forcedSequence!==undefined?forcedSequence:i===6&&forcedReaction!==undefined?forcedReaction:i===7?forcedResult:i===16 && forcedRevealed!==undefined?forcedRevealed:i===19 && forcedPrediction!==undefined?forcedPrediction:initial);};
const Game=require('../LastTapStandingGame.tsx').default;
const {BeatJudgmentEffect}=require('../src/BeatPanic.tsx');
test('beat judgments have distinct bounded effects and a reduced-motion alternative',()=>{
  for(const kind of ['perfect','nice','off','miss','wrong'])for(const reduced of [false,true]){
    observed.length=0;
    const html=renderToStaticMarkup(React.createElement(BeatJudgmentEffect,{kind,reduced,progress:new native.Animated.Value(0),size:80,width:169,top:202,u:1}));
    assert(observed.some(n=>n.testID===`beat-judgment-${kind}`));
    assert.equal(observed.filter(n=>n.testID==='beat-perfect-spark').length,!reduced&&kind==='perfect'?6:0);
    assert.equal(observed.some(n=>n.testID==='beat-impact-ring'),!reduced&&['perfect','nice'].includes(kind));
    assert.equal(observed.some(n=>n.kind==='AnimatedView'),!reduced);
    assert(html.includes({perfect:'PERFECT!',nice:'NICE!',off:'OFF BEAT',miss:'MISSED',wrong:'WRONG TAP'}[kind]));
  }
});
const {createTapPlayers,resolveTapRound,eliminatePlayer,makeSnapSequence}=require('../src/lastTapModel.ts');
const {tapRevealTiming}=require('../src/lastTapPresentation.ts');
for(const phase of ['welcome','rules','target','playing','locked','results','final','eliminated','practice','winner']) {
  test(`${phase} renders layered art and correct live state at phone sizes`,()=>{
    for(const [viewportWidth,viewportHeight] of [[390,844],[393,706],[320,568]]) {
      forcedPlayers=createTapPlayers('grumble','Matthias');
      const outCount=phase==='final'?6:phase==='winner'?7:['target','playing','locked','results'].includes(phase)?2:0;
      forcedPlayers=forcedPlayers.map((p,i)=>({...p,eliminatedRound:i>=8-outCount?i:null}));
      forcedResult=resolveTapRound(3,forcedPlayers.filter(p=>p.eliminatedRound===null).map((p,i)=>({id:p.id,ms:218+i*70,wrongTaps:0})));
      if(phase==='results') forcedPlayers=eliminatePlayer(forcedPlayers,forcedResult);
      observed.length=0;hook=0;
      const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
      assert(observed.some(n=>n.testID===`last-tap-${phase}`));
      if(phase==='welcome')assert(observed.some(n=>n.accessibilityLabel==='HOW TO PLAY'),'Welcome must lead to rules');
      const images=observed.filter(n=>n.kind==='Image');assert(images.length>=2);
      for(const image of images){assert(fs.existsSync(image.source.uri),image.source.uri);assert(!image.source.uri.includes('/designs/'),'Whole screen mockups must never replace live UI');}
      assert(observed.some(n=>n.accessibilityLabel==='Last Tap Standing options'));
      if(['target','playing','locked','results'].includes(phase)) {
        assert.equal(observed.filter(n=>n.testID?.startsWith('eliminated-')).length,outCount+(phase==='results'?1:0));
      }
      if(phase==='playing') {
        const arena=observed.find(n=>n.testID==='last-tap-arena');assert.equal(typeof arena.onPressIn,'function');assert.equal(arena.disabled,false);
        assert(!html.includes('YOUR TARGET'));assert(observed.some(n=>n.testID==='last-tap-countdown-button' && n.disabled===false));assert(!html.includes('612 ms'),'Reference scores are not hardcoded into gameplay');
      }
      if(phase==='results') {assert(html.includes('TIMING ERROR'));assert(!html.includes('IS ELIMINATED'));assert(!observed.some(n=>n.kind==='Pressable' && ['NEXT ROUND','THE VERDICT…'].includes(n.accessibilityLabel)));assert(!html.includes('THE VERDICT'));assert(html.includes('RHYTHM CHECK'));}
      if(phase==='final') {assert(html.includes('FINAL SHOWDOWN'));assert(html.includes('SHOWDOWN IN'));assert(!html.includes('YOU WIN')); const fighters=images.filter(n=>n.source.uri.includes('/poses/battle-'));assert.equal(fighters.length,2);assert.deepEqual(fighters.map(n=>n.style.transform[0].scaleX),[1,-1]);assert.equal(observed.filter(n=>n.testID?.startsWith('eliminated-')).length,0,'The duel gives the two finalists the whole stage');}
    }
  });
}

test('eliminated players predict only during preview and share the reveal before bonus feedback',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias').map(p=>({...p,eliminatedRound:p.id==='grumble'?1:null}));
  forcedResult=resolveTapRound(2,forcedPlayers.filter(p=>p.eliminatedRound===null).map((p,i)=>({id:p.id,ms:220+i*50,wrongTaps:0})));
  forcedPrediction={pick:'snicker',points:25};
  for(const phase of ['target','playing','locked','results','final','winner']) {
    observed.length=0;hook=0;forcedRevealed=false;
    const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
    const picks=observed.filter(n=>n.kind==='Pressable' && n.accessibilityLabel?.startsWith('Predict '));
    assert.equal(picks.length,phase==='target'?7:0);
    assert(!observed.some(n=>n.testID==='last-tap-arena'),'spectators cannot submit survival taps');
    if(phase==='results')assert(!html.includes('CALLED IT!'),'bonus must wait until elimination completes');
    if(phase==='final')assert(!observed.some(n=>n.accessibilityLabel==='WATCH THE FINAL'),'final intro advances automatically');
  }
  observed.length=0;hook=0;forcedRevealed=true;
  const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:'results',viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
  assert(html.includes('CALLED IT!'));
  assert(observed.some(n=>n.testID==='next-round-stage'));
  forcedRevealed=undefined;forcedPrediction=undefined;
});

test('one opaque stage persists from the elimination hold through exit and countdown',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias');
  forcedResult=resolveTapRound(1,forcedPlayers.map((p,i)=>({id:p.id,ms:210+i*61,wrongTaps:0})));
  forcedRevealed=false;
  const {spotlightAt,stampAt,kickAt,end}=tapRevealTiming(8);
  for(const time of [0,spotlightAt+220,stampAt,kickAt-1,kickAt,kickAt+350,kickAt+800,end-1,end,end+2000]){
    motionTime=time;forcedRevealed=time>=end;observed.length=0;hook=0;
    renderToStaticMarkup(React.createElement(Game,{initialPhase:'results',viewportWidth:393,viewportHeight:706,onExit(){},onFinish(){}}));
    const stages=observed.filter(n=>n.testID==='elimination-stage-background');
    assert.equal(stages.length,1,'never replace or duplicate the background');
    assert.equal(stages[0].style.at(-1).opacity,time===0?0:1,'background never fades away during handoff');
    assert.equal(observed.some(n=>n.testID==='next-round-stage'),time>=kickAt+350);
    assert.equal(observed.some(n=>n.testID==='elimination-monster-cutout'),time>=spotlightAt&&time<end);
    assert.equal(observed.some(n=>n.kind==='Pressable'&&n.accessibilityLabel==='NEXT ROUND'),false);
  }
  motionTime=0;forcedRevealed=undefined;
});

test('prediction cards keep remaining players selectable from seven down to two',()=>{
  for(const count of [7,5,4,3,2]){
    forcedPlayers=createTapPlayers('grumble','Matthias').map((p,i)=>({...p,eliminatedRound:i===0||i>count?1:null}));
    forcedResult=null;observed.length=0;hook=0;
    renderToStaticMarkup(React.createElement(Game,{initialPhase:'target',viewportWidth:320,viewportHeight:568,onExit(){},onFinish(){}}));
    const cards=observed.filter(n=>n.testID?.startsWith('prediction-card-'));
    assert.equal(cards.length,count);
    for(const card of cards){const style=card.style({pressed:false});assert(style.width>=44&&style.height>=44);assert(!card.disabled);}
  }
});

test('Chaos Snap preview and live pile use original card art and one large Snap control',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias');
  forcedRound=2;
  forcedSequence={mode:'snap',...makeSnapSequence(2,()=>.25)};
  for(const phase of ['target','playing']){
    observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
    assert(observed.some(n=>n.testID==='chaos-snap-arena'));
    assert(!observed.some(n=>n.testID==='last-tap-arena'));
    assert(html.includes(phase==='target'?'SAME CARD TWICE = SNAP':'SNAP!'));
    assert(observed.some(n=>n.kind==='Image'&&n.source.uri.includes('/last-tap/snap/snap-')));
    const action=observed.find(n=>n.testID==='last-tap-countdown-button');
    assert.equal(action.disabled,phase==='target');
    if(phase==='playing')assert.equal(action.accessibilityLabel,'Snap now');
  }
  forcedRound=undefined;forcedSequence=undefined;
});

test('Chaos Snap retains the same full pile for active players and Watch Party',()=>{
  forcedRound=2;
  forcedSequence={mode:'snap',...makeSnapSequence(2,()=>.25)};
  for(const spectator of [false,true])for(const index of [0,3,8])for(const [viewportWidth,viewportHeight] of [[390,844],[320,568]]){
    forcedPlayers=createTapPlayers('grumble','Matthias').map((p,i)=>({...p,eliminatedRound:spectator&&i===0?1:null}));
    forcedCardIndex=index;
    observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:'playing',viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
    assert(observed.some(n=>n.testID==='chaos-snap-arena'));
    assert.equal(observed.filter(n=>n.testID?.startsWith('snap-pile-card-')).length,index+1);
    assert.equal(observed.some(n=>n.testID==='last-tap-countdown-button'),!spectator);
    if(spectator){assert(html.includes('PICK LOCKED'));assert(html.includes('YOUR PICK'));}
  }
  forcedRound=undefined;forcedSequence=undefined;forcedCardIndex=undefined;
});


test('each identity uses its own recorded and victory poses and username',()=>{
  for(const id of ['grumble','snicker','gloop','brrr','scraps','dozy','peepers','bop']) {
    forcedPlayers=createTapPlayers(id,'Speedy McTap');forcedReaction=321;forcedResult=null;
    for(const phase of ['locked','winner']) {
      observed.length=0;hook=0;
      const html=renderToStaticMarkup(React.createElement(Game,{playerId:id,playerName:'Speedy McTap',initialPhase:phase,viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
      assert(html.includes('Speedy McTap'));
      const pose=phase==='locked'?'tap':'victory';
      assert(observed.some(n=>n.kind==='Image'&&n.source.uri.endsWith(`/poses/${pose}-${id}.webp`)));
      assert(!html.includes('YOU WIN'));
    }
  }
  forcedReaction=undefined;
});

test('survivor awards appear only after elimination and prediction footer clutter is gone',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias');
  forcedResult=resolveTapRound(1,forcedPlayers.map((p,i)=>({id:p.id,ms:210+i*50,wrongTaps:0})));
  for(const revealed of [false,true]){
    forcedRevealed=revealed;
    if(revealed)forcedPlayers=eliminatePlayer(forcedPlayers,forcedResult);
    observed.length=0;hook=0;
    renderToStaticMarkup(React.createElement(Game,{initialPhase:'results',viewportWidth:320,viewportHeight:568,onExit(){},onFinish(){}}));
    assert.equal(observed.filter(n=>n.testID?.startsWith('survival-award-')).length,revealed?7:0);
  }
  forcedRevealed=undefined;
  forcedPlayers=createTapPlayers('grumble','Matthias').map(p=>({...p,eliminatedRound:p.id==='grumble'?1:null}));
  observed.length=0;hook=0;
  const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:'target',viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
  assert(!html.includes('TAP A PLAYER ABOVE'));
  assert(!html.includes('OUT OF THE ROUND'));
  assert(html.includes('WIN +25 POINTS!'));
});

test('final duel skips rankings, keeps its stage, then crowns and counts points without an early spoiler',()=>{
  const make=()=>createTapPlayers('grumble','Matthias').map((p,i)=>({...p,score:i<2?600:100*(7-i),awardedThroughRound:6,eliminatedRound:i<2?null:i}));
  forcedResult=resolveTapRound(7,[{id:'snicker',ms:242,wrongTaps:0},{id:'grumble',ms:413,wrongTaps:0}]);
  for(const [viewportWidth,viewportHeight] of [[390,844],[393,706],[320,568]])for(const time of [0,6500,8000,10800,13000,18000,18500,22000,24000]){
    motionTime=time;forcedPlayers=time>=12000?eliminatePlayer(make(),forcedResult):make();observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{playerId:'grumble',playerName:'Matthias',initialPhase:'results',viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
    assert(!observed.some(n=>n.testID==='last-tap-result-row'));assert(!html.includes('REACTION RANKINGS'));
    assert.equal(observed.filter(n=>n.testID==='finale-persistent-background').length,1);
    if(time<8000){assert(!html.includes('WINS!'));assert(!html.includes('242 ms'));assert(!html.includes('413 ms'));assert(!observed.some(n=>n.testID==='finale-eliminated-stamp'));}
    if(time>=8000&&time<12000)assert(observed.some(n=>n.testID==='finale-eliminated-stamp'));
    if(time>=12000&&time<18500){assert(html.includes('Alex WINS!'));assert(observed.some(n=>n.testID==='finale-crown'));assert(!observed.some(n=>n.testID==='finale-fighter-grumble'));}
    assert.equal(observed.filter(n=>n.testID?.startsWith('final-score-')).length,time>=18500?8:0);
    assert.equal(observed.some(n=>n.kind==='Pressable'&&n.accessibilityLabel==='BACK TO THE CHAOS'),time>=24000);
  }
  motionTime=0;
});

test('a tied final offers a rematch without elimination, coronation or a rankings table',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias').map((p,i)=>({...p,eliminatedRound:i<2?null:i}));
  forcedResult=resolveTapRound(7,[{id:'grumble',ms:300,wrongTaps:0},{id:'snicker',ms:300,wrongTaps:0}]);
  motionTime=5000;observed.length=0;hook=0;
  const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:'results',viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
  assert(html.includes('A PHOTO FINISH!'));assert(html.includes('REMATCH IN'));assert(!html.includes('WINS!'));
  assert(!observed.some(n=>['finale-eliminated-stamp','last-tap-result-row','finale-score-recap'].includes(n.testID)));
  motionTime=0;
});

test('either finalist is centred and uses their own victory artwork, including reduced motion',()=>{
  for(const local of ['grumble','snicker','gloop','brrr','scraps','dozy','peepers','bop'])for(const winnerIndex of [0,1])for(const reduced of [false,true]) {
    const players=createTapPlayers(local,'My username',1), winner=players[winnerIndex];
    forcedResult=resolveTapRound(1,players.map((p,i)=>({id:p.id,ms:i===winnerIndex?210:450,wrongTaps:0})));
    forcedPlayers=eliminatePlayer(players,forcedResult);motionTime=14000;motionReduced=reduced;observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{playerId:local,initialPhase:'results',viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
    assert(html.includes(`${winner.name} WINS!`));
    const fighters=observed.filter(n=>n.testID?.startsWith('finale-fighter-'));
    assert.equal(fighters.length,1);assert.equal(fighters[0].testID,`finale-fighter-${winner.id}`);
    const style=fighters[0].style, dx=style.transform.find(t=>t.translateX!==undefined).translateX;
    assert(Math.abs(style.left+style.width/2+dx-195)<1,'Winner must be centred before coronation');
    assert(observed.some(n=>n.kind==='Image'&&n.source.uri.endsWith(`/victory-${winner.id}.webp`)));
    assert.equal(observed.filter(n=>n.testID==='finale-crown').length,1);
  }
  motionTime=0;motionReduced=false;
});

test('Beat Panic uses a live lane for active players and spectators and hides the old tap control',()=>{
  for(const spectator of [false,true])for(const phase of ['target','playing'])for(const [viewportWidth,viewportHeight] of [[390,844],[320,568]]){
    forcedRound=3;forcedPlayers=createTapPlayers('grumble','Matthias').map((p,i)=>({...p,eliminatedRound:spectator&&i===0?1:null}));
    observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
    if(!spectator||phase==='playing'){
      assert(observed.some(n=>n.testID==='beat-panic-arena'));
      assert.equal(observed.filter(n=>n.testID==='beat-arrow-target').length,2);
      assert.equal(observed.filter(n=>n.testID==='beat-arrow-note').length,phase==='target'?4:28);
      assert(!observed.some(n=>n.kind==='Image'&&n.source?.uri?.startsWith('data:')),'Cues must not depend on data-URI image decoding');
      for(const note of observed.filter(n=>/^beat-note-/.test(n.testID||'')))assert.equal(note.style.top,0);
    }
    assert.equal(observed.filter(n=>/^beat-tap-/.test(n.testID||'')).length,spectator?0:2);
    assert(!observed.some(n=>n.testID==='last-tap-countdown-button'));
    if(spectator&&phase==='target')assert(html.includes('best rhythm'));
  }
  forcedRound=undefined;forcedPlayers=undefined;
});

test('How to Play removes the extra green monster without losing the rules',()=>{
  forcedPlayers=createTapPlayers('grumble','Matthias');forcedResult=null;
  observed.length=0;hook=0;
  const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:'rules',viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
  assert(!observed.some(n=>n.kind==='Image'&&n.source.uri.endsWith('/monsters/gloop.webp')));
  for(const text of ['TARGET HUNT','CHAOS SNAP','BEAT PANIC','+100 points','Lowest error wins'])assert(html.includes(text));
});

test('next-round awards use full character artwork in bounded survivor cards',()=>{
  for(const count of [2,4,7])for(const [viewportWidth,viewportHeight] of [[390,844],[393,706],[320,568]]){
    const starting=createTapPlayers('grumble','Matthias').slice(0,count+1);
    forcedResult=resolveTapRound(1,starting.map((p,i)=>({id:p.id,ms:200+i*70,wrongTaps:0})));
    forcedPlayers=eliminatePlayer(starting,forcedResult);forcedRevealed=true;
    observed.length=0;hook=0;
    renderToStaticMarkup(React.createElement(Game,{initialPhase:'results',viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
    const cards=observed.filter(n=>n.testID?.startsWith('survivor-character-card-'));
    const images=observed.filter(n=>n.testID?.startsWith('survivor-character-')&&n.kind==='Image');
    assert.equal(cards.length,count);assert.equal(images.length,count);
    for(const image of images){assert(image.source.uri.includes('/poses/victory-'));assert.equal(image.resizeMode,'contain');}
    assert.equal(observed.filter(n=>n.testID?.startsWith('survival-award-')).length,count);
    const lineup=observed.find(n=>n.testID==='survivor-lineup').style;
    const heading=observed.find(n=>n.testID==='remaining-players-heading').style;
    const columns=count>6?4:3,rows=Math.ceil(count/columns);
    const available=lineup.height-heading.height-heading.marginBottom;
    assert(rows*cards[0].style.height+(rows-1)*8*lineup.height/321<=available+.01,'The full lineup must fit below its heading');
  }
  forcedRevealed=undefined;forcedPlayers=undefined;forcedResult=null;
});

test('Beat Panic keeps stats clear of the dancing monster and spectators never show a fake score',()=>{
  for(const spectator of [false,true])for(const phase of ['target','playing','locked'])for(const [viewportWidth,viewportHeight] of [[390,844],[393,706],[320,568]]){
    forcedRound=3;forcedReaction=840;forcedPlayers=createTapPlayers('grumble','Matthias').map((p,i)=>({...p,eliminatedRound:spectator&&i===0?1:null}));
    observed.length=0;hook=0;
    const html=renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth,viewportHeight,onExit(){},onFinish(){}}));
    const arena=observed.find(n=>n.testID==='beat-panic-arena');
    if(arena){
      const header=observed.find(n=>n.testID==='beat-score-header').style;
      const lane=observed.find(n=>n.testID==='beat-lane-0').style;
      const right=observed.find(n=>n.testID==='beat-lane-1').style;
      const target=observed.find(n=>n.testID==='beat-target-0').style;
      assert(target.width>72*Math.min(viewportWidth/390,viewportHeight/844*(spectator?.95:1)));
      assert(target.top+target.height<lane.height);
      assert(lane.left+lane.width<right.left);
      assert(header.top+header.height<lane.top);
      const pads=observed.filter(n=>/^beat-tap-/.test(n.testID||''));
      const feedback=observed.find(n=>n.testID==='beat-feedback')?.style || pads[0]?.style({pressed:false});
      for(const pad of pads){const style=pad.style({pressed:false});assert(Math.max(style.height,style.minHeight)>=44);assert.equal(pad.disabled,true);assert.equal(style.width,lane.width);}
      if(feedback)assert(lane.top+lane.height<=feedback.top,'Feedback belongs outside the arrow lane');
      assert(!html.includes('YOUR THUMB HERE'));assert(!html.includes('TAP ON THE BEAT'));
      if(spectator){assert(!html.includes('BEATS HIT'));assert(!html.includes('0/28'));assert(!html.includes('TIMING ERROR'));}
    }
    if(phase==='locked')assert(html.includes(spectator?'ROUND COMPLETE':'TOTAL TIMING ERROR'));
  }
  forcedRound=undefined;forcedPlayers=undefined;forcedReaction=undefined;
});


test('all eight winner crowns stay attached to their own fitted victory pose',()=>{
  const {CrownedVictory,VICTORY_HEADS}=require('../LastTapStandingGame.tsx');
  for(const id of Object.keys(VICTORY_HEADS))for(const [width,height] of [[190,284],[159,191],[270,248]]){
    observed.length=0;
    renderToStaticMarkup(React.createElement(CrownedVictory,{id,width,height}));
    const crown=observed.find(n=>n.testID==='winner-crown').style[0];
    const head=VICTORY_HEADS[id],scale=Math.min(width/head.width,height/900);
    assert(Math.abs(crown.top+crown.height*.94-((height-900*scale)/2+900*scale*head.y))<.01);
    assert(crown.left>=0&&crown.left+crown.width<=width);
    assert(observed.some(n=>n.source?.uri?.includes('victory-'+id+'.webp')));
  }
});
