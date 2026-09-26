const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const babel = require('@babel/core');

const observed = [];
const component = kind => props => {
  observed.push({kind, ...props});
  return React.createElement('div', null, props.children);
};
class Value {
  constructor(value) { this.value = value; }
  interpolate({outputRange}) { return outputRange[0]; }
  setValue(value) { this.value = value; }
  stopAnimation() {}
}
const native = {
  View:component('View'), Text:component('Text'), Image:component('Image'), Pressable:component('Pressable'),
  Modal:({visible,children}) => visible ? children : null,
  Platform:{OS:'web'},
  AccessibilityInfo:{isReduceMotionEnabled:async()=>false},
  AppState:{addEventListener:()=>({remove(){}})},
  Easing:{linear:x=>x,out:()=>x=>x,quad:x=>x},
  StyleSheet:{absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},
  Animated:{View:component('AnimatedView'),Value,timing:()=>({start(){},stop(){}}),spring:()=>({start(){},stop(){}})},
};
const realLoad = Module._load;
Module._load = function(id,parent,isMain) {
  if (id === './src/gameMotion') return {useMotionClock:()=>({clock:new Value(0),now:0,reduced:true})};
  if (id === '../src/sounds') return {fadeLastTapMusicTo(){}};
  if (id === 'react-native') return native;
  if (id === 'expo-linear-gradient') return {LinearGradient:component('Gradient')};
  return realLoad.call(this,id,parent,isMain);
};
for (const extension of ['.jpg','.webp','.png','.ttf','.mp3']) {
  Module._extensions[extension] = (mod,filename) => { mod.exports = {uri:filename.replace(/\\/g,'/')}; };
}
for (const extension of ['.ts','.tsx']) {
  Module._extensions[extension] = (mod,filename) => {
    const code = babel.transformSync(fs.readFileSync(filename,'utf8'), {
      filename, configFile:false, babelrc:false,
      plugins:[['@babel/plugin-transform-typescript',{isTSX:extension==='.tsx',allowDeclareFields:true}],['@babel/plugin-transform-react-jsx',{runtime:'classic'}],'@babel/plugin-transform-modules-commonjs'],
    }).code;
    mod._compile(code,filename);
  };
}

const originalState = React.useState;
let forced = {}, hook = 0;
React.useState = initial => {
  const index = hook++;
  return originalState(Object.prototype.hasOwnProperty.call(forced,index) ? forced[index] : initial);
};
const Game = require('../LastTapStandingGame.tsx').default;
const {BeatJudgmentEffect,BeatPanic} = require('../src/BeatPanic.tsx');
const {createTapPlayers,resolveTapRound} = require('../src/lastTapModel.ts');

function renderGame(phase, players, result = null) {
  forced = {0:phase,1:players,5:result,9:true,18:true};
  hook = 0;
  observed.length = 0;
  return renderToStaticMarkup(React.createElement(Game,{initialPhase:phase,viewportWidth:390,viewportHeight:844,onExit(){},onFinish(){}}));
}

test('all Beat Panic judgment effects have a reduced-motion label', () => {
  for (const kind of ['perfect','nice','off','miss','wrong','hold']) {
    observed.length = 0;
    const html = renderToStaticMarkup(React.createElement(BeatJudgmentEffect,{kind,reduced:true,progress:new Value(0),size:80,width:80,top:200,u:1}));
    assert(observed.some(node => node.testID === `beat-judgment-${kind}`));
    assert.match(html, /PERFECT|NICE|OFF BEAT|MISSED|WRONG TAP|HOLD/);
  }
});

