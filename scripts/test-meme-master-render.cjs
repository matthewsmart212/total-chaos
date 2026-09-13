// Component render smoke tests, without launching or driving a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const babel = require('@babel/core');
const observed = [];
let portalTarget=null;
let keyboardDismissals=0;
const flatten=style=>Array.isArray(style)?Object.assign({},...style.map(flatten)):style||{};
function component(kind) {
  return function Mock(props) {
    observed.push({ kind, ...props });
    return React.createElement('div', null, props.children);
  };
}
const native = {
  View: component('View'), Text: component('Text'), Image: component('Image'),
  TextInput: component('TextInput'), ScrollView: component('ScrollView'),
  Pressable: component('Pressable'), Modal: ({ visible, children }) => visible ? children : null,
  StyleSheet: { absoluteFill: { position:'absolute',top:0,left:0,right:0,bottom:0 } },
  Platform: { OS:'web' }, Keyboard: { dismiss() {keyboardDismissals++;}, addListener:()=>({remove(){}}) },
  AppState: { addEventListener:()=>({remove(){}}) },
  ActivityIndicator: component('ActivityIndicator'),
  PanResponder: {create:()=>({panHandlers:{}})},
  Animated: { View: component('AnimatedView'), Value: class { constructor(value) { this.value=value; } setValue(v){this.value=v;} interpolate(){return 0;} }, timing:()=>({start(){}}) },
};
const realLoad = Module._load;
Module._load = function(id, parent, isMain) {
  if(id==='react-dom')return {createPortal(children,target){portalTarget=target;return children;}};
  if (id === 'react-native') return native;
  if (id === 'expo-linear-gradient') return { LinearGradient:component('LinearGradient') };
  return realLoad.call(this,id,parent,isMain);
};
for (const extension of ['.png','.jpg','.webp','.ttf']) Module._extensions[extension]=(mod,filename)=>{mod.exports={uri:filename};};
for (const extension of ['.ts','.tsx']) Module._extensions[extension]=(mod,filename)=>{
  const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{
    filename,configFile:false,babelrc:false,
    plugins:[['@babel/plugin-transform-typescript',{isTSX:extension==='.tsx',allowDeclareFields:true}],
      ['@babel/plugin-transform-react-jsx',{runtime:'classic'}],'@babel/plugin-transform-modules-commonjs'],
  }).code;
  mod._compile(code,filename);
};
const originalUseState=React.useState;
let forcedPhase='intro';
let forcedEditor=false;
let hookIndex=0;
// Install before Babel's React interop copies named exports.
React.useState=(initial)=>{
  const n=hookIndex++;
  return originalUseState(n===0?forcedPhase:n===1?15:n===3?'This caption changes with the player.':forcedEditor&&n===2?'My funny caption':forcedEditor&&n===8?true:forcedEditor&&n===11?{width:393,height:300,top:80,left:0}:initial);
};
const Game = require('../MemeMasterGame.tsx').default;
const expected = {
  intro:'How to play Meme Master',rules:'Got it — start writing',compose:'Lock in my caption',
  locked:'Pause and game options',vote:'Vote for this meme',
  winner:'Show round scores',scores:'Next round',
};
for (const [phase, action] of Object.entries(expected)) {
  test(phase+' mounts a nonempty interactive screen with valid assets',()=>{
    forcedPhase=phase; hookIndex=0; observed.length=0;
    renderToStaticMarkup(React.createElement(Game,{onFinish(){},onExit(){},viewportWidth:393,viewportHeight:706}));
    const root=observed.find(n=>n.testID==='meme-'+phase); assert(root);
    assert(observed.some(n=>n.kind==='Pressable' && n.accessibilityLabel===action),action);
    const images=observed.filter(n=>n.kind==='Image'); assert(images.length>=4);
    images.forEach(n=>assert(fs.existsSync(n.source.uri),n.source.uri));
    assert.equal(images.some(n=>n.source.uri.endsWith('/layers/home-logo.webp')),false,'Meme Master intro and rules stay focused without the home-page logo');
    assert(!images.some(n=>/\/brand(?:-sticker)?\.webp$/.test(n.source.uri)), 'Do not substitute a different Total Chaos logo');
    images.filter(n=>n.style.position==='absolute' && n.style.bottom===0).forEach(n=>{
      assert.equal(n.style.width,'100%','Artwork must override intrinsic bitmap width: '+n.source.uri);
      assert.equal(n.style.height,'100%','Artwork must override intrinsic bitmap height: '+n.source.uri);
    });
    observed.filter(n=>n.kind==='Text'&&n.testID==='meme-display-copy').forEach(n=>{
      assert(n.style[0].fontFamily.includes('sans-serif'),'Display text needs a safe web fallback');
      assert(n.style[0].fontFamily.includes('TotalChaosLilita'), 'All dynamic headings must use the bundled chunky display face');
      assert.equal(n.style.at(-1).fontWeight, '400', 'Do not request a nonexistent weight of the display font');
    });
    assert(images.every(n=>!n.source.uri.includes('/designs/')),'No whole-screen references in UI');
    const backgrounds=images.filter(n=>n.resizeMode==='stretch');
    assert.equal(backgrounds.length,1,'Only the background may stretch');
    if(phase==='compose'){
      const input=observed.find(n=>n.kind==='TextInput');
      assert.equal(input.placeholder,'Make it funny…'); assert.equal(input.maxLength,140);
      assert.equal(typeof input.onChangeText,'function'); assert(input.style.zIndex>0);
      assert(input.style.fontSize>=16);
      const send=observed.findIndex(n=>n.kind==='Pressable'&&n.accessibilityLabel==='Lock in my caption');
      const sendBox=observed[send-1].style[0];
      const inputBox=flatten(observed.find(n=>n.kind==='View'&&flatten(n.style).backgroundColor==='#211d78ee').style);
      assert(sendBox.top>=inputBox.top+inputBox.height+10,'Send must have a clear gap below the caption field');
    }
    if(phase==='vote'){
      for(const part of ['heading','cards','controls'])assert(observed.some(n=>n.testID===`voting-entrance-${part}`));
      assert.equal(observed.find(n=>n.testID==='voting-entrance-controls').pointerEvents,'none','Voting controls must not accept taps during the title reveal');
    }
    if(phase==='rules'){
      const hero=images.find(n=>n.accessibilityLabel==='How to play');
      assert(hero.style[1].clipPath.startsWith('polygon('),'Exclude the reference panel strip from foreground art');
    }
    if(phase==='locked')assert(!observed.some(n=>n.accessibilityLabel?.startsWith('React:')),'Waiting screen must not contain reactions');
    if(phase==='scores') {
      assert.equal(observed.filter(n=>n.kind==='Image'&&/[\\/]monsters[\\/]/.test(n.source.uri)).length,8);
      assert.equal(observed.filter(n=>n.testID==='animated-score-row').length,8);
      assert(observed.find(n=>n.accessibilityLabel==='Next round').disabled,'Hold the next round while scores animate');
    }
    if(phase==='winner'){
      assert.equal(observed.filter(n=>n.testID==='winner-reveal-card').length,3);
      assert.equal(observed.filter(n=>n.testID==='crowned-placement').length,0,'Placement crown waits for the animated reveal');
      assert(observed.find(n=>n.accessibilityLabel==='Show round scores').disabled,'Do not skip unrevealed votes');
    }
    if(['intro','rules','compose','vote','winner','scores'].includes(phase)){
      assert(observed.some(n=>n.testID==='meme-action-button'),'Use the shared action-button component');
      assert(!images.some(n=>n.source.uri.includes('/button-')),'No mismatched bitmap action buttons');
    }
    if(phase==='vote'||phase==='winner') {
      const section=observed.find(n=>n.testID==='caption-white-section');
      assert(section.style.height>0 && section.style.flexShrink===0);
      assert.equal(section.style.overflow,'hidden');
    }
  });
}

