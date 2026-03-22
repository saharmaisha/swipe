import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data } = await supabase
    .from('google_integrations')
    .select('google_connected, spreadsheet_id, sheet_name')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    connected: data?.google_connected || false,
    spreadsheet_id: data?.spreadsheet_id || null,
    sheet_name: data?.sheet_name || 'Sheet1',
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase.from('google_integrations').upsert(
    {
      user_id: user.id,
      spreadsheet_id: body.spreadsheet_id || null,
      sheet_name: body.sheet_name || 'Sheet1',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
