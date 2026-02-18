import { useState, useCallback, useContext, useEffect, useRef, createContext } from 'react';

// ── Unit System ──────────────────────────────
export type UnitSystem = 'imperial' | 'metric';
export const UnitSystemContext = createContext<UnitSystem>('imperial');

const SYSTEM_KEY = 'swathtrack_unit_system';

export function loadUnitSystem(): UnitSystem {
  try {
    if (localStorage.getItem(SYSTEM_KEY) === 'metric') return 'metric';
  } catch {}
  return 'imperial';
}

export function saveUnitSystem(system: UnitSystem) {
  localStorage.setItem(SYSTEM_KEY, system);
}

// ── Area ──────────────────────────────────────
export type AreaUnit = 'ac' | 'ft²' | 'ha' | 'm²';
const AREA_IMP: readonly AreaUnit[] = ['ac', 'ft²'];
const AREA_MET: readonly AreaUnit[] = ['ha', 'm²'];

export function formatArea(acres: number, unit: AreaUnit): string {
  switch (unit) {
    case 'ha': return `${(acres * 0.404686).toFixed(2)} ha`;
    case 'ft²': return `${Math.round(acres * 43560).toLocaleString()} ft²`;
    case 'm²': return `${Math.round(acres * 4046.86).toLocaleString()} m²`;
    default: return `${acres.toFixed(2)} ac`;
  }
}

// ── Speed ─────────────────────────────────────
export type SpeedUnit = 'mph' | 'km/h';
const SPEED_IMP: readonly SpeedUnit[] = ['mph'];
const SPEED_MET: readonly SpeedUnit[] = ['km/h'];

export function formatSpeed(mph: number, unit: SpeedUnit): string {
  if (unit === 'km/h') return `${(mph * 1.60934).toFixed(1)} km/h`;
  return `${mph.toFixed(1)} mph`;
}

// ── Rate ──────────────────────────────────────
export type RateUnit = 'gal/ac' | 'oz/ac' | 'pt/ac' | 'L/ha' | 'mL/ha';
const RATE_IMP: readonly RateUnit[] = ['gal/ac', 'oz/ac', 'pt/ac'];
const RATE_MET: readonly RateUnit[] = ['L/ha', 'mL/ha'];

export function formatRate(gallons: number, acres: number, unit: RateUnit): string {
  if (acres <= 0) return `-- ${unit}`;
  const galPerAc = gallons / acres;
  switch (unit) {
    case 'oz/ac': return `${(galPerAc * 128).toFixed(1)} oz/ac`;
    case 'pt/ac': return `${(galPerAc * 8).toFixed(1)} pt/ac`;
    case 'L/ha': return `${((gallons * 3.78541) / (acres * 0.404686)).toFixed(1)} L/ha`;
    case 'mL/ha': return `${Math.round((gallons * 3785.41) / (acres * 0.404686)).toLocaleString()} mL/ha`;
    default: return `${galPerAc.toFixed(1)} gal/ac`;
  }
}

// ── System-aware hook ─────────────────────────
function useUnit<T extends string>(
  imperialDefault: T, metricDefault: T,
  imperialCycle: readonly T[], metricCycle: readonly T[],
): [T, () => void, number, boolean] {
  const system = useContext(UnitSystemContext);
  const cycle = system === 'metric' ? metricCycle : imperialCycle;
  const systemDefault = system === 'metric' ? metricDefault : imperialDefault;
  const prevSystem = useRef(system);

  const [unit, setUnit] = useState<T>(systemDefault);
  const [tapCount, setTapCount] = useState(0);

  // Reset when system changes (not on first render)
  useEffect(() => {
    if (prevSystem.current !== system) {
      setUnit(systemDefault);
      setTapCount((c) => c + 1);
      prevSystem.current = system;
    }
  }, [system, systemDefault]);

  const toggle = useCallback(() => {
    if (cycle.length <= 1) return;
    setUnit((prev) => {
      const idx = (cycle as readonly string[]).indexOf(prev);
      return cycle[(idx + 1) % cycle.length];
    });
    setTapCount((c) => c + 1);
  }, [cycle]);

  return [unit, toggle, tapCount, cycle.length > 1];
}

// ── Distance ─────────────────────────────────
export type DistanceUnit = 'ft' | 'yd' | 'mi' | 'm' | 'km';
const DIST_IMP: readonly DistanceUnit[] = ['ft', 'yd', 'mi'];
const DIST_MET: readonly DistanceUnit[] = ['m', 'km'];

export function formatDistance(feet: number, unit: DistanceUnit): string {
  switch (unit) {
    case 'yd': return `${Math.round(feet / 3).toLocaleString()} yd`;
    case 'mi': return `${(feet / 5280).toFixed(2)} mi`;
    case 'm': return `${Math.round(feet * 0.3048).toLocaleString()} m`;
    case 'km': return `${(feet * 0.0003048).toFixed(2)} km`;
    default: return `${Math.round(feet).toLocaleString()} ft`;
  }
}

// ── Volume (input) ───────────────────────────
export type VolumeUnit = 'gal' | 'pt' | 'oz' | 'L' | 'mL';
const VOL_IMP: readonly VolumeUnit[] = ['gal', 'pt', 'oz'];
const VOL_MET: readonly VolumeUnit[] = ['L', 'mL'];

export const VOL_TO_GAL: Record<VolumeUnit, number> = {
  gal: 1, pt: 0.125, oz: 1 / 128,
  L: 1 / 3.78541, mL: 1 / 3785.41,
};

export function formatVolume(gallons: number, unit: VolumeUnit): string {
  switch (unit) {
    case 'pt': return `${(gallons * 8).toFixed(1)} pt`;
    case 'oz': return `${(gallons * 128).toFixed(1)} oz`;
    case 'L': return `${(gallons * 3.78541).toFixed(1)} L`;
    case 'mL': return `${Math.round(gallons * 3785.41).toLocaleString()} mL`;
    default: return `${gallons.toFixed(1)} gal`;
  }
}

// ── Pre-built hooks ───────────────────────────
export function useAreaUnit() { return useUnit<AreaUnit>('ac', 'ha', AREA_IMP, AREA_MET); }
export function useSpeedUnit() { return useUnit<SpeedUnit>('mph', 'km/h', SPEED_IMP, SPEED_MET); }
export function useRateUnit() { return useUnit<RateUnit>('gal/ac', 'L/ha', RATE_IMP, RATE_MET); }
export function useDistanceUnit() { return useUnit<DistanceUnit>('ft', 'm', DIST_IMP, DIST_MET); }
export function useVolumeUnit() { return useUnit<VolumeUnit>('gal', 'L', VOL_IMP, VOL_MET); }
