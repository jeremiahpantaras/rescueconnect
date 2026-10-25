'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

interface ImageUploaderProps {
  photos: (File | null)[];
  onPhotosChange: (photos: (File | null)[]) => void;
  maxPhotos?: number;
}

// Preview with an object URL that is released when the photo changes or the component unmounts.
function PhotoPreview({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="object-cover w-full h-full" />
  );
}

export function ImageUploader({ photos, onPhotosChange, maxPhotos = 2 }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const problems: string[] = [];
    const validFiles: File[] = [];

    // Validate size (<5MB) and type; the backend repeats these checks.
    Array.from(e.target.files).forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        problems.push(`${file.name} is not a JPG or PNG image.`);
      } else if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`${file.name} is too large. Max size is 5MB.`);
      } else {
        validFiles.push(file);
      }
    });

    const availableSlots = maxPhotos - photos.filter(Boolean).length;
    if (validFiles.length > availableSlots) {
      problems.push(`You can add up to ${maxPhotos} photos.`);
    }

    const filesToAdd = validFiles.slice(0, availableSlots);
    if (filesToAdd.length > 0) {
      const updatedPhotos = [...photos];
      let added = 0;
      for (let i = 0; i < maxPhotos; i++) {
        if (!updatedPhotos[i] && added < filesToAdd.length) {
          updatedPhotos[i] = filesToAdd[added];
          added++;
        }
      }
      onPhotosChange(updatedPhotos);
    }

    setError(problems.length > 0 ? problems.join(' ') : null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const updated = [...photos];
    updated[index] = null;
    onPhotosChange(updated);
    setError(null);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-foreground">
          Photos (Optional)
        </span>
        <span className="text-xs text-muted-foreground">
          {photos.filter(Boolean).length} / {maxPhotos} Added
        </span>
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        aria-label="Choose photos"
      />

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: maxPhotos }).map((_, idx) => {
          const photo = photos[idx];
          return (
            <div key={idx} className="relative aspect-square w-full rounded-lg border-2 overflow-hidden bg-muted flex items-center justify-center">
              {photo ? (
                <>
                  <PhotoPreview file={photo} alt={`Upload ${idx + 1}`} />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-emergency transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={triggerUpload}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-xs font-medium">Add Photo {idx + 1}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-emergency">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Up to {maxPhotos} photos, max 5MB each. JPG/PNG only. Clear photos help responders understand the situation.
      </p>
    </div>
  );
}
