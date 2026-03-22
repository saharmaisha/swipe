'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-background">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md space-y-4 text-center">
            <p className="text-sm font-medium text-primary">Something went wrong</p>
            <h1 className="text-3xl font-semibold tracking-tight">Veri hit an unexpected error.</h1>
            <p className="text-sm text-muted-foreground">
              Try the action again. If the problem keeps happening, refresh the page or head back to the homepage.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Link href="/">
                <Button variant="outline">Go home</Button>
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
