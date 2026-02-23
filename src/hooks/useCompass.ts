import { useEffect, useState, useRef } from 'react';

/**
 * Returns the device's compass heading in degrees (0-360, 0 = north).
 * Uses deviceorientationabsolute when available, falls back to deviceorientation.
 * Returns null if compass is not available.
 */
export function useCompass(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const lastHeading = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHeading(null);
      return;
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      let h: number | null = null;

      // iOS provides webkitCompassHeading
      if ('webkitCompassHeading' in e) {
        h = (e as any).webkitCompassHeading as number;
      } else if (e.alpha !== null && e.absolute) {
        // Android absolute orientation: alpha is degrees from north
        h = (360 - e.alpha) % 360;
      } else if (e.alpha !== null) {
        h = (360 - e.alpha) % 360;
      }

      if (h === null) return;

      // Smooth out small jitters — only update if moved more than 2 degrees
      if (lastHeading.current !== null && Math.abs(h - lastHeading.current) < 2) return;
      lastHeading.current = h;
      setHeading(h);
    }

    // Try absolute orientation first (Android)
    const useAbsolute = 'ondeviceorientationabsolute' in window;
    const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';

    // iOS 13+ requires permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission().then((result: string) => {
        if (result === 'granted') {
          window.addEventListener(eventName, handleOrientation as EventListener);
        }
      }).catch(() => {});
    } else {
      window.addEventListener(eventName, handleOrientation as EventListener);
    }

    return () => {
      window.removeEventListener(eventName, handleOrientation as EventListener);
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener);
    };
  }, [active]);

  return heading;
}
