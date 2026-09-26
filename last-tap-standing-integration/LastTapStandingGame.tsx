import { unlockBeatAudio } from './src/beatAudio';
import { BeatPanic } from './src/BeatPanic';
import { useMotionClock } from './src/gameMotion';
import React, { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, ImageSourcePropType, Modal, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BODY_FONT, DISPLAY_FONT } from './src/brand';
import { MonsterId } from './src/monsterTypes';
import { createTapPlayers, eliminatePlayer, formatReaction, LastTapPhase, resolveTapRound, simulateRivals, TAP_PACING, TapPlayer, TapResult, TapRound } from './src/lastTapModel';
import { playSound } from './src/sounds';
import { fadeLastTapMusicTo } from '../src/sounds';
import { predictionPoints, lastTapScoreRows } from './src/lastTapModel';
import { eliminationQuip, REVEAL_BEATS, tapRevealTiming, FINALE_BEATS } from './src/lastTapPresentation';

type Prediction = { pick: MonsterId | null; points: number };

// Gameplay cards, names, timers, countdowns and actions stay live UI. The
// welcome uses shared key art so its spinner poster is visually identical.
export const LAST_TAP_ART = {
  logo: require('./assets/last-tap/beat-panic-logo.webp'),
  keyArt: require('./assets/last-tap/beat-panic-key-art.webp'),
  beat: require('./assets/last-tap/beat-panic-background.png'),
  background: require('./assets/last-tap/background-clean.webp'),
  stage: require('./assets/last-tap/elimination-stage.webp'),
  crown: require('./assets/last-tap/finale-crown.webp'),
  finaleArena: require('./assets/last-tap/finale-arena.webp'),
  finaleBurst: require('./assets/last-tap/finale-burst.webp'),
  eliminated: require('./assets/last-tap/eliminated-scene.webp'),
};
const avatars: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/meme-master-blue/avatar-grumble.webp'),
  gloop: require('./assets/meme-master-blue/avatar-gloop.webp'),
  brrr: require('./assets/meme-master-blue/avatar-brrr.webp'),
  peepers: require('./assets/meme-master-blue/avatar-peepers.webp'),
  dozy: require('./assets/meme-master-blue/avatar-dozy.webp'),
  bop: require('./assets/meme-master-blue/avatar-bop.webp'),
  snicker: require('./assets/meme-master-blue/avatar-snicker.webp'),
  scraps: require('./assets/meme-master-blue/avatar-scraps.webp'),
};
const monsters: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/monsters/grumble.webp'), gloop: require('./assets/monsters/gloop.webp'),
  brrr: require('./assets/monsters/brrr.webp'), peepers: require('./assets/monsters/peepers.webp'),
  dozy: require('./assets/monsters/dozy.webp'), bop: require('./assets/monsters/bop.webp'),
  snicker: require('./assets/monsters/snicker.webp'), scraps: require('./assets/monsters/scraps.webp'),
};
const battlePoses: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/last-tap/poses/battle-grumble.webp'),
  snicker: require('./assets/last-tap/poses/battle-snicker.webp'),
  gloop: require('./assets/last-tap/poses/battle-gloop.webp'),
  brrr: require('./assets/last-tap/poses/battle-brrr.webp'),
  scraps: require('./assets/last-tap/poses/battle-scraps.webp'),
  dozy: require('./assets/last-tap/poses/battle-dozy.webp'),
  peepers: require('./assets/last-tap/poses/battle-peepers.webp'),
  bop: require('./assets/last-tap/poses/battle-bop.webp'),
};
const victoryPoses: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/last-tap/poses/victory-grumble.webp'),
  snicker: require('./assets/last-tap/poses/victory-snicker.webp'),
  gloop: require('./assets/last-tap/poses/victory-gloop.webp'),
  brrr: require('./assets/last-tap/poses/victory-brrr.webp'),
  scraps: require('./assets/last-tap/poses/victory-scraps.webp'),
  dozy: require('./assets/last-tap/poses/victory-dozy.webp'),
  peepers: require('./assets/last-tap/poses/victory-peepers.webp'),
  bop: require('./assets/last-tap/poses/victory-bop.webp'),
};
// Anchors are measured on each victory asset, so the crown follows contain sizing
// and the character's own transform instead of floating at one screen coordinate.
export const VICTORY_HEADS:Record<MonsterId,{width:number;x:number;y:number;crown:number}>={
  bop:{width:761,x:.48,y:.15,crown:.39},brrr:{width:658,x:.50,y:.115,crown:.40},
  dozy:{width:734,x:.51,y:.16,crown:.39},gloop:{width:650,x:.50,y:.055,crown:.40},
  grumble:{width:698,x:.51,y:.155,crown:.38},peepers:{width:660,x:.50,y:.285,crown:.28},
  scraps:{width:724,x:.47,y:.15,crown:.38},snicker:{width:763,x:.50,y:.16,crown:.38},
};
export function CrownedVictory({id,width,height,crownStyle,crownTestID='winner-crown'}:{id:MonsterId;width:number;height:number;crownStyle?:any;crownTestID?:string}){
  const head=VICTORY_HEADS[id],scale=Math.min(width/head.width,height/900);
  const iw=head.width*scale,ih=900*scale,cw=iw*head.crown,ch=cw*382/512;
  return <View testID={`crowned-victory-${id}`} style={{width,height}}>
    <Image source={victoryPoses[id]} resizeMode="contain" style={FILL}/>
    <Animated.View testID={crownTestID} pointerEvents="none" style={[{position:'absolute',left:(width-iw)/2+iw*head.x-cw/2,top:(height-ih)/2+ih*head.y-ch*.94,width:cw,height:ch},crownStyle]}><Image source={LAST_TAP_ART.crown} resizeMode="contain" style={FILL}/></Animated.View>
  </View>;
}
// Elimination portraits keep the same monster artwork but use a more upset
// expression/pose for the spotlight moment.
const eliminatedMonsters: Record<MonsterId, ImageSourcePropType> = {
  grumble: require('./assets/last-tap/upset-grumble.webp'), gloop: require('./assets/last-tap/upset-gloop.webp'),
  brrr: require('./assets/last-tap/upset-brrr.webp'), peepers: require('./assets/last-tap/upset-peepers.webp'),
  dozy: require('./assets/last-tap/upset-dozy.webp'), bop: require('./assets/last-tap/upset-bop.webp'),
  snicker: require('./assets/last-tap/upset-snicker.webp'), scraps: require('./assets/last-tap/upset-scraps.webp'),
};
export const LAST_TAP_IMAGE_SOURCES = [...Object.values(LAST_TAP_ART), ...Object.values(monsters), ...Object.values(eliminatedMonsters), ...Object.values(avatars), ...Object.values(battlePoses), ...Object.values(victoryPoses)];
const INK = '#320008', CREAM = '#fff7dc', GOLD = '#ffe34c', RED = '#ff123b';
const FILL = { ...StyleSheet.absoluteFill, width: '100%' as const, height: '100%' as const };
const ScreenMotion = createContext<{clock: Animated.Value | null; enabled: boolean}>({clock:null, enabled:false});
const Layout = createContext({ sx: 1, sy: 1, unit: 1 });
type Bounds = { x: number; y: number; w: number; h: number };

