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
  if (Platform.OS === 'web') return;
  const Haptics = require('expo-haptics') as typeof import('expo-haptics');
  const now = Date.now();
  if (now - lastHapticAt < 35) return;
  lastHapticAt = now;

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
