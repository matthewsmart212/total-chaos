import { Platform } from 'react-native';

export type HapticCue =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

let lastHapticAt = 0;

export function haptic(cue: HapticCue) {
  const now = Date.now();
  if (now - lastHapticAt < 35) return;
  lastHapticAt = now;

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const pattern =
      cue === 'heavy' || cue === 'error'
        ? [32, 24, 38]
        : cue === 'success'
          ? [18, 28, 34]
          : cue === 'warning'
            ? [26, 22, 26]
            : cue === 'medium'
              ? 24
              : cue === 'selection'
                ? 8
                : 14;
    try { navigator.vibrate(pattern); } catch { /* Unsupported web haptics stay silent. */ }
    return;
  }

  const Haptics = require('expo-haptics') as typeof import('expo-haptics');

  const action =
    cue === 'selection'
      ? Haptics.selectionAsync()
      : cue === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : cue === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : cue === 'error'
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            : Haptics.impactAsync(
                cue === 'heavy'
                  ? Haptics.ImpactFeedbackStyle.Heavy
                  : cue === 'medium'
                    ? Haptics.ImpactFeedbackStyle.Medium
                    : Haptics.ImpactFeedbackStyle.Light,
              );

  void action.catch(() => undefined);
}
