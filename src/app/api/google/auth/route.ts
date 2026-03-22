import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'openid',
  'email',
].join(' ');

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';

  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID.' }, { status: 500 });
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(url.toString());
}
