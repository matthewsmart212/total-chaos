import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
let reduceMotion: boolean | null = null;
function queryReduceMotion() {
  return AccessibilityInfo.isReduceMotionEnabled()
    .then(value => { reduceMotion = value; return value; })
    .catch(() => { reduceMotion = false; return false; });
}

/**
 * One pausable clock per entrance. The value lives on the UI thread; React only
 * re-renders once, when the entrance completes, so a screen full of entrances
 * never floods the JS thread while it is still mounting.
 */
export function useMotionClock(duration:number,paused=false,onDone?:()=>void) {
  const clock=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0),completed=useRef(false);
  const onDoneRef=useRef(onDone);onDoneRef.current=onDone;
  const [complete,setComplete]=useState(false);
  const [reduced,setReduced]=useState(reduceMotion===true);
  useEffect(()=>{
    if(reduceMotion!==null)return;
    let alive=true;
    void queryReduceMotion().then(value=>{if(alive&&value)setReduced(true);});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(paused||completed.current)return;
    let alive=true;
    const from=elapsed.current,startedAt=Date.now();
    const finish=()=>{if(!alive||completed.current)return;completed.current=true;elapsed.current=duration;setComplete(true);onDoneRef.current?.();};
    if(reduceMotion===true){clock.setValue(duration);finish();return;}
    const animation=Animated.timing(clock,{toValue:duration,duration:Math.max(0,duration-from),easing:Easing.linear,useNativeDriver:true});
    animation.start(({finished})=>{if(finished)finish();});
    return()=>{alive=false;animation.stop();if(!completed.current)elapsed.current=Math.min(duration,from+Date.now()-startedAt);};
  },[clock,duration,paused]);
  return {clock,reduced,complete};
}

export function Arrival({children,delay=0,paused=false,kind='rise',onDone}:{children:ReactNode;delay?:number;paused?:boolean;kind?:'rise'|'slap'|'pop';onDone?:()=>void}) {
  const {clock,complete,reduced}=useMotionClock(delay+700,paused,onDone);
  const v=(times:number[],values:any[])=>clock.interpolate({inputRange:times.map(t=>t+delay),outputRange:values,extrapolate:'clamp'});
  return <Animated.View testID={`arrival-${kind}`} pointerEvents={complete?'box-none':'none'} accessibilityElementsHidden={!complete} importantForAccessibility={complete?'auto':'no-hide-descendants'} style={[StyleSheet.absoluteFill,{
    opacity:complete?1:v([0,180],[0,1]),
    transform:complete||reduced?[]:[{translateY:v([0,450,700],[kind==='slap'?-65:45,-3,0])},{scale:v([0,450,700],[kind==='pop'?.65:kind==='slap'?1.13:.96,1.015,1])},{rotate:v([0,450,700],[kind==='slap'?'-5deg':'0deg','0.7deg','0deg'])}],
  }]}>{children}</Animated.View>;
}

// Leg one: the card lifts toward the viewer while a disc irises shut over the
// spinner. The disc is fully closed at COVER_AT.
const COVER_AT = 900;
// Leg two: hold, then dissolve the disc to reveal Meme Master.
const TELEPORT_MS = 1500;

/**
 * Full-screen warp into Meme Master. Runs entirely on the UI thread in two
 * legs: 0 -> COVER_AT (spinner still visible, disc closes over it), then, only
 * once the parent reports the new screen has committed, COVER_AT -> end (hold
 * and dissolve). Holding on the cover means a slow mount on a phone lengthens
 * the blackout by a few frames instead of revealing a half-built screen.
 * `onReveal` fires as the dissolve starts so the destination's entrance
 * animations play under the lifting cover rather than after it.
 */
type WarpGame = 'memeMaster' | 'lastTapStanding';
const WARP: Record<WarpGame, { disc: string; label: string; ring: readonly [string, string]; testID: string; wash: string }> = {
  memeMaster: { disc: '#020444', label: 'Entering Meme Master', ring: ['#37f5ff', '#a34bff'], testID: 'meme-teleport', wash: '#070334' },
  lastTapStanding: { disc: '#250008', label: 'Entering Last Tap Standing', ring: ['#ff8296', '#b80032'], testID: 'last-tap-teleport', wash: '#1a0008' },
};

