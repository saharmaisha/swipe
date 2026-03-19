import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importPins, getPins } from '@/lib/services/pin-import';

export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pins = await getPins(user.id, id);
  return NextResponse.json({ pins });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await importPins(user.id, id);
    return NextResponse.json({
      pins: result.pins,
      warning: result.warning,
      expected_pin_count: result.expectedPinCount,
      fetched_pin_count: result.fetchedPinCount,
    });
  } catch (error) {
    console.error('Pin import error:', error);
    return NextResponse.json({ error: 'Failed to import pins' }, { status: 500 });
  }
}