function Box({ x, y, w, h, children, style, decorative = false }: Bounds & { children?: ReactNode; style?: any; decorative?: boolean }) {
  const m = useContext(Layout);
  const motion = useContext(ScreenMotion);
  // Keep the backdrop anchored; reveal title, artwork, information, then actions.
  const delay = y < 125 ? 0 : y < 225 ? 60 : y < 430 ? 120 : y < 650 ? 170 : 220;
  const progress = motion.clock?.interpolate({inputRange:[delay, delay+320],outputRange:[0,1],extrapolate:'clamp'});
  return <Animated.View pointerEvents={decorative ? 'none' : 'box-none'} style={[{ position: 'absolute', left: x * m.sx, top: y * m.sy, width: w * m.sx, height: h * m.sy }, style, motion.enabled && progress ? {
    opacity:progress,
    transform:[{translateY:motion.clock!.interpolate({inputRange:[delay,delay+420],outputRange:[12*m.unit,0],extrapolate:'clamp'})}],
  } : {}]}>{children}</Animated.View>;
}
function Art({ source, ...box }: Bounds & { source: ImageSourcePropType }) {
  return <Box {...box} decorative><Image source={source} resizeMode="contain" style={FILL} /></Box>;
}
function Copy({ children, size = 20, color = CREAM, body = false, style, lines, label }: { children: ReactNode; size?: number; color?: string; body?: boolean; style?: any; lines?: number; label?: string }) {
  const { unit } = useContext(Layout);
  const fontSize = body ? Math.max(13, size * unit) : size * unit;
  return <Text accessibilityLabel={label} numberOfLines={lines} adjustsFontSizeToFit={!!lines} minimumFontScale={.75} style={[{ color, fontSize, lineHeight: fontSize * (body ? 1.25 : 1.1), fontFamily: body ? BODY_FONT : DISPLAY_FONT, fontWeight: body ? '600' : '400', textAlign: 'center', includeFontPadding: false }, style]}>{children}</Text>;
}
function Heading({ children, size = 44, ...box }: Bounds & { children: ReactNode; size?: number }) {
  return <Box {...box} decorative style={{ justifyContent: 'center' }}><ComicCopy size={size} lines={2}>{children}</ComicCopy></Box>;
}
function Panel({ children, ...box }: Bounds & { children?: ReactNode }) {
  const { unit } = useContext(Layout);
  return <Box {...box} style={{ borderRadius: 23 * unit, borderWidth: 3 * unit, borderColor: '#fff9eb', backgroundColor: '#fff0c7', padding: 5 * unit, boxShadow: `0 0 ${15 * unit}px #ff5a2f70, 0 ${4 * unit}px 0 #c65524` }}><LinearGradient colors={['#fff9e6', '#fff4d3']} style={{ flex: 1, borderRadius: 17 * unit, borderWidth: unit, borderColor: '#fff', overflow: 'hidden' }}>{children}</LinearGradient></Box>;
}
function Pill({ children, ...box }: Bounds & { children: ReactNode }) {
  const { unit } = useContext(Layout);
  return <Box {...box} style={{ backgroundColor: '#210008ea', borderWidth: 2 * unit, borderColor: '#ff315d', borderRadius: 26 * unit, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 * unit }}>{children}</Box>;
}
function Button({ label, onPress, disabled = false, ...box }: Bounds & { label: string; onPress: () => void; disabled?: boolean }) {
  const { unit } = useContext(Layout);
  return <Box {...box}><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} onPressIn={() => playSound('click')} style={({ pressed }) => ({ flex: 1, minHeight: 44, padding: 4 * unit, borderRadius: 40 * unit, borderWidth: 2 * unit, borderColor: '#ff4561', backgroundColor: '#4b0012', opacity: disabled ? .55 : 1, transform: [{ scale: pressed ? .97 : 1 }], boxShadow: `0 ${5 * unit}px 0 #22000a, 0 0 ${14 * unit}px #ff164999` })}><LinearGradient colors={['#ff7690', '#ff1744', '#ef002d', '#ff1c39']} locations={[0, .14, .75, 1]} style={{ flex: 1, borderRadius: 35 * unit, borderWidth: 2 * unit, borderColor: '#fff4db', padding: 3 * unit }}><View style={{ flex: 1, borderRadius: 31 * unit, borderWidth: unit, borderColor: '#ffc4c8', justifyContent: 'center', paddingHorizontal: 10 * unit }}><Copy size={31} lines={1} style={{ textShadowColor: '#3d0012', textShadowOffset: { width: 1, height: 3 * unit }, textShadowRadius: 1 }}>{label}</Copy></View></LinearGradient></Pressable></Box>;
}
function Avatar({ id, size, out = false, selected = false }: { id: MonsterId; size: number; out?: boolean; selected?: boolean }) {
  const { unit } = useContext(Layout);
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: selected ? 2 * unit : 0, borderColor: GOLD, backgroundColor: '#340b1a', boxShadow: selected ? `0 0 ${12 * unit}px #ffbf00` : 'none' }}>
    <Image source={avatars[id]} style={{ width: '100%', height: '100%', borderRadius: size / 2, opacity: out ? .28 : 1 }} />
    {out && <View testID={`eliminated-${id}`} accessibilityLabel="Eliminated" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{[45, -45].map(angle => <View key={angle} style={{ position: 'absolute', width: size * .8, height: size * .15, borderRadius: size, backgroundColor: CREAM, transform: [{ rotate: `${angle}deg` }], boxShadow: `0 ${unit}px ${2 * unit}px #39000c` }} />)}</View>}
  </View>;
}
function SurvivalBar({ players, localId, y = 731 }: { players: TapPlayer[]; localId: MonsterId; y?: number }) {
  const m = useContext(Layout);
  return <Box x={10} y={y} w={370} h={83} style={{ borderWidth: 2 * m.unit, borderColor: '#ff1b4b', borderRadius: 23 * m.unit, backgroundColor: '#210007ed', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 * m.unit }}>
    {players.map(p => <View key={p.id} accessibilityLabel={`${p.name}, ${p.eliminatedRound === null ? 'still standing' : 'eliminated'}`} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 5 * m.unit }}><Avatar id={p.id} size={39 * m.unit} out={p.eliminatedRound !== null} selected={p.id === localId && p.eliminatedRound === null} /><Copy size={11.5} style={{width:'100%'}} color={p.eliminatedRound !== null ? '#c39296' : p.id === localId ? GOLD : CREAM} lines={1}>{p.name}</Copy></View>)}
  </Box>;
}
function Logo({ large = false, compact = false }: { large?: boolean; compact?: boolean }) {
  const logo = compact
    ? {x:8,y:4,w:116,h:87}
    : large
      ? {x:8,y:8,w:374,h:280}
      : {x:103,y:4,w:184,h:126};
  const tagline = compact
    ? null
    : large
      ? {x:70,y:244,w:250,h:30,size:14}
      : {x:91,y:112,w:208,h:22,size:10};
  return <>
    <Box {...logo} decorative><Image accessibilityLabel="Beat Panic" source={LAST_TAP_ART.logo} resizeMode="contain" style={FILL}/></Box>
    {tagline&&<Pill x={tagline.x} y={tagline.y} w={tagline.w} h={tagline.h}><Copy size={tagline.size} color="#ffb1ca" lines={1} style={{letterSpacing:1.5}}>MISS THE BEAT. MEET DEFEAT.</Copy></Pill>}
  </>;
}

// Live lettering and enamel surfaces shared by the stage and watch party.
function ComicCopy({children, size = 42, lines = 1}: {children:ReactNode; size?:number; lines?:number}) {
  const {unit} = useContext(Layout);
  return <Copy size={size} lines={lines} style={Platform.OS === 'web' ? {
    WebkitTextStroke:`${3*unit}px #200009`, paintOrder:'stroke fill',
    textShadow:`0 ${3*unit}px 0 #b87132, 0 ${6*unit}px 0 #200009, 0 0 ${2*unit}px #ff5481`,
  } : {textShadowColor:'#240009',textShadowOffset:{width:0,height:4*unit},textShadowRadius:1}}>{children}</Copy>;
}
function EnamelPanel({children, style, selected = false}: {children:ReactNode;style?:any;selected?:boolean}) {
  const {unit} = useContext(Layout);
  return <View style={[{borderRadius:23*unit,borderWidth:2*unit,borderColor:selected?GOLD:'#ff5477',backgroundColor:'#340311',padding:3*unit,boxShadow:`0 ${4*unit}px 0 #190009, 0 0 ${10*unit}px ${selected?'#ffcf4280':'#fa17402b'}`},style]}>
    <View style={{flex:1,borderRadius:18*unit,borderWidth:1.5*unit,borderColor:selected?GOLD:CREAM,overflow:'hidden'}}>{children}</View>
  </View>;
}
function CountdownDial({value,size=156,total=5,running=true}: {value:number;size?:number;total?:number;running?:boolean}) {
  const {unit} = useContext(Layout);
  const pulse = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(value/total)).current;
  const previous = useRef(value);
  useEffect(()=>{
    if(previous.current!==value){progress.setValue(value/total);previous.current=value;}
    if(!running)return;
    const animation=Animated.timing(progress,{toValue:Math.max(0,value-1)/total,duration:1000,easing:Easing.linear,useNativeDriver:true});
    animation.start();
    return()=>animation.stop();
  },[value,total,running,progress]);
  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
      if(!alive||reduced)return;
      pulse.setValue(.92);
      Animated.spring(pulse,{toValue:1,friction:8,tension:160,useNativeDriver:true}).start();
    });
    return()=>{alive=false;pulse.stopAnimation();};
  },[value,pulse]);
  const d=(size-8)*unit,r=d/2;
  return <View accessibilityLabel={`${value} seconds`} style={{width:size*unit,height:size*unit,borderRadius:size*unit/2,borderWidth:2*unit,borderColor:'#210008',backgroundColor:'#a2072e',padding:9*unit,boxShadow:`0 ${3*unit}px 0 #180008, 0 0 ${18*unit}px #ff255458`}}>
    <View testID="smooth-countdown-ring" pointerEvents="none" style={{position:'absolute',left:2*unit,top:2*unit,width:d,height:d,borderRadius:r,backgroundColor:'#640020',overflow:'hidden'}}>
      {[false,true].map(left=><View key={String(left)} style={{position:'absolute',left:left?0:r,top:0,width:r,height:d,overflow:'hidden'}}>
        <Animated.View style={{position:'absolute',left:left?0:-r,width:d,height:d,transform:[{rotate:progress.interpolate({inputRange:[0,.5,1],outputRange:left?['180deg','0deg','0deg']:['180deg','180deg','0deg'],extrapolate:'clamp'})}]}}>
          <View style={{position:'absolute',left:left?0:r,width:r,height:d,backgroundColor:'#ff9eba',borderTopLeftRadius:left?r:0,borderBottomLeftRadius:left?r:0,borderTopRightRadius:left?0:r,borderBottomRightRadius:left?0:r}}/>
        </Animated.View>
      </View>)}
      <View style={{position:'absolute',inset:4*unit,borderRadius:r,backgroundColor:'#390010'}}/>
    </View>
    <LinearGradient colors={['#fffbed','#ffeac3']} style={{flex:1,borderRadius:size*unit,borderWidth:2*unit,borderColor:CREAM,alignItems:'center',justifyContent:'center'}}>
      <Animated.View style={{transform:[{scale:pulse}]}}><Copy size={size*.55} color={INK}>{value}</Copy></Animated.View>
    </LinearGradient>
  </View>;
}

