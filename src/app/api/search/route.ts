import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackAppEvent } from '@/lib/services/app-events';
import { analyzeImage } from '@/lib/services/image-analysis';
import { analyzeBoardStyle, getBoardStyleProfile } from '@/lib/services/board-analysis';
import { getPreferences } from '@/lib/services/preferences';
import { enforceRateLimit } from '@/lib/services/rate-limit';
import { orchestrateSearch } from '@/lib/services/search-orchestrator';
import type { BoardSearchRequest, SearchFilters } from '@/lib/types/products';
import type { PinAnalysis, PinterestPin } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
import { searchRequestSchema } from '@/lib/utils/validators';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = searchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search payload' }, { status: 400 });
    }

    await enforceRateLimit({
      userId: user.id,
      eventType: 'search_request',
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
      path: '/api/search',
    });

    const preferences = await getPreferences(user.id);
    const payload = parsed.data;

    const filters: SearchFilters = {
      budget_min: payload.budget_min ?? preferences.default_budget_min ?? undefined,
      budget_max: payload.budget_max ?? preferences.default_budget_max ?? undefined,
      excluded_retailers: payload.excluded_retailers || [],
      length: payload.length ?? payload.dress_length,
      sleeve_preference: payload.sleeve_preference,
      color: payload.color,
      mode: payload.mode || 'both',
      occasion: payload.occasion,
      style_tags: payload.style_tags,
    };

    if ('pins' in payload) {
      const boardRequest = payload as BoardSearchRequest;
      const selectedPins = boardRequest.search_scope === 'selected_pins' && boardRequest.selected_pin_ids?.length
        ? boardRequest.pins.filter((pin) => boardRequest.selected_pin_ids?.includes(pin.id))
        : boardRequest.pins;

      if (selectedPins.length === 0) {
        return NextResponse.json({ error: 'Select at least one pin.' }, { status: 400 });
      }

      // For board-level searches with multiple pins, optionally analyze board style
      // This runs in parallel with pin analyses to save time
      const boardStylePromise = boardRequest.board_id && selectedPins.length >= 3
        ? (async () => {
            try {
              // Check for existing board analysis
              let boardAnalysis = await getBoardStyleProfile(boardRequest.board_id, user.id);

              // If no cached analysis, create one (but don't block on it)
              if (!boardAnalysis) {
                boardAnalysis = await analyzeBoardStyle(
                  boardRequest.board_id,
                  user.id,
                  boardRequest.pins
                );
              }

              return boardAnalysis;
            } catch {
              // Board analysis is optional - don't fail the search
              return null;
            }
          })()
        : Promise.resolve(null);

      const [analyses, boardAnalysis] = await Promise.all([
        Promise.all(
          selectedPins.map((pin) =>
            analyzeImage(
              {
                pin_id: pin.id,
                image_url: pin.image_url,
              },
              user.id
            )
          )
        ),
        boardStylePromise,
      ]);

      const result = await orchestrateSearch({
        pinSearches: selectedPins.map((pin, index) => ({
          pin,
          analysis: analyses[index],
          imageUrl: pin.image_url,
        })),
        filters,
        userId: user.id,
        boardId: boardRequest.board_id,
        boardName: boardRequest.board_name || null,
        searchScope: boardRequest.search_scope,
        boardStyleProfile: boardAnalysis?.style_profile,
      });

      await trackAppEvent({
        userId: user.id,
        eventType: 'search_completed',
        path: '/api/search',
        metadata: {
          searchRunId: result.searchRun.id,
          searchScope: boardRequest.search_scope,
          selectedPinCount: selectedPins.length,
          productCount: result.products.length,
          usedBoardStyle: !!boardAnalysis,
        },
      });

      return NextResponse.json({
        search_run_id: result.searchRun.id,
        search_run: result.searchRun,
        products: result.products,
        analyses: result.analyses,
        selected_pins: result.selectedPins,
        board: result.board,
        board_style: boardAnalysis?.style_profile,
      });
    }

    const analysis: PinAnalysis = payload.analysis;
    const pin: PinterestPin = payload.pin
      ? {
          ...payload.pin,
          section_key: payload.pin.section_key ?? null,
          section_name: payload.pin.section_name ?? null,
        }
      : {
          id: analysis.pin_id,
          user_id: user.id,
          board_id: payload.board_id || '',
          pinterest_pin_id: analysis.pin_id,
          section_key: null,
          section_name: null,
          title: payload.pin_title || null,
          description: null,
          image_url: payload.image_url || '',
          source_url: null,
          raw_payload: null,
          imported_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

    const result = await orchestrateSearch({
      pinSearches: [{ pin, analysis, imageUrl: payload.image_url || pin.image_url }],
      filters,
      userId: user.id,
      boardId: payload.board_id || pin.board_id || null,
      boardName: payload.board_name || null,
      searchScope: 'single_pin',
    });

    await trackAppEvent({
      userId: user.id,
      eventType: 'search_completed',
      path: '/api/search',
      metadata: {
        searchRunId: result.searchRun.id,
        searchScope: 'single_pin',
        selectedPinCount: 1,
        productCount: result.products.length,
      },
    });

    return NextResponse.json({
      search_run_id: result.searchRun.id,
      search_run: result.searchRun,
      products: result.products,
      analyses: result.analyses,
      selected_pins: result.selectedPins,
      board: result.board,
      analysis,
    });
  } catch (error) {
    console.error('Search error:', error);
    const status =
      error instanceof Error && error.message.toLowerCase().includes('rate limit') ? 429 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status }
    );
  }
}
