'use client';

import React, { useState } from 'react';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Header } from '@/components/layout/Header';
import { submitReport, type SubmitOutcome } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { OfflineNotice } from '@/components/reports/OfflineNotice';
import { ImageUploader } from '../reports/ImageUploader';

interface UrgentResponseFormProps {
  location: { lat: number; lng: number };
  onBack: () => void;
  onSuccess: (outcome: SubmitOutcome) => void;
}

export function UrgentResponseForm({ location, onBack, onSuccess }: UrgentResponseFormProps) {
  const [photos, setPhotos] = useState<(File | null)[]>([null, null]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('Please provide details about the emergency.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = await submitReport({
        reportType: 'URGENT RESPONSE',
        location,
        message: message.trim(),
        photos: photos.filter((photo): photo is File => photo !== null),
      });
      onSuccess(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your request could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-y-auto z-[500]">
      <div className="bg-emergency/10 border-b border-emergency/20 text-emergency text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Only use Urgent Response when immediate assistance is needed.
      </div>

      <Header
        title="Urgent Response"
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
            <h3 className="font-semibold text-foreground mb-1">Emergency Location</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>

          <ImageUploader photos={photos} onPhotosChange={setPhotos} maxPhotos={2} />

          <Textarea
            label="Emergency Details (Required)"
            placeholder="Describe the situation, number of people trapped, injuries..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
            className="border-emergency focus-visible:ring-emergency"
          />

          <Button
            type="submit"
            variant="destructive"
            className="w-full h-14 text-lg shadow-lg shadow-emergency/20"
            isLoading={isSubmitting}
            disabled={!message.trim()}
          >
            {online ? 'Send Urgent Response' : 'Save Urgent Response'}
          </Button>
        </form>
      </div>
    </div>
  );
}
