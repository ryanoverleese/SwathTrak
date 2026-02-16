export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface SpraySwath {
  id: string;
  points: GpsPoint[];
  widthFeet: number;
  color: string;
  startTime: number;
  endTime?: number;
}

export interface Tank {
  id: string;
  swaths: SpraySwath[];
  gallons?: number;
  startTime: number;
  endTime?: number;
}

export interface SpraySession {
  id: string;
  name: string;
  date: string;
  tanks: Tank[];
  /** @deprecated kept for backward compat with old saved sessions */
  swaths?: SpraySwath[];
  totalAcres: number;
  gallons?: number;
}
