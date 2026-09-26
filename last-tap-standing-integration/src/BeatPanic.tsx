import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Platform,Pressable,Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {DISPLAY_FONT} from './brand';
import {startBeatAudio} from './beatAudio';
import {BEAT_WINDOW,DOUBLE_GAP,BeatLane,BeatNote,beatChartForRound,beatTotal,freshBeatScore,noteComplete,recordBeat,releaseBeat,requiredTaps} from './beatPanicModel';
import {haptic} from '../../src/haptics';

const LANES=[
  {id:0 as BeatLane,name:'LEFT',rotation:'90deg',color:'#ff89c2',fill:'#ff57ae',dark:'#5b123b'},
  {id:1 as BeatLane,name:'UP',rotation:'180deg',color:'#8dfff0',fill:'#44dfdc',dark:'#075457'},
  {id:2 as BeatLane,name:'DOWN',rotation:'0deg',color:'#ffe66d',fill:'#ffc83d',dark:'#6b4800'},
  {id:3 as BeatLane,name:'RIGHT',rotation:'-90deg',color:'#a9a0ff',fill:'#7f72ff',dark:'#302268'},
];
type Judgment='perfect'|'nice'|'off'|'miss'|'wrong'|'hold';
const JUDGMENTS={
  perfect:{color:'#ffe66d',text:'PERFECT!',duration:460},nice:{color:'#8dfff0',text:'NICE!',duration:360},
  off:{color:'#ffc67d',text:'OFF BEAT',duration:300},miss:{color:'#ff7594',text:'MISSED',duration:340},
  wrong:{color:'#ff7594',text:'WRONG TAP',duration:300},hold:{color:'#a9a0ff',text:'HOLD!',duration:420},
};

export function BeatJudgmentEffect({kind,progress,reduced,size,width,top,u}:{kind:Judgment;progress:Animated.Value;reduced:boolean;size:number;width:number;top:number;u:number}){
  const effect=JUDGMENTS[kind],success=kind==='perfect'||kind==='nice'||kind==='hold';
  const opacity=progress.interpolate({inputRange:[0,.12,.6,1],outputRange:[0,1,.8,0]});
  if(reduced)return <View testID={`beat-judgment-${kind}`} pointerEvents="none" style={{position:'absolute',left:0,right:0,top:top-21*u,alignItems:'center'}}><Text style={{fontFamily:DISPLAY_FONT,fontSize:12*u,color:effect.color}}>{effect.text}</Text></View>;
  return <View testID={`beat-judgment-${kind}`} pointerEvents="none" style={{position:'absolute',left:0,top:0,width,height:'100%'}}>
    <Animated.View testID="beat-impact-glow" style={{position:'absolute',left:4*u,right:4*u,top:top-4*u,height:size+8*u,borderRadius:18*u,backgroundColor:effect.color,opacity:progress.interpolate({inputRange:[0,.15,1],outputRange:[.05,success?.2:.13,0]})}}/>
    {success&&<Animated.View testID="beat-impact-ring" style={{position:'absolute',left:(width-size)/2,top,width:size,height:size,borderRadius:size/2,borderWidth:(kind==='perfect'?2.5:1.5)*u,borderColor:effect.color,opacity,transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[.65,kind==='perfect'?1.65:1.35]})}]}}/>}
    {kind==='perfect'&&Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return <Animated.View key={i} testID="beat-perfect-spark" style={{position:'absolute',left:width/2-2*u,top:top+size/2-2*u,width:4*u,height:7*u,borderRadius:2*u,backgroundColor:i%2?'#fff5d5':effect.color,opacity,transform:[{translateX:progress.interpolate({inputRange:[0,1],outputRange:[Math.cos(a)*15*u,Math.cos(a)*42*u]})},{translateY:progress.interpolate({inputRange:[0,1],outputRange:[Math.sin(a)*15*u,Math.sin(a)*36*u]})},{rotate:`${i*60}deg`}]}}/>;})}
    <Animated.View testID="beat-impact-label" style={{position:'absolute',left:-8*u,right:-8*u,top:top-21*u,alignItems:'center',opacity,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[3*u,-7*u]})},{scale:progress.interpolate({inputRange:[0,.22,1],outputRange:[.92,kind==='perfect'?1.08:1.02,1]})}]}}><Text style={{fontFamily:DISPLAY_FONT,fontSize:12*u,color:effect.color,textShadowColor:'#160019',textShadowRadius:3}}>{effect.text}</Text></Animated.View>
  </View>;
}