function WinnerConfetti({paused}: {paused:boolean}) {
  const m=useContext(Layout);
  const {clock,reduced}=useMotionClock(3100,paused);
  if(reduced)return null;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({length:20},(_,i)=>{
    const delay=(i%5)*95;
    const v=(inputRange:number[],outputRange:any[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
    return <Animated.View key={i} style={{position:'absolute',left:195*m.sx,top:305*m.sy,width:(i%2?6:10)*m.unit,height:(i%2?15:8)*m.unit,borderRadius:2*m.unit,backgroundColor:[GOLD,CREAM,'#ff749b'][i%3],opacity:v([delay,delay+100,2300,3000],[0,1,1,0]),transform:[{translateX:v([delay,delay+900,3000],[0,((i*73)%360-180)*m.sx,((i*73)%360-180)*m.sx])},{translateY:v([delay,delay+800,3000],[0,(-100-(i*41)%180)*m.sy,450*m.sy])},{rotate:v([delay,3000],['0deg',`${i%2?-620:720}deg`])}]}}/>;
  })}</View>;
}

// Shared arena geometry keeps the intro and result reveal in the same visual world.
function DuelLighting({clock,reduced,crowned=false}: {clock:Animated.Value;reduced:boolean;crowned?:boolean}) {
  const m=useContext(Layout);
  const v=(inputRange:number[],outputRange:any[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {[0,1].map(i=><Animated.View key={i} style={{position:'absolute',left:(i===0?-40:180)*m.sx,top:235*m.sy,width:250*m.sx,height:470*m.sy,opacity:crowned?0:reduced?.3:v([0,1000,2400,3600,4800,6000,7100,7800],[.1,.4,i===0?.65:.15,i===0?.15:.65,i===0?.65:.15,i===0?.15:.65,.5,.12]),transform:reduced?[]:[{rotate:v([0,3000,6000,8000],[i===0?'-18deg':'18deg',i===0?'-7deg':'7deg',i===0?'-15deg':'15deg','0deg'])}]}}><LinearGradient colors={['#ffbbdf00',i===0?'#f5398345':'#ffb73c3a','#fa4b8800']} style={{flex:1,borderRadius:140*m.unit}}/></Animated.View>)}
    {!reduced&&Array.from({length:16},(_,i)=><Animated.View key={`ember-${i}`} style={{position:'absolute',left:((i*83+17)%390)*m.sx,top:(235+(i*47)%530)*m.sy,width:(i%3===0?3:2)*m.unit,height:(i%3===0?9:4)*m.unit,borderRadius:3*m.unit,backgroundColor:i%3?'#ffad6b':'#ffd7e8',opacity:v([0,800,22000,24500],[0,.6,.6,0]),transform:[{translateY:v([0,24500],[0,-160*m.sy])},{rotate:`${i*29}deg`}]}}/>)}
  </View>;
}

function FinalShowdown({finalists,seconds,paused}: {finalists:TapPlayer[];seconds:number;paused:boolean}) {
  const m=useContext(Layout);
  const {clock,reduced}=useMotionClock(5500,paused,undefined,undefined,true);
  const v=(inputRange:number[],outputRange:any[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
  return <ScreenMotion.Provider value={{clock:null,enabled:false}}><View testID="final-showdown-intro" style={[StyleSheet.absoluteFill,{overflow:'hidden'}]}>
    <Image source={LAST_TAP_ART.finaleArena} resizeMode="stretch" style={FILL}/>
    <DuelLighting clock={clock} reduced={reduced}/>
    <Logo />
    <Box x={30} y={153} w={330} h={26}><Copy size={17} color={GOLD} style={{letterSpacing:3*m.unit}}>FINAL SHOWDOWN</Copy></Box>
    <Heading x={16} y={194} w={358} h={105} size={45}>{'TWO THUMBS.\nONE CROWN.'}</Heading>
    <Animated.View pointerEvents="none" style={{position:'absolute',left:194*m.sx,top:323*m.sy,width:2*m.unit,height:290*m.sy,backgroundColor:'#ff83ae',boxShadow:`0 0 ${18*m.unit}px #ff276e`,opacity:.65,transform:[{rotate:'18deg'}]}}/>
    {finalists.map((p,i)=><React.Fragment key={p.id}>
      <Animated.View style={{position:'absolute',left:(i===0?3:197)*m.sx,top:333*m.sy,width:190*m.sx,height:298*m.sy,opacity:reduced?1:v([i*180,i*180+450],[0,1]),transform:reduced?[]:[{translateX:v([i*180,i*180+550,i*180+800],[i===0?-160*m.sx:160*m.sx,i===0?5*m.sx:-5*m.sx,0])},{translateY:v([1000,2200,3400,4600,5500],[0,-5*m.sy,0,-5*m.sy,0])},{rotate:i===0?'3deg':'-3deg'}]}}><Image source={battlePoses[p.id]} resizeMode="contain" style={{...FILL,transform:[{scaleX:i===0?1:-1}]}}/></Animated.View>
      <Pill x={i===0?14:206} y={650} w={170} h={43}><Copy size={22} lines={1}>{p.name}</Copy></Pill>
    </React.Fragment>)}
    <Box x={161} y={438} w={68} h={65}><ComicCopy size={46}>VS</ComicCopy></Box>
    <Box x={28} y={712} w={334} h={27}><Copy size={18} color="#ffadc7">Two thumbs. One fragile ego.</Copy></Box>
    <Box x={78} y={757} w={234} h={66} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14*m.unit}}><CountdownDial running={!paused} total={5} value={Math.ceil(seconds)} size={62}/><View><Copy size={20}>SHOWDOWN IN</Copy><Copy size={14} color="#ffadc7" style={{marginTop:5*m.unit}}>Make this one count.</Copy></View></Box>
  </View></ScreenMotion.Provider>;
}

function FinaleReveal({result,players,playerId,bonusPoints,paused,onSettled,onReplay,onFinish}: {result:TapRound;players:TapPlayer[];playerId:MonsterId;bonusPoints:number;paused:boolean;onSettled:()=>void;onReplay:()=>void;onFinish:()=>void}) {
  const m=useContext(Layout), b=FINALE_BEATS;
  const settled=useRef(false), cues=useRef(new Set<number>());
  const {clock,now,reduced}=useMotionClock(result.tied?b.tieEnd:b.end,paused,()=>{if(result.tied)onReplay();},time=>{
    if(result.tied)return;
    if(time>=b.champion&&!settled.current){settled.current=true;onSettled();}
    for(const at of [b.stamp,b.exit,b.champion])if(time>=at&&!cues.current.has(at)){cues.current.add(at);playSound(at===b.exit?'teleport':'click');}
  },true);
  const v=(inputRange:number[],outputRange:any[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
  // Preserve lobby order: fastest-first ordering would spoil the result.
  const finalists=players.filter(p=>result.results.some(r=>r.id===p.id));
  const winner=finalists.find(p=>p.id!==result.eliminatedId);
  const crowned=!result.tied&&now>=b.champion, recap=!result.tied&&now>=b.scores;
  const scoreRows=lastTapScoreRows(eliminatePlayer(players,result),playerId,bonusPoints);
  const winnerTime=result.results.find(r=>r.id===winner?.id)?.ms;
  const recapHeight=Math.max(194,scoreRows.length*46+39);
  const recapTop=scoreRows.length<=4?370:319;
  return <ScreenMotion.Provider value={{clock:null,enabled:false}}><View testID="finale-stage" style={[StyleSheet.absoluteFill,{overflow:'hidden',backgroundColor:'#190009'}]}>
    <Image testID="finale-persistent-background" source={LAST_TAP_ART.finaleArena} resizeMode="stretch" style={FILL}/>
    <DuelLighting clock={clock} reduced={reduced} crowned={crowned}/>
    {!result.tied&&!reduced&&<Animated.View testID="finale-impact-ring" pointerEvents="none" style={{position:'absolute',left:(finalists.findIndex(p=>p.id===result.eliminatedId)===0?22:212)*m.sx,top:418*m.sy,width:150*m.sx,height:150*m.sx,borderRadius:100*m.sx,borderWidth:3*m.unit,borderColor:'#ff9eb9',boxShadow:`0 0 ${22*m.unit}px #ff206b`,opacity:v([b.stamp,b.stamp+80,b.stamp+600],[0,.85,0]),transform:[{scale:v([b.stamp,b.stamp+600],[.25,2.4])}]}}/>}
    {/* A feathered glow replaces the old rectangular yellow overlay. */}
    {!result.tied&&<Animated.View pointerEvents="none" style={{position:'absolute',left:-20*m.sx,top:275*m.sy,width:430*m.sx,height:430*m.sy,opacity:v([b.champion-100,b.champion+900,b.scores,b.scores+500],[0,.85,.85,.15]),transform:reduced?[]:[{scale:v([b.champion,b.champion+900,b.scores],[.35,1.08,1])},{rotate:v([b.champion,b.scores],['-12deg','8deg'])}]}}><Image source={LAST_TAP_ART.finaleBurst} resizeMode="contain" style={FILL}/></Animated.View>}
    <Logo />
    {!recap&&<Animated.View style={[StyleSheet.absoluteFill,{opacity:result.tied||reduced?1:v([b.scores-500,b.scores],[1,0]),transform:result.tied||reduced?[]:[{translateY:v([b.scores-500,b.scores],[0,-20*m.sy])}]}]}>
      <Animated.View style={{position:'absolute',left:18*m.sx,top:156*m.sy,width:354*m.sx,opacity:reduced?1:result.tied?v([0,550,3800,3950,4050,4300],[0,1,1,0,0,1]):v([0,550,5700,5950,6050,6350,7750,7950,8050,8350,b.champion-300,b.champion-80,b.champion+80,b.champion+500],[0,1,1,0,0,1,1,0,0,1,1,0,0,1])}}>
        <Copy size={15} color={GOLD} style={{letterSpacing:3*m.unit,marginBottom:16*m.sy}}>{crowned?'BEAT PANIC CHAMPION':now>=b.stamp&&!result.tied?'THE FINAL ELIMINATION':'THE FINAL RESULT'}</Copy>
        <ComicCopy size={crowned?43:44} lines={2}>{crowned?`${winner?.name} WINS!`:result.tied&&now>=4000?'A PHOTO FINISH!':now>=b.stamp?'TOO SLOW.':now>=6000?'AND THE\nCROWN GOES TO…':'WHO TAKES\nTHE CROWN?'}</ComicCopy>
        <Copy size={18} color={crowned?GOLD:'#ffadc7'} style={{marginTop:14*m.sy}}>{crowned?'HUMILITY NOT INCLUDED.':result.tied&&now>=4000?'Same time. Same egos. Rematch.':now>=b.stamp?'One thumb has left the chat.':'Somebody is about to get unbearable.'}</Copy>
      </Animated.View>
      {!crowned&&<Animated.View pointerEvents="none" style={{position:'absolute',left:194*m.sx,top:333*m.sy,width:2*m.unit,height:280*m.sy,backgroundColor:'#ff90b3',boxShadow:`0 0 ${20*m.unit}px #ff1d6a`,opacity:result.tied?.5:v([0,800,6800,7600,b.stamp],[0,.7,.7,.12,0]),transform:[{rotate:'18deg'}]}}/>}
      {finalists.map((p,i)=>{
        const lost=!result.tied&&p.id===result.eliminatedId,side=i===0?-1:1,centerMove=(i===0?92:-92)*m.sx;
        if(lost&&now>=b.champion)return null;
        const source=lost&&now>=b.stamp?eliminatedMonsters[p.id]:crowned?victoryPoses[p.id]:battlePoses[p.id];
        return <React.Fragment key={p.id}>
          <Animated.View testID={`finale-fighter-${p.id}`} style={{position:'absolute',left:(i===0?8:192)*m.sx,top:349*m.sy,width:190*m.sx,height:284*m.sy,alignItems:'center',opacity:lost?(reduced?1:v([0,650,b.exit+600,b.champion],[0,1,1,0])):reduced?1:v([0,600],[0,1]),transform:reduced?(crowned?[{translateX:centerMove},{scale:1.26}]:[]):lost?[{translateX:v([0,650,b.stamp,b.stamp+80,b.stamp+160,b.stamp+280,b.exit,b.champion],[side*190*m.sx,0,0,side*8*m.sx,-side*4*m.sx,0,0,side*470*m.sx])},{translateY:v([900,2100,3300,4500,5700,6800,b.exit,b.exit+400,b.champion],[0,-5*m.sy,0,-5*m.sy,0,-5*m.sy,0,-70*m.sy,130*m.sy])},{rotate:v([b.stamp,b.stamp+220,b.exit,b.champion],['0deg',`${side*5}deg`,`${side*5}deg`,`${side*420}deg`])},{scale:v([b.stamp,b.stamp+250,b.exit,b.champion],[1,1.05,1.05,.45])}]:[{translateX:v([0,650,b.exit+300,b.champion],[side*190*m.sx,0,0,centerMove])},{translateY:v([900,2100,3300,4500,5700,6800,b.exit,b.champion],[0,-5*m.sy,0,-5*m.sy,0,-5*m.sy,0,0])},{scale:v([b.exit+300,b.champion,b.champion+400],[1,1.3,1.26])}]}}>
            {crowned?<CrownedVictory id={p.id} width={190*m.sx} height={284*m.sy} crownTestID="finale-crown" crownStyle={{opacity:reduced?1:v([b.champion+200,b.champion+650],[0,1]),transform:reduced?[]:[{translateY:v([b.champion+200,b.champion+800,b.champion+1100],[-65*m.sy,3*m.sy,0])},{rotate:v([b.champion+200,b.champion+800,b.champion+1100],['-12deg','4deg','0deg'])}]}}/>:<Image source={source} resizeMode="contain" style={{width:'100%',height:'100%',transform:i===1?[{scaleX:-1}]:[]}}/>}
            {lost&&now>=b.stamp&&<Animated.View testID="finale-eliminated-stamp" style={{position:'absolute',top:153*m.sy,left:-7*m.sx,width:204*m.sx,transform:reduced?[]:[{scale:v([b.stamp,b.stamp+160,b.stamp+380],[1.6,.94,1])},{rotate:'-10deg'}]}}><EnamelPanel><LinearGradient colors={['#ff6886','#f00039','#a70029']} style={{paddingVertical:12*m.sy}}><Copy size={25} lines={1}>ELIMINATED!</Copy></LinearGradient></EnamelPanel></Animated.View>}
          </Animated.View>
          {!crowned&&<Animated.View style={{position:'absolute',left:(i===0?10:208)*m.sx,top:664*m.sy,width:172*m.sx,height:42*m.sy,opacity:v([b.exit,b.champion],[1,0]),transform:reduced?[]:[{translateY:v([b.exit,b.champion],[0,25*m.sy])}]}}><EnamelPanel><View style={{flex:1,justifyContent:'center',paddingHorizontal:8*m.unit}}><Copy size={22} lines={1}>{p.name}</Copy></View></EnamelPanel></Animated.View>}
        </React.Fragment>;
      })}
      {crowned&&<>
        <WinnerConfetti paused={paused}/>
        <Box x={35} y={680} w={320} h={136}><EnamelPanel selected style={{height:'100%'}}><View testID="winner-result-content" style={{flex:1,paddingVertical:14*m.sy,paddingHorizontal:14*m.sx,alignItems:'center',justifyContent:'center',gap:6*m.sy}}><Copy size={16} color="#ffe4a6">WINNING TIMING ERROR</Copy><Copy size={36} color={GOLD}>{formatReaction(winnerTime)}</Copy><Copy size={18}>+{reduced?100:Math.round(100*Math.min(1,Math.max(0,(now-b.champion-900)/1000)))} POINTS</Copy></View></EnamelPanel></Box>
      </>}
      {result.tied&&now>=4000?<Box x={93} y={745} w={204} h={66} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14*m.unit}}><CountdownDial size={63} total={5} value={Math.max(1,Math.ceil((b.tieEnd-now)/1000))} running={!paused}/><Copy size={20}>REMATCH IN</Copy></Box>:!crowned?<Box x={25} y={758} w={340} h={40}><Copy size={19} color="#ffafc8">{now>=b.stamp?'A devastating day for that ego.':'Hold your breath. Blame your thumb.'}</Copy></Box>:null}
    </Animated.View>}
    {recap&&<Animated.View testID="finale-score-recap" style={[StyleSheet.absoluteFill,{opacity:reduced?1:v([b.scores,b.scores+550],[0,1]),transform:reduced?[]:[{translateY:v([b.scores,b.scores+550],[24*m.sy,0])}]}]}>
      <Heading x={17} y={165} w={356} h={88} size={38}>{'THE CHAOS\nPAYS OFF'}</Heading>
      <Pill x={38} y={259} w={314} h={34}><Copy size={16} color={GOLD} lines={1}>★ {winner?.name} · BEAT PANIC CHAMPION</Copy></Pill>
      <Panel x={17} y={recapTop} w={356} h={recapHeight}><View style={{flex:1,padding:5*m.unit}}>
        <View style={{height:27*m.sy,flexDirection:'row',alignItems:'center',paddingHorizontal:5*m.sx}}><Copy size={13} color={INK} style={{flex:1,textAlign:'left'}}>POINTS EARNED</Copy>{['SURV.','BONUS','TOTAL'].map((label,i)=><Copy key={label} size={11} color="#793345" style={{width:(i===2?49:40)*m.sx}}>{label}</Copy>)}</View>
        {scoreRows.map((p,i)=>{
          const start=b.scores+450+i*b.rowStagger,progress=reduced?1:Math.max(0,Math.min(1,(now-start)/b.count)),count=(n:number)=>Math.round(n*(1-Math.pow(1-progress,3)));
          return <Animated.View key={p.id} testID={`final-score-${p.id}`} accessibilityLabel={`${p.name}: ${p.score} survival plus ${p.bonus} bonus equals ${p.total} points${p.champion?', champion':''}`} style={{flex:1,flexDirection:'row',alignItems:'center',paddingHorizontal:5*m.sx,marginTop:3*m.sy,borderRadius:10*m.unit,borderWidth:m.unit,borderColor:p.champion?'#efad27':'#ebd1b5',backgroundColor:p.champion?'#ffe794':p.id===playerId?'#ffe0e8':i%2?'#ffecdf':'#fff9ef',opacity:reduced?1:v([start,start+240],[0,1]),transform:reduced?[]:[{translateX:v([start,start+300],[24*m.sx,0])}]}}><Avatar id={p.id} size={27*Math.min(m.sx,m.sy)}/><Copy size={14} color={INK} lines={1} style={{flex:1,minWidth:0,textAlign:'left',marginLeft:6*m.sx}}>{p.name}</Copy><Copy size={14} color="#753042" style={{width:40*m.sx}}>{count(p.score)}</Copy><Copy size={14} color="#753042" style={{width:40*m.sx}}>{count(p.bonus)}</Copy><Copy size={21} color={INK} style={{width:49*m.sx}}>{count(p.total)}</Copy></Animated.View>;
        })}
      </View></Panel>

      {now>=b.ready?<Button x={28} y={774} w={334} h={55} label="BACK TO THE CHAOS" onPress={onFinish}/>:<Pill x={28} y={774} w={334} h={48}><Copy size={20} color={GOLD}>ADDING YOUR POINTS…</Copy></Pill>}
    </Animated.View>}
  </View></ScreenMotion.Provider>;
}

function SurvivorAward({player, index, paused}: {player:TapPlayer; index:number; paused:boolean}) {
  const {unit}=useContext(Layout);
  const {clock,now,reduced}=useMotionClock(1800,paused);
  const start=index*70;
  const progress=reduced?1:Math.max(0,Math.min(1,(now-start)/1000));
  const total=Math.round(player.score-100+100*progress);
  return <View testID={`survival-award-${player.id}`} accessibilityLabel={`${player.name} survived: plus 100 points, ${player.score} total`} style={{height:38*unit,justifyContent:'center',alignItems:'center'}}>
    <Animated.View style={{opacity:reduced?1:clock.interpolate({inputRange:[start,start+250],outputRange:[0,1],extrapolate:'clamp'}),transform:reduced?[]:[{scale:clock.interpolate({inputRange:[start,start+250,start+450],outputRange:[.5,1.18,1],extrapolate:'clamp'})}]}}><Copy size={22} color={GOLD}>+100</Copy></Animated.View>
    <Copy size={13} color="#ffd1dc">{total} PTS</Copy>
  </View>;
}

function ResultsReveal({result, players, playerId, paused, revealed, onRevealed, onContinue, prediction = null}: {result:TapRound; players:TapPlayer[]; playerId:MonsterId; paused:boolean; revealed:boolean; onRevealed:()=>void; onContinue:()=>void; prediction?:Prediction|null}) {
  const m = useContext(Layout);
  const rows = result.results;
  const rowHeight = rows.length > 6 ? 43 : 48;
  const tableTop = 300;
  const tableHeight = Math.max(250, rows.length * rowHeight + 24);
  const {spotlightAt,stampAt,kickAt,end}=tapRevealTiming(rows.length,!!result.eliminatedId);
  const {clock, now, reduced} = useMotionClock(end, paused, onRevealed, undefined, true);
  const done = revealed;
  const [remaining, setRemaining] = useState(5);
  const continueRef = useRef(onContinue); continueRef.current = onContinue;
  useEffect(() => {
    if (!done || paused) return;
    const timer = setTimeout(() => {
      if (remaining > 1) setRemaining(n => n - 1);
      else continueRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [done, paused, remaining]);
  const v = (times:number[], values:any[]) => clock.interpolate({inputRange:times,outputRange:values,extrapolate:'clamp'});
  const loser = result.eliminatedId;
  const name = loser ? players.find(p=>p.id===loser)?.name || 'Player' : '';
  const showSpotlight = done || now >= spotlightAt;
  const showNext = done || now >= (loser?kickAt+350:spotlightAt);
  const nextArrival = loser?kickAt+350:spotlightAt;
  const remainingPlayers = players.filter(p=>p.eliminatedRound===null && p.id !== loser);
  const survivors = remainingPlayers.length;
  return <>
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden={showSpotlight} importantForAccessibility={showSpotlight?'no-hide-descendants':'auto'}>
    <Logo />
    <Heading x={20} y={132} w={350} h={59} size={36}>RHYTHM CHECK</Heading>
    <Box x={30} y={201} w={330} h={28}><Copy size={18} color="#ffb0c3">Some of you fought the music.</Copy></Box>
    <Pill x={65} y={250} w={260} h={36}><Copy size={16} color={GOLD} lines={1}>TIMING ERROR · LOWER IS BETTER</Copy></Pill>
    <Panel x={20} y={tableTop+14} w={350} h={tableHeight}><View style={{flex:1,padding:5*m.unit,gap:3*m.unit}}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{padding:5*m.unit,gap:3*m.unit}]}>{rows.map((_,i)=><View key={i} style={{flex:1,borderRadius:11*m.unit,backgroundColor:i%2?'#ffe8d8':'#fff6e8',borderWidth:m.unit,borderColor:'#efd4b8',flexDirection:'row',alignItems:'center',paddingHorizontal:11*m.unit}}><Copy size={17} color="#c5a38a">{i+1}</Copy><View style={{marginLeft:12*m.unit,width:29*m.unit,height:29*m.unit,borderRadius:20*m.unit,backgroundColor:'#e9d4bf'}}/><View style={{marginLeft:12*m.unit,width:90*m.unit,height:8*m.unit,borderRadius:6*m.unit,backgroundColor:'#e9d4bf'}}/></View>)}</View>
      {rows.map((r,i)=><Animated.View key={r.id} testID="last-tap-result-row" style={{flex:1,flexDirection:'row',alignItems:'center',gap:7*m.unit,paddingHorizontal:8*m.unit,borderRadius:11*m.unit,borderWidth:m.unit,borderColor:done&&r.id===loser?'#ee6980':r.id===playerId?'#edb534':'#e9cdb5',backgroundColor:done&&r.id===loser?'#ffd1d8':r.id===playerId?'#fff0a5':i%2?'#ffecdf':'#fff9ee',opacity:done||reduced?1:v([REVEAL_BEATS.firstRow+i*REVEAL_BEATS.rowStagger,REVEAL_BEATS.firstRow+i*REVEAL_BEATS.rowStagger+REVEAL_BEATS.rowArrival],[0,1]),transform:done||reduced?[]:[{translateX:v([REVEAL_BEATS.firstRow+i*REVEAL_BEATS.rowStagger,REVEAL_BEATS.firstRow+i*REVEAL_BEATS.rowStagger+REVEAL_BEATS.rowArrival],[30,0])}]}}>
        <Copy size={20} color={INK} style={{width:15*m.unit}}>{i+1}</Copy><Avatar id={r.id} size={33*m.unit}/><Copy size={17} color={INK} lines={1} style={{flex:1,textAlign:'left'}}>{players.find(p=>p.id===r.id)?.name}</Copy><View style={{backgroundColor:done&&r.id===loser?'#b60939':'#4b1224',borderRadius:9*m.unit,paddingHorizontal:7*m.unit,paddingVertical:5*m.unit}}><Copy size={16} color={CREAM}>{formatReaction(r.ms)}</Copy></View>{done&&r.id===loser&&<Copy size={12} color={RED}>OUT</Copy>}
      </Animated.View>)}
    </View></Panel>
    <SurvivalBar players={players} localId={playerId} y={704}/>
    </View>
    {/* This single backdrop remains mounted throughout spotlight, stamp, exit and countdown. */}
    <Animated.View testID="elimination-stage-background" pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:30,backgroundColor:'#190009',opacity:done?1:v([spotlightAt,spotlightAt+220],[0,1])}]}>
      <Image source={LAST_TAP_ART.stage} resizeMode="stretch" style={FILL}/>
    </Animated.View>
    {showSpotlight && <View pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:31}]}>
      <Logo />
      {!done && loser && <>
        <Animated.View style={{position:'absolute',left:20*m.sx,top:185*m.sy,width:350*m.sx,opacity:v([spotlightAt+150,spotlightAt+450,kickAt,kickAt+480],[0,1,1,0]),transform:reduced?[]:[{translateY:v([spotlightAt+150,spotlightAt+450,kickAt,kickAt+480],[-18*m.sy,0,0,-24*m.sy])}]}}>
          <Copy size={14} color="#ff9dbb" style={{letterSpacing:3*m.unit,marginBottom:11*m.unit}}>RHYTHM HAS LEFT THE CHAT</Copy>
          <ComicCopy size={47}>{name}</ComicCopy>
          <Copy size={20} color="#ff9dbb" style={{marginTop:15*m.unit}}>{now>=stampAt?(rows.at(-1)?.ms==null?'NO BEAT. BOLD STRATEGY.':`${formatReaction(rows.at(-1)?.ms)} · MOST TIMING ERROR`):'Your moment of shame.'}</Copy>
        </Animated.View>
        <Animated.View testID="elimination-monster-group" style={{position:'absolute',left:68*m.sx,top:326*m.sy,width:254*m.sx,height:272*m.sy,alignItems:'center',justifyContent:'center',opacity:v([spotlightAt+100,spotlightAt+400,kickAt+650,kickAt+900],[0,1,1,0]),transform:reduced?[]:[{translateX:v([spotlightAt,kickAt,kickAt+850],[0,0,440*m.sx])},{translateY:v([spotlightAt,spotlightAt+600,kickAt,kickAt+300,kickAt+850],[65*m.sy,0,0,-60*m.sy,100*m.sy])},{scale:v([spotlightAt,spotlightAt+450,spotlightAt+650,kickAt,kickAt+850],[.55,1.06,1,1,.4])},{rotate:v([spotlightAt,kickAt-140,kickAt,kickAt+850],['0deg','0deg','-6deg','390deg'])}]}}>
          <Image testID="elimination-monster-cutout" source={eliminatedMonsters[loser]} resizeMode="contain" style={FILL}/>
          <Animated.View testID="elimination-attached-badge" style={{position:'absolute',left:-48*m.sx,top:144*m.sy,width:350*m.sx,opacity:v([stampAt,stampAt+90],[0,1]),transform:reduced?[]:[{scale:v([stampAt,stampAt+160,stampAt+340],[1.5,.94,1])},{rotate:v([stampAt,stampAt+340],['-13deg','-7deg'])}]}}>
            <LinearGradient colors={['#ff5374','#f40935','#b60028']} style={{borderWidth:2*m.unit,borderColor:'#24000a',borderRadius:17*m.unit,padding:3*m.unit,boxShadow:`0 ${5*m.unit}px 0 #190009, 0 0 ${16*m.unit}px #ff174477`}}>
              <View style={{borderWidth:2*m.unit,borderColor:CREAM,borderRadius:12*m.unit,padding:3*m.unit}}><View style={{borderWidth:m.unit,borderColor:'#ff7e93',borderRadius:9*m.unit,paddingVertical:11*m.unit}}><Copy size={34} lines={1} style={{textShadowColor:'#5d0616',textShadowOffset:{width:0,height:3*m.unit},textShadowRadius:1}}>✕ ELIMINATED!</Copy></View></View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
        <Animated.View style={{position:'absolute',left:105*m.sx,top:622*m.sy,width:180*m.sx,height:58*m.sy,opacity:v([spotlightAt+600,spotlightAt+900,stampAt-180,stampAt],[0,1,1,0])}}>
          <EnamelPanel><LinearGradient colors={['#fffbee','#ffe8bf']} style={{flex:1,alignItems:'center',justifyContent:'center'}}><Copy size={34} color={INK}>{formatReaction(rows.at(-1)?.ms)}</Copy></LinearGradient></EnamelPanel>
        </Animated.View>
        <Animated.View style={{position:'absolute',left:24*m.sx,top:658*m.sy,width:342*m.sx,opacity:v([stampAt+300,stampAt+650,kickAt,kickAt+500],[0,1,1,0]),transform:reduced?[]:[{translateY:v([stampAt+300,stampAt+650,kickAt,kickAt+500],[15*m.sy,0,0,25*m.sy])}]}}>
          <Copy size={24} lines={1}>TWO LEFT THUMBS.</Copy><Copy size={20} color="#ff94b0" style={{marginTop:8*m.unit}}>{eliminationQuip(result.round)}</Copy>
        </Animated.View>
        {!reduced && Array.from({length:10},(_,i)=>{
          const angle=i*Math.PI/5;
          return <Animated.View key={i} style={{position:'absolute',left:195*m.sx,top:512*m.sy,width:6*m.unit,height:17*m.unit,borderRadius:3*m.unit,backgroundColor:i%2?CREAM:'#ff7496',opacity:v([stampAt,stampAt+80,stampAt+400,stampAt+650],[0,1,1,0]),transform:[{translateX:v([stampAt,stampAt+650],[0,Math.cos(angle)*195*m.sx])},{translateY:v([stampAt,stampAt+650],[0,Math.sin(angle)*120*m.sy])},{rotate:`${i*36}deg`}]}}/>;
        })}
      </>}
      {showNext && <View testID="next-round-stage" style={StyleSheet.absoluteFill}>
        <Animated.View style={{position:'absolute',left:16*m.sx,top:185*m.sy,width:358*m.sx,alignItems:'center',opacity:done?1:v([nextArrival,nextArrival+370],[0,1]),transform:reduced?[]:[{translateY:done?0:v([nextArrival,nextArrival+370],[18*m.sy,0])}]}}>
          <ComicCopy size={survivors===1||result.tied?35:46}>{survivors===1?'BEAT PANIC CHAMPION!':result.tied?'EVERYONE STAYS IN!':'NEXT ROUND'}</ComicCopy>
          <Copy size={16} color="#ff9fbc" style={{letterSpacing:2*m.unit,marginTop:14*m.unit}}>{survivors===1?'WINNER REVEAL IN':'STARTS IN'}</Copy>
          <View style={{marginTop:12*m.unit}}><CountdownDial value={remaining} size={112} running={done&&!paused}/></View>
        </Animated.View>
        <Animated.View style={{position:'absolute',left:32*m.sx,top:416*m.sy,width:326*m.sx,height:66*m.sy,opacity:done?1:v([nextArrival+150,nextArrival+530],[0,1])}}>
          {prediction ? <EnamelPanel style={{height:'100%'}}>
            <View style={{flex:1,padding:9*m.unit,flexDirection:'row',alignItems:'center',gap:11*m.unit}}>
              {prediction.pick && <Avatar id={prediction.pick} size={44*m.unit}/>}
              <View style={{flex:1}}><Copy size={23} color={prediction.points?GOLD:CREAM} lines={1}>{prediction.pick?prediction.points?'CALLED IT!':'NOT THIS TIME':'NO PICK THIS ROUND'}</Copy><Copy size={14} color="#ffacc2" style={{marginTop:3*m.unit}}>{prediction.pick?prediction.points?'+25 bonus points':'No points lost':'Try a pick next round'}</Copy></View>
            </View>
          </EnamelPanel> : <View style={{flex:1,justifyContent:'center'}}><Copy size={19} color="#ff9dbb">{loser===playerId?'PROMOTED TO SPECTATOR':survivors===1?'One beat. One champion.':result.tied?'Too close to call. Go again!':'+100 POINTS. EGO RESTORED.'}</Copy></View>}
        </Animated.View>
        <Animated.View testID="survivor-lineup" style={{position:'absolute',left:18*m.sx,top:497*m.sy,width:354*m.sx,height:321*m.sy,opacity:done?1:v([nextArrival+300,nextArrival+700],[0,1]),transform:reduced?[]:[{translateY:done?0:v([nextArrival+300,nextArrival+700],[36*m.sy,0])}]}}>
          <View testID="remaining-players-heading" style={{height:37*m.sy,justifyContent:'center',borderBottomWidth:m.unit,borderColor:'#ff89b54d',marginBottom:12*m.sy}}><Copy size={20} color={GOLD} lines={1}>{survivors} {survivors===1?'PLAYER':'PLAYERS'} REMAINING</Copy></View>
          <View style={{flex:1,flexDirection:'row',flexWrap:'wrap',alignContent:'center',justifyContent:'center',rowGap:8*m.sy,columnGap:8*m.sx}}>
            {remainingPlayers.map((p,i)=><LinearGradient key={p.id} testID={`survivor-character-card-${p.id}`} colors={p.id===playerId?['#773336','#340717']:['#49162c','#250914']} style={{alignItems:'center',width:(survivors>6?80:108)*m.sx,height:(survivors>3?131:215)*m.sy,borderRadius:15*m.unit,borderWidth:m.unit,borderColor:p.id===playerId?'#ffe34c':'#ff9fc32e',paddingTop:4*m.sy,paddingHorizontal:3*m.sx,boxShadow:p.id===playerId?'0 0 16px #ffbf0033':'0 4px 0 #19000966'}}>
              <Image testID={`survivor-character-${p.id}`} source={victoryPoses[p.id]} resizeMode="contain" style={{width:'100%',height:(survivors>3?64:144)*m.sy}}/>
              <Copy size={14} color={p.id===playerId?GOLD:CREAM} lines={1} style={{marginTop:3*m.sy,width:'100%'}}>{p.name}</Copy>
              {done&&loser&&p.awardedThroughRound===result.round?<SurvivorAward player={p} index={i} paused={paused}/>:<View style={{height:40*m.unit,justifyContent:'center'}}><Copy size={15} color="#ffd1dc">{p.score} PTS</Copy></View>}
            </LinearGradient>)}
          </View>
        </Animated.View>
      </View>}
    </View>}

  </>;
}

