import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, ImageSourcePropType, Keyboard, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ballot, CAPTION_LIMIT, castVote, createPlayers, formatTime, gameLayout, makeCaptions, MEME_MASTER_PACING, MemeImage, MemePhase, MonsterId, POINTS_PER_VOTE, resultsFor, simulateBallots, WINNER_BONUS, winnerRevealPlan } from './src/memeMasterModel';
import { Arrival } from './src/gameMotion';
import { haptic, type HapticCue } from './src/haptics';
import { getRandomMemeMasterGif } from './src/supabase';
import { BODY_FONT, DISPLAY_FONT as FONT, TOTAL_CHAOS_LOGO } from './src/brand';
import { fadeMemeMasterMusicTo, playMemeMasterRulesVoiceover, playNarration, playSound, stopAllNarration, stopMemeMasterRulesVoiceover, stopSound } from './src/sounds';

export { MEME_MASTER_PACING } from './src/memeMasterModel';

// Standalone art only. Input, timers, cards, votes, names and scores are live UI.
const art = {
  background: require('./assets/packed/meme-master-blue/background.jpg'),
  brand: TOTAL_CHAOS_LOGO,
  introTitle: require('./assets/packed/meme-master-blue/intro-title.webp'),
  cast: require('./assets/packed/meme-master-blue/intro-cast.webp'),
  question: require('./assets/packed/meme-master-blue/speech-question.webp'),
  lol: require('./assets/packed/meme-master-blue/speech-lol.webp'),
  begin: require('./assets/packed/meme-master-blue/let-memes-begin.webp'),
  rulesHero: require('./assets/packed/meme-master-blue/how-to-hero.webp'),
  write: require('./assets/packed/meme-master-blue/write-title.webp'),
  pick: require('./assets/packed/meme-master-blue/pick-title.webp'),
  trophy: require('./assets/packed/meme-master-blue/trophy-bop.webp'),
  scores: require('./assets/packed/meme-master-blue/scores-title.webp'),
};
const scenes: Record<MemeImage, ImageSourcePropType> = {
  gaming: require('./assets/packed/meme-master-blue/meme-gaming.jpg'),
  pool: require('./assets/packed/meme-master-blue/meme-pool.jpg'),
  party: require('./assets/packed/meme-master-blue/meme-party.jpg'),
  work: require('./assets/packed/meme-master-blue/meme-work.jpg'),
};
const avatars: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/packed/meme-master-blue/avatar-grumble.webp'),
  gloop: require('./assets/packed/meme-master-blue/avatar-gloop.webp'),
  brrr: require('./assets/packed/meme-master-blue/avatar-brrr.webp'),
  peepers: require('./assets/packed/meme-master-blue/avatar-peepers.webp'),
  dozy: require('./assets/packed/meme-master-blue/avatar-dozy.webp'),
  bop: require('./assets/packed/meme-master-blue/avatar-bop.webp'),
  snicker: require('./assets/packed/meme-master-blue/avatar-snicker.webp'),
  scraps: require('./assets/packed/meme-master-blue/avatar-scraps.webp'),
};
const monsters = {
  grumble: require('./assets/packed/monsters/grumble.webp'),
  gloop: require('./assets/packed/monsters/gloop.webp'),
  brrr: require('./assets/packed/monsters/brrr.webp'),
  peepers: require('./assets/packed/monsters/peepers.webp'),
  dozy: require('./assets/packed/monsters/dozy.webp'),
  bop: require('./assets/packed/monsters/bop.webp'),
  snicker: require('./assets/packed/monsters/snicker.webp'),
  scraps: require('./assets/packed/monsters/scraps.webp'),
};
const reactions = [
  { name: 'Love this', source: require('./assets/packed/meme-master-blue/reaction-love.webp') },
  { name: 'So good', source: require('./assets/packed/meme-master-blue/reaction-laugh.webp') },
  { name: 'Mood', source: require('./assets/packed/meme-master-blue/reaction-mood.webp') },
  { name: 'LOL', source: require('./assets/packed/meme-master-blue/reaction-lol.webp') },
];
const doodles = {
  funny: require('./assets/packed/meme-master-blue/doodle-funny-thoughts.webp'),
  legends: require('./assets/packed/meme-master-blue/doodle-chaos-legends.webp'),
  friends: require('./assets/packed/meme-master-blue/doodle-good-memes.webp'),
  brainrot: require('./assets/packed/meme-master-blue/doodle-same-brainrot.webp'),
  always: require('./assets/packed/meme-master-blue/doodle-chaos-always.webp'),
  more: require('./assets/packed/meme-master-blue/doodle-more-memes.webp'),
};
export const MEME_MASTER_IMAGE_SOURCES: ImageSourcePropType[] = [
  ...Object.values(art), ...Object.values(scenes),
  ...Object.values(avatars), ...Object.values(monsters), ...Object.values(doodles),
  ...reactions.map(r => r.source),
];
const INK = '#06032d';
const WHITE = '#fffeff';
const COMPOSER_HEIGHT = 116;
const COMPOSER_ENTRANCE_DELAY = 2800;
// RN Web gives Image its source's intrinsic dimensions unless width/height
// override them. Absolute positioning alone does not resize a bitmap.
const FILL_IMAGE = { ...StyleSheet.absoluteFill, width: '100%' as const, height: '100%' as const };
const CYAN = '#37f5ff';
const LIME = '#c9ff42';
type Bounds = { x: number; y: number; w: number; h: number };
const Metrics = createContext(gameLayout(709, 1536));

function Box({ x, y, w, h, children, style, decorative = false }: Bounds & { children?: ReactNode; style?: ViewStyle | ViewStyle[]; decorative?: boolean }) {
  const m = useContext(Metrics);
  return <View pointerEvents={decorative ? 'none' : 'box-none'} style={[{ position:'absolute', left:x*m.sx, top:y*m.sy, width:w*m.sx, height:h*m.sy },style]}>{children}</View>;
}
function Art({ source, label, ...box }: Bounds & { source: ImageSourcePropType; label?: string }) {
  return <Box {...box} decorative><Image source={source} resizeMode="contain" accessibilityLabel={label} accessible={!!label} style={FILL_IMAGE} /></Box>;
}
// Display only the title and Gloop silhouettes from the original crop. The
// blue/white strip belongs to the reference panel, not to this foreground art.
const RULES_HERO_OUTLINE = [
  [8,46],[25,26],[96,20],[105,12],[199,6],[293,4],[332,14],[383,19],
  [396,6],[424,0],[454,4],[481,20],[498,50],[515,109],[529,132],
  [532,151],[523,159],[509,155],[494,148],[482,143],[476,133],
  [392,130],[389,142],[379,147],[365,145],[354,147],[343,141],
  [337,134],[338,119],[348,110],[360,109],[368,102],[333,99],
  [296,95],[264,102],[237,98],[204,108],[175,103],[149,108],
  [122,111],[94,109],[75,118],[56,112],[39,122],[19,115],[8,103],
].map(([x,y])=>`${x/536*100}% ${y/164*100}%`).join(',');
function RulesHero() {
  const m=useContext(Metrics);
  return <Box x={70} y={168} w={569} h={150} decorative style={{alignItems:'center',justifyContent:'center',transform:[{rotate:'-2deg'}]}}>
    <Copy size={22} color={CYAN} style={{marginBottom:6*m.sy}}>MEME MASTER</Copy>
    <ImpactCopy size={58} lines={1}>HOW TO PLAY</ImpactCopy>
    <Image source={art.rulesHero} resizeMode="contain" accessibilityLabel="How to play" style={[{position:'absolute',width:1,height:1,opacity:0},Platform.OS==='web'?{clipPath:`polygon(${RULES_HERO_OUTLINE})`} as any:{}]} />
  </Box>;
}

const RULE_STEPS = [
  {title:'WRITE A CAPTION',description:'A meme appears. Write your funniest caption before the timer ends.',monster:'grumble' as const},
  {title:'LOCK IT IN',description:'Send your caption. Voting begins when everyone is ready.',monster:'peepers' as const},
  {title:'VOTE TWICE',description:'Pick 2 different anonymous memes. You can’t vote for your own!',monster:'snicker' as const},
  {title:'WIN THE ROUND',description:`Earn ${POINTS_PER_VOTE} points per vote, plus ${WINNER_BONUS} bonus for winning.`,monster:'scraps' as const},
];
const RULE_TITLE_MS = 720;
const RULE_STEP_MS = 1000;
const RULE_SLIDE_MS = 420;
const RULE_CARDS_DONE = RULE_TITLE_MS + (RULE_STEPS.length - 1) * RULE_STEP_MS + RULE_SLIDE_MS;
const RULE_FOOTER_MS = RULE_CARDS_DONE + 80;
const RULE_BUTTON_MS = RULE_FOOTER_MS + 750;
const RULE_SLOT_Y = (index:number) => 332 + index * 172;

function RuleCardFace({index}:{index:number}) {
  const m=useContext(Metrics);
  const rule=RULE_STEPS[index];
  const portrait=118*Math.min(m.sx,m.sy);
  return <LinearGradient colors={['#4a1a93','#190840']} start={{x:0,y:0}} end={{x:1,y:1}} style={{
    flex:1,
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:16*m.unit,
    gap:16*m.unit,
    borderRadius:34*m.unit,
    borderWidth:3*m.unit,
    borderColor:'#7af6ff',
    boxShadow:`0 ${6*m.unit}px 0 #0a0330, 0 0 ${18*m.unit}px #37f5ff55`,
  }}>
    <View style={{width:portrait,height:portrait,alignItems:'center',justifyContent:'center'}}>
      <View style={{width:portrait,height:portrait,borderRadius:portrait/2,overflow:'hidden',backgroundColor:'#2d1270',borderWidth:3*m.unit,borderColor:'#f3a6ff'}}>
        <Image source={monsters[rule.monster]} resizeMode="contain" style={{width:portrait*1.15,height:portrait*1.15,marginLeft:-portrait*0.08,marginTop:portrait*0.04}} />
      </View>
      <LinearGradient colors={['#ff4ad8','#a500e5']} style={{
        position:'absolute',left:-4*m.unit,top:-4*m.unit,
        width:52*m.unit,height:52*m.unit,borderRadius:28*m.unit,borderWidth:3*m.unit,borderColor:WHITE,justifyContent:'center',
        boxShadow:`0 ${3*m.unit}px 0 #6b0878`,
      }}><Copy size={32}>{index+1}</Copy></LinearGradient>
    </View>
    <View style={{flex:1,minWidth:0,paddingRight:8*m.sx}}>
      <Copy size={30} color="#fff6b8" lines={1} style={{textAlign:'left',marginBottom:8*m.sy}}>{rule.title}</Copy>
      <Copy body size={22} color="#e8dcff" lines={3} style={{textAlign:'left',fontSize:Math.max(14,22*m.unit),lineHeight:Math.max(18,22*m.unit)*1.32}}>{rule.description}</Copy>
    </View>
  </LinearGradient>;
}

