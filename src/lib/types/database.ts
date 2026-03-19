export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PinterestAccount {
  id: string;
  user_id: string;
  pinterest_user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  connected_at: string;
  updated_at: string;
}

export interface PinterestBoard {
  id: string;
  user_id: string;
  pinterest_board_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  pin_count: number;
  source_type: 'api' | 'public_url';
  source_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PinterestPin {
  id: string;
  user_id: string;
  board_id: string;
  pinterest_pin_id: string;
  section_key: string | null;
  section_name: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  source_url: string | null;
  raw_payload: Record<string, unknown> | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface PinMediaRegion {
  id: string;
  pin_id: string;
  user_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string | null;
  created_at: string;
}

export interface PinAnalysis {
  id: string;
  pin_id: string;
  region_id: string | null;
  user_id: string;
  analysis_mode: 'full_pin' | 'region';
  short_description: string;
  category: string;
  primary_color: string;
  secondary_colors: string[];
  material_or_texture: string | null;
  silhouette: string | null;
  sleeve_length: string | null;
  strap_type: string | null;
  length: string | null;
  neckline: string | null;
  fit: string | null;
  notable_details: string[];
  occasion: string | null;
  style_keywords: string[];
  broad_query: string;
  balanced_query: string;
  specific_query: string;
  raw_model_output: Record<string, unknown>;
  created_at: string;
}

export interface SearchRun {
  id: string;
  analysis_id: string;
  user_id: string;
  mode: 'exact' | 'vibe' | 'both';
  search_scope?: 'single_pin' | 'selected_pins' | 'all_board';
  board_id?: string | null;
  board_name?: string | null;
  selected_pin_ids?: string[];
  selected_pin_count?: number;
  budget_min: number | null;
  budget_max: number | null;
  excluded_retailers: string[];
  provider_summary: Record<string, unknown> | null;
  created_at: string;
}

export interface ProductResult {
  id: string;
  search_run_id: string;
  user_id: string;
  source_provider: string;
  provider_product_id: string | null;
  title: string;
  retailer: string;
  price_text: string;
  numeric_price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  match_reason: string | null;
  match_score: number | null;
  board_id?: string | null;
  board_name?: string | null;
  source_pin_id?: string | null;
  source_pin_title?: string | null;
  source_pin_image_url?: string | null;
  balanced_query?: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  product_result_id: string;
  pin_id: string;
  search_run_id: string;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  default_budget_min: number | null;
  default_budget_max: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderLog {
  id: string;
  user_id: string;
  search_run_id: string;
  provider_name: string;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface AppEvent {
  id: string;
  user_id: string;
  event_type: string;
  path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AnalysisMode = PinAnalysis['analysis_mode'];
export type SearchMode = SearchRun['mode'];
export type SearchScope = NonNullable<SearchRun['search_scope']>;
export type PinterestBoardSource = PinterestBoard['source_type'];

export interface SavedItemWithProduct extends SavedItem {
  product: ProductResult;
  pin: PinterestPin;
}

export interface PinWithAnalysis extends PinterestPin {
  analyses: PinAnalysis[];
  has_results: boolean;
}

export interface SearchBoardSummary {
  id: string;
  name: string;
}
