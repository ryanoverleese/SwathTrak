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
  const wasTilted = useRef(false);
  const tiltEnabledRef = useRef(false);
  tiltEnabledRef.current = !!tiltEnabled;
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

  // Handle tilt transition — CarPlay-style navigation view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !hasInitialZoom.current) return;

    if (tiltEnabled && !wasTilted.current) {
      // Starting tilt — save current zoom, swoop to nav view
      // Combine pitch + bearing + zoom + center into single easeTo to prevent animation conflicts
      flatZoomRef.current = map.getZoom();
      const center = position
        ? [position.lng, position.lat] as [number, number]
        : undefined;
      map.easeTo({
        pitch: NAV_PITCH,
        zoom: NAV_ZOOM,
        bearing: lockNorth ? 0 : -(heading ?? 0),
        ...(center ? { center } : {}),
        duration: 800,
      });
      map.setPadding({ top: 0, left: 0, right: 0, bottom: NAV_PADDING_BOTTOM });
    } else if (!tiltEnabled && wasTilted.current) {
      // Stopped tilt — flatten + restore zoom
      map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: flatZoomRef.current,
        duration: 800,
      });
      map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
    }
    wasTilted.current = !!tiltEnabled;
  }, [tiltEnabled, mapReady]);

  // Compass heading → map bearing (while tilted)
  // Uses tiltEnabledRef instead of tiltEnabled in deps so this effect does NOT fire
  // when tilt starts — the tilt effect above already sets the initial bearing.
  // This only fires on subsequent heading/lockNorth changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !tiltEnabledRef.current) return;

    if (lockNorth) {
      map.easeTo({ bearing: 0, duration: 300 });
      return;
    }

    if (heading !== null && heading !== undefined) {
      const opts: maplibregl.EaseToOptions = {
        bearing: -heading,
        duration: 300,
      };
      // Include center so position + rotation are atomic
      if (position) {
        opts.center = [position.lng, position.lat];
      }
      map.easeTo(opts);
    }
  }, [heading, lockNorth, mapReady]);

  // Update position marker and center map
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
    } else if (isSpraying && !tiltEnabled) {
      // Only pan from here when NOT tilted — tilted view handles centering in the bearing effect
      map.easeTo({
        center: [position.lng, position.lat],
        duration: 500,
      });
    }
  }, [position, isSpraying, tiltEnabled, mapReady]);

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