function RulesWalkthrough({paused}:{paused:boolean}) {
  const m=useContext(Metrics);
  const clock=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0);
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduced(value);});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(paused)return;
    if(reduced){clock.setValue(RULE_CARDS_DONE);elapsed.current=RULE_CARDS_DONE;return;}
    const from=elapsed.current,startedAt=Date.now();
    const animation=Animated.timing(clock,{
      toValue:RULE_CARDS_DONE,
      duration:Math.max(0,RULE_CARDS_DONE-from),
      easing:Easing.linear,
      useNativeDriver:Platform.OS!=='web',
    });
    animation.start(({finished})=>{if(finished)elapsed.current=RULE_CARDS_DONE;});
    return()=>{animation.stop();elapsed.current=Math.min(RULE_CARDS_DONE,from+Date.now()-startedAt);};
  },[clock,paused,reduced]);
  return <>
    {RULE_STEPS.map((rule,index)=>{
      const start=RULE_TITLE_MS+index*RULE_STEP_MS;
      const end=start+RULE_SLIDE_MS;
      const fromX=80*m.sx;
      const at=(inputRange:number[],outputRange:number[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
      const opacity=reduced?1:at([0,start,start+180],[0,0,1]);
      const translateX=reduced?0:at([0,start,end],[fromX,fromX,0]);
      return <Box key={rule.title} x={32} y={RULE_SLOT_Y(index)} w={645} h={160}>
        <Animated.View style={{flex:1,opacity,transform:[{translateX}]}}>
          <RuleCardFace index={index} />
        </Animated.View>
      </Box>;
    })}
  </>;
}
function Copy({ children, size=30, color=WHITE, style, lines, body=false }: { children:ReactNode; size?:number; color?:string; style?:any; lines?:number; body?:boolean }) {
  const { unit } = useContext(Metrics);
  const fontSize = body ? Math.max(13, size*unit) : size*unit;
  return <Text testID={body ? 'meme-body-copy' : 'meme-display-copy'} numberOfLines={lines} adjustsFontSizeToFit={!!lines} minimumFontScale={.82} style={[{fontFamily:body?BODY_FONT:FONT, fontSize, lineHeight:fontSize*(body?1.24:1.12), color, textAlign:'center', includeFontPadding:false, ...(Platform.OS==='web'?{overflowWrap:'anywhere'}:{})},style,{fontWeight:body?'600':'400',letterSpacing:0}]}>{children}</Text>;
}
function ImpactCopy({children,size=60,color='#fff6b8',lines=1}:{children:ReactNode;size?:number;color?:string;lines?:number}) {
  const {unit}=useContext(Metrics);
  return <Copy size={size} color={color} lines={lines} style={Platform.OS==='web'?{
    WebkitTextStroke:`${3*unit}px #17083e`,paintOrder:'stroke fill',
    textShadow:`0 ${4*unit}px 0 #321068, 0 ${7*unit}px 0 #100528, 0 0 ${18*unit}px #ad49fc55`,
  }:{textShadowColor:'#230e56',textShadowOffset:{width:0,height:4*unit},textShadowRadius:1}}>{children}</Copy>;
}

// A display-only colour treatment: the original logo bitmap, lettering and
// transparency remain unchanged. The home screen retains its original colour.
const MEME_LOGO_COLOR = Platform.OS==='web'?{filter:'grayscale(1) sepia(1) hue-rotate(135deg) saturate(3) brightness(1.4)'} as any:{tintColor:'#bffaff'};
function Brand({x=211,y=18,w=287,h=172}: Partial<Bounds>) {
  const m=useContext(Metrics);
  return <Box x={x} y={y} w={w} h={h} decorative>
    <Image source={TOTAL_CHAOS_LOGO} accessibilityLabel="Total Chaos" resizeMode="contain" style={[{width:'100%',height:(h-42)*m.sy},MEME_LOGO_COLOR]} />
    <LinearGradient colors={['#ab3bff','#6523db']} start={{x:0,y:0}} end={{x:1,y:1}} style={{alignSelf:'center',height:34*m.sy,minWidth:'78%',paddingHorizontal:15*m.sx,borderRadius:28*m.unit,justifyContent:'center',borderTopWidth:m.unit,borderColor:'#ea9eff',transform:[{rotate:'-3deg'}]}}><Copy size={24}>MEME MASTER</Copy></LinearGradient>
  </Box>;
}
function PillButton({ label, onPress, color=CYAN, disabled, accessibilityLabel, sound=true, hapticCue='selection', ...box }: Bounds & { label:string; onPress:()=>void; color?:string; disabled?:boolean; accessibilityLabel?:string;sound?:boolean;hapticCue?:HapticCue|false }) {
  const m=useContext(Metrics);
  const secondary=color!==CYAN;
  return <Box {...box}><Pressable testID="meme-action-button" accessibilityRole="button" accessibilityLabel={accessibilityLabel||label} accessibilityState={{disabled:!!disabled}} disabled={disabled} style={({pressed})=>({flex:1,minHeight:44,borderRadius:32*m.unit,backgroundColor:'#100735',padding:4*m.unit,borderWidth:2*m.unit,borderColor:disabled?'#65548e':secondary?'#9f77ef':'#bdfdff',transform:[{scale:pressed?.97:1}],boxShadow:disabled?'none':`0 ${6*m.unit}px 0 #07022d, 0 0 ${18*m.unit}px ${secondary?'#8d4dff44':'#37f5ff44'}`})} onPressIn={()=>{if(!disabled){if(sound)playSound('click');if(hapticCue)haptic(hapticCue);}}} onPress={onPress}><LinearGradient colors={disabled?['#3a2b62','#281c4f']:secondary?['#6532c0','#34217e']:['#a9fbff',CYAN]} style={{flex:1,borderRadius:26*m.unit,borderTopWidth:2*m.unit,borderColor:'#ffffff80',justifyContent:'center',paddingHorizontal:16*m.unit}}><Copy color={disabled?'#c1b5dd':secondary?WHITE:INK} size={box.w<200?29:35} lines={2}>{label}</Copy></LinearGradient></Pressable></Box>;
}
function WhitePanel({ children, neon=false, ...box }: Bounds & {children:ReactNode;neon?:boolean}) {
  const m=useContext(Metrics);
  return <Box {...box} style={{backgroundColor:'#fefeff',borderRadius:38*m.unit,borderWidth:5*m.unit,borderColor:neon?'#effeff':WHITE,boxShadow:neon?`0 0 0 ${4*m.unit}px #31e9ff, ${4*m.unit}px ${6*m.unit}px 0 ${7*m.unit}px #7326ec, 0 0 ${26*m.unit}px #23dcff90`:`0 ${8*m.unit}px 0 #dfd5ff, 0 ${14*m.unit}px ${26*m.unit}px #05042670`}}>{children}</Box>;
}
function Avatar({ id,name,size=84,selected=false }: {id:MonsterId;name?:string;size?:number;selected?:boolean}) {
  const m=useContext(Metrics);
  const diameter=size*Math.min(m.sx,m.sy);
  return <View style={{alignItems:'center',minWidth:0}}><Image source={avatars[id]} accessibilityLabel={id} style={{width:diameter,height:diameter,borderRadius:diameter/2,borderWidth:selected?3*m.unit:0,borderColor:CYAN}} />{name?<Copy size={20} lines={1} style={{marginTop:5*m.unit}}>{name}</Copy>:null}</View>;
}
function Timer({ seconds,total,x=260,y=324,size=186,simple=false }: {seconds:number;total:number;x?:number;y?:number;size?:number;simple?:boolean}) {
  const m=useContext(Metrics);
  const d=size*Math.min(m.sx,m.sy), thickness=14*Math.min(m.sx,m.sy), radius=(d-thickness)/2;
  const n=Math.max(0,Math.round(seconds/total*100));
  return <Box x={x} y={y} w={size} h={size} decorative style={{alignItems:'center',justifyContent:'center'}}>
    <View accessibilityRole="timer" accessibilityLabel={`${seconds} seconds remaining`} style={{width:d,height:d,borderRadius:d/2,justifyContent:'center',alignItems:'center',boxShadow:`0 0 ${25*m.unit}px #04a6ff99`,backgroundColor:'#02063f'}}>
      {Platform.OS==='web'?<>
        <View style={[StyleSheet.absoluteFill,{borderRadius:d/2,backgroundImage:`conic-gradient(${seconds<=10?'#fff153':CYAN} ${n*3.6}deg, #4530c9 ${n*3.6}deg)`} as any]} />
        <View style={{position:'absolute',inset:thickness,borderRadius:d/2,backgroundColor:'#02063f'}} />
        {n>0&&[0,n].map((part,i)=>{const a=part/100*2*Math.PI-Math.PI/2;return <View key={i} style={{position:'absolute',width:thickness,height:thickness,borderRadius:thickness/2,backgroundColor:seconds<=10?'#fff153':CYAN,left:d/2-thickness/2+Math.cos(a)*radius,top:d/2-thickness/2+Math.sin(a)*radius}} />;})}
      </>:<>
        <View style={[StyleSheet.absoluteFill,{borderRadius:d/2,borderWidth:thickness,borderColor:'#4634df'}]} />
        {Array.from({length:n},(_,i)=>{const a=i/100*2*Math.PI-Math.PI/2;return <View key={i} style={{position:'absolute',width:thickness+1,height:thickness+1,borderRadius:thickness,backgroundColor:seconds<=10?'#fff153':CYAN,left:d/2-(thickness+1)/2+Math.cos(a)*radius,top:d/2-(thickness+1)/2+Math.sin(a)*radius}} />;})}
      </>}
      <View style={{width:d-thickness*2-12*m.unit,alignItems:'center',justifyContent:'center'}}><Copy size={(simple?d*.36:d*.225)/m.unit} lines={1} style={{fontVariant:['tabular-nums']}}>{simple?seconds:formatTime(seconds)}</Copy></View>
    </View>
  </Box>;
}
function PhotoCard({ source,caption,stacked=true,...box }: Bounds & {source:ImageSourcePropType;caption?:string;stacked?:boolean}) {
  const m=useContext(Metrics);
  const captionHeight=caption?(caption.length>90?215:caption.length>58?190:155)*m.sy:0;
  const captionSize=caption?Math.min(44*m.unit,(captionHeight-24*m.unit)/(caption.length>90?5:caption.length>58?4:3)/1.16):0;
  const imageSide=Math.max(0,Math.min(box.w*m.sx-30*m.unit,box.h*m.sy-30*m.unit-captionHeight));
  return <Box {...box} decorative>
    {stacked&&<><View style={[StyleSheet.absoluteFill,{backgroundColor:'#ddd2ff',borderRadius:32*m.unit,transform:[{rotate:'-3deg'},{translateY:11*m.unit}],boxShadow:`0 ${6*m.unit}px ${12*m.unit}px #05032b70`}]} />
    <View style={[StyleSheet.absoluteFill,{backgroundColor:WHITE,borderRadius:32*m.unit,transform:[{rotate:'2deg'},{translateY:4*m.unit}]}]} /></>}
    <View style={{flex:1,padding:15*m.unit,backgroundColor:WHITE,borderRadius:30*m.unit,transform:[{rotate:stacked?'1deg':'0deg'}],boxShadow:stacked?'none':`0 ${8*m.unit}px ${24*m.unit}px #02002180`}}>
      <View style={{flex:1,minHeight:0,alignItems:'center',justifyContent:'center'}}>
        <View style={{width:imageSide,height:imageSide,borderRadius:22*m.unit,overflow:'hidden',backgroundColor:'#e8e8ef'}}>
          <Image source={source} accessibilityLabel="Meme image" resizeMode="cover" style={FILL_IMAGE} />
        </View>
      </View>
      {caption?<View testID="caption-white-section" style={{height:captionHeight,flexShrink:0,overflow:'hidden',justifyContent:'center',paddingVertical:12*m.unit,paddingHorizontal:12*m.unit}}><Copy size={captionSize/m.unit} color={INK} lines={caption.length>90?5:caption.length>58?4:3}>{caption.toUpperCase()}</Copy></View>:null}
    </View>
  </Box>;
}
function SwipeDeck({source,caption,onBrowse,...box}:Bounds & {source:ImageSourcePropType;caption:string;onBrowse:(direction:number)=>void}) {
  const m=useContext(Metrics);
  const offset=useRef(new Animated.Value(0)).current;
  const busy=useRef(false);
  const browse=useRef(onBrowse); browse.current=onBrowse;
  const responder=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>10&&Math.abs(g.dx)>Math.abs(g.dy)*1.3,
    onPanResponderMove:(_,g)=>{if(!busy.current)offset.setValue(g.dx);},
    onPanResponderRelease:(_,g)=>{
      if(busy.current)return;
      if(Math.abs(g.dx)>40 || (Math.abs(g.vx)>.45&&Math.abs(g.dx)>15)) {
        busy.current=true;
        const direction=g.dx<0?1:-1;
        playSound('swipe');
        haptic('light');
        Animated.timing(offset,{toValue:-direction*box.w*m.sx,duration:160,useNativeDriver:true}).start(()=>{
          browse.current(direction);offset.setValue(direction*35);
          Animated.spring(offset,{toValue:0,useNativeDriver:true,tension:90,friction:12}).start(()=>{busy.current=false;});
        });
      }else Animated.spring(offset,{toValue:0,useNativeDriver:true}).start();
    },
    onPanResponderTerminate:()=>{offset.setValue(0);busy.current=false;},
  }),[offset,box.w,m.sx]);
  return <Box {...box}><Animated.View {...responder.panHandlers} accessibilityLabel="Swipe left or right to browse captions" style={{flex:1,...(Platform.OS==='web'?{touchAction:'pan-y'} as any:{}),transform:[{translateX:offset},{rotate:offset.interpolate({inputRange:[-300,0,300],outputRange:['-8deg','0deg','8deg']})}]}}><PhotoCard x={0} y={0} w={box.w} h={box.h} source={source} caption={caption}/></Animated.View></Box>;
}

