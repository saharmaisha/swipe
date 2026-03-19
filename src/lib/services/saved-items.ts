import { createClient } from '@/lib/supabase/server';
import type { SavedItemWithProduct } from '@/lib/types/database';

// Select all columns to match SavedItemWithProduct type
const SAVED_ITEM_SELECT = `
  *,
  product:product_results(*),
  pin:pinterest_pins(*)
`;

export async function getSavedItems(userId: string): Promise<SavedItemWithProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_items')
    .select(SAVED_ITEM_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as SavedItemWithProduct[]) || [];
}

export async function upsertSavedItem(input: {
  userId: string;
  productResultId: string;
  pinId: string;
  searchRunId: string;
}): Promise<SavedItemWithProduct> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_items')
    .upsert(
      {
        user_id: input.userId,
        product_result_id: input.productResultId,
        pin_id: input.pinId,
        search_run_id: input.searchRunId,
      },
      { onConflict: 'user_id,product_result_id' }
    )
    .select(SAVED_ITEM_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save item');
  }

  return data as SavedItemWithProduct;
}

export async function deleteSavedItem(userId: string, productResultId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_result_id', productResultId);

  if (error) {
    throw new Error(error.message);
  }
}
