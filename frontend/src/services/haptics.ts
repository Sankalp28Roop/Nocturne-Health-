import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const hapticFeedback = {
  // Light impact for button clicks, tab switching, chips
  light: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics not available in pure browser, silent fallback
    }
  },

  // Medium impact for drawer snaps, toggle switches, modal opens
  medium: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  },

  // Heavy impact for workout start/stop, critical actions
  heavy: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  },

  // Double pulse for goal reached / milestone (Medium + Heavy)
  milestone: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      setTimeout(async () => {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch {}
      }, 140);
    } catch {}
  },

  // Soft notification for success (save, record, cheer)
  success: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  }
};
