import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await supabase.from('google_integrations').upsert(
    {
      user_id: user.id,
      google_connected: false,
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      spreadsheet_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return NextResponse.json({ success: true });
}
