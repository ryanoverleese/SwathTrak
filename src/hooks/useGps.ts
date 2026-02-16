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
        // Request permissions first (Capacitor handles native prompts)
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          setState((s) => ({ ...s, error: 'Location permission denied' }));
          return;
        }
      } catch {
        // Browser environment may not support requestPermissions - continue anyway
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
