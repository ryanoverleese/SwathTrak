import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GpsPoint, SpraySwath } from '../types';
import { buildSwathPolygon } from '../utils/geo';

interface SprayMapProps {
  position: GpsPoint | null;
  swaths: SpraySwath[];
  activeSwath: SpraySwath | null;
  pastSessionSwaths?: SpraySwath[];
}

const SWATH_STYLE: L.PathOptions = {
  color: '#00e676',
  fillColor: '#00e676',
  fillOpacity: 0.35,
  weight: 1,
};

const ACTIVE_SWATH_STYLE: L.PathOptions = {
  color: '#ffea00',
  fillColor: '#ffea00',
  fillOpacity: 0.4,
  weight: 1,
};

const PAST_SWATH_STYLE: L.PathOptions = {
  color: '#888888',
  fillColor: '#888888',
  fillOpacity: 0.2,
  weight: 1,
};

export function SprayMap({ position, swaths, activeSwath, pastSessionSwaths }: SprayMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const swathLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const pastLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const hasInitialZoom = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [39.8283, -98.5795], // center of US
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    // Esri satellite tiles (free, no API key)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 20,
        maxNativeZoom: 18,
      }
    ).addTo(map);

    // Add zoom control to bottom-right so it's out of the way
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    swathLayerRef.current.addTo(map);
    pastLayerRef.current.addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
    } else {
      map.panTo(latlng, { animate: true, duration: 0.5 });
    }
  }, [position]);

  // Render swaths
  useEffect(() => {
    const layer = swathLayerRef.current;
    layer.clearLayers();

    // Completed swaths for current session
    for (const swath of swaths) {
      const poly = buildSwathPolygon(swath.points, swath.widthFeet);
      if (poly) {
        L.geoJSON(poly, { style: SWATH_STYLE }).addTo(layer);
      }
    }

    // Active swath (currently spraying)
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

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
