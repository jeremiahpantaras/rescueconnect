import React from 'react';

/** RescueConnect's own neutral emblem (same artwork as the staff portal). Not an official government seal. */
export function Emblem({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M32 3 56 12v18c0 15-10 27-24 31C18 57 8 45 8 30V12z" fill="#0b2545" stroke="#fcd116" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 13v15M24.5 20.5h15" stroke="#fcd116" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M16 38c4-4 8-4 12 0s8 4 12 0 8-4 12 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 46c4-4 8-4 12 0s8 4 12 0 8-4 12 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
