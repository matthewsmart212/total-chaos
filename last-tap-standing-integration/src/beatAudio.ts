import {Platform} from 'react-native';
import {BEAT_DURATION,BEAT_NOTES} from './beatPanicModel';
let context:AudioContext|null=null;
export function unlockBeatAudio(){
  if(Platform.OS!=='web'||typeof window==='undefined')return;
  const AudioCtor=window.AudioContext||(window as any).webkitAudioContext;
  if(!AudioCtor)return;
  context??=new AudioCtor();void context?.resume().catch(()=>undefined);
}
/** Schedule percussion on the audio clock, not a chain of JavaScript timers. */
export function startBeatAudio(){
  if(!context||context.state!=='running')return ()=>{};
  const ctx=context,bus=ctx.createGain(),nodes:OscillatorNode[]=[];
  bus.gain.value=.13;bus.connect(ctx.destination);
  const origin=ctx.currentTime;
  const tone=(ms:number,frequency:number,end:number,volume:number,type:OscillatorType)=>{
    const osc=ctx.createOscillator(),gain=ctx.createGain(),at=origin+ms/1000;
    osc.type=type;osc.frequency.setValueAtTime(frequency,at);
    osc.frequency.exponentialRampToValueAtTime(end,at+.09);
    gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.001,at+.12);
    osc.connect(gain);gain.connect(bus);osc.start(at);osc.stop(at+.13);nodes.push(osc);
  };
  for(let ms=0;ms<BEAT_DURATION;ms+=500)tone(ms,660,440,.08,'triangle');
  for(const note of BEAT_NOTES)tone(note.at,note.lane===0?170:340,note.lane===0?55:110,1,'sine');
  return ()=>{bus.disconnect();nodes.forEach(n=>{try{n.stop();}catch{}});};
}
