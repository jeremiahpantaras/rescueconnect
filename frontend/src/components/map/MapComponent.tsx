'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Setup default marker icon
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapComponentProps {
  center: { lat: number; lng: number };
  onLocationChange: (lat: number, lng: number) => void;
  isDraggable?: boolean;
}

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], 15);
  }, [center, map]);
  return null;
}

export default function MapComponent({ center, onLocationChange, isDraggable = true }: MapComponentProps) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const position = marker.getLatLng();
          onLocationChange(position.lat, position.lng);
        }
      },
    }),
    [onLocationChange]
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} />
      
      <Marker
        draggable={isDraggable}
        eventHandlers={eventHandlers}
        position={[center.lat, center.lng]}
        ref={markerRef}
      >
        <Popup minWidth={90}>
          <span>{isDraggable ? "Drag me to adjust location" : "Incident Location"}</span>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
