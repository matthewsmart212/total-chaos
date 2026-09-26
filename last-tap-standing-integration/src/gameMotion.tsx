import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing} from 'react-native';

let reduceMotion: boolean | null = null;
function queryReduceMotion() {
  return AccessibilityInfo.isReduceMotionEnabled()
    .then(value => { reduceMotion = value; return value; })
    .catch(() => { reduceMotion = false; return false; });
}

/** One pausable clock: visuals and completion never race separate timeouts. */
export function useMotionClock(duration:number,paused=false,onDone?:()=>void,onTick?:(time:number)=>void,preserveReducedTiming=false) {
  const clock=useRef(new Animated.Value(0)).current;
  const elapsed=useRef(0),bucket=useRef(-1),completed=useRef(false);
  const callbacks=useRef({onDone,onTick});callbacks.current={onDone,onTick};
  const [now,setNow]=useState(0);
  const [reduced,setReduced]=useState(reduceMotion===true);
  useEffect(()=>{
    const id=clock.addListener(({value})=>{
      elapsed.current=value;callbacks.current.onTick?.(value);
      if(Math.floor(value/40)!==bucket.current){bucket.current=Math.floor(value/40);setNow(value);}
    });
    return()=>clock.removeListener(id);
  },[clock]);
  useEffect(()=>{
    if(paused||completed.current)return;
    let alive=true,animation:Animated.CompositeAnimation|undefined;
    const finish=()=>{if(!alive||completed.current)return;completed.current=true;clock.setValue(duration);setNow(duration);callbacks.current.onTick?.(duration);callbacks.current.onDone?.();};
    const start=(reducedMotionOn:boolean)=>{
      if(!alive||completed.current)return;
      setReduced(reducedMotionOn);
      if(reducedMotionOn&&!preserveReducedTiming){finish();return;}
      // JS driver so iOS listeners keep `now` and onTick in lockstep with the
      // interpolated fighter/crown motion. Native-driver clocks can stay at 0
      // here and leave the showdown frozen with invisible avatars.
      animation=Animated.timing(clock,{toValue:duration,duration:Math.max(0,duration-elapsed.current),easing:Easing.linear,useNativeDriver:false});
      animation.start(({finished})=>{if(finished)finish();});
    };
    if(reduceMotion!==null)start(reduceMotion);
    else start(false);
    void queryReduceMotion().then(value=>{
      if(!alive)return;
      setReduced(value);
      if(value&&!preserveReducedTiming){animation?.stop();finish();}
    });
    return()=>{alive=false;animation?.stop();};
  },[clock,duration,paused,preserveReducedTiming]);
  return {clock,now,reduced,complete:now>=duration};
}
