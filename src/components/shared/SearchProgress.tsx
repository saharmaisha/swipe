'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Search, ListChecks, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchProgressProps {
  pinCount: number;
}

const STEPS = [
  { id: 'analyze', label: 'Analyzing pins', icon: Sparkles, duration: 3000 },
  { id: 'search', label: 'Finding products', icon: Search, duration: 4000 },
  { id: 'rank', label: 'Ranking results', icon: ListChecks, duration: 2000 },
];

export function SearchProgress({ pinCount }: SearchProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Progress through steps based on estimated timing
    // Adjust duration based on pin count
    const multiplier = Math.max(1, Math.min(pinCount / 5, 3));

    const timers: NodeJS.Timeout[] = [];
    let elapsed = 0;

    STEPS.forEach((step, index) => {
      if (index > 0) {
        elapsed += STEPS[index - 1].duration * multiplier;
        const timer = setTimeout(() => {
          setCurrentStep(index);
        }, elapsed);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [pinCount]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-xl p-8 shadow-lg max-w-sm w-full mx-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <h3 className="font-semibold text-lg">Finding your perfect matches</h3>
          <p className="text-sm text-muted-foreground">
            Searching across {pinCount} pin{pinCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                  isActive && 'bg-primary/5',
                  isComplete && 'opacity-60'
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    isComplete && 'bg-muted text-muted-foreground',
                    !isActive && !isComplete && 'bg-muted/50 text-muted-foreground/50'
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className={cn('h-4 w-4', isActive && 'animate-pulse')} />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive && 'text-foreground',
                    !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                  {isActive && '...'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
