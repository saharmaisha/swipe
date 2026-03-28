import type {
  PinAnalysis,
  PinterestPin,
  ProductResult,
  SearchBoardSummary,
  SearchRun,
} from '@/lib/types/database';

export interface NormalizedProduct {
  provider_product_id: string;
  source_provider: string;
  title: string;
  retailer: string;
  price_text: string;
  numeric_price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  retailer_url?: string | null;
  match_reason: string;
  match_score: number;
  board_id?: string | null;
  board_name?: string | null;
  source_pin_id?: string | null;
  source_pin_title?: string | null;
  source_pin_image_url?: string | null;
  balanced_query?: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface RawProduct {
  id?: string;
  title: string;
  retailer?: string;
  price?: string | number;
  currency?: string;
  image_url?: string;
  product_url?: string;
  [key: string]: unknown;
}

export interface TextSearchInput {
  queries: string[];
  budget_min?: number;
  budget_max?: number;
  excluded_retailers?: string[];
}

export interface ImageSearchInput {
  image_url: string;
  budget_min?: number;
  budget_max?: number;
}

export interface RankingContext {
  budget_min?: number;
  budget_max?: number;
  excluded_retailers: string[];
  mode: 'exact' | 'similar' | 'vibe' | 'both';
  analysis_attributes: {
    category?: string;
    primary_color?: string;
    silhouette?: string;
    sleeve_length?: string;
    length?: string;
    fit?: string;
    neckline?: string;
    material_or_texture?: string;
    strap_type?: string;
    style_keywords?: string[];
  };
}

export interface SearchFilters {
  budget_min?: number;
  budget_max?: number;
  excluded_retailers: string[];
  length?: string;
  sleeve_preference?: string;
  color?: string;
  mode: 'exact' | 'similar' | 'vibe' | 'both';
}

export type BoardSearchScope = 'all_board' | 'selected_pins';

export interface PinSearchContext {
  pin: PinterestPin;
  analysis: PinAnalysis;
  imageUrl?: string;
}

export interface BoardSearchRequest {
  board_id: string;
  board_name?: string;
  pins: PinterestPin[];
  selected_pin_ids?: string[];
  search_scope: BoardSearchScope;
  budget_min?: number;
  budget_max?: number;
  excluded_retailers?: string[];
}

export interface SearchSessionData {
  searchRun: SearchRun;
  products: ProductResult[];
  analyses?: PinAnalysis[];
  selectedPins?: PinterestPin[];
  board?: SearchBoardSummary | null;
}

export const DEFAULT_FILTERS: SearchFilters = {
  excluded_retailers: [],
  mode: 'both',
};
