'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Sparkles, Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/callback`
          : '/api/auth/callback';

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
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
            <CardTitle className="text-lg">{sent ? 'Check your inbox' : 'Sign in with email'}</CardTitle>
            <CardDescription>
              {sent
                ? `We sent a sign-in link to ${email}`
                : 'We\u2019ll email you a link\u2009\u2014\u2009no password needed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <p className="text-sm text-muted-foreground text-center">
                  Click the link in your email to continue. You can close this tab.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSent(false);
                    setEmail('');
                  }}
                >
                  Try a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? 'Sending\u2026' : 'Continue'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
            )}
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
