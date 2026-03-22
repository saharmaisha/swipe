import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appendToSheet, ensureHeaders } from '@/lib/services/google-sheets';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Look up the user's spreadsheet ID from their google_integrations row
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('google_connected, spreadsheet_id')
      .eq('user_id', user.id)
      .single();

    if (!integration?.google_connected) {
      return NextResponse.json({
        success: false,
        sync_status: 'not_configured',
        message: 'Google not connected. Visit Settings to connect your Google account.',
      });
    }

    const spreadsheetId = body.spreadsheet_id || integration?.spreadsheet_id;

    if (!spreadsheetId) {
      return NextResponse.json({
        success: false,
        sync_status: 'not_configured',
        message: 'No spreadsheet ID set. Add it in Settings.',
      });
    }

    // Ensure header row exists on first use
    await ensureHeaders(spreadsheetId, user.id);

    const result = await appendToSheet(
      spreadsheetId,
      {
        product: body.product,
        user_email: user.email || '',
        board_name: body.board_name,
        pin_id: body.pin_id,
        pin_title: body.pin_title,
        inspiration_image_url: body.inspiration_image_url,
        balanced_query: body.balanced_query,
        mode: body.mode,
      },
      user.id
    );

    return NextResponse.json({
      success: result.success,
      sync_status: result.success ? 'synced' : 'failed',
      error: result.error,
    });
  } catch (error) {
    console.error('Sheets append error:', error);
    return NextResponse.json({
      success: false,
      sync_status: 'failed',
      error: 'Failed to append to sheet',
    }, { status: 500 });
  }
}