test('the chart renders four lanes, four controls, doubles and holds', () => {
  observed.length = 0;
  renderToStaticMarkup(React.createElement(BeatPanic,{sx:1,sy:1,round:3,preview:true,onComplete(){}}));
  assert.equal(observed.filter(node => node.testID?.startsWith('beat-lane-')).length,4);
  assert.equal(observed.filter(node => node.testID?.startsWith('beat-tap-')).length,4);
  const labels = observed.filter(node => node.kind === 'Pressable').map(node => node.accessibilityLabel);
  assert.deepEqual(labels,['left beat button','up beat button','down beat button','right beat button']);
  const html = renderToStaticMarkup(React.createElement(BeatPanic,{sx:1,sy:1,round:3,preview:true,onComplete(){}}));
  assert(html.includes('×2'));
  assert(html.includes('HOLD'));
  for (const plainArrow of ['←','↑','↓','→']) assert(!html.includes(plainArrow));
});

test('rules describe only Beat Panic mechanics', () => {
  const html = renderGame('rules',createTapPlayers('grumble','Tester'));
  for (const text of ['FOLLOW THE BEAT','DOUBLE IT','HOLD &amp; RELEASE',"DON&#x27;T COME LAST"]) assert(html.includes(text));
  assert.equal(observed.filter(node => node.testID === 'focused-rule-card').length,4);
  assert(!html.includes('TARGET HUNT'));
  assert(!html.includes('CHAOS SNAP'));
  assert(observed.some(node => node.accessibilityLabel === 'Beat Panic options'));
});

test('active preview and play screens use the Beat Panic arena', () => {
  const players = createTapPlayers('grumble','Tester');
  for (const phase of ['target','playing','locked']) {
    const html = renderGame(phase,players);
    assert(observed.some(node => node.testID === `beat-panic-${phase}`));
    const background = observed.find(node => node.testID === 'beat-panic-background');
    assert.match(background.source.uri,/beat-panic-arena-v2\.webp$/);
    if (phase !== 'locked') {
      assert(observed.some(node => node.testID === 'beat-panic-arena'));
      assert.equal(observed.filter(node => node.testID?.startsWith('beat-tap-')).length,4);
    }
  }
});

test('knockout, finale, eliminated and champion screens remain connected', () => {
  const full = createTapPlayers('grumble','Tester');
  const roundResult = resolveTapRound(1,full.map((player,index)=>({id:player.id,ms:200+index*50,wrongTaps:0})));
  const resultsHtml = renderGame('results',full,roundResult);
  assert(resultsHtml.includes('RHYTHM CHECK'));
  assert(!resultsHtml.includes('TIMING ERROR · LOWER IS BETTER'));

  const finalists = full.map((player,index)=>({...player,eliminatedRound:index>1?1:null}));
  assert(renderGame('final',finalists).includes('FINAL SHOWDOWN'));

  const eliminated = full.map(player=>({...player,eliminatedRound:player.id==='grumble'?1:null}));
  const eliminatedHtml = renderGame('eliminated',eliminated);
  assert(eliminatedHtml.includes('BEATEN.'));
  assert(eliminatedHtml.includes('YOUR TIMING ERROR'));
  assert(!eliminatedHtml.includes('PRACTISE'));

  const champion = full.map((player,index)=>({...player,eliminatedRound:index===0?null:1}));
  const winnerHtml = renderGame('winner',champion);
  assert(winnerHtml.includes('BEAT PANIC'));
  assert(winnerHtml.includes('CHAMPION!'));
  assert(observed.some(node => node.testID === 'winner-crown'));
});

test('every referenced runtime image exists and old mode art is gone', () => {
  renderGame('welcome',createTapPlayers('grumble','Tester'));
  for (const image of observed.filter(node => node.kind === 'Image')) {
    if (image.source?.uri) assert(fs.existsSync(image.source.uri),image.source.uri);
  }
  const root = require('node:path').resolve(__dirname,'../assets/last-tap');
  assert.equal(fs.existsSync(`${root}/snap`),false);
  assert.equal(fs.existsSync(`${root}/targets`),false);
  assert.equal(fs.existsSync(`${root}/practice-scene.webp`),false);
});
