import { useEffect, useRef, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { GpsPoint } from '../types';

interface GpsState {
  position: GpsPoint | null;
  error: string | null;
  accuracy: number | null;
}

export function useGps(active: boolean) {
  const [state, setState] = useState<GpsState>({
    position: null,
    error: null,
    accuracy: null,
  });
  const watchId = useRef<string | null>(null);

  const stop = useCallback(async () => {
    if (watchId.current !== null) {
      try {
        await Geolocation.clearWatch({ id: watchId.current });
      } catch {
        // ignore
      }
      watchId.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    async function startWatch() {
      try {
        // Only request permissions through Capacitor on native platforms.
        // In a browser/PWA, the browser handles its own permission prompt
        // via watchPosition, and Capacitor's requestPermissions() falsely
        // reports 'denied'.
        if ((window as any).Capacitor?.isNativePlatform()) {
          const perm = await Geolocation.requestPermissions();
          if (perm.location === 'denied') {
            setState((s) => ({ ...s, error: 'Location permission denied' }));
            return;
          }
        }
      } catch {
        // Continue to watchPosition which will trigger the browser prompt
      }

      try {
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000,
          },
          (position, err) => {
            if (cancelled) return;
            if (err) {
              setState((s) => ({ ...s, error: err.message }));
              return;
            }
            if (position) {
              setState({
                position: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  timestamp: position.timestamp,
                },
                error: null,
                accuracy: position.coords.accuracy,
              });
            }
          }
        );

        if (!cancelled) {
          watchId.current = id;
        } else {
          await Geolocation.clearWatch({ id });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : 'GPS error',
          }));
        }
      }
    }

    startWatch();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return state;
}
