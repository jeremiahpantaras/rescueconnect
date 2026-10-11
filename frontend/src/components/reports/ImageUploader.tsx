'use client';

import React, { useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface ImageUploaderProps {
  photos: (File | null)[];
  onPhotosChange: (photos: (File | null)[]) => void;
  maxPhotos?: number;
}

export function ImageUploader({ photos, onPhotosChange, maxPhotos = 2 }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const newFiles = Array.from(e.target.files);
    const validFiles: File[] = [];
    
    // Validate size (<5MB) and type
    newFiles.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max size is 5MB.`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert(`File ${file.name} is not a valid image.`);
        return;
      }
      validFiles.push(file);
    });

    const currentPhotosCount = photos.filter(Boolean).length;
    const availableSlots = maxPhotos - currentPhotosCount;
    
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
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const updated = [...photos];
    updated[index] = null;
    onPhotosChange(updated);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Photos (Required)
        </label>
        <span className="text-xs text-muted-foreground">
          {photos.filter(Boolean).length} / {maxPhotos} Added
        </span>
      </div>

      <input 
        type="file" 
        accept="image/jpeg,image/png,image/jpg" 
        capture="environment"
        multiple
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: maxPhotos }).map((_, idx) => {
          const photo = photos[idx];
          return (
            <div key={idx} className="relative aspect-square w-full rounded-lg border-2 overflow-hidden bg-muted flex items-center justify-center">
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt={`Upload ${idx + 1}`} 
                    className="object-cover w-full h-full"
                  />
                  <button 
                    type="button"
                    onClick={() => removePhoto(idx)}
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
      <p className="text-xs text-muted-foreground">
        Max 5MB per photo. JPG/PNG only. Please take clear photos of the situation.
      </p>
    </div>
  );
}
