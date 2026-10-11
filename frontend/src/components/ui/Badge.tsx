import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'emergency' | 'success' | 'outline' | 'warning';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    default: 'border-transparent bg-primary text-white',
    emergency: 'border-transparent bg-emergency text-white',
    success: 'border-transparent bg-success text-white',
    warning: 'border-transparent bg-amber-500 text-white',
    outline: 'text-foreground',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />
  );
}
