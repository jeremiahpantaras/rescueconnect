import React from 'react';
import Link from 'next/link';

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

// A link that looks like <Button>; a <button> inside an <a> is invalid HTML.
export function LinkButton({ className = '', variant = 'default', size = 'md', ...props }: LinkButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95';
  const variants = {
    default: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
    outline: 'border-2 border-border bg-transparent hover:bg-surface-hover text-foreground focus:ring-border',
    ghost: 'bg-transparent hover:bg-surface-hover text-foreground focus:ring-surface-hover',
  };
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 py-2',
    lg: 'h-14 px-8 text-lg',
  };
  return <Link className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
