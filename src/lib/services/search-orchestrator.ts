import { getTextProvider } from '@/lib/providers/registry';
import { rankByHeuristics, generateMatchReason } from '@/lib/ranking/ranker';
import { dedupeByUrl } from '@/lib/ranking/deduper';
import { createClient } from '@/lib/supabase/server';
import { generateSearchQueries } from '@/lib/search/query-expander';
import type {
  NormalizedProduct,
  BoardSearchScope,
  PinSearchContext,
  SearchFilters,
} from '@/lib/types/products';
import type {
  SearchBoardSummary,
  SearchRun,
  ProductResult,
} from '@/lib/types/database';
import type { BoardStyleProfile } from './board-analysis';

export interface SearchOrchestrationInput {
  pinSearches: PinSearchContext[];
  filters: SearchFilters;
  userId: string;
  boardId?: string | null;
  boardName?: string | null;
  searchScope?: 'single_pin' | BoardSearchScope;
  boardStyleProfile?: BoardStyleProfile;
}

export interface SearchOrchestrationResult {
  searchRun: SearchRun;
  products: ProductResult[];
  analyses: PinSearchContext['analysis'][];
  selectedPins: PinSearchContext['pin'][];
  board: SearchBoardSummary | null;
}

export async function orchestrateSearch(
  input: SearchOrchestrationInput
): Promise<SearchOrchestrationResult> {
  const {
    pinSearches,
    filters,
    userId,
    boardId = null,
    boardName = null,
    searchScope = 'single_pin',
    boardStyleProfile,
  } = input;

  if (pinSearches.length === 0) {
    throw new Error('No pins selected for search');
  }

  const textProvider = getTextProvider();

  const pinResults = await Promise.all(
    pinSearches.map(async (pinSearch) => {
      const { pin, analysis } = pinSearch;
      // Use query expansion to generate retail-friendly search terms
      // This maps "formal" → "evening gown", "black tie dress", etc.
      const queries = generateSearchQueries(analysis.balanced_query, filters);

      const textRaw = await textProvider.searchByTextQueries({
        queries,
        budget_min: filters.budget_min,
        budget_max: filters.budget_max,
        excluded_retailers: filters.excluded_retailers,
      });

      const textNormalized = textProvider.normalizeProducts(textRaw);
      // Merge board-level style keywords with pin analysis if available
      const mergedStyleKeywords = boardStyleProfile
        ? [...new Set([...analysis.style_keywords, ...boardStyleProfile.key_style_keywords.slice(0, 3)])]
        : analysis.style_keywords;

      // Merge user-selected style tags with analysis style keywords
      const combinedStyleKeywords = filters.style_tags?.length
        ? [...new Set([...filters.style_tags, ...mergedStyleKeywords])]
        : mergedStyleKeywords;

      const rankingContext = {
        budget_min: filters.budget_min,
        budget_max: filters.budget_max,
        excluded_retailers: filters.excluded_retailers,
        mode: filters.mode,
        analysis_attributes: {
          category: analysis.category,
          primary_color: filters.color || analysis.primary_color,
          silhouette: analysis.silhouette || undefined,
          sleeve_length: filters.sleeve_preference || analysis.sleeve_length || undefined,
          length: filters.length || analysis.length || undefined,
          fit: analysis.fit || undefined,
          neckline: analysis.neckline || undefined,
          material_or_texture: analysis.material_or_texture || undefined,
          strap_type: analysis.strap_type || undefined,
          style_keywords: combinedStyleKeywords,
          occasion: filters.occasion || undefined,
        },
        // Include board style for ranking boost
        boardStyleAesthetic: boardStyleProfile?.style_aesthetic,
      };

      const rankedProducts = rankByHeuristics(
        dedupeByUrl(textNormalized),
        rankingContext
      ).map((product) => ({
        ...product,
        board_id: boardId,
        board_name: boardName,
        source_pin_id: pin.id,
        source_pin_title: pin.title,
        source_pin_image_url: pin.image_url,
        balanced_query: analysis.balanced_query,
        match_reason: product.match_reason || generateMatchReason(product, rankingContext),
      }));

      return {
        rankedProducts,
        textResultCount: textNormalized.length,
      };
    })
  );

  let combinedProducts: NormalizedProduct[] = pinResults.flatMap((result) => result.rankedProducts);
  const totalTextResults = pinResults.reduce((sum, result) => sum + result.textResultCount, 0);

  combinedProducts = dedupeByUrl(combinedProducts).sort(
    (a, b) => (b.match_score || 0) - (a.match_score || 0)
  );

  const analyses = pinSearches.map((pinSearch) => pinSearch.analysis);
  const selectedPins = pinSearches.map((pinSearch) => pinSearch.pin);
  const supabase = await createClient();
  const providerSummary = {
    text_provider: textProvider.name,
    text_results: totalTextResults,
    analyzed_pins: selectedPins.length,
    total_after_dedupe: combinedProducts.length,
  };

  const { data: searchRunData, error: searchRunError } = await supabase
    .from('search_runs')
    .insert({
      analysis_id: analyses[0]?.id,
      user_id: userId,
      mode: filters.mode,
      search_scope: searchScope,
      board_id: boardId,
      board_name: boardName,
      selected_pin_ids: selectedPins.map((pin) => pin.id),
      selected_pin_count: selectedPins.length,
      budget_min: filters.budget_min || null,
      budget_max: filters.budget_max || null,
      excluded_retailers: filters.excluded_retailers,
      provider_summary: providerSummary,
    })
    .select('*')
    .single();

  if (searchRunError || !searchRunData) {
    throw new Error(searchRunError?.message || 'Failed to create search run');
  }

  const searchRun = searchRunData as SearchRun;
  let products: ProductResult[] = [];

  if (combinedProducts.length > 0) {
    const { data: productRows, error: productError } = await supabase
      .from('product_results')
      .insert(
        combinedProducts.map((p) => ({
          search_run_id: searchRun.id,
          user_id: userId,
          source_provider: p.source_provider,
          provider_product_id: p.provider_product_id,
          title: p.title,
          retailer: p.retailer,
          price_text: p.price_text,
          numeric_price: p.numeric_price,
          currency: p.currency,
          image_url: p.image_url,
          product_url: p.product_url,
          retailer_url: p.retailer_url || null,
          match_reason: p.match_reason,
          match_score: p.match_score,
          board_id: p.board_id || null,
          board_name: p.board_name || null,
          source_pin_id: p.source_pin_id || null,
          source_pin_title: p.source_pin_title || null,
          source_pin_image_url: p.source_pin_image_url || null,
          balanced_query: p.balanced_query || null,
          raw_payload: p.raw_payload || null,
        }))
      )
      .select('*');

    if (productError) {
      throw new Error(productError.message);
    }

    products = ((productRows as ProductResult[]) || []).sort(
      (a, b) => (b.match_score || 0) - (a.match_score || 0)
    );
  }

  return {
    searchRun,
    products,
    analyses,
    selectedPins,
    board: boardId && boardName ? { id: boardId, name: boardName } : null,
  };
}
