import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { swipeInteractionSchema } from '@/lib/utils/validators';
import { optimizeWeights, type TrainingExample } from '@/lib/ranking/weight-optimizer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/swipe-interactions
 * Records a swipe interaction (save/skip) with feature vectors for training.
 */
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
    const parsed = swipeInteractionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { product_result_id, search_run_id, action, product_features, preference_features } =
      parsed.data;

    // Insert the swipe interaction
    const { data: interaction, error } = await supabase
      .from('swipe_interactions')
      .insert({
        user_id: user.id,
        product_result_id,
        search_run_id,
        action,
        product_features,
        preference_features,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Swipe interaction insert error:', error);
      return NextResponse.json({ error: 'Failed to record interaction' }, { status: 500 });
    }

    return NextResponse.json({ id: interaction.id, recorded: true });
  } catch (error) {
    console.error('Swipe interaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record interaction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/swipe-interactions
 * Gets swipe statistics for the current user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get counts by action type
    const { data: interactions, error } = await supabase
      .from('swipe_interactions')
      .select('action')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    const saves = interactions?.filter((i) => i.action === 'save').length || 0;
    const skips = interactions?.filter((i) => i.action === 'skip').length || 0;

    // Get learned weights if available
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('learned_weights, weights_updated_at')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      total: saves + skips,
      saves,
      skips,
      hasLearnedWeights: !!prefs?.learned_weights,
      weightsUpdatedAt: prefs?.weights_updated_at || null,
    });
  } catch (error) {
    console.error('Get swipe stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/swipe-interactions
 * Triggers weight optimization based on swipe history.
 */
export async function PATCH() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch recent swipe interactions
    const { data: interactions, error: fetchError } = await supabase
      .from('swipe_interactions')
      .select('product_features, preference_features, action')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (fetchError) {
      throw fetchError;
    }

    if (!interactions || interactions.length < 20) {
      return NextResponse.json(
        { error: 'Not enough data for training. Need at least 20 interactions.' },
        { status: 400 }
      );
    }

    // Convert to training examples
    const examples: TrainingExample[] = interactions.map((i) => ({
      productFeatures: i.product_features as number[],
      preferenceFeatures: i.preference_features as number[],
      label: i.action === 'save' ? 1 : 0,
    }));

    // Run optimization
    const result = optimizeWeights(examples);

    // Persist learned weights
    const { error: updateError } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          learned_weights: result.weights,
          weights_updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      trainingExamples: examples.length,
      initialLoss: result.initialLoss,
      finalLoss: result.finalLoss,
      iterations: result.iterations,
      converged: result.converged,
    });
  } catch (error) {
    console.error('Weight optimization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to optimize weights' },
      { status: 500 }
    );
  }
}