test('keyboard editor stays above the visible viewport bottom with Send and Done available',()=>{
  forcedPhase='compose';forcedEditor=true;hookIndex=0;observed.length=0;
  try {
    renderToStaticMarkup(React.createElement(Game,{onFinish(){},onExit(){},viewportWidth:393,viewportHeight:706}));
    const panel=flatten(observed.find(n=>flatten(n.style).backgroundColor==='#151144').style);
    assert.equal(panel.top+panel.height,380,'Composer must sit flush on the keyboard');
    assert.equal(panel.top,380-panel.height);
    assert(panel.height>=96);
    const input=observed.find(n=>n.kind==='TextInput');
    assert.equal(input.returnKeyType,'send');assert.equal(input.submitBehavior,'blurAndSubmit');
    assert(input.style.fontSize>=16);
    const send=observed.find(n=>n.accessibilityLabel==='Send caption');
    const done=observed.find(n=>n.accessibilityLabel==='Done editing caption');
    assert.equal(send.disabled,false);assert.equal(send.style.display,'flex');assert(done);
    assert(!observed.some(n=>n.kind==='ScrollView'),'No clipping scroll ancestor around the keyboard editor');
    assert.equal(observed.find(n=>n.testID==='meme-unclipped-canvas').style.overflow,'visible');
    const before=keyboardDismissals;send.onPress();assert.equal(keyboardDismissals,before+1,'Sending dismisses the keyboard');
  }finally{forcedEditor=false;}
});

test('web game and editor escape the clipped app frame through a stable body portal',()=>{
  const previous=global.document;
  global.document={body:{}};
  try{
    for(const editing of [false,true]){
      forcedPhase='compose';forcedEditor=editing;hookIndex=0;observed.length=0;portalTarget=null;
      renderToStaticMarkup(React.createElement(Game,{onFinish(){},onExit(){},viewportWidth:393,viewportHeight:300}));
      assert.equal(portalTarget,global.document.body,'Portal must exist before focus, not move the input after focus');
      assert.equal(observed.find(n=>n.testID==='meme-compose').style.overflow,'visible');
    }
  }finally{global.document=previous;forcedEditor=false;}
});

test('web display font waits for decoded bytes and registers exactly once', async()=>{
  const previousDocument=global.document;
  const previousFontFace=global.FontFace;
  let finishLoading;
  let registrations=0;
  let requests=0;
  global.document={fonts:{add(face){assert.equal(face.family,'TotalChaosLilita');registrations++;}}};
  global.FontFace=class {
    constructor(family,source,descriptors){
      this.family=family;requests++;
      assert(source.includes('/assets/fonts/LilitaOne-Regular.ttf'));
      assert(!source.includes('node_modules'),'Public font URLs must stay in first-party assets');
      assert.equal(descriptors.weight,'400');
    }
    load(){return new Promise(resolve=>{finishLoading=()=>resolve(this);});}
  };
  try {
    const {loadWebDisplayFont}=require('../src/brand.ts');
    const first=loadWebDisplayFont();
    assert.equal(loadWebDisplayFont(),first);
    assert.equal(registrations,0,'Do not claim the font is ready before it loads');
    finishLoading();await first;
    await loadWebDisplayFont();
    assert.equal(registrations,1);assert.equal(requests,1);
  } finally {
    global.document=previousDocument;global.FontFace=previousFontFace;
  }
});