function VotingEntrance({children,part,paused=false,onReady,headingY=76}:{children:ReactNode;part:'heading'|'cards'|'controls';paused?:boolean;onReady?:()=>void;headingY?:number}) {
  const m=useContext(Metrics);
  const progress=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0);
  const complete=useRef(onReady);complete.current=onReady;
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const id=progress.addListener(({value})=>{elapsed.current=value;});
    return()=>progress.removeListener(id);
  },[progress]);
  useEffect(()=>{
    if(paused)return;
    let mounted=true;
    let animation:Animated.CompositeAnimation|undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
      if(!mounted)return;
      if(reduced){progress.setValue(2800);setReady(true);complete.current?.();return;}
      animation=Animated.timing(progress,{toValue:2800,duration:Math.max(0,2800-elapsed.current),easing:Easing.linear,useNativeDriver:true});
      animation.start(({finished})=>{if(finished&&mounted){setReady(true);complete.current?.();}});
    });
    return()=>{mounted=false;animation?.stop();};
  },[progress,paused]);
  const value=(inputRange:number[],outputRange:any[])=>progress.interpolate({inputRange,outputRange,extrapolate:'clamp'});
  const heading=part==='heading',cards=part==='cards';
  const animated=<Animated.View testID={`voting-entrance-${part}`} pointerEvents={ready?'box-none':'none'} accessibilityElementsHidden={!ready&&!heading} importantForAccessibility={!ready&&!heading?'no-hide-descendants':'auto'} style={[StyleSheet.absoluteFill,{
    opacity:heading?value([0,220],[0,1]):cards?value([1850,2020],[0,1]):value([2390,2670],[0,1]),
    transform:ready?[]:[
      {translateY:heading?value([0,1050,1480,1800],[560*m.sy,560*m.sy,100*m.sy,0]):cards?value([1850,2220,2420],[150*m.sy,-10*m.sy,0]):value([2390,2680,2800],[32*m.sy,-3*m.sy,0])},
      {scale:heading?value([0,380,570,1050,1800],[.25,1.48,1.35,1.35,1]):cards?value([1850,2220,2420],[1.35,.98,1]):value([2390,2680,2800],[.92,1.015,1])},
      {rotate:heading?value([0,380,1050,1800],['-8deg','2deg','-2deg','0deg']):cards?value([1850,2220,2420],['-12deg','1.5deg','0deg']):'0deg'},
    ],
  }]}>{children}</Animated.View>;
  return heading?<Box x={164} y={headingY} w={390} h={68} decorative>{animated}</Box>:animated;
}

