import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, FeDropShadow, Filter, G, Image as SvgImage, Polygon, Rect, Text as SvgText } from 'react-native-svg';

const background = require('./assets/last-tap/background-clean.webp');
const welcome = require('./assets/last-tap/welcome-hero.webp');

export const LAST_TAP_SPINNER_SOURCES = [background, welcome];

// Same die-cut as scripts/make-spinner-cards.mjs, in the 390x780 poster space.
const CARD_WIDTH = 390;
const CARD_HEIGHT = 780;
const SILHOUETTE = [
  [0.02, 0.07],
  [0.87, 0.01],
  [0.99, 0.05],
  [0.98, 0.94],
  [0.9, 0.99],
  [0.07, 0.97],
  [0.01, 0.93],
]
  .map(([x, y]) => `${x * CARD_WIDTH},${y * CARD_HEIGHT}`)
  .join(' ');

// Strokes are centred on the silhouette and the clip keeps the inside half.
// Visible bands on a 390-wide poster: burgundy 14, pink 5, crimson 7.
const BORDER = {
  burgundy: 52,
  pink: 24,
  crimson: 14,
};
const GLOW_PAD = 28;

type Props = {
  scale: number;
};

export default function LastTapSpinnerArtwork({ scale }: Props) {
  const pad = GLOW_PAD * scale;
  const width = CARD_WIDTH * scale + pad * 2;
  const height = CARD_HEIGHT * scale + pad * 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        Platform.OS === 'web'
          ? ({
              filter: `drop-shadow(0 0 ${7 * scale}px #ff8296) drop-shadow(0 0 ${16 * scale}px #b8003288)`,
            } as ViewStyle)
          : null,
      ]}
      testID="beat-panic-spinner-poster"
    >
      <Svg
        height={height}
        style={[styles.canvas, { height, left: -pad, top: -pad, width }]}
        viewBox={`${-GLOW_PAD} ${-GLOW_PAD} ${CARD_WIDTH + GLOW_PAD * 2} ${CARD_HEIGHT + GLOW_PAD * 2}`}
        width={width}
      >
        <Defs>
          <ClipPath id="lastTapPosterSilhouette">
            <Polygon points={SILHOUETTE} />
          </ClipPath>
          {Platform.OS !== 'web' ? (
            <Filter id="lastTapPosterGlow" x="-20%" y="-12%" width="140%" height="124%">
              <FeDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff8296" floodOpacity="0.8" />
              <FeDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#b80032" floodOpacity="0.4" />
            </Filter>
          ) : null}
        </Defs>
        <G filter={Platform.OS === 'web' ? undefined : 'url(#lastTapPosterGlow)'}>
          <G clipPath="url(#lastTapPosterSilhouette)">
            <SvgImage
              height={CARD_HEIGHT}
              href={background}
              preserveAspectRatio="xMidYMid slice"
              width={CARD_WIDTH}
              x="0"
              y="0"
            />
            <G transform="rotate(-2 195 150)">
              <Rect x="44" y="50" width="302" height="230" rx="31" fill="#39000f" stroke="#fff1ce" strokeWidth="8" />
              <Rect x="52" y="58" width="286" height="214" rx="24" fill="#d70c3f" stroke="#ff8aa8" strokeWidth="4" />
              <SvgText x="195" y="153" textAnchor="middle" fill="#26000b" stroke="#26000b" strokeWidth="8" fontSize="78" fontWeight="900">BEAT</SvgText>
              <SvgText x="195" y="153" textAnchor="middle" fill="#fff7dc" fontSize="78" fontWeight="900">BEAT</SvgText>
              <SvgText x="195" y="235" textAnchor="middle" fill="#26000b" stroke="#26000b" strokeWidth="8" fontSize="82" fontWeight="900">PANIC</SvgText>
              <SvgText x="195" y="235" textAnchor="middle" fill="#ffe34c" fontSize="82" fontWeight="900">PANIC</SvgText>
            </G>
            <Rect x="69" y="293" width="252" height="38" rx="19" fill="#26000b" />
            <SvgText x="195" y="319" textAnchor="middle" fill="#ff9dbc" fontSize="15" fontWeight="800" letterSpacing="2">MISS THE BEAT. MEET DEFEAT.</SvgText>
            <SvgImage
              height={CARD_HEIGHT * 0.43}
              href={welcome}
              preserveAspectRatio="xMidYMid meet"
              width={CARD_WIDTH}
              x="0"
              y={CARD_HEIGHT * 0.54}
            />
            <Polygon fill="none" points={SILHOUETTE} stroke="#30000d" strokeLinejoin="round" strokeWidth={BORDER.burgundy} />
            <Polygon fill="none" points={SILHOUETTE} stroke="#ff8296" strokeLinejoin="round" strokeWidth={BORDER.pink} />
            <Polygon fill="none" points={SILHOUETTE} stroke="#b80032" strokeLinejoin="round" strokeWidth={BORDER.crimson} />
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
  },
  fill: {
    bottom: 0,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
