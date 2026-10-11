import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  title?: string;
}

export function Alert({ className = '', variant = 'default', title, children, ...props }: AlertProps) {
  const variants = {
    default: 'bg-primary/10 text-primary border-primary/20',
    destructive: 'bg-emergency/10 text-emergency border-emergency/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-500',
  };

  const Icon = {
    default: Info,
    destructive: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
  }[variant];

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:text-current [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11 ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className="h-5 w-5" />
      <div>
        {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
        <div className="text-sm [&_p]:leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
