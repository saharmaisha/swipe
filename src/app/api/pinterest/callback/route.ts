import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangePinterestCode } from '@/lib/services/pinterest';
import { encrypt } from '@/lib/services/encryption';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=no_code`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const tokenResponse = await exchangePinterestCode(code);

    await supabase.from('pinterest_accounts').upsert(
      {
        user_id: user.id,
        pinterest_user_id: 'pending',
        access_token_encrypted: encrypt(tokenResponse.access_token),
        refresh_token_encrypted: tokenResponse.refresh_token
          ? encrypt(tokenResponse.refresh_token)
          : null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return NextResponse.redirect(`${origin}/boards?connected=true`);
  } catch (error) {
    console.error('Pinterest callback error:', error);
    return NextResponse.redirect(`${origin}/settings?error=pinterest_failed`);
  }
}
