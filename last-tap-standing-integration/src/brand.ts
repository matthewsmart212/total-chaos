import { Image, Platform } from 'react-native';

export const DISPLAY_FONT_NAME = 'TotalChaosLilita';
export const DISPLAY_FONT_CSS = `"${DISPLAY_FONT_NAME}", "Arial Rounded MT Bold", "Arial Black", sans-serif`;
export const DISPLAY_FONT = Platform.OS === 'web' ? DISPLAY_FONT_CSS : DISPLAY_FONT_NAME;
export const BODY_FONT = Platform.OS === 'web'
  ? '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif'
  : 'System';
// Keep the font on the same first-party asset path as our images. Some hosting
// filters treat URLs containing node_modules as source rather than public assets.
export const DISPLAY_FONT_SOURCE = require('../assets/fonts/LilitaOne-Regular.ttf');

let webFontPromise: Promise<void> | undefined;

// Await the actual font bytes on Safari too; registering @font-face alone is
// not enough to prevent a whole round being measured with a fallback font.
export function loadWebDisplayFont(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  if (!webFontPromise) {
    const uri = typeof DISPLAY_FONT_SOURCE === 'string' ? DISPLAY_FONT_SOURCE
      : typeof DISPLAY_FONT_SOURCE === 'number' ? Image.resolveAssetSource(DISPLAY_FONT_SOURCE).uri
      : DISPLAY_FONT_SOURCE.uri ?? DISPLAY_FONT_SOURCE.default;
    webFontPromise = new FontFace(DISPLAY_FONT_NAME, `url(${JSON.stringify(uri)})`, {
      style: 'normal', weight: '400', display: 'swap',
    }).load().then(face => { document.fonts.add(face); }).catch(error => {
      webFontPromise = undefined;
      throw error;
    });
  }
  return webFontPromise;
}
