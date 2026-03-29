'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnimatedHeroProps {
  isSignedIn: boolean;
}

export function AnimatedHero({ isSignedIn }: AnimatedHeroProps) {
  return (
    <section className="container mx-auto flex min-h-[min(calc(100vh-9rem),36rem)] items-center px-6 pb-12 pt-20 sm:pt-24">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Shop the looks you&apos;ve already saved
        </motion.div>

        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
            className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
          >
            Pin it. Find it. Wear it.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
            className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Pinterest shows you the outfit. We find where to actually buy
            it — real products from real stores, not just more pins.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
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
        </motion.div>
      </div>
    </section>
  );
}
