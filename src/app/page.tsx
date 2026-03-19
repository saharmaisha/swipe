import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Veri</span>
        </Link>
        {isSignedIn ? (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user?.email}
            </span>
            <Link href="/boards">
              <Button size="sm">My boards</Button>
            </Link>
          </div>
        ) : (
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        )}
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex min-h-[min(calc(100vh-9rem),36rem)] items-center px-6 pb-12 pt-20 sm:pt-24">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Shop the looks you've already saved
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                Pin it. Find it. Wear it.
              </h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground">
                Paste a Pinterest board and we'll find similar pieces you can
                actually buy—from the retailers you love, at the prices you set.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href={isSignedIn ? '/boards' : '/login'}>
                <Button size="lg" className="gap-2 px-6">
                  {isSignedIn ? 'Open my boards' : 'Try the beta'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                href="/privacy"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy & terms
              </Link>
            </div>
          </div>
        </section>

        <section className="pb-16">
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
            Whatever you're looking for
          </p>
          <div className="relative overflow-hidden">
            <div
              className="flex w-max gap-3"
              style={{
                animation: 'marquee 25s linear infinite',
              }}
            >
              {/* First set */}
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎓 Graduation outfits
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                ✈️ Vacation wardrobe
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                💼 Internship staples
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎉 Date night looks
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🏋️ Gym fits
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                👗 Wedding guest
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎿 Ski trip gear
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                ☕ Coffee run fits
              </span>
              {/* Duplicate set for seamless loop */}
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎓 Graduation outfits
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                ✈️ Vacation wardrobe
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                💼 Internship staples
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎉 Date night looks
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🏋️ Gym fits
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                👗 Wedding guest
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                🎿 Ski trip gear
              </span>
              <span className="whitespace-nowrap rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-sm">
                ☕ Coffee run fits
              </span>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 pb-24 pt-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                How it works
              </p>
            </div>
            <div className="grid gap-3 text-left text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Step 1
                </p>
                <p className="mt-2 font-medium text-foreground">Paste a Pinterest board</p>
                <p className="mt-1 text-muted-foreground">
                  Start with the outfits and pins you already saved.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Step 2
                </p>
                <p className="mt-2 font-medium text-foreground">
                  We find similar pieces
                </p>
                <p className="mt-1 text-muted-foreground">
                  Get shoppable matches from retailers you love, at prices you control.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Step 3
                </p>
                <p className="mt-2 font-medium text-foreground">Save your favorites</p>
                <p className="mt-1 text-muted-foreground">
                  Keep the best options in one place while you decide what to buy.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-xs text-muted-foreground">
        <div className="container mx-auto flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <span>Veri</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy">Privacy & terms</Link>
            <a href="mailto:smaisha@college.harvard.edu">smaisha@college.harvard.edu</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
