import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export function Button({
  className = '',
  variant = 'default',
  size = 'md',
  isLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    default: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
    destructive: 'bg-emergency text-white hover:bg-emergency-hover focus:ring-emergency',
    success: 'bg-success text-white hover:bg-success-hover focus:ring-success',
    outline: 'border-2 border-border bg-transparent hover:bg-surface-hover text-foreground focus:ring-border',
    ghost: 'bg-transparent hover:bg-surface-hover text-foreground focus:ring-surface-hover',
  };

  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 py-2',
    lg: 'h-14 px-8 text-lg',
    icon: 'h-11 w-11',
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
