import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { apiFetch } from './account';
import { HEARTBEAT_MS } from './admin/presence';

/**
 * Tells the server "still here" every HEARTBEAT_MS while the app is on screen, for the admin's online and
 * visit numbers. Only the platform and the current screen are sent; nothing while the app is in the background.
 */
export function PresencePing() {
  const pathname = usePathname();
  const screen = useRef(pathname);
  screen.current = pathname;

  useEffect(() => {
    const beat = () => {
      // On web, AppState follows the tab's visibility.
      if (AppState.currentState === 'active') apiFetch('/api/presence', { body: { platform: Platform.OS, screen: screen.current } }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    // Coming back to the app counts right away instead of at the next tick.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && beat());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return null;
}
