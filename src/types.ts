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

export interface SpraySession {
  id: string;
  name: string;
  date: string;
  swaths: SpraySwath[];
  totalAcres: number;
  gallons?: number;
}
