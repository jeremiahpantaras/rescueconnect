'use client';

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Header } from '@/components/layout/Header';
import { submitReport, type SubmitOutcome } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { OfflineNotice } from '@/components/reports/OfflineNotice';
import { ImageUploader } from './ImageUploader';

interface FloodReportFormProps {
  location: { lat: number; lng: number };
  onBack: () => void;
  onSuccess: (outcome: SubmitOutcome) => void;
}

export function FloodReportForm({ location, onBack, onSuccess }: FloodReportFormProps) {
  const [photos, setPhotos] = useState<(File | null)[]>([null, null]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = await submitReport({
        reportType: 'FLOODED AREA',
        location,
        message,
        photos: photos.filter((photo): photo is File => photo !== null),
      });
      onSuccess(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your report could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-y-auto z-[500]">
      <Header
        title="Report Flooded Area"
        leftAction={
          <Button variant="ghost" size="icon" onClick={onBack} disabled={isSubmitting} aria-label="Back to map">
            <ChevronLeft className="h-6 w-6" />
          </Button>
        }
      />

      <div className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 pb-24">
        <OfflineNotice />

        {error && (
          <div role="alert" className="mb-6 p-4 bg-emergency/10 border border-emergency/20 text-emergency rounded-lg text-sm">
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
          >
            {online ? 'Submit Flood Report' : 'Save Flood Report'}
          </Button>
        </form>
      </div>
    </div>
  );
}
