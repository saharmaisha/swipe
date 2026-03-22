import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/services/encryption';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?error=google_denied`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('Google token exchange failed:', text);
      return NextResponse.redirect(`${origin}/settings?error=google_token_failed`);
    }

    const tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    } = await tokenRes.json();

    // Encrypt and upsert into google_integrations
    await supabase.from('google_integrations').upsert(
      {
        user_id: user.id,
        google_connected: true,
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return NextResponse.redirect(`${origin}/settings?google_connected=true`);
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(`${origin}/settings?error=google_failed`);
  }
}
