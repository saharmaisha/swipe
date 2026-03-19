import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackAppEvent } from '@/lib/services/app-events';
import { deleteSavedItem, getSavedItems, upsertSavedItem } from '@/lib/services/saved-items';
import { savedItemCreateSchema, savedItemDeleteSchema } from '@/lib/utils/validators';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const items = await getSavedItems(user.id);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load saved items' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = savedItemCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid save payload' }, { status: 400 });
    }

    const { product } = parsed.data;
    if (!product.source_pin_id) {
      return NextResponse.json({ error: 'Missing source pin for saved item' }, { status: 400 });
    }

    const item = await upsertSavedItem({
      userId: user.id,
      productResultId: product.id,
      pinId: product.source_pin_id,
      searchRunId: product.search_run_id,
    });

    await trackAppEvent({
      userId: user.id,
      eventType: 'product_saved',
      path: '/api/saved',
      metadata: {
        productResultId: product.id,
        searchRunId: product.search_run_id,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Save item error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = savedItemDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid delete payload' }, { status: 400 });
    }

    await deleteSavedItem(user.id, parsed.data.product_result_id);

    await trackAppEvent({
      userId: user.id,
      eventType: 'product_unsaved',
      path: '/api/saved',
      metadata: { productResultId: parsed.data.product_result_id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove saved item' },
      { status: 500 }
    );
  }
}
