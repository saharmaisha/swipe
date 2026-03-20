import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { AnimatedHero } from '@/components/landing/AnimatedHero';
import { AnimatedHowItWorks } from '@/components/landing/AnimatedHowItWorks';

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
        <AnimatedHero isSignedIn={isSignedIn} />

        <section className="pb-16">
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
            Whatever you&apos;re looking for
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

        <AnimatedHowItWorks />
      </main>

      <footer className="border-t py-6 text-xs text-muted-foreground">
        <div className="container mx-auto flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <span>Veri</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy">Privacy & terms</Link>
            <a
              href={process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || 'https://forms.gle/68ZBQSur82AfAG8c8'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Feedback
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
