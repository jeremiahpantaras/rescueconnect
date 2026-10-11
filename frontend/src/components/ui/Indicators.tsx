import React from 'react';

// Statuses matching backend: 'pending', 'acknowledged', 'responding', 'resolved'
export function StatusIndicator({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  
  let color = 'bg-slate-500';
  let label = 'Unknown';

  if (normalized === 'pending') {
    color = 'bg-amber-500';
    label = 'Pending';
  } else if (normalized === 'acknowledged') {
    color = 'bg-blue-500';
    label = 'Acknowledged';
  } else if (normalized === 'responding') {
    color = 'bg-purple-500';
    label = 'Responding';
  } else if (normalized === 'resolved') {
    color = 'bg-success';
    label = 'Resolved';
  }

  return (
    <div className="flex items-center space-x-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_8px_rgba(0,0,0,0.15)]`} style={{ boxShadow: `0 0 8px var(--tw-shadow-color)` }} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

// Severities: 'low', 'moderate', 'high', 'critical'
export function SeverityIndicator({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();
  
  let colorClass = 'text-slate-500 bg-slate-100 dark:bg-slate-800';
  
  if (normalized === 'low') {
    colorClass = 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
  } else if (normalized === 'moderate') {
    colorClass = 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
  } else if (normalized === 'high') {
    colorClass = 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
  } else if (normalized === 'critical') {
    colorClass = 'text-emergency bg-emergency/10 font-bold animate-pulse';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${colorClass}`}>
      {severity}
    </span>
  );
}