export function BeatArrow({size,rotation,outline=false,color}:{size:number;rotation:string;outline?:boolean;color:string}){
  const k=size/72;
  const shape=(fill:string,inset:number)=><>
    <View style={{position:'absolute',left:(23+inset)*k,top:(5+inset)*k,width:(26-2*inset)*k,height:(34-inset)*k,backgroundColor:fill}}/>
    <View style={{position:'absolute',left:(7+inset)*k,top:35*k,width:0,height:0,borderStyle:'solid',borderLeftWidth:(29-inset)*k,borderRightWidth:(29-inset)*k,borderTopWidth:(31-inset)*k,borderLeftColor:'transparent',borderRightColor:'transparent',borderTopColor:fill}}/>
  </>;
  return <View testID={outline?'beat-arrow-target':'beat-arrow-note'} pointerEvents="none" style={{width:size,height:size,transform:[{rotate:rotation}]}}>
    <View style={{position:'absolute',top:4*k,left:0}}>{shape('#160019',0)}</View>
    {shape(outline?color:'#fff5bc',0)}{shape(outline?'#25102b':color,4)}
    {!outline&&<View style={{position:'absolute',left:29*k,top:11*k,width:5*k,height:21*k,borderRadius:3*k,backgroundColor:'#ffffffa8'}}/>}
  </View>;
}

function NoteBadge({note,u}:{note:BeatNote;u:number}){
  if(note.kind==='tap')return null;
  return <View pointerEvents="none" style={{position:'absolute',right:-5*u,top:-7*u,minWidth:25*u,height:20*u,borderRadius:11*u,borderWidth:1.5*u,borderColor:'#2a0618',backgroundColor:note.kind==='double'?'#ffe66d':'#a9a0ff',alignItems:'center',justifyContent:'center',paddingHorizontal:4*u}}><Text style={{fontFamily:DISPLAY_FONT,fontSize:10*u,color:'#260815'}}>{note.kind==='double'?'×2':'HOLD'}</Text></View>;
}

