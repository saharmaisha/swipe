'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: 1,
    title: 'Paste a Pinterest board',
    description: 'Start with the outfits and pins you already saved.',
  },
  {
    number: 2,
    title: 'We find where to buy it',
    description: 'Get real product links from actual stores — not repins or dead-end posts. Set your budget and we handle the rest.',
  },
  {
    number: 3,
    title: 'Save your favorites',
    description: 'Keep the best options in one place while you decide what to buy.',
  },
];

export function AnimatedHowItWorks() {
  return (
    <section className="container mx-auto px-6 pb-24 pt-12">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-6 text-center"
        >
          <p className="text-sm font-medium text-muted-foreground">
            How it works
          </p>
        </motion.div>

        <div className="grid gap-3 text-left text-sm sm:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{
                duration: 0.5,
                ease: 'easeOut',
                delay: 0.1 + index * 0.1,
              }}
              className="rounded-xl border border-border/70 bg-card px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Step {step.number}
              </p>
              <p className="mt-2 font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