function CrownedPlacement({rank,tied=false}:{rank:number;tied?:boolean}) {
  const m=useContext(Metrics);
  const color=rank===1?'#ffdf64':rank===2?'#d6e7ff':'#eda575';
  return <View testID="crowned-placement" accessibilityLabel={`${tied?'Joint ':''}${rank===1?'1st':rank===2?'2nd':'3rd'} place`} style={{alignItems:'center',justifyContent:'center',gap:3*m.sy}}>
    <Text accessible={false} style={{fontSize:37*m.unit,lineHeight:42*m.unit,includeFontPadding:false}}>👑</Text>
    <ImpactCopy size={46} color={color}>{rank===1?'1ST':rank===2?'2ND':'3RD'}</ImpactCopy>
    {tied&&<Copy size={18}>JOINT</Copy>}
  </View>;
}
function WinnerReveal({plan,paused,onScores,memeSource}:{plan:ReturnType<typeof winnerRevealPlan>;paused:boolean;onScores:()=>void;memeSource?:ImageSourcePropType}) {
  const m=useContext(Metrics);
  const clock=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0);
  const reported=useRef(-1);
  const sounded=useRef(new Set<string>());
  const [now,setNow]=useState(0);
  const [reduced,setReduced]=useState(false);
  const done=useRef(onScores);done.current=onScores;
  useEffect(()=>{
    let mounted=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReduced(value);});
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);
    return()=>{mounted=false;sub.remove();};
  },[]);
  useEffect(()=>{
    const id=clock.addListener(({value})=>{
      elapsed.current=value;
      plan.entries.forEach(item=>{
        const placementKey=`placement-${item.caption.id}`;
        if(value>=item.start&&!sounded.current.has(placementKey)){
          sounded.current.add(placementKey);
          playSound(item.rank===1?'winner':'runnerUp');
          haptic(item.rank===1?'success':'medium');
          playNarration(item.rank===1?'memeMasterFirstPlace':item.rank===2?'memeMasterSecondPlace':'memeMasterThirdPlace');
        }
        item.voteTimes.forEach((time,index)=>{
          const voteKey=`vote-${item.caption.id}-${index}`;
          if(value>=time&&!sounded.current.has(voteKey)){
            sounded.current.add(voteKey);
            playSound('pointsAppearing');
          }
        });
        const confettiKey=`confetti-${item.caption.id}`;
        if(item.rank===1&&item.bonus>0&&value>=item.bonusAt&&!sounded.current.has(confettiKey)){
          sounded.current.add(confettiKey);
          playSound('playerReady');
        }
      });
      const bucket=Math.floor(value/80);
      if(bucket!==reported.current){reported.current=bucket;setNow(value);}
    });
    return()=>clock.removeListener(id);
  },[clock,plan.entries]);
  useEffect(()=>{
    if(paused)return;
    const animation=Animated.timing(clock,{toValue:plan.duration,duration:Math.max(0,plan.duration-elapsed.current),easing:Easing.linear,useNativeDriver:true});
    animation.start(({finished})=>{if(finished)done.current();});
    return()=>animation.stop();
  },[clock,paused,plan.duration]);
  const active=Math.max(0,plan.entries.findLastIndex(e=>now>=e.start));
  const entry=plan.entries[active];
  if(!entry)return <PillButton x={150} y={1300} w={409} h={104} label="ROUND SCORES" accessibilityLabel="Show round scores" onPress={onScores}/>;
  const showing=now>=entry.cardAt;
  const rankColor=entry.rank===1?'#ffdf64':entry.rank===2?'#d6e7ff':'#eda575';
  const arrived=entry.voteTimes.filter(t=>now>=t).length;
  const awardedBonus=now>=entry.bonusAt?entry.bonus:0;
  const latestAward=awardedBonus?entry.bonusAt:(entry.voteTimes[arrived-1]??entry.start);
  const pointsPulse=clock.interpolate({inputRange:[latestAward,latestAward+170,latestAward+420],outputRange:[1,1.12,1],extrapolate:'clamp'});
  const rankName=entry.rank===1?'1ST':entry.rank===2?'2ND':'3RD';
  const introOpacity=clock.interpolate({inputRange:[0,250],outputRange:[0,1],extrapolate:'clamp'});
  const titleMove=clock.interpolate({inputRange:[0,800,1650],outputRange:[500*m.sy,500*m.sy,0],extrapolate:'clamp'});
  const titleScale=clock.interpolate({inputRange:[0,420,800,1650],outputRange:[.2,1.25,1.18,1],extrapolate:'clamp'});
  const splatOpacity=clock.interpolate({inputRange:[entry.start,entry.start+180,entry.start+980,entry.cardAt],outputRange:[0,1,1,0],extrapolate:'clamp'});
  const splatScale=clock.interpolate({inputRange:[entry.start,entry.start+300,entry.start+980,entry.cardAt],outputRange:[.35,1.08,1,1.38],extrapolate:'clamp'});
  const splatRotate=clock.interpolate({inputRange:[entry.start,entry.start+500,entry.cardAt],outputRange:['-14deg','3deg','18deg'],extrapolate:'clamp'});
  return <>
    <Box x={105} y={76} w={499} h={119} decorative>
      <Animated.View style={{flex:1,justifyContent:'center',opacity:reduced?1:introOpacity,transform:reduced?[]:[{translateY:titleMove},{scale:titleScale},{rotate:'-2deg'}]}}><Copy size={28} color={CYAN} style={{marginBottom:4*m.sy}}>THE CROWD</Copy><ImpactCopy size={75}>CHOSE…</ImpactCopy></Animated.View>
    </Box>
    {now>=entry.start&&!showing&&<Box x={189} y={475} w={330} h={330} decorative style={{zIndex:90,overflow:'visible'}}>
      <Animated.View style={{flex:1,opacity:reduced?1:splatOpacity,transform:reduced?[]:[{scale:splatScale},{rotate:splatRotate}]}}>
        <View style={{position:'absolute',left:'15%',top:'14%',width:'70%',height:'72%',borderRadius:76*m.unit,backgroundColor:CYAN,borderWidth:5*m.unit,borderColor:'#c7fdff',transform:[{rotate:'11deg'}],boxShadow:`0 0 ${30*m.unit}px #37f5ffcc`}}/>
        <View style={{position:'absolute',left:'5%',top:'31%',width:'40%',height:'38%',borderRadius:70*m.unit,backgroundColor:'#2cdcf5',transform:[{rotate:'-24deg'}]}}/>
        <View style={{position:'absolute',right:'3%',top:'20%',width:'39%',height:'46%',borderRadius:74*m.unit,backgroundColor:'#5ff8ff',transform:[{rotate:'31deg'}]}}/>
        <View style={{position:'absolute',left:'27%',bottom:'2%',width:'42%',height:'42%',borderRadius:72*m.unit,backgroundColor:'#24d8ee',transform:[{rotate:'17deg'}]}}/>
        {Array.from({length:10},(_,i)=>{
          const angle=i/10*Math.PI*2;
          const travel=clock.interpolate({inputRange:[entry.start+980,entry.cardAt],outputRange:[0,94*m.unit],extrapolate:'clamp'});
          const particleOpacity=clock.interpolate({inputRange:[entry.start+940,entry.start+1080,entry.cardAt],outputRange:[0,1,0],extrapolate:'clamp'});
          return <Animated.View key={`splat-particle-${i}`} style={{position:'absolute',left:'48%',top:'48%',width:(10+i%3*4)*m.unit,height:(10+i%3*4)*m.unit,borderRadius:12*m.unit,backgroundColor:i%2?CYAN:'#99fbff',opacity:particleOpacity,transform:[{translateX:Animated.multiply(travel,Math.cos(angle))},{translateY:Animated.multiply(travel,Math.sin(angle))},{rotate:`${i*29}deg`}]}}/>;
        })}
      </Animated.View>
    </Box>}
    {now>=entry.start&&!showing&&<Box x={73} y={220} w={146} h={146} decorative style={{zIndex:100}}>
      <Animated.View testID="winner-placement-spotlight" accessibilityLabel={`${entry.tied?'Joint ':''}${rankName} place`} style={{flex:1,alignItems:'center',justifyContent:'center',opacity:reduced?1:clock.interpolate({inputRange:[entry.start,entry.start+220],outputRange:[0,1],extrapolate:'clamp'}),transform:reduced?[]:[
        {translateX:clock.interpolate({inputRange:[entry.start,entry.start+950,entry.cardAt-160,entry.cardAt],outputRange:[208*m.sx,208*m.sx,-8*m.sx,0],extrapolate:'clamp'})},
        {translateY:clock.interpolate({inputRange:[entry.start,entry.start+950,entry.cardAt-160,entry.cardAt],outputRange:[350*m.sy,350*m.sy,8*m.sy,0],extrapolate:'clamp'})},
        {scale:clock.interpolate({inputRange:[entry.start,entry.start+380,entry.start+950,entry.cardAt-220,entry.cardAt-90,entry.cardAt],outputRange:[.3,2.8,2.6,.88,1.12,1],extrapolate:'clamp'})},
        {rotate:clock.interpolate({inputRange:[entry.start,entry.start+380,entry.cardAt],outputRange:['-12deg','3deg','0deg'],extrapolate:'clamp'})}
      ]}}><CrownedPlacement rank={entry.rank} tied={entry.tied}/></Animated.View>
    </Box>}
    {showing&&<Box x={60} y={220} w={589} h={146} decorative><LinearGradient colors={['#42117f','#190840']} start={{x:0,y:0}} end={{x:1,y:1}} style={{flex:1,flexDirection:'row',alignItems:'center',gap:16*m.unit,paddingHorizontal:13*m.unit,borderRadius:30*m.unit,borderWidth:2*m.unit,borderColor:rankColor,boxShadow:`0 0 ${20*m.unit}px #992aff44`}}>
      <View style={{width:146*m.sx}}><CrownedPlacement rank={entry.rank} tied={entry.tied}/></View>
      <View style={{width:2*m.unit,height:68*m.sy,backgroundColor:'#c4a5ef66'}}/>
      <View style={{width:94*m.sx,height:122*m.sy,alignItems:'center',justifyContent:'flex-end'}}><Image source={monsters[entry.author.id]} accessibilityLabel={`${entry.author.name}'s monster`} resizeMode="contain" style={{width:108*m.sx,height:128*m.sy}}/></View>
      <View style={{flex:1,minWidth:0}}><Copy size={20} color="#d9c5ff">{entry.rank===1?'ROUND WINNER':'MEME BY'}</Copy><Copy size={38} lines={1} style={{marginTop:5*m.sy}}>{entry.author.name}</Copy></View>
    </LinearGradient></Box>}
    {plan.entries.map((item,i)=>{
      const angle=i===plan.entries.length-1?-1:i%2?4:-5;
      const opacity=clock.interpolate({inputRange:[item.cardAt-1,item.cardAt,item.cardAt+160],outputRange:[0,0,1],extrapolate:'clamp'});
      const scale=clock.interpolate({inputRange:[item.cardAt,item.cardAt+420,item.cardAt+610],outputRange:[1.65,.97,1],extrapolate:'clamp'});
      const move=clock.interpolate({inputRange:[item.cardAt,item.cardAt+440,item.cardAt+610],outputRange:[-260*m.sy,8*m.sy,0],extrapolate:'clamp'});
      const rotate=clock.interpolate({inputRange:[item.cardAt,item.cardAt+440,item.cardAt+610],outputRange:[`${i%2?-17:17}deg`,`${angle+1}deg`,`${angle}deg`],extrapolate:'clamp'});
      return <Box key={item.caption.id} x={104.5} y={390} w={500} h={650} decorative>
        <Animated.View testID="winner-reveal-card" accessibilityElementsHidden={now<item.cardAt||i!==active} importantForAccessibility={i===active?'auto':'no-hide-descendants'} style={{flex:1,opacity:reduced?(now>=item.cardAt?1:0):opacity,transform:reduced?[{rotate:`${angle}deg`}]:[{translateY:move},{scale},{rotate}]}}>
          <PhotoCard x={0} y={0} w={500} h={650} source={memeSource??scenes[item.caption.image]} caption={item.caption.text} stacked={false}/>
        </Animated.View>
      </Box>;
    })}
    {showing&&<>
      <Box x={105} y={1080} w={499} h={36} decorative><Copy size={23} color="#e4d8ff">{entry.voters.length?`${entry.voters.length} VOTED FOR THIS`:'NO VOTES THIS TIME'}</Copy></Box>
      <Box x={20} y={1124} w={669} h={126} decorative><View style={{flexDirection:'row',justifyContent:'center',gap:5*m.unit}}>
        {entry.voters.map((voter,i)=>{
          const at=entry.voteTimes[i];
          const pop=clock.interpolate({inputRange:[at,at+210,at+350],outputRange:[.25,1.18,1],extrapolate:'clamp'});
          const alpha=clock.interpolate({inputRange:[at,at+140],outputRange:[0,1],extrapolate:'clamp'});
          return <Animated.View key={voter.id} accessibilityLabel={`${voter.name} voted, ${POINTS_PER_VOTE} points`} style={{alignItems:'center',flex:1,maxWidth:92*m.sx,minWidth:0,opacity:reduced?(now>=at?1:0):alpha,transform:reduced?[]:[{scale:pop}]}}>
            <Image source={monsters[voter.id]} accessibilityLabel={`${voter.name}'s monster`} resizeMode="contain" style={{width:72*m.sx,height:68*m.sy}}/>
            <Copy size={17} lines={1} style={{marginTop:-2*m.sy}}>{voter.name}</Copy>
            <View style={{marginTop:3*m.sy,paddingHorizontal:8*m.unit,paddingVertical:2*m.unit,borderRadius:11*m.unit,backgroundColor:'#112855',borderWidth:m.unit,borderColor:'#53ffc877'}}><Copy size={19} color="#95ffd4">+{POINTS_PER_VOTE}</Copy></View>
          </Animated.View>;
        })}
      </View></Box>
      <Box x={92} y={1262} w={525} h={104} decorative><Animated.View style={{flex:1,transform:reduced?[]:[{scale:pointsPulse}]}}><LinearGradient colors={['#9cfcff',CYAN]} style={{flex:1,borderRadius:30*m.unit,borderWidth:2*m.unit,borderColor:'#d9ffff',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:22*m.unit,paddingHorizontal:20*m.sx,boxShadow:`0 ${4*m.unit}px 0 #087f9d`}}><ImpactCopy size={57} color={INK}>+{arrived*POINTS_PER_VOTE+awardedBonus}</ImpactCopy><View style={{alignItems:'flex-start',gap:5*m.sy}}><Copy size={26} color={INK}>ROUND POINTS</Copy>{awardedBonus>0&&<Copy size={20} color="#164c68">Includes +{awardedBonus} bonus</Copy>}</View></LinearGradient></Animated.View></Box>
      {!reduced&&entry.bonus>0&&Array.from({length:14},(_,i)=>{
        const at=entry.bonusAt,theta=i/14*Math.PI*2;
        const fade=clock.interpolate({inputRange:[at,at+100,at+1000,at+1400],outputRange:[0,1,1,0],extrapolate:'clamp'});
        const dx=clock.interpolate({inputRange:[at,at+1400],outputRange:[0,Math.cos(theta)*220*m.unit],extrapolate:'clamp'});
        const dy=clock.interpolate({inputRange:[at,at+750,at+1400],outputRange:[0,Math.sin(theta)*145*m.unit-65*m.unit,Math.sin(theta)*145*m.unit+30*m.unit],extrapolate:'clamp'});
        return <Box key={`confetti-${i}`} x={351} y={1312} w={10} h={18} decorative><Animated.View style={{flex:1,borderRadius:2*m.unit,backgroundColor:['#ffe76a','#56f9ff','#ff69c7'][i%3],opacity:fade,transform:[{translateX:dx},{translateY:dy},{rotate:`${i*37}deg`}]}}/></Box>;
      })}
    </>}
    <PillButton x={151} y={1410} w={407} h={96} label={now>=plan.completeAt?'ROUND SCORES →':'REVEALING THE VOTES…'} accessibilityLabel="Show round scores" disabled={now<plan.completeAt} onPress={onScores}/>
  </>;
}
const SCORE_TABLE_DURATION=3000;
function ScoreTable({rows,paused,onReady}:{rows:ReturnType<typeof resultsFor>['rows'];paused:boolean;onReady:()=>void}) {
  const m=useContext(Metrics);
  const clock=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0);
  const bucket=useRef(-1);
  const done=useRef(onReady);done.current=onReady;
  const [now,setNow]=useState(0);
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{
    const id=clock.addListener(({value})=>{
      elapsed.current=value;
      if(Math.floor(value/50)!==bucket.current){bucket.current=Math.floor(value/50);setNow(value);}
    });
    return()=>clock.removeListener(id);
  },[clock]);
  useEffect(()=>{
    if(paused)return;
    let alive=true;
    let animation:Animated.CompositeAnimation|undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{
      if(!alive)return;
      setReduced(value);
      if(value){clock.setValue(SCORE_TABLE_DURATION);setNow(SCORE_TABLE_DURATION);done.current();return;}
      animation=Animated.timing(clock,{toValue:SCORE_TABLE_DURATION,duration:Math.max(0,SCORE_TABLE_DURATION-elapsed.current),easing:Easing.linear,useNativeDriver:true});
      animation.start(({finished})=>{if(alive&&finished){setNow(SCORE_TABLE_DURATION);done.current();}});
    });
    return()=>{alive=false;animation?.stop();};
  },[clock,paused]);
  const settled=now>=2800;
  const pitch=94*m.sy;
  return <>
    <Box x={136} y={407} w={437} h={45} decorative><Copy size={27} color={CYAN}>{now<1900?'ADDING YOUR POINTS…':settled?'THE NEW STANDINGS':'MOVING UP. MOVING DOWN.'}</Copy></Box>
    <WhitePanel x={34} y={478} w={641} h={790}><View style={{flex:1,margin:14*m.unit}}>
      {rows.map((p,i)=>{
        const previousIndex=i+p.movement;
        const start=180+previousIndex*55;
        const fraction=Math.max(0,Math.min(1,(now-start)/1750));
        const earned=Math.round(p.points*(1-Math.pow(1-fraction,3)));
        const shift=clock.interpolate({inputRange:[1900,2750,2800],outputRange:[p.movement*pitch,0,0],extrapolate:'clamp'});
        const lift=clock.interpolate({inputRange:[1900,2100,2700,2800],outputRange:[0,p.movement>0?8*m.sx:p.movement<0?-8*m.sx:0,p.movement>0?8*m.sx:p.movement<0?-8*m.sx:0,0],extrapolate:'clamp'});
        const pulse=clock.interpolate({inputRange:[start,start+220,start+550],outputRange:[1,1.12,1],extrapolate:'clamp'});
        return <Animated.View key={p.id} testID="animated-score-row" accessibilityLabel={`${p.name}, ${settled?i+1:previousIndex+1} place, ${p.previousScore+earned} points`} style={{position:'absolute',top:i*pitch,left:0,right:0,height:88*m.sy,zIndex:p.movement>0?10:1,transform:reduced?[]:[{translateY:shift},{translateX:lift}],borderRadius:18*m.unit,backgroundColor:settled&&i===0?'#a9fbff':'#f0f1f8',borderWidth:2*m.unit,borderColor:settled&&i===0?'#37f5ff':'#e4e4ef',flexDirection:'row',alignItems:'center',paddingHorizontal:12*m.sx,gap:10*m.sx,boxShadow:settled&&i===0?`0 0 ${12*m.unit}px #37f5ff77`:'none'}}>
          <Copy color={settled&&i===0?'#164c68':'#555078'} size={36} style={{width:35*m.sx}}>{settled?i+1:previousIndex+1}</Copy>
          <Image source={monsters[p.id]} accessibilityLabel={`${p.name}'s monster`} resizeMode="contain" style={{width:72*m.sx,height:76*m.sy}}/>
          <View style={{flex:1,minWidth:0}}><Copy color={INK} size={29} lines={1} style={{textAlign:'left'}}>{p.name}</Copy><Copy size={20} color="#14765c" style={{textAlign:'left',marginTop:4*m.sy}}>{now>=start?`+${earned} THIS ROUND`:'POINTS SO FAR'}</Copy></View>
          <Animated.View style={{width:100*m.sx,transform:reduced?[]:[{scale:pulse}]}}><Copy color={INK} size={39} lines={1} style={{textAlign:'right'}}>{p.previousScore+earned}</Copy></Animated.View>
          <Copy color={p.movement>0?'#078244':p.movement<0?'#d92566':'#726889'} size={25} style={{width:65*m.sx,textAlign:'right'}}>{settled?(p.movement>0?`▲${p.movement}`:p.movement<0?`▼${Math.abs(p.movement)}`:'—'):'·'}</Copy>
        </Animated.View>;
      })}
    </View></WhitePanel>
  </>;
}