type Props = { entrancePaused?:boolean; soundOn?:boolean; viewportWidth: number; viewportHeight: number; playerId?: MonsterId; playerName?: string; onExit: () => void; onFinish: () => void; initialPhase?: LastTapPhase };
export default function LastTapStandingGame({ viewportWidth, viewportHeight, entrancePaused=false, soundOn=true, playerId = 'grumble', playerName = 'Player', onExit, onFinish, initialPhase = 'welcome' }: Props) {
  const [phase, setPhase] = useState<LastTapPhase>(initialPhase);
  const [players, setPlayers] = useState(() => createTapPlayers(playerId, playerName));
  const [round, setRound] = useState(1);
  const [seconds, setSeconds] = useState<number>(TAP_PACING.preview);
  const [reaction, setReaction] = useState<number | null>(null);
  const [result, setResult] = useState<TapRound | null>(null);
  const [history, setHistory] = useState<TapRound[]>([]);
  const [paused, setPaused] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [resultRevealed, setResultRevealed] = useState(false);
  const [loungeSeen, setLoungeSeen] = useState(false);
  const [favourite, setFavourite] = useState<MonsterId | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [bonusPoints, setBonusPoints] = useState(0);
  const pickRef = useRef<MonsterId | null>(null);
  const submitted = useRef(false);
  const rivals = useRef<TapResult[]>([]);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const entry = useRef(new Animated.Value(TAP_PACING.entryMs)).current;
  const departure=useRef(new Animated.Value(1)).current;
  const transitionPending=useRef(false);
  const transitionAnimation=useRef<Animated.CompositeAnimation|null>(null);
  const [pageReady, setPageReady] = useState(true);
  const active = players.filter(p => p.eliminatedRound === null);
  const localOut = players.find(p => p.id === playerId)?.eliminatedRound !== null;
  const width = Math.min(viewportWidth, 510, viewportHeight * .72);
  const height = Math.min(viewportHeight, width * 844 / 390);
  const metrics = useMemo(() => ({ sx: width / 390, sy: height / 844, unit: Math.min(width / 390, height / 844 * 1.07) }), [width, height]);
  const blocked = paused || showOptions;
  // ResultsReveal owns its five-second countdown after the elimination finishes.
  const timerPhases = ['target', 'final', 'locked'];
  const nameOf = (id: MonsterId) => players.find(p => p.id === id)?.name || 'Player';

  function goPhase(next:LastTapPhase, immediate=false) {
    if(transitionPending.current)return;
    if(immediate||reducedMotion){setPhase(next);return;}
    transitionPending.current=true;
    transitionAnimation.current=Animated.timing(departure,{toValue:0,duration:TAP_PACING.exitMs,easing:Easing.out(Easing.quad),useNativeDriver:false});
    transitionAnimation.current.start(({finished})=>{
      transitionPending.current=false;
      if(!finished)return;
      // Hold the outgoing phase invisible until the next phase has mounted, so
      // iOS does not paint the previous screen for a frame at full opacity.
      departure.setValue(0);
      entry.setValue(0);
      setPhase(next);
      requestAnimationFrame(()=>{requestAnimationFrame(()=>departure.setValue(1));});
    });
  }
  useEffect(()=>()=>transitionAnimation.current?.stop(),[]);
  useEffect(() => {
    if (!soundOn || phase !== 'rules') return;
    fadeLastTapMusicTo(.4, 1000);
    return () => { fadeLastTapMusicTo(1, 800); };
  }, [phase, soundOn]);

  useEffect(() => {
    let live = true;
    setAssetsReady(false); setAssetError(false);
    Promise.all(LAST_TAP_IMAGE_SOURCES.map(source => {
      const uri = typeof source === 'string' ? source : (source as any).uri || Image.resolveAssetSource(source)?.uri;
      return uri ? Image.prefetch(uri) : Promise.resolve(true);
    })).then(() => { if (live) setAssetsReady(true); }).catch(() => { if (live) setAssetError(true); });
    return () => { live = false; };
  }, [retry]);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); }, []);
  useEffect(() => {
    const pause = () => { if (['playing', 'target', 'final', 'results', 'locked'].includes(phaseRef.current)) setPaused(true); };
    const app = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    const visibility = () => { if (document.hidden) pause(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
    return () => { app.remove(); if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useLayoutEffect(() => {
    if (entrancePaused) { entry.setValue(0); setPageReady(false); return; }
    if (reducedMotion || phase === 'playing' || phase === 'final') { entry.setValue(TAP_PACING.entryMs); setPageReady(true); return; }
    entry.setValue(0); setPageReady(false);
    const animation = Animated.timing(entry, {toValue:TAP_PACING.entryMs, duration:TAP_PACING.entryMs, easing:Easing.linear, useNativeDriver:false});
    animation.start(({finished}) => {if (finished) setPageReady(true);});
    const fallback = setTimeout(() => setPageReady(true), TAP_PACING.entryMs + 80);
    return () => { animation.stop(); clearTimeout(fallback); };
  }, [phase, entry, reducedMotion, entrancePaused]);

  function prepareRound(nextRound: number, showFinal = false) {
    if(soundOn)unlockBeatAudio();
    pickRef.current = null; setFavourite(null); setPrediction(null);
    submitted.current = false;
    setReaction(null); setRound(nextRound);
    rivals.current = simulateRivals(players, playerId, nextRound, Math.random, players.filter(p=>p.eliminatedRound===null).length===2);
    setSeconds(showFinal ? TAP_PACING.final : TAP_PACING.preview); goPhase(showFinal ? 'final' : 'target');
  }
  function finishRound(ms: number | null) {
    if (submitted.current) return;
    submitted.current = true; setReaction(ms);
    const all = [...rivals.current, ...(!localOut ? [{ id: playerId, ms, wrongTaps: 0 }] : [])];
    const resolved = resolveTapRound(round, all);
    if (localOut) {
      const points = predictionPoints(pickRef.current, all);
      setPrediction({pick:pickRef.current, points});
      setBonusPoints(total => total + points);
    }
    setResultRevealed(false); setLoungeSeen(false); setResult(resolved); setHistory(old => [...old, resolved]);
    setSeconds(TAP_PACING.locked); goPhase('locked');
  }
  function afterResults() {
    if (active.length === 1) { goPhase('winner'); return; }
    prepareRound(result?.tied ? round : round + 1, active.length === 2);
  }
  useEffect(() => {
    if (blocked || !pageReady || !timerPhases.includes(phase)) return;
    const timer = setTimeout(() => {
      if (seconds > 1) { setSeconds(n => Math.max(0, n - 1)); return; }
      if (phase === 'final') { setSeconds(TAP_PACING.preview); goPhase('target'); }
      else if (phase === 'target') { goPhase('playing',true); }
      else if (phase === 'locked') { setSeconds(0); goPhase('results'); }
    }, Math.min(1, seconds) * 1000);
    return () => clearTimeout(timer);
  }, [phase, seconds, blocked, pageReady, result, players]);

  function resume() { setPaused(false); setShowOptions(false); if (phase === 'playing') prepareRound(round); }
  function continueFromResults() {
    if (phase !== 'results' || !resultRevealed) return;
    afterResults();
  }
  function restart() {
    setBonusPoints(0); setPrediction(null); pickRef.current = null;
    setPlayers(createTapPlayers(playerId, playerName, players.length - 1)); setHistory([]); setResult(null); setRound(1);
    setFavourite(null); setPaused(false); setShowOptions(false); goPhase('welcome');
  }

  const survivor = active[0];
  const resultRows = result?.results || [];
  const finalists = active.slice(0, 2);

  return <View nativeID="beat-panic" testID={`beat-panic-${phase}`} style={{ width: viewportWidth, height: viewportHeight, backgroundColor: '#250008', alignItems: 'center', justifyContent: 'center' }}>
    <Image accessibilityLabel={phase === 'welcome' ? 'Beat Panic' : undefined} source={phase === 'welcome' ? LAST_TAP_ART.keyArt : ['target','playing','locked','results'].includes(phase) ? LAST_TAP_ART.beat : LAST_TAP_ART.background} resizeMode="cover" style={FILL} />
    <Layout.Provider value={metrics}>
      <View style={{ width, height, position: 'relative' }}>
        <ScreenMotion.Provider value={{clock:entry, enabled:!reducedMotion && phase !== 'playing'}}>
        <Animated.View pointerEvents={pageReady ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill,{opacity:departure,transform:[{translateY:departure.interpolate({inputRange:[0,1],outputRange:[-6*metrics.unit,0]})}]}]}>
          {phase === 'welcome' ? <>
            <Button x={27} y={742} w={336} h={66} label="HOW TO PLAY" onPress={() => goPhase('rules')} />

          </> : phase === 'rules' ? <>
            <Logo /><Heading x={12} y={135} w={366} h={62} size={42}>HOW TO PLAY</Heading>
            <Panel x={24} y={224} w={342} h={496}><View testID="focused-rules" style={{flex:1,padding:12*metrics.unit,gap:10*metrics.sy}}>
              <View style={{height:84*metrics.sy,justifyContent:'center'}}><Copy size={21} color={INK}>LAST ONE STANDING WINS</Copy><Copy size={15} color="#743145" body style={{marginTop:7*metrics.sy}}>{'One player out per round.\nSurvivors earn +100 points.'}</Copy></View>
              {[
                {icon:'← ↑ ↓ →',title:'FOLLOW THE ARROWS',description:'Tap the matching lane as each arrow reaches the line.'},
                {icon:'×2',title:'DOUBLE TAP',description:'Hit the lane twice when the double marker lands.'},
                {icon:'HOLD',title:'HOLD NOTES',description:'Press and keep holding until the trail finishes.'},
                {icon:'OUT',title:'SURVIVE THE ROUND',description:'Lowest timing error stays in. One player is eliminated.'},
              ].map((rule,i)=><View key={rule.title} testID="focused-rule-card" style={{flex:1,flexDirection:'row',alignItems:'center',borderRadius:16*metrics.unit,backgroundColor:i%2?'#ffe3cf':'#ffeadb',padding:10*metrics.unit,gap:12*metrics.sx}}>
                <View style={{width:70*metrics.sx,height:62*metrics.sy,borderRadius:13*metrics.unit,backgroundColor:'#390010',alignItems:'center',justifyContent:'center'}}><Copy size={rule.icon.length>4?17:22} color={GOLD} lines={1}>{rule.icon}</Copy></View>
                <View style={{flex:1}}><Copy size={19} color={INK} style={{textAlign:'left'}}>{rule.title}</Copy><Copy size={14} color={INK} body style={{textAlign:'left',marginTop:5*metrics.sy}}>{rule.description}</Copy></View>
              </View>)}
            </View></Panel>
            <Button x={55} y={744} w={280} h={66} label={assetError ? 'RETRY IMAGES' : assetsReady ? 'GOT IT!' : 'LOADING…'} disabled={!assetsReady && !assetError} onPress={() => assetError ? setRetry(n => n + 1) : prepareRound(1, players.length === 2)} />
          </> : localOut && (phase === 'target' || phase === 'playing' || phase === 'locked') ? <>
            <Logo />
            <Pill x={100} y={121} w={190} h={33}><Copy size={20}>WATCH PARTY</Copy></Pill>
            <Box x={13} y={165} w={364} h={55} style={{justifyContent:'center'}}><ComicCopy size={phase==='target'?44:38}>{phase==='target'?'WIN +25 POINTS!':phase==='playing'?'PICK LOCKED':'RESULTS UP NEXT'}</ComicCopy></Box>
            {phase==='target'&&<Pill x={20} y={235} w={350} h={38}><Copy size={18}>Predict who has the best rhythm</Copy></Pill>}
            {phase === 'target' ? <>
              <Box x={35} y={290} w={320} h={39} style={{justifyContent:'center'}}><Copy size={20} color={GOLD} lines={1}>{favourite ? `${nameOf(favourite)} · PICK SAVED ✓` : 'ONE PICK. +25 IF YOU NAIL IT.'}</Copy></Box>
              <Box x={15} y={345} w={360} h={320} style={{justifyContent:'center'}}>
                <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',rowGap:10*metrics.sy,columnGap:7*metrics.sx}}>
                  {active.map(p=>{
                    const selected=favourite===p.id;
                    const cardWidth=active.length>6?82:active.length===4||active.length===2?169:112;
                    return <Pressable key={p.id} testID={`prediction-card-${p.id}`} accessibilityRole="button" accessibilityLabel={`Predict ${p.name}`} accessibilityState={{selected,disabled:blocked||!pageReady}} disabled={blocked||!pageReady} onPress={()=>{if(phaseRef.current!=='target'||blocked||!pageReady)return;pickRef.current=p.id;setFavourite(p.id);playSound('click');}} style={({pressed})=>({width:cardWidth*metrics.sx,height:(active.length<=3?248:149)*metrics.sy,minHeight:44,transform:[{scale:pressed?.96:1}]})}>
                      <EnamelPanel selected={selected} style={{flex:1,borderRadius:17*metrics.unit}}><View style={{flex:1,alignItems:'center',justifyContent:'center',gap:7*metrics.unit,padding:6*metrics.unit}}>
                        <Image source={monsters[p.id]} resizeMode="contain" style={{width:'100%',height:active.length<=3?155*metrics.sy:86*metrics.sy}}/><Copy size={17} lines={1} style={{width:'100%'}} color={selected?GOLD:CREAM}>{p.name}</Copy>
                      </View></EnamelPanel>
                      {selected && <View style={{position:'absolute',right:6*metrics.unit,top:6*metrics.unit,width:28*metrics.unit,height:28*metrics.unit,borderRadius:16*metrics.unit,borderWidth:2*metrics.unit,borderColor:GOLD,backgroundColor:CREAM,alignItems:'center',justifyContent:'center'}}><Copy size={21} color={INK}>✓</Copy></View>}
                    </Pressable>;
                  })}
                </View>
              </Box>
              <Box x={74} y={711} w={242} h={95} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:15*metrics.unit}}>
                <CountdownDial running={!blocked&&pageReady} total={TAP_PACING.preview} value={Math.ceil(seconds)} size={84}/>
                <View style={{flex:1}}><Copy size={22}>PICKS LOCK IN</Copy><Copy size={15} color="#ffadc7" style={{marginTop:7*metrics.unit}}>{favourite?'Pick saved. Feeling lucky?':'Tap a player to predict'}</Copy></View>
              </Box>
            </> : <>
              {phase==='playing'?<Box x={20} y={235} w={350} h={390}><BeatPanic soundOn={soundOn} round={round} finalRound={active.length===2} sx={metrics.sx} sy={metrics.sy*.92} paused={blocked||!pageReady} spectator reduced={reducedMotion} monster={victoryPoses[favourite||playerId]} onComplete={finishRound}/></Box>:<Box x={32} y={270} w={326} h={300}>
                <EnamelPanel style={{height:'100%'}}><View style={{flex:1,padding:20*metrics.unit,backgroundColor:'#31000f',alignItems:'center',justifyContent:'center'}}><Copy size={24}>ROUND COMPLETE</Copy><Image source={victoryPoses[favourite||playerId]} resizeMode="contain" style={{width:150*metrics.sx,height:160*metrics.sy,marginTop:12*metrics.sy}}/><CountdownDial running={!blocked&&pageReady} total={TAP_PACING.locked} value={Math.ceil(seconds)} size={76}/></View></EnamelPanel>
              </Box>}
              <Box x={32} y={624} w={326} h={82}>
                <EnamelPanel style={{height:'100%'}} selected={!!favourite}><View style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:15*metrics.unit,paddingHorizontal:16*metrics.unit,paddingVertical:12*metrics.sy}}>{favourite&&<Image source={monsters[favourite]} resizeMode="contain" style={{width:48*metrics.sx,height:52*metrics.sy}}/>}<View style={{flex:1}}><Copy size={16} color="#ffc5d9">YOUR PICK</Copy><Copy size={25} lines={1} style={{marginTop:5*metrics.unit}}>{favourite?nameOf(favourite):'NO PICK'}</Copy></View></View></EnamelPanel>
              </Box>
              <SurvivalBar players={players} localId={playerId} y={721}/>

            </>}
          </> : phase === 'target' || phase === 'playing' ? <>
            <Logo compact />
            <Pill x={130} y={32} w={240} h={42}><Copy size={18}>{active.length===2?'FINAL':`ROUND ${round}`} · {active.length} STANDING</Copy></Pill>
            <Box x={20} y={96} w={350} h={624}><BeatPanic soundOn={soundOn} key={`${round}-${phase}`} round={round} finalRound={active.length===2} sx={metrics.sx} sy={metrics.sy} preview={phase==='target'} paused={blocked||!pageReady} reduced={reducedMotion} monster={victoryPoses[playerId]} onComplete={finishRound}/></Box>
            {phase==='target'&&<Pill x={62} y={677} w={266} h={42}><Copy size={24} color={GOLD}>STARTS IN {Math.ceil(seconds)}</Copy></Pill>}
            <SurvivalBar players={players} localId={playerId} y={731}/>

          </> : phase === 'locked' ? <>
            <Logo /><Heading x={13} y={137} w={364} h={62} size={43}>BEAT COMPLETE</Heading>
            <Box x={22} y={208} w={346} h={31}><Copy size={19} color="#ffadc7">{reaction!==null&&reaction<=2600?'Your thumb has serious range.':'The rhythm has filed a complaint.'}</Copy></Box>
            <Art source={victoryPoses[playerId]} x={55} y={255} w={280} h={215} />
            <Box x={30} y={476} w={330} h={145}><EnamelPanel selected style={{height:'100%'}}><LinearGradient colors={['#561728','#290512']} style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:18*metrics.sy,paddingHorizontal:18*metrics.sx,gap:10*metrics.sy}}><Copy size={49} color={GOLD}>{formatReaction(reaction)}</Copy><Copy size={20}>TOTAL TIMING ERROR</Copy></LinearGradient></EnamelPanel></Box>
            <Pill x={30} y={641} w={330} h={72}><View style={{flexDirection:'row',alignItems:'center',gap:18*metrics.unit}}><CountdownDial running={!blocked&&pageReady} total={5} value={Math.ceil(seconds)} size={52}/><Copy size={23}>RESULTS IN</Copy></View></Pill>
            <SurvivalBar players={players} localId={playerId} y={737} />
          </> : phase === 'eliminated' ? <>
            <Logo /><Heading x={14} y={125} w={362} h={95} size={44}>BEATEN.</Heading>
            <Art source={LAST_TAP_ART.eliminated} x={14} y={227} w={362} h={280} />
            <Panel x={26} y={520} w={338} h={133}><Copy size={22} color={INK} style={{ marginTop: 12 * metrics.unit }}>YOUR TIMING ERROR</Copy><Copy size={54} color={INK}>{formatReaction(reaction)}</Copy></Panel>
            <SurvivalBar players={players} localId={playerId} y={690} />
            <Button x={30} y={785} w={330} h={54} label="JOIN THE WATCH PARTY" onPress={afterResults} />
          </> : phase === 'results' ? <>
            {result && (result.results.length===2 ? <FinaleReveal result={result} players={players} playerId={playerId} bonusPoints={bonusPoints} paused={blocked || !pageReady} onSettled={()=>{if(!resultRevealed){setPlayers(old=>eliminatePlayer(old,result));setResultRevealed(true);}}} onReplay={()=>prepareRound(round,true)} onFinish={onFinish}/> : <ResultsReveal result={result} players={players} playerId={playerId} prediction={prediction} paused={blocked || !pageReady} revealed={resultRevealed} onRevealed={() => {if (!resultRevealed) {setPlayers(old=>eliminatePlayer(old,result));setResultRevealed(true);}}} onContinue={continueFromResults}/>)}
          </> : phase === 'final' ? <>
            <FinalShowdown finalists={finalists} seconds={seconds} paused={blocked}/>
          </> : <>
            <Logo/>
            <Heading x={20} y={134} w={350} h={105} size={48}>{'BEAT PANIC\nCHAMPION!'}</Heading>
            <WinnerConfetti paused={blocked}/>
            <Box x={60} y={256} w={270} h={248}><CrownedVictory id={survivor?.id||'snicker'} width={270*metrics.sx} height={248*metrics.sy}/></Box>
            <Panel x={27} y={509} w={336} h={200}><View style={{ alignItems: 'center', padding: 9 * metrics.unit }}><Copy size={39} color={INK} lines={1}>{`${nameOf(survivor?.id || 'snicker')} WINS!`}</Copy><Copy size={16} color="#7a3044" style={{ marginTop: 16 * metrics.unit }}>{survivor?.score || 0} SURVIVAL POINTS</Copy>
              <View style={{ flexDirection: 'row', width: '100%', marginTop: 6 * metrics.unit }}>{resultRows.slice(0, 2).map(r => <View key={r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 * metrics.unit, padding: 5 * metrics.unit, borderRightWidth: r.id === resultRows[0]?.id ? metrics.unit : 0, borderColor: '#edcc84' }}><Avatar id={r.id} size={38 * metrics.unit} /><View style={{ flex: 1 }}><Copy size={14} color={INK} lines={1} style={{ textAlign: 'left' }}>{nameOf(r.id)}</Copy><Copy size={21} color={INK} lines={1} style={{ textAlign: 'left' }}>{formatReaction(r.ms)}</Copy></View></View>)}</View>
            </View></Panel>
            <Box x={25} y={714} w={340} h={24}><Copy size={17} lines={1} color={GOLD}>YOUR SCORE: {(players.find(p=>p.id===playerId)?.score || 0) + bonusPoints}{bonusPoints > 0 ? ` · INCLUDES ${bonusPoints} BONUS` : ''}</Copy></Box>
            <Button x={35} y={749} w={320} h={68} label="BACK TO THE CHAOS" onPress={onFinish} />
          </>}
        </Animated.View>
        </ScreenMotion.Provider>
        <Box x={0} y={0} w={44} h={44}><Pressable accessibilityRole="button" accessibilityLabel="Beat Panic options" onPress={() => setShowOptions(true)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: .78 }}><Copy size={21}>•••</Copy></Pressable></Box>
      </View>
      <Modal visible={showOptions || paused} transparent animationType="fade" onRequestClose={resume}>
        <View style={{ flex: 1, backgroundColor: '#160005e8', justifyContent: 'center', alignItems: 'center', padding: 24 }}><View style={{ width: '100%', maxWidth: 390, borderRadius: 24, padding: 25, backgroundColor: INK, borderWidth: 2, borderColor: RED, gap: 18 }}>
          <Copy size={35}>TAKE A BREATHER</Copy><Copy size={17} body>{phase === 'playing' ? 'We’ll restart this chart so your timing stays fair.' : 'Thumb having a tea break?'}</Copy>
          {[['RESUME', resume], ['PLAY AGAIN', restart], ['BACK TO LOBBY', onExit]].map(([label, action]) => <Pressable key={label as string} accessibilityRole="button" onPress={action as () => void} style={{ paddingVertical: 15, borderRadius: 24, backgroundColor: '#e90636' }}><Copy size={23}>{label as string}</Copy></Pressable>)}
          <Copy size={13} color="#e9a7b5" body>Solo preview: your taps are real; {players.length - 1} {players.length === 2 ? 'rival is' : 'rivals are'} simulated.</Copy>
          {history.length > 0 && <Copy size={14} color={GOLD}>{history.length} round{history.length === 1 ? '' : 's'} recorded this game</Copy>}
        </View></View>
      </Modal>
    </Layout.Provider>
  </View>;
}
