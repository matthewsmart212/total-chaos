import React,{useEffect,useRef,useState} from 'react';
import {Animated,Image,ImageSourcePropType,Platform,Pressable,Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {DISPLAY_FONT} from './brand';
import {startBeatAudio} from './beatAudio';
import {BEAT_APPROACH,BEAT_DURATION,BEAT_NOTES,BEAT_WINDOW,BeatLane,beatTotal,freshBeatScore,recordBeat} from './beatPanicModel';

const LANES=[{id:0 as BeatLane,name:'LEFT',color:'#ff89c2',fill:'#ff57ae',dark:'#5b123b'},{id:1 as BeatLane,name:'RIGHT',color:'#8dfff0',fill:'#44dfdc',dark:'#075457'}];
const PREVIEW_NOTES=[{at:300,lane:0},{at:800,lane:1},{at:1300,lane:0},{at:1600,lane:1}];
type Judgment='perfect'|'nice'|'off'|'miss'|'wrong';
const JUDGMENTS={perfect:{color:'#ffe66d',text:'PERFECT!',duration:460},nice:{color:'#8dfff0',text:'NICE!',duration:360},off:{color:'#ffc67d',text:'OFF BEAT',duration:300},miss:{color:'#ff7594',text:'MISSED',duration:340},wrong:{color:'#ff7594',text:'WRONG TAP',duration:300}};

// Feedback stays around the receptor, never obscuring incoming notes or moving the lane.
export function BeatJudgmentEffect({kind,progress,reduced,size,width,top,u}:{kind:Judgment;progress:Animated.Value;reduced:boolean;size:number;width:number;top:number;u:number}){
  const effect=JUDGMENTS[kind],success=kind==='perfect'||kind==='nice';
  const opacity=progress.interpolate({inputRange:[0,.12,.6,1],outputRange:[0,1,.8,0]});
  if(reduced)return <View testID={`beat-judgment-${kind}`} pointerEvents="none" style={{position:'absolute',left:0,right:0,top:top-23*u,alignItems:'center'}}><Text style={{fontFamily:DISPLAY_FONT,fontSize:14*u,color:effect.color}}>{effect.text}</Text></View>;
  return <View testID={`beat-judgment-${kind}`} pointerEvents="none" style={{position:'absolute',left:0,top:0,width,height:'100%'}}>
    <Animated.View testID="beat-impact-glow" style={{position:'absolute',left:8*u,right:8*u,top:top-5*u,height:size+10*u,borderRadius:22*u,backgroundColor:effect.color,opacity:progress.interpolate({inputRange:[0,.15,1],outputRange:[.05,success?.18:.13,0]})}}/>
    {success&&<Animated.View testID="beat-impact-ring" style={{position:'absolute',left:(width-size)/2,top,width:size,height:size,borderRadius:size/2,borderWidth:(kind==='perfect'?2.5:1.5)*u,borderColor:effect.color,opacity,transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[.65,kind==='perfect'?1.65:1.35]})}]}}/>}
    {kind==='perfect'&&Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return <Animated.View key={i} testID="beat-perfect-spark" style={{position:'absolute',left:width/2-2*u,top:top+size/2-2*u,width:4*u,height:7*u,borderRadius:2*u,backgroundColor:i%2?'#fff5d5':effect.color,opacity,transform:[{translateX:progress.interpolate({inputRange:[0,1],outputRange:[Math.cos(a)*20*u,Math.cos(a)*57*u]})},{translateY:progress.interpolate({inputRange:[0,1],outputRange:[Math.sin(a)*20*u,Math.sin(a)*44*u]})},{rotate:`${i*60}deg`}]}}/>;})}
    <Animated.View testID="beat-impact-label" style={{position:'absolute',left:0,right:0,top:top-23*u,alignItems:'center',opacity,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[3*u,-8*u]})},{scale:progress.interpolate({inputRange:[0,.22,1],outputRange:[.92,kind==='perfect'?1.08:1.02,1]})}]}}><Text style={{fontFamily:DISPLAY_FONT,fontSize:14*u,color:effect.color,textShadowColor:'#160019',textShadowRadius:3}}>{effect.text}</Text></Animated.View>
  </View>;
}
// Native geometry keeps critical gameplay cues independent of image decoding.
function BeatArrow({size,outline=false,color}:{size:number;outline?:boolean;color:string}){
  const k=size/72;
  const shape=(fill:string,inset:number)=><>
    <View style={{position:'absolute',left:(23+inset)*k,top:(5+inset)*k,width:(26-2*inset)*k,height:(34-inset)*k,backgroundColor:fill}}/>
    <View style={{position:'absolute',left:(7+inset)*k,top:35*k,width:0,height:0,borderStyle:'solid',borderLeftWidth:(29-inset)*k,borderRightWidth:(29-inset)*k,borderTopWidth:(31-inset)*k,borderLeftColor:'transparent',borderRightColor:'transparent',borderTopColor:fill}}/>
  </>;
  return <View testID={outline?'beat-arrow-target':'beat-arrow-note'} pointerEvents="none" style={{width:size,height:size}}>
    <View style={{position:'absolute',top:4*k,left:0}}>{shape('#160019',0)}</View>
    {shape(outline?color:'#fff5bc',0)}{shape(outline?'#25102b':color,4)}
    {!outline&&<View style={{position:'absolute',left:29*k,top:11*k,width:5*k,height:21*k,borderRadius:3*k,backgroundColor:'#ffffffa8'}}/>}
  </View>;
}
export function BeatPanic({sx,sy,preview=false,paused=false,spectator=false,reduced=false,soundOn=true,monster,onComplete}:{sx:number;sy:number;preview?:boolean;paused?:boolean;spectator?:boolean;reduced?:boolean;soundOn?:boolean;monster:ImageSourcePropType;onComplete:(total:number)=>void}){
  const [elapsed,setElapsed]=useState(0),[feedback,setFeedback]=useState('FIND YOUR RHYTHM'),[total,setTotal]=useState(0),[laneReady,setLaneReady]=useState(false);
  const [judgments,setJudgments]=useState<({kind:Judgment;at:number}|null)[]>([null,null]);
  const readyLanes=useRef(new Set<BeatLane>()),score=useRef(freshBeatScore()),start=useRef<number|null>(null),done=useRef(false),lastMiss=useRef(-1),feedbackAt=useRef(0);
  const callback=useRef(onComplete);callback.current=onComplete;
  const motion=useRef(new Animated.Value(0)).current,impacts=useRef([new Animated.Value(1),new Animated.Value(1)]).current;
  const u=Math.min(sx,sy),travel=(spectator?190:240)*sy,noteSize=80*u,laneW=169*sx,laneTop=90*sy,laneH=travel+noteSize+14*sy;
  const feedbackY=434,controlY=preview?440:476;
  const hitCount=score.current.errors.filter(e=>e!==null).length,good=feedback.startsWith('PERFECT')||feedback.startsWith('NICE');
  const label=(size:number,color='#fff5d5')=>({fontFamily:DISPLAY_FONT,fontSize:size*u,lineHeight:size*u*1.1,color,textAlign:'center' as const,includeFontPadding:false});
  const showJudgment=(lane:BeatLane,kind:Judgment,at:number)=>{
    setJudgments(previous=>previous.map((value,i)=>i===lane?{kind,at}:value));
    const impact=impacts[lane];impact.stopAnimation();impact.setValue(reduced?1:0);
    if(!reduced)Animated.timing(impact,{toValue:1,duration:JUDGMENTS[kind].duration,useNativeDriver:true}).start();
  };
  useEffect(()=>()=>{impacts.forEach(impact=>impact.stopAnimation());},[impacts]);
  useEffect(()=>{
    if(paused||preview||!laneReady)return;
    let frame=0,stopAudio=()=>{};
    const update=(now:number)=>{
      if(start.current===null){start.current=now;if(soundOn)stopAudio=startBeatAudio();}
      const time=Math.min(BEAT_DURATION,now-start.current);motion.setValue(time);setElapsed(time);
      if(!spectator){
        const missed=BEAT_NOTES.findLastIndex((note,i)=>time>note.at+BEAT_WINDOW&&score.current.errors[i]===null);
        if(missed>lastMiss.current){
          for(let i=lastMiss.current+1;i<=missed;i++)if(score.current.errors[i]===null)showJudgment(BEAT_NOTES[i].lane,'miss',time);
          lastMiss.current=missed;setFeedback('MISSED · +500 ms');feedbackAt.current=time;
        }
        if(time-feedbackAt.current>650)setFeedback('KEEP IT GOING');
        setTotal(beatTotal(score.current,time));
      }
      if(time>=BEAT_DURATION){if(!done.current){done.current=true;callback.current(beatTotal(score.current));}return;}
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);return()=>{cancelAnimationFrame(frame);stopAudio();};
  },[paused,preview,motion,laneReady,spectator,soundOn,reduced]);
  const tap=(lane:BeatLane)=>{
    if(preview||paused||!laneReady||spectator||done.current||start.current===null)return;
    const time=performance.now()-start.current;if(time>=BEAT_DURATION)return;
    const hit=recordBeat(score.current,time,lane);score.current=hit.score;feedbackAt.current=time;
    showJudgment(lane,hit.error===null?'wrong':hit.error<=55?'perfect':hit.error<=120?'nice':'off',time);
    setFeedback(hit.error===null?`${hit.wrongLane?'WRONG SIDE':'EXTRA TAP'} · +350 ms`:`${hit.error<=55?'PERFECT!':hit.error<=120?'NICE!':'OFF BEAT'} · ${hit.error} ms`);
    setTotal(beatTotal(score.current,time));
  };
  const notes=preview?PREVIEW_NOTES:BEAT_NOTES;
  return <View testID="beat-panic-arena" style={{width:'100%',height:'100%'}}>
    <View testID="beat-score-header" style={{position:'absolute',left:0,right:0,top:0,height:72*sy,borderRadius:16*u,backgroundColor:'#240914',paddingHorizontal:18*sx,justifyContent:'center'}}>
      {preview?<><Text style={label(22,'#ffe55b')}>20 SECONDS · 28 BEATS</Text><Text style={[label(18),{marginTop:7*sy}]}>Tap when the arrows overlap.</Text></>:<>
        <View testID="beat-score-info" style={{position:'absolute',left:18*sx,top:13*sy,width:200*sx}}>
          <Text style={[label(15,'#ffc5d9'),{textAlign:'left'}]}>{spectator?'ROUND IN PROGRESS':'TIMING ERROR'}</Text>
          <Text style={[label(spectator?24:30),{textAlign:'left',marginTop:4*sy}]}>{spectator?'BEAT PANIC':total.toLocaleString()+' ms'}</Text>
        </View>
        <View style={{position:'absolute',right:18*sx,top:20*sy}}><Text style={label(29,'#ffe55b')}>{Math.max(0,Math.ceil((BEAT_DURATION-elapsed)/1000))}s</Text></View>
        <View testID="beat-time-remaining" style={{position:'absolute',left:14*sx,right:14*sx,bottom:0,height:3*sy,overflow:'hidden'}}><View style={{height:'100%',width:`${100*(1-elapsed/BEAT_DURATION)}%`,backgroundColor:'#ffe55b'}}/></View>
      </>}
    </View>
    {LANES.map(lane=>{
      const impact=impacts[lane.id],judgment=judgments[lane.id];
      const active=judgment&&elapsed-judgment.at<500;
      const error=active&&(judgment.kind==='miss'||judgment.kind==='wrong');
      return <View key={lane.id} testID={`beat-lane-${lane.id}`} onLayout={({nativeEvent})=>{if(nativeEvent.layout.width>0&&nativeEvent.layout.height>0){readyLanes.current.add(lane.id);if(readyLanes.current.size===2)setLaneReady(true);}}} style={{position:'absolute',top:laneTop,left:lane.id*181*sx,width:laneW,height:laneH,overflow:'hidden',backgroundColor:'#160019',borderRadius:18*u,borderWidth:2*u,borderColor:lane.color,boxShadow:`0 0 20px ${lane.color}25`}}>
        <LinearGradient colors={['#240b39','#1f082c',lane.dark]} style={{position:'absolute',width:'100%',height:'100%'}}/>
        {[.25,.5,.75].map(x=><View key={x} style={{position:'absolute',left:laneW*x,top:0,bottom:0,width:1,backgroundColor:'#ffb7dc10'}}/>)}
        {Array.from({length:7},(_,i)=><View key={i} style={{position:'absolute',left:0,right:0,top:(i*48+(reduced?0:elapsed/18)%48)*sy,height:1,backgroundColor:'#ffb7dc1c'}}/>)}
        <LinearGradient colors={[`${lane.color}00`,`${lane.color}44`,`${lane.color}08`]} style={{position:'absolute',left:0,right:0,top:travel-14*sy,height:noteSize+30*sy}}/>
        <View style={{position:'absolute',left:8*sx,right:8*sx,top:travel+noteSize*.51,height:2*u,backgroundColor:`${lane.color}76`}}/>
        <Animated.View testID={`beat-target-${lane.id}`} style={{position:'absolute',left:(laneW-noteSize)/2,top:travel,width:noteSize,height:noteSize,transform:reduced||!active?[]:error?[{translateX:impact.interpolate({inputRange:[0,.2,.4,.6,1],outputRange:[0,-2*u,2*u,-1*u,0]})}]:[{scale:impact.interpolate({inputRange:[0,.2,1],outputRange:[1,judgment.kind==='perfect'?1.08:1.04,1]})}]}}><BeatArrow size={noteSize} outline color={active?JUDGMENTS[judgment.kind].color:lane.color}/></Animated.View>
        {notes.map((note,i)=>note.lane!==lane.id||(!preview&&score.current.errors[i]!==null)?null:<Animated.View key={i} testID={`beat-note-${i}`} style={{position:'absolute',top:0,left:(laneW-noteSize)/2,width:noteSize,height:noteSize,transform:[{translateY:preview?[.12,.3,.68,.84][i]*travel:motion.interpolate({inputRange:[note.at-BEAT_APPROACH,note.at],outputRange:[0,travel],extrapolate:'extend'})}]}}>
          <LinearGradient colors={[`${lane.color}00`,`${lane.color}44`]} style={{position:'absolute',left:noteSize*.34,top:-24*u,width:noteSize*.32,height:36*u}}/><BeatArrow size={noteSize} color={lane.fill}/>
        </Animated.View>)}
        {active&&<BeatJudgmentEffect kind={judgment.kind} progress={impact} reduced={reduced} size={noteSize} width={laneW} top={travel} u={u}/>}
        <LinearGradient colors={['#240b39','#240b3900']} style={{position:'absolute',left:0,right:0,top:0,height:15*sy}}/>
      </View>;
    })}
    {!preview&&!spectator&&<View testID="beat-feedback" accessibilityLiveRegion={spectator?'none':'polite'} style={{position:'absolute',top:feedbackY*sy,left:0,right:0,height:32*sy,borderRadius:12*u,backgroundColor:'#240914',justifyContent:'center'}}><Text style={label(good&&!spectator?24:18,good&&!spectator?'#89fff1':'#fff5d5')}>{spectator?'Two thumbs. Absolutely no chill.':feedback}</Text></View>}
    {!spectator&&LANES.map(lane=><Pressable key={lane.id} testID={`beat-tap-${lane.id}`} accessibilityRole="button" accessibilityLabel={`Tap ${lane.name.toLowerCase()} lane`} disabled={preview||paused||!laneReady} onPressIn={()=>tap(lane.id)} onPress={event=>{if(Platform.OS==='web'&&(event.nativeEvent as any).detail===0)tap(lane.id);}} style={({pressed})=>({position:'absolute',left:lane.id*181*sx,top:controlY*sy,width:laneW,height:76*sy,minHeight:44,borderRadius:22*u,padding:3*u,backgroundColor:'#fff0d5',borderWidth:2*u,borderColor:lane.color,transform:[{scale:pressed?.96:1}],boxShadow:`0 5px 0 ${lane.dark}, 0 0 22px ${lane.color}30`,...(Platform.OS==='web'?{touchAction:'none',userSelect:'none'} as any:{})})}><LinearGradient colors={[lane.color,lane.fill,lane.color]} style={{flex:1,borderRadius:18*u,alignItems:'center',justifyContent:'center',borderWidth:2*u,borderColor:lane.dark}}><Text style={[label(33,'#240914')]}>{lane.name}</Text></LinearGradient></Pressable>)}
  </View>;
}
