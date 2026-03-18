import { createClient } from '@/lib/supabase/server';

export interface AppEventInput {
  userId: string;
  eventType: string;
  path?: string | null;
  metadata?: Record<string, unknown>;
}

export async function trackAppEvent(input: AppEventInput) {
  const supabase = await createClient();

  await supabase.from('app_events').insert({
    user_id: input.userId,
    event_type: input.eventType,
    path: input.path ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function countRecentAppEvents(
  userId: string,
  eventType: string,
  windowMs: number
): Promise<number> {
  const supabase = await createClient();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from('app_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', since);

  return count ?? 0;
}

export async function isFirstTrackedEvent(userId: string, eventType: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('app_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType);

  return (count ?? 0) === 0;
}
