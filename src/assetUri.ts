import { Image, ImageSourcePropType } from 'react-native';

function asUri(value: string | undefined): string | undefined {
  return value ? value.replace(/\\/g, '/') : undefined;
}

export function assetUri(source: ImageSourcePropType): string | undefined {
  if (typeof source === 'string') return asUri(source);
  if (source && typeof source === 'object') {
    const value = source as { uri?: string; default?: string };
    if (typeof value.uri === 'string') return asUri(value.uri);
    if (typeof value.default === 'string') return asUri(value.default);
  }
  if (typeof Image.resolveAssetSource === 'function') {
    try {
      return asUri(Image.resolveAssetSource(source)?.uri);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
