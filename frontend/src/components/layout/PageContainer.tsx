import React from 'react';

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 ${className}`}>
      {children}
    </main>
  );
}
