import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GpsPoint, SpraySwath } from '../types';
import { buildSwathPolygon } from '../utils/geo';

interface SprayMapProps {
  position: GpsPoint | null;
  swaths: SpraySwath[];
  activeSwath: SpraySwath | null;
  pastSessionSwaths?: SpraySwath[];
  isSpraying?: boolean;
  tiltEnabled?: boolean;
  heading?: number | null;
  lockNorth?: boolean;
}

export interface SprayMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const NAV_PITCH = 60;
const NAV_ZOOM = 19;
const NAV_PADDING_BOTTOM = 250;

export const SprayMap = forwardRef<SprayMapHandle, SprayMapProps>(function SprayMap(
  { position, swaths, activeSwath, pastSessionSwaths, isSpraying, tiltEnabled, heading, lockNorth },
  ref
) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasInitialZoom = useRef(false);
  const flatZoomRef = useRef(18);
  const prevTilt = useRef(false);
  const tiltRaf = useRef<number>(0);
  const [mapReady, setMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
  }));

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: [
              'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            ],
            tileSize: 256,
            maxzoom: 20,
          },
        },
        layers: [
          {
            id: 'satellite',
            type: 'raster',
            source: 'google-satellite',
          },
        ],
      },
      center: [-98.5795, 39.8283],
      zoom: 5,
      attributionControl: false,
    });

    map.on('load', () => {
      // Past session swaths (blue, rendered first / below)
      map.addSource('past-swaths', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'past-swaths-fill',
        type: 'fill',
        source: 'past-swaths',
        paint: {
          'fill-color': '#42a5f5',
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'past-swaths-outline',
        type: 'line',
        source: 'past-swaths',
        paint: {
          'line-color': '#42a5f5',
          'line-width': 1,
        },
      });

      // Current session swaths (per-feature color from properties)
      map.addSource('swaths', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'swaths-fill',
        type: 'fill',
        source: 'swaths',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'swaths-outline',
        type: 'line',
        source: 'swaths',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1,
        },
      });

      // Active swath (yellow, on top)
      map.addSource('active-swath', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'active-swath-fill',
        type: 'fill',
        source: 'active-swath',
        paint: {
          'fill-color': '#ffea00',
          'fill-opacity': 0.4,
        },
      });
      map.addLayer({
        id: 'active-swath-outline',
        type: 'line',
        source: 'active-swath',
        paint: {
          'line-color': '#ffea00',
          'line-width': 1,
        },
      });

      // Position marker (circle layer)
      map.addSource('position', {
        type: 'geojson',
        data: EMPTY_FC,
      });
      map.addLayer({
        id: 'position-outline',
        type: 'circle',
        source: 'position',
        paint: {
          'circle-radius': 8,
          'circle-color': '#2196f3',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Tilt transition — manual rAF animation so nothing can cancel it.
  // MapLibre's easeTo/jumpTo/setBearing ALL cancel in-progress animations,
  // so we animate pitch+zoom ourselves outside MapLibre's animation system.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!!tiltEnabled === prevTilt.current) return;
    prevTilt.current = !!tiltEnabled;

    // Cancel any in-progress tilt animation
    if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current);

    const fromPitch = map.getPitch();
    const toPitch = tiltEnabled ? NAV_PITCH : 0;
    const fromZoom = map.getZoom();
    const toZoom = tiltEnabled ? NAV_ZOOM : flatZoomRef.current;

    if (tiltEnabled) flatZoomRef.current = fromZoom;

    map.setPadding(tiltEnabled
      ? { top: 0, left: 0, right: 0, bottom: NAV_PADDING_BOTTOM }
      : { top: 0, left: 0, right: 0, bottom: 0 });

    const start = performance.now();
    const duration = 800;

    function frame() {
      if (!map) return;
      const t = Math.min(1, (performance.now() - start) / duration);
      const ease = t < 1 ? t * (2 - t) : 1; // ease-out quad
      map.jumpTo({
        pitch: fromPitch + (toPitch - fromPitch) * ease,
        zoom: fromZoom + (toZoom - fromZoom) * ease,
      });
      if (t < 1) {
        tiltRaf.current = requestAnimationFrame(frame);
      } else {
        tiltRaf.current = 0;
      }
    }
    tiltRaf.current = requestAnimationFrame(frame);

    return () => {
      if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current);
    };
  }, [tiltEnabled, mapReady]);

  // Compass heading → bearing (instant via jumpTo, only sets bearing)
  // jumpTo({ bearing }) does NOT touch pitch or zoom — only specified properties.
  // Its stop() call kills MapLibre animations but not our rAF tilt loop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const bearing = lockNorth ? 0 : -(heading ?? 0);
    map.jumpTo({ bearing });
  }, [heading, lockNorth, mapReady]);

  // Update position marker and center map (instant via jumpTo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !position) return;

    const src = map.getSource('position') as maplibregl.GeoJSONSource;
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
          properties: {},
        },
      ],
    });

    if (!hasInitialZoom.current) {
      map.jumpTo({ center: [position.lng, position.lat], zoom: 18 });
      hasInitialZoom.current = true;
    } else if (isSpraying) {
      map.jumpTo({ center: [position.lng, position.lat] });
    }
  }, [position, isSpraying, mapReady]);

  // Render current session swaths
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const features: GeoJSON.Feature[] = [];

    for (const swath of swaths) {
      const poly = buildSwathPolygon(swath.points, swath.widthFeet);
      if (poly) {
        poly.properties = { ...poly.properties, color: swath.color || '#00e676' };
        features.push(poly);
      }
    }

    (map.getSource('swaths') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });

    // Active swath
    const activeFeatures: GeoJSON.Feature[] = [];
    if (activeSwath && activeSwath.points.length >= 2) {
      const poly = buildSwathPolygon(activeSwath.points, activeSwath.widthFeet);
      if (poly) activeFeatures.push(poly);
    }

    (map.getSource('active-swath') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: activeFeatures,
    });
  }, [swaths, activeSwath, mapReady]);

  // Render past session swaths
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const features: GeoJSON.Feature[] = [];
    if (pastSessionSwaths) {
      for (const swath of pastSessionSwaths) {
        const poly = buildSwathPolygon(swath.points, swath.widthFeet);
        if (poly) features.push(poly);
      }
    }

    (map.getSource('past-swaths') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });
  }, [pastSessionSwaths, mapReady]);

  return <div className="map-container" ref={mapContainer} />;
});
