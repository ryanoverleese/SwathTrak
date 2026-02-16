import * as turf from '@turf/turf';
import type { GpsPoint } from '../types';

/**
 * Build a polygon representing the spray swath around a GPS track.
 * Uses Turf.js buffer to offset the center line by half the spray width.
 */
export function buildSwathPolygon(
  points: GpsPoint[],
  widthFeet: number
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  if (points.length < 2) return null;

  const coords = points.map((p) => [p.lng, p.lat] as [number, number]);
  const line = turf.lineString(coords);

  // Convert feet to kilometers for turf buffer
  const widthKm = (widthFeet / 2) * 0.0003048;

  const buffered = turf.buffer(line, widthKm, { units: 'kilometers' });
  if (!buffered) return null;

  return buffered as GeoJSON.Feature<GeoJSON.Polygon>;
}

/**
 * Calculate acres covered by a set of swath polygons.
 * Merges overlapping areas so they aren't double-counted.
 */
export function calculateAcres(
  polygons: (GeoJSON.Feature<GeoJSON.Polygon> | null)[]
): number {
  const valid = polygons.filter(Boolean) as GeoJSON.Feature<GeoJSON.Polygon>[];
  if (valid.length === 0) return 0;

  try {
    // Union all polygons to avoid double-counting overlaps
    let merged: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = valid[0];
    for (let i = 1; i < valid.length; i++) {
      const result = turf.union(
        turf.featureCollection([merged, valid[i]])
      );
      if (result) {
        merged = result as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
      }
    }

    const sqMeters = turf.area(merged);
    // 1 acre = 4046.86 sq meters
    return sqMeters / 4046.86;
  } catch {
    // Fallback: sum individual areas (may double-count overlaps)
    let total = 0;
    for (const poly of valid) {
      total += turf.area(poly);
    }
    return total / 4046.86;
  }
}

/**
 * Calculate distance between two GPS points in feet.
 */
export function distanceFeet(a: GpsPoint, b: GpsPoint): number {
  const from = turf.point([a.lng, a.lat]);
  const to = turf.point([b.lng, b.lat]);
  const km = turf.distance(from, to, { units: 'kilometers' });
  return km * 3280.84; // km to feet
}
