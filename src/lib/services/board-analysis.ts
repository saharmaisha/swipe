import OpenAI from 'openai';
import { z } from 'zod';
import { isOpenAIConfigured } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import {
  BOARD_ANALYSIS_SYSTEM_PROMPT,
  BOARD_ANALYSIS_USER_PROMPT,
} from '@/lib/prompts/board-analysis';
import type { PinterestPin } from '@/lib/types/database';

// Schema for board style profile
const boardStyleProfileSchema = z.object({
  dominant_categories: z.array(z.string()),
  color_palette: z.array(z.string()),
  style_aesthetic: z.string(),
  occasion_types: z.array(z.string()),
  price_tier_hints: z.string(),
  key_style_keywords: z.array(z.string()),
  board_search_queries: z.array(z.string()),
});

export type BoardStyleProfile = z.infer<typeof boardStyleProfileSchema>;

export interface BoardAnalysis {
  id: string;
  board_id: string;
  user_id: string;
  style_profile: BoardStyleProfile;
  analyzed_pin_count: number;
  created_at: string;
}

// Number of representative pins to analyze
const SAMPLE_PIN_COUNT = 8;

/**
 * Get or create a board style analysis.
 * Analyzes representative pins to understand the board's overall aesthetic.
 */
export async function getBoardStyleProfile(
  boardId: string,
  userId: string
): Promise<BoardAnalysis | null> {
  const supabase = await createClient();

  // Check for cached analysis (within last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('board_analyses')
    .select('*')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return existing as BoardAnalysis;
  }

  return null;
}

/**
 * Analyze a board's style by sampling representative pins.
 */
export async function analyzeBoardStyle(
  boardId: string,
  userId: string,
  pins: PinterestPin[]
): Promise<BoardAnalysis> {
  const supabase = await createClient();

  // Select representative pins (spread across the board)
  const samplePins = selectRepresentativePins(pins, SAMPLE_PIN_COUNT);

  if (samplePins.length === 0) {
    throw new Error('No pins available for board analysis');
  }

  let styleProfile: BoardStyleProfile;

  if (!isOpenAIConfigured()) {
    styleProfile = getDefaultBoardProfile();
  } else {
    styleProfile = await callOpenAIBoardAnalysis(samplePins);
  }

  // Store the analysis
  const { data, error } = await supabase
    .from('board_analyses')
    .insert({
      board_id: boardId,
      user_id: userId,
      style_profile: styleProfile,
      analyzed_pin_count: samplePins.length,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to store board analysis:', error);
    // Return a temporary analysis object
    return {
      id: 'temp',
      board_id: boardId,
      user_id: userId,
      style_profile: styleProfile,
      analyzed_pin_count: samplePins.length,
      created_at: new Date().toISOString(),
    };
  }

  return data as BoardAnalysis;
}

/**
 * Select representative pins from across the board.
 * Uses a spread algorithm to get diverse samples.
 */
function selectRepresentativePins(pins: PinterestPin[], count: number): PinterestPin[] {
  if (pins.length <= count) {
    return pins;
  }

  const step = Math.floor(pins.length / count);
  const selected: PinterestPin[] = [];

  for (let i = 0; i < count && i * step < pins.length; i++) {
    selected.push(pins[i * step]);
  }

  return selected;
}

/**
 * Call OpenAI Vision API with multiple board images.
 */
async function callOpenAIBoardAnalysis(pins: PinterestPin[]): Promise<BoardStyleProfile> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Build image content array
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: BOARD_ANALYSIS_USER_PROMPT },
  ];

  for (const pin of pins) {
    imageContent.push({
      type: 'image_url',
      image_url: { url: pin.image_url, detail: 'low' }, // Use 'low' detail to reduce tokens
    });
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: BOARD_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: imageContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  return boardStyleProfileSchema.parse(parsed);
}

/**
 * Default board profile when OpenAI is not configured.
 */
function getDefaultBoardProfile(): BoardStyleProfile {
  return {
    dominant_categories: ['dresses', 'tops', 'pants'],
    color_palette: ['neutral', 'black', 'white'],
    style_aesthetic: 'modern minimal',
    occasion_types: ['casual', 'versatile'],
    price_tier_hints: 'mid-range',
    key_style_keywords: ['modern', 'versatile', 'classic', 'minimal', 'chic'],
    board_search_queries: [
      'modern minimal dress',
      'classic neutral top',
      'versatile casual outfit',
    ],
  };
}

/**
 * Generate enhanced search queries using board context.
 * Combines individual pin analysis with board-level style insights.
 */
export function enhanceQueryWithBoardContext(
  pinQuery: string,
  boardProfile: BoardStyleProfile
): string {
  // Add board-level style context if not already present
  const styleKeyword = boardProfile.key_style_keywords[0];
  const aesthetic = boardProfile.style_aesthetic.split(' ')[0];

  // If the query doesn't contain style context, add it
  if (!pinQuery.toLowerCase().includes(aesthetic.toLowerCase())) {
    return `${pinQuery} ${aesthetic}`.trim();
  }

  return pinQuery;
}
