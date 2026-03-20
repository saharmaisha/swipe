import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { trackAppEvent } from '@/lib/services/app-events';
import { getPreferences, updatePreferences } from '@/lib/services/preferences';
import { preferencesSchema } from '@/lib/utils/validators';

export const dynamic = 'force-dynamic';

const preferencesUpdateSchema = preferencesSchema.extend({
  complete_onboarding: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const preferences = await getPreferences(user.id);
  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = preferencesUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid preferences payload' }, { status: 400 });
    }

    const { complete_onboarding, ...updates } = parsed.data;
    const preferences = await updatePreferences(user.id, updates);

    if (complete_onboarding) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', user.id);

      await trackAppEvent({
        userId: user.id,
        eventType: 'onboarding_completed',
        path: '/api/preferences',
        metadata: updates,
      });
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
