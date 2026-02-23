import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
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

const ACTIVE_SWATH_STYLE: L.PathOptions = {
  color: '#ffea00',
  fillColor: '#ffea00',
  fillOpacity: 0.4,
  weight: 1,
};

const PAST_SWATH_STYLE: L.PathOptions = {
  color: '#42a5f5',
  fillColor: '#42a5f5',
  fillOpacity: 0.35,
  weight: 1,
};

const TILT_ZOOM_OUT = 1.5; // zoom levels to pull back when tilted

export function SprayMap({ position, swaths, activeSwath, pastSessionSwaths, isSpraying, tiltEnabled, heading }: SprayMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const swathLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const pastLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const hasInitialZoom = useRef(false);
  const flatZoomRef = useRef(18); // remember the zoom level before tilting
  const wasSpraying = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [39.8283, -98.5795],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      { maxZoom: 20, maxNativeZoom: 20 }
    ).addTo(map);

    swathLayerRef.current.addTo(map);
    pastLayerRef.current.addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle tilt transition when spraying starts/stops
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasInitialZoom.current) return;

    if (tiltEnabled && !wasSpraying.current) {
      // Starting tilt — save current zoom then zoom out
      flatZoomRef.current = map.getZoom();
      map.setZoom(flatZoomRef.current - TILT_ZOOM_OUT, { animate: true });
    } else if (!tiltEnabled && wasSpraying.current) {
      // Stopped tilt — restore zoom
      map.setZoom(flatZoomRef.current, { animate: true });
    }
    wasSpraying.current = !!tiltEnabled;

    // Tell Leaflet about the container size change from the CSS transform
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 700);
    return () => clearTimeout(timer);
  }, [tiltEnabled]);

  // Update position marker and center map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    const latlng: L.LatLngExpression = [position.lat, position.lng];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latlng, {
        radius: 8,
        color: '#ffffff',
        fillColor: '#2196f3',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }

    if (!hasInitialZoom.current) {
      map.setView(latlng, 18);
      hasInitialZoom.current = true;
    } else if (isSpraying) {
      // Just pan to center — the CSS transform-origin at bottom
      // naturally pushes the center point to the upper half visually
      map.panTo(latlng, { animate: true, duration: 0.5 });
    }
  }, [position, isSpraying]);

  // Render swaths
  useEffect(() => {
    const layer = swathLayerRef.current;
    layer.clearLayers();

    for (const swath of swaths) {
      const poly = buildSwathPolygon(swath.points, swath.widthFeet);
      if (poly) {
        const style: L.PathOptions = {
          color: swath.color || '#00e676',
          fillColor: swath.color || '#00e676',
          fillOpacity: 0.35,
          weight: 1,
        };
        L.geoJSON(poly, { style }).addTo(layer);
      }
    }

    if (activeSwath && activeSwath.points.length >= 2) {
      const poly = buildSwathPolygon(activeSwath.points, activeSwath.widthFeet);
      if (poly) {
        L.geoJSON(poly, { style: ACTIVE_SWATH_STYLE }).addTo(layer);
      }
    }
  }, [swaths, activeSwath]);

  // Render past session swaths
  useEffect(() => {
    const layer = pastLayerRef.current;
    layer.clearLayers();

    if (!pastSessionSwaths) return;

    for (const swath of pastSessionSwaths) {
      const poly = buildSwathPolygon(swath.points, swath.widthFeet);
      if (poly) {
        L.geoJSON(poly, { style: PAST_SWATH_STYLE }).addTo(layer);
      }
    }
  }, [pastSessionSwaths]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const rotation = tiltEnabled && heading !== null && heading !== undefined ? heading : 0;

  return (
    <>
      <div className="map-wrapper">
        {tiltEnabled && <div className="map-sky" />}
        <div
          className={`map-container${tiltEnabled ? ' map-tilted' : ''}`}
          style={{ '--heading': `${-rotation}deg` } as React.CSSProperties}
        >
          <div
            ref={mapContainer}
            className={`map-leaflet${tiltEnabled ? ' map-leaflet-tilted' : ''}`}
          />
        </div>
      </div>
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn}>+</button>
        <button className="zoom-btn" onClick={handleZoomOut}>−</button>
      </div>
    </>
  );
}
