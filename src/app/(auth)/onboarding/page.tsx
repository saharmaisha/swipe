'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState('150');
  const [saving, setSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const validateBudget = (value: string): boolean => {
    const num = Number(value);
    if (!value || isNaN(num) || num < 10) {
      setBudgetError('Minimum budget is $10');
      return false;
    }
    setBudgetError(null);
    return true;
  };

  const steps = [
    {
      title: 'Welcome to Veri',
      description: 'Find shoppable versions of the outfits you love on Pinterest.',
      content: (
        <div className="flex flex-col items-center gap-6 py-8">
          <Sparkles className="h-16 w-16 text-primary" />
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Paste a Pinterest board and we&apos;ll find similar pieces you can actually buy.
            </p>
          </div>
          <div className="flex gap-3 p-4 rounded-lg bg-muted/50 border text-left">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Your board must be public. </strong> Veri can only access publicly visible Pinterest boards.
              To make a board public: open it on Pinterest, tap the three dots, select &quot;Edit board&quot;, and set visibility to &quot;Public&quot;.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Set your budget',
      description: 'We\'ll prioritize items within your price range.',
      content: (
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="budget">Default max budget per item</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="budget"
                type="number"
                value={budget}
                onChange={(e) => {
                  setBudget(e.target.value);
                  if (budgetError) validateBudget(e.target.value);
                }}
                onBlur={(e) => validateBudget(e.target.value)}
                className={`pl-8 ${budgetError ? 'border-destructive' : ''}`}
                min={10}
              />
            </div>
            {budgetError ? (
              <p className="text-sm text-destructive">{budgetError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can change this anytime in settings.
              </p>
            )}
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <CardTitle>{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {current.content}
            <div className="flex justify-between mt-6">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button
                disabled={saving || (step === steps.length - 1 && !!budgetError)}
                onClick={() => {
                  if (step < steps.length - 1) {
                    setStep(step + 1);
                  } else {
                    if (!validateBudget(budget)) return;
                    void (async () => {
                      setSaving(true);

                      try {
                        const response = await fetch('/api/preferences', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            default_budget_max: budget ? Number(budget) : null,
                            complete_onboarding: true,
                          }),
                        });

                        if (!response.ok) {
                          throw new Error('Failed to save onboarding preferences');
                        }

                        toast.success('You’re all set');
                        router.push('/boards');
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : 'Failed to complete onboarding'
                        );
                      } finally {
                        setSaving(false);
                      }
                    })();
                  }
                }}
              >
                {step < steps.length - 1 ? 'Next' : saving ? 'Saving…' : 'Get started'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
