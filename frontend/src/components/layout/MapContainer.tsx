'use client';

import React from 'react';
// Note: Actual react-leaflet imports must be done dynamically with ssr: false
// This is just the wrapper container

export function MapContainerWrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden rounded-xl border border-border bg-surface shadow-inner z-0 ${className}`}>
      {children}
    </div>
  );
}
