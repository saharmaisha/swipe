import { countRecentAppEvents, trackAppEvent } from '@/lib/services/app-events';

interface RateLimitOptions {
  userId: string;
  eventType: string;
  maxRequests: number;
  windowMs: number;
  path?: string;
}

export async function enforceRateLimit(options: RateLimitOptions) {
  const currentCount = await countRecentAppEvents(
    options.userId,
    options.eventType,
    options.windowMs
  );

  if (currentCount >= options.maxRequests) {
    const windowMinutes = Math.ceil(options.windowMs / 60000);
    throw new Error(`Rate limit reached. Please wait before trying again (${windowMinutes} minute window).`);
  }

  await trackAppEvent({
    userId: options.userId,
    eventType: options.eventType,
    path: options.path,
    metadata: {
      currentCount: currentCount + 1,
      maxRequests: options.maxRequests,
      windowMs: options.windowMs,
    },
  });
}
