'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <p className="text-sm font-medium text-primary">We couldn’t load that screen</p>
      <h1 className="text-2xl font-semibold tracking-tight">Try refreshing this part of the app.</h1>
      <p className="text-sm text-muted-foreground">
        If the problem continues, go back to your boards and try again from there.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/boards">
          <Button variant="outline">Back to boards</Button>
        </Link>
      </div>
    </div>
  );
}
