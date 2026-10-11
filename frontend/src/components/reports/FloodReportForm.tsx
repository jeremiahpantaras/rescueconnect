'use client';

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Header } from '@/components/layout/Header';
import { ImageUploader } from './ImageUploader';

interface FloodReportFormProps {
  location: { lat: number; lng: number };
  onBack: () => void;
  onSuccess: (refNumber: string) => void;
}

export function FloodReportForm({ location, onBack, onSuccess }: FloodReportFormProps) {
  const [photos, setPhotos] = useState<(File | null)[]>([null, null]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Backend validation requires exactly 2 photos
    if (!photos[0] || !photos[1]) {
      setError('Both photos are strictly required to submit a report.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('accuracy', '10'); // Defaulting since we're dropping pin manually
      formData.append('message', `[FLOODED AREA] ${message}`.trim());
      
      const deviceId = localStorage.getItem('device_id') || `device-${Date.now()}`;
      localStorage.setItem('device_id', deviceId);
      formData.append('device_id', deviceId);

      formData.append('photo1', photos[0]);
      formData.append('photo2', photos[1]);

      const response = await fetch('http://127.0.0.1:8000/api/reports/send/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit report');
      }

      const data = await response.json();
      onSuccess(data.id.toString());
    } catch (err) {
      const error = err as Error;
      console.error(error);
      setError(error.message || 'Your report could not be submitted. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-y-auto z-[500]">
      <Header 
        title="Report Flooded Area" 
        leftAction={
          <Button variant="ghost" size="icon" onClick={onBack} disabled={isSubmitting}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
        }
      />
      
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 pb-24">
        {error && (
          <div className="mb-6 p-4 bg-emergency/10 border border-emergency/20 text-emergency rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold text-foreground mb-1">Selected Location</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>

          <ImageUploader photos={photos} onPhotosChange={setPhotos} maxPhotos={2} />

          <Textarea 
            label="Additional Details (Optional)" 
            placeholder="Describe the flooding, affected area, road condition, water level..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
          />

          <Button 
            type="submit" 
            className="w-full h-14 text-lg" 
            isLoading={isSubmitting}
            disabled={!photos[0] || !photos[1]}
          >
            Submit Flood Report
          </Button>
        </form>
      </div>
    </div>
  );
}