export function BeatPanic({sx,sy,round=1,finalRound=false,preview=false,paused=false,spectator=false,reduced=false,soundOn=true,onComplete}:{sx:number;sy:number;round?:number;finalRound?:boolean;preview?:boolean;paused?:boolean;spectator?:boolean;reduced?:boolean;soundOn?:boolean;monster?:unknown;onComplete:(total:number)=>void}){
  const chart=useMemo(()=>beatChartForRound(round,finalRound),[round,finalRound]);
  const [elapsed,setElapsed]=useState(0),[feedback,setFeedback]=useState('FIND YOUR RHYTHM'),[total,setTotal]=useState(0),[laneReady,setLaneReady]=useState(false),[,renderScore]=useState(0);
  const [judgments,setJudgments]=useState<({kind:Judgment;at:number}|null)[]>([null,null,null,null]);
  const readyLanes=useRef(new Set<BeatLane>()),score=useRef(freshBeatScore(chart)),start=useRef<number|null>(null),done=useRef(false),feedbackAt=useRef(0),reportedMisses=useRef(new Set<string>()),activeHolds=useRef(new Set<BeatLane>());
  const callback=useRef(onComplete);callback.current=onComplete;
  const motion=useRef(new Animated.Value(0)).current,impacts=useRef(LANES.map(()=>new Animated.Value(1))).current;
  const u=Math.min(sx,sy),travel=(spectator?250:292)*sy,noteSize=52*u,laneGap=6*sx,laneW=(350*sx-laneGap*3)/4,laneTop=83*sy,laneH=travel+noteSize+10*sy;
  const feedbackY=437,controlY=478;
  const good=feedback.startsWith('PERFECT')||feedback.startsWith('NICE')||feedback.startsWith('HOLD');
  const label=(size:number,color='#fff5d5')=>({fontFamily:DISPLAY_FONT,fontSize:size*u,lineHeight:size*u*1.1,color,textAlign:'center' as const,includeFontPadding:false});
  const showJudgment=(lane:BeatLane,kind:Judgment,at:number)=>{
    setJudgments(previous=>previous.map((value,i)=>i===lane?{kind,at}:value));
    const impact=impacts[lane];impact.stopAnimation();impact.setValue(reduced?1:0);
    if(!reduced)Animated.timing(impact,{toValue:1,duration:JUDGMENTS[kind].duration,useNativeDriver:true}).start();
  };

  useEffect(()=>()=>{impacts.forEach(impact=>impact.stopAnimation());},[impacts]);
  useEffect(()=>{
    score.current=freshBeatScore(chart);start.current=null;done.current=false;reportedMisses.current.clear();activeHolds.current.clear();
    setElapsed(0);setTotal(0);setFeedback('FIND YOUR RHYTHM');motion.setValue(0);
  },[chart,motion]);
  useEffect(()=>{
    if(paused||preview||!laneReady)return;
    let frame=0,stopAudio=()=>{};
    const update=(now:number)=>{
      if(start.current===null){start.current=now;if(soundOn)stopAudio=startBeatAudio(chart);}
      const time=Math.min(chart.duration,now-start.current);motion.setValue(time);setElapsed(time);
      if(!spectator){
        chart.notes.forEach((note,index)=>{
          for(let tapIndex=score.current.errors[index].length;tapIndex<requiredTaps(note);tapIndex++){
            const key=`${index}-tap-${tapIndex}`;
            if(time>note.at+tapIndex*DOUBLE_GAP+BEAT_WINDOW&&!reportedMisses.current.has(key)){
              reportedMisses.current.add(key);showJudgment(note.lane,'miss',time);haptic('warning');setFeedback('MISSED · +500 ms');feedbackAt.current=time;
            }
          }
          const releaseKey=`${index}-release`;
          if(note.kind==='hold'&&time>note.at+note.duration+BEAT_WINDOW&&score.current.releases[index]===null&&!reportedMisses.current.has(releaseKey)){
            reportedMisses.current.add(releaseKey);activeHolds.current.delete(note.lane);showJudgment(note.lane,'miss',time);haptic('warning');setFeedback('DROPPED HOLD · +500 ms');feedbackAt.current=time;
          }
        });
        if(time-feedbackAt.current>650)setFeedback(finalRound?'SURVIVE THE PANIC':'KEEP IT GOING');
        setTotal(beatTotal(chart,score.current,time));
      }
      if(time>=chart.duration){if(!done.current){done.current=true;callback.current(beatTotal(chart,score.current));}return;}
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);return()=>{cancelAnimationFrame(frame);stopAudio();};
  },[paused,preview,motion,laneReady,spectator,soundOn,reduced,chart,finalRound]);

  const tap=(lane:BeatLane)=>{
    if(preview||paused||!laneReady||spectator||done.current||start.current===null)return;
    const time=performance.now()-start.current;if(time>=chart.duration)return;
    const hit=recordBeat(chart,score.current,time,lane);score.current=hit.score;feedbackAt.current=time;renderScore(value=>value+1);
    if(hit.note?.kind==='hold'){activeHolds.current.add(lane);showJudgment(lane,'hold',time);haptic('medium');setFeedback('HOLD IT…');}
    else {
      const kind:Judgment=hit.error===null?'wrong':hit.error<=55?'perfect':hit.error<=120?'nice':'off';
      showJudgment(lane,kind,time);
      haptic(kind==='perfect'?'medium':kind==='nice'?'light':kind==='off'?'selection':'warning');
      setFeedback(hit.error===null?`${hit.wrongLane?'WRONG DIRECTION':'EXTRA TAP'} · +350 ms`:`${hit.error<=55?'PERFECT!':hit.error<=120?'NICE!':'OFF BEAT'} · ${hit.error} ms`);
    }
    setTotal(beatTotal(chart,score.current,time));
  };
  const release=(lane:BeatLane)=>{
    if(!activeHolds.current.has(lane)||start.current===null)return;
    const time=performance.now()-start.current,hit=releaseBeat(chart,score.current,time,lane);
    if(!hit.note)return;
    activeHolds.current.delete(lane);score.current=hit.score;renderScore(value=>value+1);feedbackAt.current=time;
    const kind:Judgment=hit.error!==null&&hit.error<=90?'perfect':hit.error!==null&&hit.error<=170?'nice':'off';
    const releaseLabel=kind==='perfect'?'PERFECT RELEASE!':kind==='nice'?'NICE RELEASE!':(hit.offset??0)<0?'EARLY RELEASE':'LATE RELEASE';
    showJudgment(lane,kind,time);haptic(kind==='perfect'?'heavy':kind==='nice'?'medium':'warning');setFeedback(`${releaseLabel} · ${hit.error} ms`);setTotal(beatTotal(chart,score.current,time));
  };

  const previewNotes:BeatNote[]=LANES.map((lane,index)=>({id:`preview-${index}`,at:300+index*250,lane:lane.id,kind:index===1&&round>=2?'double':index===2&&round>=3?'hold':'tap',duration:index===2?800:0}));
  const notes=preview?previewNotes:chart.notes;
  const webInteractionProps=Platform.OS==='web'?({onContextMenu:(event:any)=>event.preventDefault()} as any):{};
  const webNoSelect=Platform.OS==='web'?({touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',WebkitTapHighlightColor:'transparent'} as any):{};
  return <View {...webInteractionProps} testID="beat-panic-arena" style={{width:'100%',height:'100%',...webNoSelect}}>
    <View testID="beat-score-header" style={{position:'absolute',left:0,right:0,top:0,height:70*sy,borderRadius:16*u,backgroundColor:'#240914',paddingHorizontal:14*sx,justifyContent:'center'}}>
      {preview?<><Text style={label(20,'#ffe55b')}>ROUND {round} · {Math.round(chart.duration/1000)} SECONDS</Text><Text style={[label(15),{marginTop:6*sy}]}>{chart.subtitle}</Text></>:<>
        <View testID="beat-score-info" style={{position:'absolute',left:14*sx,top:11*sy,width:245*sx}}><Text style={[label(13,'#ffc5d9'),{textAlign:'left'}]}>{spectator?'ROUND IN PROGRESS':'TIMING ERROR · LOWER WINS'}</Text><Text style={[label(spectator?20:25),{textAlign:'left',marginTop:4*sy}]}>{spectator?'BEAT PANIC':total.toLocaleString()+' ms'}</Text></View>
        <View style={{position:'absolute',right:14*sx,top:18*sy}}><Text style={label(25,'#ffe55b')}>{Math.max(0,Math.ceil((chart.duration-elapsed)/1000))}s</Text></View>
        <View testID="beat-time-remaining" style={{position:'absolute',left:14*sx,right:14*sx,bottom:0,height:3*sy,overflow:'hidden'}}><View style={{height:'100%',width:`${100*(1-elapsed/chart.duration)}%`,backgroundColor:'#ffe55b'}}/></View>
      </>}
    </View>
    {LANES.map(lane=>{
      const impact=impacts[lane.id],judgment=judgments[lane.id],active=judgment&&elapsed-judgment.at<520,error=active&&(judgment.kind==='miss'||judgment.kind==='wrong');
      const left=lane.id*(laneW+laneGap);
      return <View key={lane.id} testID={`beat-lane-${lane.id}`} onLayout={({nativeEvent})=>{if(nativeEvent.layout.width>0&&nativeEvent.layout.height>0){readyLanes.current.add(lane.id);if(readyLanes.current.size===4)setLaneReady(true);}}} style={{position:'absolute',top:laneTop,left,width:laneW,height:laneH,overflow:'hidden',backgroundColor:'#160019',borderRadius:15*u,borderWidth:2*u,borderColor:lane.color,boxShadow:`0 0 17px ${lane.color}25`}}>
        <LinearGradient colors={['#240b39','#1f082c',lane.dark]} style={{position:'absolute',width:'100%',height:'100%'}}/>
        {Array.from({length:7},(_,i)=><View key={i} style={{position:'absolute',left:0,right:0,top:(i*48+(reduced?0:elapsed/18)%48)*sy,height:1,backgroundColor:'#ffb7dc1c'}}/>)}
        <LinearGradient colors={[`${lane.color}00`,`${lane.color}44`,`${lane.color}08`]} style={{position:'absolute',left:0,right:0,top:travel-10*sy,height:noteSize+22*sy}}/>
        <View style={{position:'absolute',left:5*sx,right:5*sx,top:travel+noteSize*.51,height:2*u,backgroundColor:`${lane.color}76`}}/>
        <Animated.View testID={`beat-target-${lane.id}`} style={{position:'absolute',left:(laneW-noteSize)/2,top:travel,width:noteSize,height:noteSize,transform:reduced||!active?[]:error?[{translateX:impact.interpolate({inputRange:[0,.2,.4,.6,1],outputRange:[0,-2*u,2*u,-1*u,0]})}]:[{scale:impact.interpolate({inputRange:[0,.2,1],outputRange:[1,judgment.kind==='perfect'?1.08:1.04,1]})}]}}><BeatArrow size={noteSize} rotation={lane.rotation} outline color={active?JUDGMENTS[judgment.kind].color:lane.color}/></Animated.View>
        {notes.map((note,index)=>{
          if(note.lane!==lane.id||(!preview&&noteComplete(score.current,note,index)))return null;
          const holding=!preview&&note.kind==='hold'&&score.current.errors[index].length>0&&score.current.releases[index]===null;
          const trailHeight=note.kind==='hold'?Math.max(42*u,note.duration/chart.approach*travel):0;
          const trailTop=-trailHeight+noteSize*.45;
          const liveTrail=holding?{
            top:motion.interpolate({inputRange:[note.at,note.at+note.duration],outputRange:[trailTop,noteSize*.45],extrapolate:'clamp'}),
            height:motion.interpolate({inputRange:[note.at,note.at+note.duration],outputRange:[trailHeight,0],extrapolate:'clamp'}),
            opacity:motion.interpolate({inputRange:[note.at,note.at+note.duration-40,note.at+note.duration],outputRange:[1,1,0],extrapolate:'clamp'}),
          }:{top:trailTop,height:trailHeight,opacity:1};
          return <Animated.View key={note.id} testID={`beat-note-${note.id}`} style={{position:'absolute',top:0,left:(laneW-noteSize)/2,width:noteSize,height:noteSize,transform:[{translateY:holding?travel:preview?[.12,.32,.56,.78][lane.id]*travel:motion.interpolate({inputRange:[note.at-chart.approach,note.at],outputRange:[0,travel],extrapolate:'extend'})}]}}>
            {note.kind==='hold'&&<Animated.View testID="beat-hold-trail" style={[{position:'absolute',left:noteSize*.37,width:noteSize*.26,borderRadius:9*u,borderWidth:1*u,borderColor:'#fff5d5',overflow:'hidden'},liveTrail]}><LinearGradient colors={[lane.fill,`${lane.color}aa`]} style={{position:'absolute',left:0,right:0,top:0,bottom:0}}/></Animated.View>}
            <BeatArrow size={noteSize} rotation={lane.rotation} color={lane.fill}/><NoteBadge note={note} u={u}/>
          </Animated.View>;
        })}
        {active&&<BeatJudgmentEffect kind={judgment.kind} progress={impact} reduced={reduced} size={noteSize} width={laneW} top={travel} u={u}/>}<LinearGradient colors={['#240b39','#240b3900']} style={{position:'absolute',left:0,right:0,top:0,height:13*sy}}/>
      </View>;
    })}
    {!preview&&!spectator&&<View testID="beat-feedback" accessibilityLiveRegion="polite" style={{position:'absolute',top:feedbackY*sy,left:0,right:0,height:30*sy,borderRadius:12*u,backgroundColor:'#240914',justifyContent:'center'}}><Text style={label(good?19:15,good?'#89fff1':'#fff5d5')}>{feedback}</Text></View>}
    {!spectator&&LANES.map(lane=>{const left=lane.id*(laneW+laneGap);return <Pressable {...webInteractionProps} key={lane.id} testID={`beat-tap-${lane.id}`} accessibilityRole="button" accessibilityLabel={`${lane.name.toLowerCase()} beat button`} disabled={preview||paused||!laneReady} onPressIn={()=>tap(lane.id)} onPressOut={()=>release(lane.id)} onPress={event=>{if(Platform.OS==='web'&&(event.nativeEvent as any).detail===0){tap(lane.id);release(lane.id);}}} style={({pressed})=>({position:'absolute',left,top:controlY*sy,width:laneW,height:76*sy,minHeight:44,borderRadius:18*u,padding:3*u,backgroundColor:'#fff0d5',borderWidth:2*u,borderColor:lane.color,transform:[{scale:pressed?.95:1}],boxShadow:`0 5px 0 ${lane.dark}, 0 0 18px ${lane.color}30`,...webNoSelect})}><LinearGradient colors={[lane.color,lane.fill,lane.color]} style={{flex:1,borderRadius:14*u,alignItems:'center',justifyContent:'center',borderWidth:2*u,borderColor:lane.dark}}><BeatArrow size={40*u} rotation={lane.rotation} color={lane.dark}/><Text selectable={false} style={[label(9,'#240914'),{marginTop:-4*u,...webNoSelect}]}>{lane.name}</Text></LinearGradient></Pressable>;})}
  </View>;
}
