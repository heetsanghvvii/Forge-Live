/**
 * What this device can do about notifications, in words a person can act on.
 * iPhone: notifications only work from the app installed to the Home Screen (iOS 16.4 or later).
 */

export type NotifyState =
  | 'unsupported'
  | 'ios-install-needed'
  | 'default'
  | 'granted'
  | 'denied';

export interface NotifyEnv {
  userAgent: string;
  hasNotification: boolean;
  permission?: NotificationPermission;
  standalone: boolean;
}

export function isIos(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function notifyState(env: NotifyEnv): NotifyState {
  if (isIos(env.userAgent) && !env.standalone) return 'ios-install-needed';
  if (!env.hasNotification) return 'unsupported';
  if (env.permission === 'granted') return 'granted';
  if (env.permission === 'denied') return 'denied';
  return 'default';
}

export function notifyMessage(state: NotifyState): string {
  switch (state) {
    case 'ios-install-needed':
      return 'On iPhone, open Forge in Safari, tap Share, then Add to Home Screen, and open it from there. Then come back here to turn on notifications.';
    case 'unsupported':
      return 'This browser cannot show notifications. Reminders will still appear inside Forge while it is open.';
    case 'denied':
      return 'Notifications are blocked for Forge. Allow them in your phone or browser settings, then reload.';
    case 'granted':
      return 'Notifications are on. Reminders appear while Forge is open or in the background. A reminder cannot arrive if the app is fully closed.';
    default:
      return 'Turn on notifications to get reminders at the times you set.';
  }
}

export function readEnv(): NotifyEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const standalone =
    (typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches) ||
    (nav as unknown as { standalone?: boolean } | undefined)?.standalone === true;
  return {
    userAgent: nav?.userAgent ?? '',
    hasNotification: typeof Notification !== 'undefined',
    permission: typeof Notification !== 'undefined' ? Notification.permission : undefined,
    standalone,
  };
}
