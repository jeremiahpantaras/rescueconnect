'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, AlertTriangle, Waves, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/layout/Header';
import { LinkButton } from '@/components/ui/LinkButton';
import { SearchLocation } from './SearchLocation';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

// Dynamically import MapComponent to disable SSR since leaflet requires window
const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted animate-pulse">
      <p className="text-muted-foreground">Loading Map...</p>
    </div>
  )
});

// Default to a central location (e.g., Bacolod/Negros)
const DEFAULT_CENTER = { lat: 10.6653, lng: 122.9546 };

interface MapDashboardProps {
  onReportFlood: (location: { lat: number, lng: number }) => void;
  onUrgentResponse: (location: { lat: number, lng: number }) => void;
}

export function MapDashboard({ onReportFlood, onUrgentResponse }: MapDashboardProps) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const getCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsLocating(false);
        },
        (error) => {
          console.warn("Location error:", error);
          setLocationError("Unable to get your location. Please check your permissions.");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  };

  // Get current location on mount if possible
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    getCurrentLocation();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      <Header
        title="RescueConnect"
        rightAction={
          <LinkButton href="/status" variant="ghost" size="sm" aria-label="Check the status of a report you submitted">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            My reports
          </LinkButton>
        }
      />

      {/* Map Area */}
      <div className="flex-1 relative w-full h-full">
        <SearchLocation onSelectLocation={(lat, lng) => setCenter({ lat, lng })} />
        
        <MapComponent 
          center={center} 
          onLocationChange={(lat, lng) => setCenter({ lat, lng })} 
        />
        
        {/* Current Location Button */}
        <button
          onClick={getCurrentLocation}
          className="absolute bottom-6 right-4 z-[400] bg-surface text-foreground shadow-xl rounded-full p-3 border border-border hover:bg-surface-hover active:scale-95 transition-all"
          aria-label="Current Location"
        >
          <LocateFixed className={`h-6 w-6 ${isLocating ? 'animate-pulse text-primary' : ''}`} />
        </button>

        {/* Floating Instruction */}
        <div className="absolute top-20 left-0 right-0 z-[400] pointer-events-none flex justify-center">
          <div className="bg-background/90 backdrop-blur-sm text-foreground text-sm font-medium px-4 py-2 rounded-full shadow-md border border-border">
            Adjust the pin to the exact location
          </div>
        </div>
        {!online && (
          <div role="status" className="absolute top-32 left-0 right-0 z-[400] flex justify-center px-4 pointer-events-none">
            <div className="max-w-sm rounded-xl border border-amber-500/50 bg-background/95 px-4 py-2 text-center text-sm text-foreground shadow-md">
              <strong>You are offline.</strong> The map background may be blank, but your location and pin still work.
              You can still report: it will be saved and sent when you have a signal.
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Drawer */}
      <div className="bg-surface border-t border-border p-4 pb-safe z-40 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        {locationError && (
          <p className="text-xs text-emergency mb-3 text-center">{locationError}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Button 
            size="lg" 
            variant="outline"
            className="w-full h-16 justify-start border-primary/20 hover:bg-primary/5 hover:border-primary/50"
            onClick={() => onReportFlood(center)}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="bg-primary/10 p-2 rounded-full">
                <Waves className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-foreground">Report Flooded Area</div>
                <div className="text-xs text-muted-foreground font-normal">Report an area affected by flooding</div>
              </div>
            </div>
          </Button>

          <Button 
            size="lg" 
            variant="destructive"
            className="w-full h-16 justify-start shadow-lg shadow-emergency/20"
            onClick={() => onUrgentResponse(center)}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1 text-white">
                <div className="font-bold">Urgent Response</div>
                <div className="text-xs text-white/80 font-normal">Report where immediate response is needed</div>
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
