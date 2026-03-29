'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/callback`
          : '/api/auth/callback';

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (authError) {
        setError(authError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-2xl font-semibold tracking-tight">Veri</span>
          </Link>
          <p className="text-muted-foreground">
            Sign in to start shopping your Pinterest boards
          </p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in with Google</CardTitle>
            <CardDescription>
              Continue with your school Google account to start shopping your Pinterest boards.
              The beta is currently limited to .edu email addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button onClick={handleLogin} className="w-full gap-2" disabled={loading}>
                {loading ? 'Redirecting\u2026' : 'Continue with Google'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          By continuing you agree to let Veri analyze your
          public Pinterest boards to find shopping matches. Read our{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
