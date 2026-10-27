import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

/** Hold the screen on only during spraying; serialize native start/stop calls. */
export function useKeepAwake(active: boolean) {
  const pending = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let nativeHeld = false;
    let webLock: WakeLockSentinel | null = null;

    const enqueue = (operation: () => Promise<void>) => {
      pending.current = pending.current.then(operation).catch((error: unknown) => {
        console.warn('Unable to update screen wake lock', error);
      });
    };

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (Capacitor.isNativePlatform() && !nativeHeld) {
        try {
          await KeepAwake.keepAwake();
          nativeHeld = true;
        } catch (error) {
          console.warn('Native keep-awake unavailable; trying web wake lock', error);
        }
      }
      if (!nativeHeld && (!webLock || webLock.released) && 'wakeLock' in navigator) {
        webLock = await navigator.wakeLock.request('screen');
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') enqueue(acquire);
    };

    enqueue(acquire);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      // A late acquisition must finish before release, including on rapid toggles
      // and React StrictMode's setup/cleanup cycle.
      enqueue(async () => {
        if (nativeHeld) await KeepAwake.allowSleep();
        if (webLock && !webLock.released) await webLock.release();
      });
    };
  }, [active]);
}
