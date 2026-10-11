import React from 'react';
import { Loader2, AlertTriangle, FileQuestion } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title = 'No Data Found', description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px] rounded-xl border border-dashed border-border bg-surface/50">
      <div className="bg-muted p-4 rounded-full mb-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px] rounded-xl border border-emergency/20 bg-emergency/5">
      <AlertTriangle className="h-10 w-10 text-emergency mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mb-6 max-w-sm">{message}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="default" className="bg-emergency hover:bg-emergency-hover focus:ring-emergency">
          Try Again
        </Button>
      )}
    </div>
  );
}
