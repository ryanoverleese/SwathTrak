import { useEffect, useRef, useCallback, useState } from 'react';
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
}

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const TILT_ZOOM_OUT = 1.5;

export function SprayMap({ position, swaths, activeSwath, pastSessionSwaths, isSpraying, tiltEnabled, heading }: SprayMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasInitialZoom = useRef(false);
  const flatZoomRef = useRef(18);
  const wasTilted = useRef(false);
  const [mapReady, setMapReady] = useState(false);

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

  // Handle tilt transition
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !hasInitialZoom.current) return;

    if (tiltEnabled && !wasTilted.current) {
      // Starting tilt — save current zoom then zoom out + pitch
      flatZoomRef.current = map.getZoom();
      map.easeTo({
        pitch: 45,
        zoom: flatZoomRef.current - TILT_ZOOM_OUT,
        duration: 600,
      });
    } else if (!tiltEnabled && wasTilted.current) {
      // Stopped tilt — flatten + restore zoom
      map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: flatZoomRef.current,
        duration: 600,
      });
    }
    wasTilted.current = !!tiltEnabled;
  }, [tiltEnabled, mapReady]);

  // Compass heading → map bearing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !tiltEnabled) return;

    if (heading !== null && heading !== undefined) {
      map.easeTo({
        bearing: -heading,
        duration: 300,
      });
    }
  }, [heading, tiltEnabled, mapReady]);

  // Lock north resets bearing
  const [lockNorth, setLockNorth] = useState(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !tiltEnabled) return;

    if (lockNorth) {
      map.easeTo({ bearing: 0, duration: 300 });
    }
  }, [lockNorth, tiltEnabled, mapReady]);

  // Override compass heading when lockNorth
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !tiltEnabled || !lockNorth) return;

    // When locked north, keep bearing at 0 regardless of heading
    map.easeTo({ bearing: 0, duration: 300 });
  }, [heading, lockNorth, tiltEnabled, mapReady]);

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
    } else if (isSpraying) {
      map.easeTo({
        center: [position.lng, position.lat],
        duration: 500,
      });
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

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // Compute compass icon rotation for the UI button
  const compassRotation = tiltEnabled && !lockNorth && heading != null ? heading : 0;

  return (
    <>
      <div className="map-container" ref={mapContainer} />
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn}>
          <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="6" x2="12" y2="18" /><line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        </button>
        <button className="zoom-btn" onClick={handleZoomOut}>
          <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        </button>
        <button
          className={`zoom-btn compass-btn${lockNorth ? ' compass-locked' : ''}`}
          onClick={() => setLockNorth(!lockNorth)}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            style={{
              transform: `rotate(${lockNorth && heading != null ? -heading : compassRotation}deg)`,
              transition: 'transform 0.3s ease-out',
            }}>
            {/* North triangle */}
            <path d="M12 3 L14.5 11 L12 9.5 L9.5 11 Z" fill="rgba(239,68,68,0.8)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
            {/* South triangle */}
            <path d="M12 21 L9.5 13 L12 14.5 L14.5 13 Z" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            {/* Center dot */}
            <circle cx="12" cy="12" r="1.2" fill="rgba(255,255,255,0.6)" />
          </svg>
        </button>
      </div>
    </>
  );
}
