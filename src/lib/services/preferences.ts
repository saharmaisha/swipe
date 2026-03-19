import { createClient } from '@/lib/supabase/server';
import type { UserPreferences } from '@/lib/types/database';

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  default_budget_min: null,
  default_budget_max: 150,
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) return data as UserPreferences;

  return {
    id: 'default',
    user_id: userId,
    ...DEFAULT_PREFERENCES,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function updatePreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserPreferences> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Preferences update error:', error);
    return getPreferences(userId);
  }

  return data as UserPreferences;
}
