import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GpsPoint, SpraySwath } from '../types';
import { buildSwathPolygon } from '../utils/geo';

interface SprayMapProps {
  position: GpsPoint | null;
  swaths: SpraySwath[];
  activeSwath: SpraySwath | null;
  pastSessionSwaths?: SpraySwath[];
  isSpraying?: boolean;
  tiltAngle?: number;
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

export function SprayMap({ position, swaths, activeSwath, pastSessionSwaths, isSpraying, tiltAngle = 0 }: SprayMapProps) {
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
      center: [39.8283, -98.5795],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    // Google satellite tiles
    L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        maxNativeZoom: 20,
      }
    ).addTo(map);


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
    } else if (isSpraying) {
      // When tilted, offset the target so your position sits in the upper third
      // of the visible area — feels more natural looking "ahead"
      if (tiltAngle > 0) {
        const size = map.getSize();
        const offsetY = size.y * (tiltAngle / 60) * 0.3;
        const point = map.latLngToContainerPoint(latlng);
        const offsetLatLng = map.containerPointToLatLng([point.x, point.y - offsetY]);
        map.panTo(offsetLatLng, { animate: true, duration: 0.5 });
      } else {
        map.panTo(latlng, { animate: true, duration: 0.5 });
      }
    }
  }, [position, isSpraying, tiltAngle]);

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

  // Adjust zoom and re-render when tilt changes
  const prevTiltRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Zoom out slightly as tilt increases (max ~1.5 zoom levels at 60 degrees)
    const prevTilt = prevTiltRef.current;
    if (hasInitialZoom.current && prevTilt !== tiltAngle) {
      const zoomDelta = (tiltAngle - prevTilt) / 60 * 1.5;
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom - zoomDelta, { animate: true });
    }
    prevTiltRef.current = tiltAngle;

    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 450);
    return () => clearTimeout(timer);
  }, [tiltAngle]);

  const isTilted = tiltAngle > 0;

  return (
    <>
      {isTilted && <div className="map-sky" />}
      <div
        className="map-container"
        style={{ '--tilt': `${tiltAngle}deg`, '--tilt-pct': tiltAngle } as React.CSSProperties}
      >
        <div
          ref={mapContainer}
          className={`map-leaflet${isTilted ? ' map-leaflet-3d' : ''}`}
        />
      </div>
    </>
  );
}