export function MemeTeleport({width,height,revealReady,onCovered,onReveal,onDone,game='memeMaster',card}:{width:number;height:number;revealReady:boolean;onCovered:()=>void;onReveal?:()=>void;onDone:()=>void;game?:WarpGame;card?:ReactNode}) {
  const clock=useRef(new Animated.Value(0)).current;
  const covered=useRef(false);
  const revealing=useRef(false);
  const callbacks=useRef({onCovered,onReveal,onDone});
  callbacks.current={onCovered,onReveal,onDone};

  useEffect(()=>{
    const animation=Animated.timing(clock,{toValue:COVER_AT,duration:COVER_AT,easing:Easing.linear,useNativeDriver:true});
    animation.start(({finished})=>{
      if(!finished)return;
      covered.current=true;
      callbacks.current.onCovered();
    });
    return()=>animation.stop();
  },[clock]);

  useEffect(()=>{
    if(!revealReady||!covered.current||revealing.current)return;
    revealing.current=true;
    let animation:Animated.CompositeAnimation|undefined;
    // One frame so the freshly committed screen has painted under the cover.
    const frame=requestAnimationFrame(()=>{
      callbacks.current.onReveal?.();
      animation=Animated.timing(clock,{toValue:TELEPORT_MS,duration:TELEPORT_MS-COVER_AT,easing:Easing.linear,useNativeDriver:true});
      animation.start(({finished})=>{if(finished)callbacks.current.onDone();});
    });
    return()=>{cancelAnimationFrame(frame);animation?.stop();};
  },[clock,revealReady]);

  // The clock is linear; easing lives in these keyframes so every layer stays
  // in lockstep on the UI thread.
  const v=(inputRange:number[],outputRange:any[])=>clock.interpolate({inputRange,outputRange,extrapolate:'clamp'});
  // Just large enough to cover the screen corners at scale 1. iOS only draws a
  // rounded border with CoreAnimation when the view clips its bounds; without
  // `overflow: 'hidden'` it rasterises a bitmap the size of the view instead,
  // which for a screen-sized disc is a main-thread stall on every layout.
  const diameter=Math.hypot(width,height)*1.06;
  const shape={overflow:'hidden' as const,position:'absolute' as const};
  const ringSize=Math.min(width,height)*.7;
  const ring=(i:number)=>(
    <Animated.View
      key={i}
      pointerEvents="none"
      style={{
        ...shape,
        width:ringSize,
        height:ringSize,
        borderRadius:ringSize/2,
        borderWidth:4+i*3,
        borderColor:WARP[game].ring[i] ?? WARP[game].ring[0],
        opacity:v([i*110,260+i*110,700,COVER_AT],[0,.9,.45,0]),
        transform:[{scale:v([0,320,640,COVER_AT],[.18,.9+i*.35,2.6+i*.6,4.2+i*.8])}],
      }}
    />
  );
  const theme = WARP[game];
  const content=<View testID={theme.testID} accessibilityLabel={theme.label} pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:20000,overflow:'hidden',alignItems:'center',justifyContent:'center',...(Platform.OS==='web'?{position:'fixed'} as any:{})}]}>
    <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:theme.wash,opacity:v([0,320,COVER_AT,1380],[0,.6,.6,0])}]}/>
    {[0,1].map(ring)}
    <Animated.View style={{width:width*.38,height:width*.74,opacity:v([0,120,560,820],[0,1,1,0]),transform:[{translateY:v([0,COVER_AT],[0,-height*.06])},{scale:v([0,200,520,COVER_AT],[1,1.04,1.28,2.9])},{rotate:v([0,COVER_AT],['0deg','-6deg'])}]}}>
      {card ?? <Image source={require('../assets/packed/spinner/poses/meme-master-flat.webp')} resizeMode="contain" style={{position:'absolute',left:'-14%',top:'-7%',width:'128%',height:'114%'}}/>}
    </Animated.View>
    <Animated.View style={{...shape,width:diameter,height:diameter,borderRadius:diameter/2,backgroundColor:theme.disc,borderWidth:10,borderColor:theme.ring[0],opacity:v([0,540,600,1000,1150,1300,1450],[0,0,1,1,.55,.2,0]),transform:[{scale:v([0,540,640,740,820,COVER_AT,TELEPORT_MS],[.02,.02,.12,.38,.72,1,1.05])}]}}/>
  </View>;
  return Platform.OS==='web'&&typeof document!=='undefined'?require('react-dom').createPortal(content,document.body):content;
}
