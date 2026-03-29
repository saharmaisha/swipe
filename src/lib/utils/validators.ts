import { z } from 'zod';

export const analysisRequestSchema = z.object({
  pin_id: z.string().min(1),
  image_url: z.string().url().or(z.string().min(1)),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
});

const pinterestPinSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  board_id: z.string().min(1),
  pinterest_pin_id: z.string().min(1),
  section_key: z.string().nullable().optional(),
  section_name: z.string().nullable().optional(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image_url: z.string().url().or(z.string().min(1)),
  source_url: z.string().nullable(),
  raw_payload: z.record(z.string(), z.unknown()).nullable(),
  imported_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const pinAnalysisSchema = z.object({
  id: z.string().min(1),
  pin_id: z.string().min(1),
  region_id: z.string().nullable(),
  user_id: z.string().min(1),
  analysis_mode: z.enum(['full_pin', 'region']),
  short_description: z.string(),
  category: z.string(),
  primary_color: z.string(),
  secondary_colors: z.array(z.string()),
  material_or_texture: z.string().nullable(),
  silhouette: z.string().nullable(),
  sleeve_length: z.string().nullable(),
  strap_type: z.string().nullable(),
  length: z.string().nullable(),
  neckline: z.string().nullable(),
  fit: z.string().nullable(),
  notable_details: z.array(z.string()),
  occasion: z.string().nullable(),
  style_keywords: z.array(z.string()),
  broad_query: z.string(),
  balanced_query: z.string(),
  specific_query: z.string(),
  raw_model_output: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

const boardSearchRequestSchema = z.object({
  board_id: z.string().min(1),
  board_name: z.string().optional(),
  pins: z.array(pinterestPinSchema).min(1),
  selected_pin_ids: z.array(z.string().min(1)).optional(),
  search_scope: z.enum(['all_board', 'selected_pins']),
  budget_min: z.number().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  excluded_retailers: z.array(z.string()).optional(),
  mode: z.enum(['similar', 'vibe', 'both']).optional(),
  length: z.string().optional(),
  dress_length: z.string().optional(),
  sleeve_preference: z.string().optional(),
  color: z.string().optional(),
});

const singlePinSearchRequestSchema = z.object({
  analysis: pinAnalysisSchema,
  pin: pinterestPinSchema.optional(),
  board_id: z.string().optional(),
  board_name: z.string().optional(),
  pin_title: z.string().optional(),
  image_url: z.string().url().or(z.string().min(1)).optional(),
  budget_min: z.number().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  excluded_retailers: z.array(z.string()).optional(),
  mode: z.enum(['similar', 'vibe', 'both']).optional(),
  length: z.string().optional(),
  dress_length: z.string().optional(),
  sleeve_preference: z.string().optional(),
  color: z.string().optional(),
});

export const searchRequestSchema = z.union([boardSearchRequestSchema, singlePinSearchRequestSchema]);

export const sheetsAppendSchema = z.object({
  product: z.object({
    title: z.string(),
    retailer: z.string(),
    price_text: z.string(),
    numeric_price: z.number().nullable(),
    currency: z.string(),
    product_url: z.string().url(),
    image_url: z.string().url().or(z.string().min(1)),
    match_reason: z.string().nullable(),
  }),
  spreadsheet_id: z.string().optional(),
  search_run_id: z.string().optional(),
  pin_id: z.string().optional(),
  pin_title: z.string().optional(),
  board_name: z.string().optional(),
  inspiration_image_url: z.string().optional(),
  balanced_query: z.string().optional(),
  mode: z.string().optional(),
});

export const boardImportSchema = z.object({
  board_url: z.string().url().optional(),
});

export const preferencesSchema = z.object({
  default_budget_min: z.number().nullable().optional(),
  default_budget_max: z.number().nullable().optional(),
});

export const savedItemCreateSchema = z.object({
  product: z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    search_run_id: z.string().uuid(),
    source_provider: z.string(),
    provider_product_id: z.string().nullable(),
    source_pin_id: z.string().uuid().nullable().optional(),
    title: z.string(),
    retailer: z.string(),
    price_text: z.string(),
    numeric_price: z.number().nullable(),
    currency: z.string(),
    image_url: z.string().url().or(z.string().min(1)),
    product_url: z.string().url(),
    match_reason: z.string().nullable(),
    match_score: z.number().nullable(),
    board_id: z.string().uuid().nullable().optional(),
    board_name: z.string().nullable().optional(),
    source_pin_title: z.string().nullable().optional(),
    source_pin_image_url: z.string().nullable().optional(),
    balanced_query: z.string().nullable().optional(),
    raw_payload: z.record(z.string(), z.unknown()).nullable().optional(),
    created_at: z.string(),
  }),
  board_name: z.string().nullable().optional(),
  pin_title: z.string().nullable().optional(),
  inspiration_image_url: z.string().nullable().optional(),
  balanced_query: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
});

export const savedItemDeleteSchema = z.object({
  product_result_id: z.string().uuid(),
});

export const analyticsEventSchema = z.object({
  event_type: z.string().min(1).max(100),
  path: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