const phaseSeconds:Partial<Record<MemePhase,number>>={
  compose:MEME_MASTER_PACING.composeSeconds,locked:MEME_MASTER_PACING.lockedSeconds,
  vote:MEME_MASTER_PACING.voteSeconds,
  scores:MEME_MASTER_PACING.scoresSeconds,
};
type Props={onFinish:()=>void;onExit:()=>void;viewportWidth:number;viewportHeight:number;playerId?:MonsterId;playerName?:string;entrancePaused?:boolean};

export default function MemeMasterGame({onFinish,onExit,viewportWidth,viewportHeight,playerId='grumble',playerName='MATTHIAS',entrancePaused=false}:Props) {
  const [phase,setPhase]=useState<MemePhase>('intro');
  const [seconds,setSeconds]=useState(0);
  const [draft,setDraft]=useState('');
  const [submitted,setSubmitted]=useState('');
  const [scene,setScene]=useState<MemeImage>('gaming');
  const [cardIndex,setCardIndex]=useState(0);
  const [ballots,setBallots]=useState<Ballot[]>([]);
  const [menu,setMenu]=useState(false);
  const [focused,setFocused]=useState(false);
  const [paused,setPaused]=useState(false);
  const [hasFinished,setHasFinished]=useState(false);
  const [keyboardViewport,setKeyboardViewport]=useState({height:viewportHeight,width:viewportWidth,top:0,left:0});
  const [voteReady,setVoteReady]=useState(false);
  const [scoresReady,setScoresReady]=useState(false);
  const [pageReady,setPageReady]=useState(false);
  const [memeGifUrl,setMemeGifUrl]=useState<string|null>(null);
  const stableHeight=useRef(viewportHeight);
  const input=useRef<TextInput>(null);
  const gameRef=useRef<View>(null);
  const gameOrigin=useRef({x:0,y:0});
  const readySoundCount=useRef<number|null>(null);
  const fade=useRef(new Animated.Value(1)).current;
  if(!focused) stableHeight.current=viewportHeight;
  const metrics=gameLayout(viewportWidth,focused?stableHeight.current:viewportHeight);
  const {sx,sy,unit}=metrics;
  const memeGifSource=useMemo<ImageSourcePropType|undefined>(()=>memeGifUrl?{uri:memeGifUrl}:undefined,[memeGifUrl]);
  const players=useMemo(()=>createPlayers(playerId,playerName),[playerId,playerName]);
  const captions=useMemo(()=>makeCaptions(playerId,submitted,scene),[playerId,submitted,scene]);
  const allBallots=useMemo(()=>[...simulateBallots(players,captions,playerId),...ballots],[players,captions,playerId,ballots]);
  const result=useMemo(()=>resultsFor(players,captions,allBallots),[players,captions,allBallots]);
  const current=captions[cardIndex%captions.length];
  const revealPlan=useMemo(()=>winnerRevealPlan(players,captions,allBallots),[players,captions,allBallots]);
  useEffect(()=>{
    let active=true;
    void getRandomMemeMasterGif().then(url=>{if(active&&url)setMemeGifUrl(url);}).catch(()=>undefined);
    return()=>{active=false;};
  },[]);
  const own=current.authorId===playerId;
  const voted=ballots.some(v=>v.captionId===current.id);
  const votesLeft=2-ballots.length;
  const readyCount=Math.min(8,3+Math.floor((MEME_MASTER_PACING.lockedSeconds-seconds)/1.25));
  const readyIds=new Set([playerId,...players.filter(p=>p.id!==playerId).slice(0,readyCount-1).map(p=>p.id)]);

  useEffect(()=>{
    if(phase!=='locked'||!pageReady){
      readySoundCount.current=null;
      return;
    }
    if(readySoundCount.current===null){
      readySoundCount.current=readyCount;
      return;
    }
    if(readyCount>readySoundCount.current)playSound('playerReady');
    readySoundCount.current=readyCount;
  },[phase,pageReady,readyCount]);

  const go=(next:MemePhase)=>{
    setPageReady(false);
    if(next==='vote')setVoteReady(false);
    if(next==='scores')setScoresReady(false);
    Keyboard.dismiss();setFocused(false);setMenu(false);setSeconds(phaseSeconds[next]||0);setPhase(next);
    fade.setValue(.3);Animated.timing(fade,{toValue:1,duration:260,useNativeDriver:true}).start();
  };
  const lock=()=>{
    const caption=draft.trim();
    if(caption){playSound('lockedIn');haptic('success');}
    else haptic('warning');
    setSubmitted(caption);
    go('locked');
  };
  const dismissEditor=()=>{input.current?.blur();Keyboard.dismiss();setFocused(false);};
  const finish=()=>{if(!hasFinished){setHasFinished(true);onFinish();}};
  const nextMeme=()=>setCardIndex(i=>(i+1)%captions.length);
  useEffect(()=>{
    if(phase!=='rules')return;
    fadeMemeMasterMusicTo(.4,1000);
    playMemeMasterRulesVoiceover();
    return stopMemeMasterRulesVoiceover;
  },[phase]);
  useEffect(()=>{
    if(phase!=='compose')return;
    playNarration('memeMasterCaptionTease');
    return()=>stopSound('memeMasterCaptionTease');
  },[phase]);
  useEffect(()=>{
    if(phase!=='vote')return;
    playNarration('memeMasterVoting');
    return()=>stopSound('memeMasterVoting');
  },[phase]);
  useEffect(()=>{
    if(phase!=='scores')return;
    playSound('winningCheers');
    return()=>stopSound('winningCheers');
  },[phase]);
  useEffect(()=>()=>stopAllNarration(),[phase]);
  useEffect(()=>{
    const app=AppState.addEventListener('change',state=>setPaused(state!=='active'));
    const visibility=()=>setPaused(document.hidden);
    if(Platform.OS==='web')document.addEventListener('visibilitychange',visibility);
    return()=>{app.remove();if(Platform.OS==='web')document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{
    if(phase!=='compose')return;
    if(Platform.OS==='web'){
      if(!focused)return;
      const viewport=window.visualViewport;
      const update=()=>setKeyboardViewport({height:viewport?.height??window.innerHeight,width:viewport?.width??window.innerWidth,top:viewport?.offsetTop??0,left:viewport?.offsetLeft??0});
      update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
      return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
    }
    const apply=(event:{duration?:number;easing?:string;endCoordinates:{screenY:number;height?:number;width?:number}},onApplied?:()=>void)=>{
      const finish=(x:number,y:number)=>{
        gameOrigin.current={x,y};
        Keyboard.scheduleLayoutAnimation?.(event as any);
        const keyboardTop=event.endCoordinates.screenY-y;
        setKeyboardViewport({height:Math.max(0,keyboardTop),width:event.endCoordinates.width||viewportWidth,top:0,left:0});
        onApplied?.();
      };
      if(gameRef.current?.measureInWindow)gameRef.current.measureInWindow(finish);
      else finish(gameOrigin.current.x,gameOrigin.current.y);
    };
    // iOS must finish attaching first responder before this view changes at
    // all. Android can follow the keyboard frame continuously.
    const change=Platform.OS==='ios'?null:Keyboard.addListener('keyboardWillChangeFrame',apply);
    const shown=Keyboard.addListener('keyboardDidShow',event=>{
      apply(event,Platform.OS==='ios'?()=>setFocused(true):undefined);
    });
    const hide=Keyboard.addListener('keyboardDidHide',()=>{
      if(input.current?.isFocused?.())return;
      setKeyboardViewport({height:viewportHeight,width:viewportWidth,top:0,left:0});
      setFocused(false);
    });
    return()=>{change?.remove();shown.remove();hide.remove();};
  },[focused,phase,viewportHeight,viewportWidth]);
  useEffect(()=>{
    if(focused||Platform.OS!=='web')return;
    // Safari can retain the page pan it applied when focusing a low input.
    // Reset after its keyboard-collapse animation, without touching the draft.
    const frame=requestAnimationFrame(()=>window.scrollTo(0,0));
    const settle=setTimeout(()=>window.scrollTo(0,0),350);
    return()=>{cancelAnimationFrame(frame);clearTimeout(settle);};
  },[focused,phase]);
  useEffect(()=>{
    if(!phaseSeconds[phase]||menu||paused||hasFinished||((phase==='compose'||phase==='locked')&&!pageReady)||(phase==='vote'&&!voteReady)||(phase==='scores'&&!scoresReady))return;
    const timer=setInterval(()=>{
      if(Platform.OS==='web'&&typeof document!=='undefined'&&document.hidden)return;
      setSeconds(s=>Math.max(0,s-1));
    },1000);
    return()=>clearInterval(timer);
  },[phase,menu,paused,hasFinished,voteReady,scoresReady,pageReady]);
  useEffect(()=>{
    if(seconds!==0||!phaseSeconds[phase]||menu||paused||hasFinished)return;
    if(phase==='compose')lock();
    else if(phase==='locked')go('vote');
    else if(phase==='vote')go('winner');
    else if(phase==='scores')finish();
  },[seconds,phase,menu,paused,hasFinished]);

  const header=(y=18,height=172)=><>
    <Box x={22} y={54} w={64} h={72}><Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={()=>{haptic('selection');phase==='rules'?go('intro'):setMenu(true);}} style={{flex:1,justifyContent:'center',alignItems:'center',minHeight:44}}><View style={{width:22*unit,height:22*unit,borderLeftWidth:6*unit,borderBottomWidth:6*unit,borderColor:WHITE,transform:[{rotate:'45deg'}],borderRadius:2*unit}} /></Pressable></Box>
    <Box x={610} y={54} w={74} h={72}><Pressable accessibilityRole="button" accessibilityLabel="Pause and game options" hitSlop={8} onPress={()=>{haptic('warning');setMenu(true);}} style={{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7*unit,minHeight:44}}>{[0,1,2].map(i=><View key={i} style={{width:9*unit,height:9*unit,borderRadius:6*unit,backgroundColor:WHITE}} />)}</Pressable></Box>
  </>;
  const edgeDoodles=(top=true)=><>
    {top?<><Art x={17} y={232} w={149} h={147} source={doodles.funny} /><Art x={569} y={205} w={135} h={226} source={doodles.legends} /></>:null}
    <Art x={17} y={1385} w={138} h={124} source={doodles.brainrot} />
    <Art x={565} y={1422} w={124} h={103} source={doodles.always} />
  </>;

  const canvasLeft=(viewportWidth-metrics.width)/2;
  const canvasTop=(viewportHeight-metrics.height)/2;
  // Never move the native field on tap alone. On iOS `focused` is only set by
  // keyboardDidShow, after first responder and the keyboard are stable.
  const iosDocked=Platform.OS==='ios'&&focused;
  const docked=iosDocked||(Platform.OS!=='ios'&&focused&&(keyboardViewport.top>0||keyboardViewport.height<(focused?stableHeight.current:viewportHeight)-48));
  const composerStyle=iosDocked?{
    position:'absolute' as const,
    left:10,
    top:Math.max(0,keyboardViewport.height-68),
    width:Math.max(0,keyboardViewport.width-20),
    height:60,
    zIndex:10000,
    overflow:'hidden' as const,
    borderRadius:30,
    borderWidth:StyleSheet.hairlineWidth,
    borderColor:'#7567ba',
    padding:6,
    backgroundColor:'#151144',
    flexDirection:'row' as const,
    gap:8,
  }:docked?{
    position:Platform.OS==='web'?'fixed':'absolute',
    left:keyboardViewport.left,
    top:keyboardViewport.top+Math.max(0,keyboardViewport.height-COMPOSER_HEIGHT),
    width:keyboardViewport.width,
    height:COMPOSER_HEIGHT,
    zIndex:10000,
    overflow:'hidden' as const,
    borderTopLeftRadius:18,
    borderTopRightRadius:18,
    borderTopWidth:StyleSheet.hairlineWidth,
    borderColor:'#5b4b9a',
    paddingHorizontal:10,
    paddingTop:6,
    paddingBottom:8,
    backgroundColor:'#151144',
    flexDirection:'column' as const,
    gap:6,
    boxShadow:'0 -10px 28px #01012899',
    ...(Platform.OS==='web'?{transition:'top 280ms ease-out'} as any:{}),
  }:{
    position:'absolute' as const,
    left:canvasLeft+26*sx,
    top:canvasTop+1156*sy,
    width:657*sx,
    height:139*sy,
    zIndex:20,
    overflow:'visible' as const,
    borderRadius:34*unit,
    borderWidth:2*unit,
    borderColor:'#7b6cec80',
    padding:12*unit,
    backgroundColor:'#211d78ee',
    flexDirection:'row' as const,
    gap:12*unit,
  };
  const compactScale=iosDocked
    ?Math.max(.78,Math.min(.92,(keyboardViewport.height-70)/Math.max(1,canvasTop+970*sy)))
    :1;
  const keyboardHeaderShift=iosDocked?10/Math.max(.01,sy*compactScale):0;

  const game=<Metrics.Provider value={metrics}><View ref={gameRef} nativeID="meme-master-game" testID={`meme-${phase}`} onLayout={()=>{gameRef.current?.measureInWindow?.((x,y)=>{gameOrigin.current={x,y};});}} style={{flex:1,width:'100%',backgroundColor:'#020444',...(Platform.OS==='web'?{position:'fixed',inset:0,zIndex:100,overflow:'visible'} as any:{})}}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={art.background} resizeMode="stretch" style={FILL_IMAGE} /></View>
    <View testID="meme-unclipped-canvas" style={{flex:1,alignItems:'center',justifyContent:'center',overflow:'visible'}}>
      <Animated.View style={{width:metrics.width,height:metrics.height,position:'relative',opacity:fade,transformOrigin:'top center',transform:[{scale:compactScale}]}}>
        {phase==='intro'&&<>
          <Arrival paused={paused||menu||entrancePaused} kind="pop">
          <Art x={536} y={126} w={153} h={189} source={doodles.friends} />
          <Box x={111} y={316} w={486} h={824} decorative style={{borderWidth:3*unit,borderColor:'#efccff',borderRadius:47*unit,backgroundColor:'#11045b',boxShadow:`0 0 ${18*unit}px #9836ff, inset 0 0 ${12*unit}px #9e20ff`}} />
          <Art x={128} y={260} w={448} h={347} source={art.introTitle} label="Meme Master. Caption it. Vote on it. Win it." />
          </Arrival><Arrival paused={paused||menu||entrancePaused} delay={260} kind="slap">
          <Art x={0} y={612} w={709} h={568} source={art.cast} />
          <Art x={15} y={533} w={106} h={96} source={art.question} />
          <Art x={575} y={537} w={117} h={98} source={art.lol} />
          </Arrival><Arrival paused={paused||menu||entrancePaused} delay={620}>
          <PillButton x={125} y={1220} w={459} h={110} label="HOW TO PLAY" accessibilityLabel="How to play Meme Master" onPress={()=>go('rules')} />
          <Art x={194} y={1353} w={323} h={68} source={art.begin} />
          </Arrival>
          <Box x={20} y={25} w={88} h={80}><Pressable accessibilityRole="button" accessibilityLabel="Return to party" onPress={()=>{haptic('selection');onExit();}} style={{flex:1,justifyContent:'center'}}><Copy size={32}>‹</Copy></Pressable></Box>
        </>}

        {phase==='rules'&&<>
          {header(48,235)}
          <Arrival paused={paused||menu} kind="pop">
            <RulesHero />
          </Arrival>
          <RulesWalkthrough paused={paused||menu} />
          <Arrival paused={paused||menu} delay={RULE_FOOTER_MS} kind="slap">
            <Box x={48} y={1028} w={613} h={68} decorative style={{
              borderRadius:28*unit,borderWidth:2*unit,borderColor:'#ff9bff',backgroundColor:'#2a0878',
              justifyContent:'center',boxShadow:`0 0 ${16*unit}px #a429ff88`,
            }}><Copy size={24} color="#fff6b8">⭐ Most points at the end = Meme Master.</Copy></Box>
          </Arrival>
          <Arrival paused={paused||menu} delay={RULE_BUTTON_MS} kind="rise">
            <PillButton x={125} y={1118} w={459} h={110} label="GOT IT" accessibilityLabel="Got it — start writing" hapticCue="medium" onPress={()=>go('compose')} />
            <Art x={194} y={1244} w={323} h={68} source={art.begin} />
          </Arrival>
        </>}

        {phase==='compose'&&<>
          {header(18,192)}{edgeDoodles()}
          <VotingEntrance part="heading" paused={paused||menu} headingY={76+keyboardHeaderShift}>
          <Art x={0} y={0} w={390} h={68} source={art.write} label="Write a caption" />
          </VotingEntrance><VotingEntrance part="cards" paused={paused||menu}>
          <PhotoCard x={40} y={iosDocked?230:400} w={629} h={709} source={memeGifSource??scenes[scene]} />
          </VotingEntrance><VotingEntrance part="controls" paused={paused||menu} onReady={()=>setPageReady(true)}>
          <Timer x={iosDocked?560:275} y={iosDocked?50+keyboardHeaderShift:190} size={iosDocked?120:160} seconds={seconds} total={MEME_MASTER_PACING.composeSeconds} />
          <PillButton x={151} y={1323} w={407} h={104} label="LOCK IT IN →" accessibilityLabel="Lock in my caption" disabled={!draft.trim()} sound={false} hapticCue={false} onPress={lock} />
          </VotingEntrance>
        </>}

        {phase==='locked'&&<>
          {header()}{edgeDoodles()}
          <Arrival paused={paused||menu} kind="pop" onDone={()=>setPageReady(true)}>
          <WhitePanel x={32} y={190} w={645} h={1120}><View style={{flex:1,padding:16*unit}}>
            <View style={{height:112*sy,flexDirection:'row',alignItems:'center',gap:20*unit,paddingHorizontal:24*unit}}>
              <LinearGradient colors={['#23e23e','#00bd31']} style={{width:90*unit,height:90*unit,borderRadius:45*unit,justifyContent:'center',alignItems:'center',boxShadow:`0 ${3*unit}px ${12*unit}px #20c43c30`}}><View style={{width:39*unit,height:22*unit,borderBottomWidth:10*unit,borderLeftWidth:10*unit,borderColor:WHITE,transform:[{rotate:'-45deg'}],marginTop:-8*unit,borderRadius:3*unit}} /></LinearGradient>
              <View style={{flex:1,minWidth:0}}><Copy color={INK} size={46} lines={1} style={{textAlign:'left'}}>{submitted?'Caption locked in!':'You’re on voting duty!'}</Copy><Copy color="#66628f" size={29} lines={1} style={{textAlign:'left',marginTop:6*unit}}>{submitted?'Waiting for the others…':'No caption? You can still judge.'}</Copy></View>
            </View>
            <View style={{height:500*sy,marginTop:6*sy,borderRadius:28*unit,overflow:'hidden',borderWidth:8*unit,borderColor:WHITE,boxShadow:`0 0 ${12*unit}px #21105430`}}><Image source={scenes.pool} resizeMode="cover" style={{width:'100%',height:'100%'}} /></View>
            <View accessibilityLabel={`${readyCount} of 8 players ready`} style={{height:300*sy,flexDirection:'row',flexWrap:'wrap',columnGap:'1.6%',rowGap:9*sy,marginTop:10*sy}}>
              {players.map(p=><View key={p.id} accessibilityLabel={`${p.name}: ${readyIds.has(p.id)?'ready':'writing'}`} style={{width:'23.8%',height:'48%',backgroundColor:readyIds.has(p.id)?'#f0f1fc':'#f5f3f9',borderRadius:22*unit,alignItems:'center',justifyContent:'center',borderWidth:unit,borderColor:readyIds.has(p.id)?'#dbe9e2':'#eeebf5'}}><Avatar id={p.id} size={94} /><View style={{position:'absolute',right:9*unit,top:57*sy,width:33*unit,height:33*unit,borderRadius:20*unit,backgroundColor:readyIds.has(p.id)?'#0ac839':'#fff',borderWidth:3*unit,borderColor:WHITE,alignItems:'center',justifyContent:'center'}}>{readyIds.has(p.id)?<View style={{width:14*unit,height:8*unit,borderBottomWidth:4*unit,borderLeftWidth:4*unit,borderColor:WHITE,transform:[{rotate:'-45deg'}],marginTop:-3*unit}}/>:<ActivityIndicator size="small" color="#aaa0d0"/>}</View><Copy color={INK} size={24} lines={1} style={{marginTop:3*unit,maxWidth:'94%'}}>{p.name}</Copy></View>)}
            </View>
            <View style={{borderTopWidth:2*unit,borderColor:'#cbc6dc',marginTop:13*sy,paddingTop:12*sy}}>
              <Copy size={32} color={INK}>{readyCount} OF 8 READY</Copy>
              <Copy size={25} color="#66628f" style={{marginTop:9*sy}}>Voting begins when everyone is ready.</Copy>
            </View>
          </View></WhitePanel>
          </Arrival>
        </>}

        {phase==='vote'&&<>
          {header(18,192)}{edgeDoodles()}
          <VotingEntrance part="heading" paused={paused||menu}>
          <Art x={0} y={0} w={390} h={68} source={art.pick} label="Pick the funniest" />
          </VotingEntrance>
          <VotingEntrance part="cards" paused={paused||menu}>
          <SwipeDeck x={40} y={400} w={630} h={741} source={memeGifSource??scenes[current.image]} caption={current.text} onBrowse={direction=>setCardIndex(i=>(i+direction+captions.length)%captions.length)} />
          </VotingEntrance>
          <VotingEntrance part="controls" paused={paused||menu} onReady={()=>setVoteReady(true)}>
          <Timer x={275} y={190} size={160} seconds={seconds} total={MEME_MASTER_PACING.voteSeconds} />
          <Box x={31} y={1185} w={647} h={119}>
            <LinearGradient colors={['#34238d','#151155']} start={{x:0,y:0}} end={{x:1,y:1}} style={{flex:1,borderWidth:2*unit,borderColor:'#9771ed',borderRadius:29*unit,flexDirection:'row',alignItems:'center',paddingHorizontal:22*sx,gap:22*sx,boxShadow:`0 ${5*unit}px ${16*unit}px #03012880`}}>
              <View style={{flexDirection:'row',gap:9*unit}}>{[0,1].map(i=><View key={i} accessibilityLabel={`Vote ${i+1}: ${i<ballots.length?'cast':'available'}`} style={{width:70*unit,height:70*unit,borderRadius:40*unit,alignItems:'center',justifyContent:'center',backgroundColor:i<ballots.length?'#191142':'#d428a2',borderWidth:2*unit,borderColor:i<ballots.length?'#7562a2':'#ffa4ef',overflow:'hidden'}}>{i<ballots.length?<View style={{width:25*unit,height:14*unit,borderBottomWidth:6*unit,borderLeftWidth:6*unit,borderColor:LIME,transform:[{rotate:'-45deg'}],marginTop:-6*unit}}/>:<Image source={reactions[0].source} resizeMode="contain" style={{width:'100%',height:'100%'}}/>}</View>)}</View>
              <View style={{flex:1,minWidth:0}}><Copy size={32} lines={1} style={{textAlign:'left'}}>{votesLeft?`${votesLeft} VOTE${votesLeft===1?'':'S'} LEFT`:'VOTES LOCKED IN'}</Copy><Copy size={22} lines={1} color="#dcd2f7" style={{textAlign:'left',marginTop:7*sy}}>{votesLeft?'Give them to 2 different memes':'Both votes counted. Nice picks!'}</Copy><View style={{flexDirection:'row',gap:5*unit,marginTop:9*sy}}>{captions.map((c,i)=><View key={c.id} style={{height:4*unit,flex:1,borderRadius:3*unit,backgroundColor:i===cardIndex?CYAN:'#695497'}}/>)}</View></View>
            </LinearGradient>
          </Box>
          {votesLeft===0?<PillButton x={36} y={1325} w={354} h={101} label="SEE THE WINNERS" hapticCue="medium" onPress={()=>go('winner')} />:own||voted?<PillButton x={36} y={1325} w={354} h={101} label={own?'YOUR CAPTION':'VOTE COUNTED ✓'} onPress={()=>{}} disabled />:<PillButton x={36} y={1325} w={354} h={101} label="VOTE FOR THIS ONE" accessibilityLabel="Vote for this meme" sound={false} hapticCue={false} onPress={()=>{playSound('voteCast');haptic('success');setBallots(b=>castVote(b,playerId,current));}} />}
          <PillButton x={404} y={1325} w={277} h={101} label="NEXT MEME →" color="#6532c0" accessibilityLabel={`Next meme, showing ${cardIndex+1} of ${captions.length}`} onPress={nextMeme} />
          {own&&<Box x={100} y={1435} w={509} h={52} decorative><Copy color="#dacaf6" size={24} lines={2}>That’s yours. Give another monster some love.</Copy></Box>}
          </VotingEntrance>
        </>}

        {phase==='winner'&&<>
          {header()}
          <WinnerReveal plan={revealPlan} paused={paused||menu} memeSource={memeGifSource} onScores={()=>go('scores')}/>
        </>}

        {phase==='scores'&&<>
          {header(8,195)}
          <Art x={17} y={170} w={149} h={147} source={doodles.funny} />
          <Art x={559} y={160} w={137} h={175} source={doodles.friends} />
          <Arrival paused={paused||menu} kind="pop">
          <Art x={170} y={85} w={369} h={210} source={art.trophy} />
          <Art x={70} y={287} w={570} h={105} source={art.scores} label="Round scores. Chaos wins always." />
          </Arrival>
          <ScoreTable rows={result.rows} paused={paused||menu} onReady={()=>setScoresReady(true)}/>
          <PillButton x={125} y={1310} w={459} h={104} label={scoresReady?'NEXT ROUND →':'ADDING THE CHAOS…'} accessibilityLabel="Next round" disabled={!scoresReady} hapticCue="medium" onPress={finish} />
          <Box x={163} y={1420} w={385} h={63} decorative><Copy size={30}>{scoresReady?`Starting in ${String(seconds).padStart(2,'0')}…`:'Every vote counts.'}</Copy></Box>
          <Art x={12} y={1410} w={105} h={107} source={doodles.more} />
          <Art x={580} y={1390} w={121} h={135} source={doodles.legends} />
        </>}
      </Animated.View>
      {phase==='compose'&&<Arrival paused={paused||menu} delay={COMPOSER_ENTRANCE_DELAY} kind="rise"><View collapsable={false} style={composerStyle}>
        <View style={{display:docked&&!iosDocked?'flex':'none',height:32,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={{fontFamily:BODY_FONT,fontWeight:'600',color:'#c9b8ff',fontSize:13}}>Caption</Text>
          <Text style={{fontFamily:BODY_FONT,fontWeight:'600',color:CYAN,fontSize:13,fontVariant:['tabular-nums']}}>{formatTime(seconds)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Done editing caption" onPress={()=>{haptic('selection');dismissEditor();}} hitSlop={8} style={{minHeight:32,minWidth:48,justifyContent:'center',alignItems:'flex-end'}}>
            <Text style={{fontFamily:BODY_FONT,fontWeight:'600',fontSize:17,color:CYAN}}>Done</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change meme image" onPress={()=>{haptic('selection');void getRandomMemeMasterGif(memeGifUrl??undefined).then(url=>{if(url)setMemeGifUrl(url);else{const keys=Object.keys(scenes) as MemeImage[];setScene(keys[(keys.indexOf(scene)+1)%keys.length]);}}).catch(()=>{const keys=Object.keys(scenes) as MemeImage[];setScene(keys[(keys.indexOf(scene)+1)%keys.length]);});}} style={{display:docked?'none':'flex',width:76*sx,borderRadius:23*unit,backgroundColor:'#03054f',justifyContent:'center',alignItems:'center'}}><View style={{width:35*unit,height:33*unit,borderRadius:5*unit,borderWidth:4*unit,borderColor:WHITE,justifyContent:'flex-end',overflow:'hidden'}}><View style={{width:24*unit,height:24*unit,backgroundColor:WHITE,transform:[{rotate:'45deg'},{translateY:14*unit}]}} /></View></Pressable>
        <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:docked?8:12*unit}}>
          <View style={{flex:1,overflow:'hidden',borderRadius:docked?22:24*unit,backgroundColor:docked?'#2a215c':'#a69bff22',borderWidth:docked?0:unit,borderColor:'#b2a7ff33',justifyContent:'center',minHeight:docked?40:undefined}}>
            <TextInput ref={input} testID="meme-caption-input" accessibilityLabel="Write your caption" placeholder="Make it funny…" placeholderTextColor="#c1b8ed" value={draft} onChangeText={setDraft} maxLength={CAPTION_LIMIT} multiline={Platform.OS!=='ios'} returnKeyType="send" blurOnSubmit submitBehavior="blurAndSubmit" keyboardAppearance="dark" showSoftInputOnFocus autoCorrect autoCapitalize="sentences" onSubmitEditing={()=>{if(draft.trim())lock();else dismissEditor();}} onFocus={()=>{if(Platform.OS!=='ios')setFocused(true);}} style={{flex:1,width:'100%',paddingLeft:docked?14:20*unit,paddingRight:iosDocked?62:docked?12:80*unit,paddingTop:docked?10:14*unit,paddingBottom:docked?10:14*unit,fontFamily:FONT,fontWeight:'400',fontSize:Math.max(16,docked?17:32*unit),lineHeight:Math.max(20,docked?22:37*unit),letterSpacing:0,color:WHITE,textAlignVertical:'center',backgroundColor:'transparent',zIndex:5,transform:iosDocked?[{translateY:-2}]:undefined,...(Platform.OS==='web'?{outlineStyle:'none'} as any:{})}} />
            <View pointerEvents="none" style={{position:'absolute',right:iosDocked?14:docked?12:16*unit,top:0,bottom:0,justifyContent:'center',display:docked&&!iosDocked?'none':'flex'}}><Copy body size={iosDocked?14:24} color="#c1b8ed">{draft.length}/{CAPTION_LIMIT}</Copy></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send caption" accessibilityState={{disabled:!draft.trim()}} disabled={!draft.trim()} onPress={lock} style={{display:docked&&!iosDocked?'flex':'none',width:36,height:36,minHeight:36,borderRadius:18,backgroundColor:draft.trim()?CYAN:'#3a3470',alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:FONT,fontSize:16,color:draft.trim()?INK:'#8d86b8'}}>↑</Text></Pressable>
        </View>
      </View></Arrival>}
    </View>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={()=>setMenu(false)}><View style={{flex:1,backgroundColor:'#01021bdc',alignItems:'center',justifyContent:'center',padding:24}}><View style={{width:'100%',maxWidth:420,backgroundColor:'#f9f7ff',borderRadius:28,padding:26,gap:18}}>
      <Text style={{fontFamily:FONT,fontSize:30,color:INK,textAlign:'center'}}>PAUSED FOR CHAOS</Text>
      <Text style={{fontFamily:BODY_FONT,color:INK,fontSize:16,lineHeight:23}}>Write a caption. Cast two votes for different memes, but not your own. Every vote earns {POINTS_PER_VOTE} points; the round winner gets {WINNER_BONUS} bonus points. Tied winners each earn the bonus.</Text>
      <Text style={{fontFamily:BODY_FONT,color:'#6c6181',fontSize:13}}>Demo party: the other seven monsters are simulated. Your captions and votes affect the results.</Text>
      <Pressable accessibilityRole="button" onPress={()=>{haptic('selection');setMenu(false);}} style={{backgroundColor:CYAN,padding:16,borderRadius:20}}><Text style={{fontFamily:FONT,fontSize:24,textAlign:'center',color:INK}}>KEEP PLAYING</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>{haptic('warning');onExit();}} style={{padding:14}}><Text style={{fontFamily:FONT,fontSize:19,textAlign:'center',color:'#772098'}}>LEAVE MEME MASTER</Text></Pressable>
    </View></View></Modal>
  </View></Metrics.Provider>;
  // Keep the entire game in a stable body portal on web. Safari pans the visual
  // viewport for its keyboard; the app frame's overflow:hidden used to clip the
  // fixed editor. Never reparent on focus: that would destroy keyboard focus.
  return Platform.OS==='web'&&typeof document!=='undefined'
    ?require('react-dom').createPortal(game,document.body):game;
}
