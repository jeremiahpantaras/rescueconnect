import React from 'react';
import { Check } from 'lucide-react';
import { STATUS_STEPS } from '@/lib/reportStatus';

/** The four stages a report moves through. `current` is the index of the active stage (-1 if unknown). */
export function StatusStepper({ current }: { current: number }) {
  return (
    <ol className="space-y-0" aria-label="Report progress">
      {STATUS_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === STATUS_STEPS.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={active ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${done ? 'bg-success' : 'bg-border'}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? 'border-success bg-success text-white'
                  : active
                    ? `border-transparent ${step.dot} text-white ring-4 ring-primary/20`
                    : 'border-border bg-background text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
            </span>
            <div className="pt-1">
              <p className={`text-sm font-semibold ${active ? 'text-foreground' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
                {done && <span className="sr-only"> (completed)</span>}
                {active && <span className="sr-only"> (current step)</span>}
              </p>
              {active && <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
