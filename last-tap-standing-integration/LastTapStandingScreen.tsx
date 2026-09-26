import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Platform,Pressable,Text,View} from 'react-native';
import {useFonts} from 'expo-font';
import LastTapStandingGame from './LastTapStandingGame';
import {DISPLAY_FONT_NAME,DISPLAY_FONT_SOURCE,loadWebDisplayFont} from './src/brand';

type Props=Omit<React.ComponentProps<typeof LastTapStandingGame>,'viewportWidth'|'viewportHeight'>;

/** Mount inside your app's safe-area content container. Measures available space
 * instead of assuming that the whole window is available below navigation. */
export default function LastTapStandingScreen(props:Props){
  const [size,setSize]=useState({width:0,height:0});
  const [nativeReady,nativeError]=useFonts(Platform.OS==='web'?{}:{[DISPLAY_FONT_NAME]:DISPLAY_FONT_SOURCE});
  const [webReady,setWebReady]=useState(Platform.OS!=='web');
  const [webError,setWebError]=useState(false);
  useEffect(()=>{
    if(Platform.OS!=='web')return;
    let live=true;
    loadWebDisplayFont().then(()=>{if(live)setWebReady(true);}).catch(()=>{if(live)setWebError(true);});
    return()=>{live=false;};
  },[]);
  const ready=nativeReady&&webReady&&size.width>0&&size.height>0;
  return <View style={{flex:1,backgroundColor:'#250008'}} onLayout={({nativeEvent})=>setSize({width:nativeEvent.layout.width,height:nativeEvent.layout.height})}>
    {nativeError||webError?<View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24,gap:20}}><Text style={{fontSize:18,color:'#fff7dc',textAlign:'center'}}>Could not load the game font. Check your connection and reopen the game.</Text><Pressable accessibilityRole="button" onPress={props.onExit} style={{padding:16,backgroundColor:'#ef1648',borderRadius:16}}><Text style={{fontSize:18,color:'#fff'}}>Back to app</Text></Pressable></View>:ready?<LastTapStandingGame {...props} viewportWidth={size.width} viewportHeight={size.height}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#ffe34c" accessibilityLabel="Loading Last Tap Standing"/></View>}
  </View>;
}
