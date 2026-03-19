import OpenAI from 'openai';
import { isOpenAIConfigured } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { analysisResultSchema, type AnalysisResult, type AnalysisRequest } from '@/lib/types/analysis';
import {
  IMAGE_ANALYSIS_SYSTEM_PROMPT,
  IMAGE_ANALYSIS_USER_PROMPT,
  IMAGE_ANALYSIS_CROP_USER_PROMPT,
} from '@/lib/prompts/image-analysis';
import { getMockAnalysis } from '@/lib/mock/analyses';
import type { PinAnalysis } from '@/lib/types/database';

export async function analyzeImage(request: AnalysisRequest, userId: string): Promise<PinAnalysis> {
  const supabase = await createClient();

  // Check for cached analysis (skip OpenAI if same pin analyzed before)
  if (!request.crop) {
    const { data: existing } = await supabase
      .from('pin_analyses')
      .select('*')
      .eq('pin_id', request.pin_id)
      .eq('analysis_mode', 'full_pin')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return existing as PinAnalysis;
    }
  }

  let result: AnalysisResult;

  if (!isOpenAIConfigured()) {
    const mockResult = getMockAnalysis(request.pin_id);
    if (mockResult) {
      result = mockResult;
    } else {
      result = getDefaultMockAnalysis();
    }
  } else {
    result = await callOpenAIVision(request);
  }

  const { data, error } = await supabase
    .from('pin_analyses')
    .insert({
      pin_id: request.pin_id,
      region_id: request.region_id || null,
      user_id: userId,
      analysis_mode: request.crop ? 'region' : 'full_pin',
      ...result,
      raw_model_output: result as unknown as Record<string, unknown>,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist analysis');
  }

  return data as PinAnalysis;
}

async function callOpenAIVision(request: AnalysisRequest): Promise<AnalysisResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPrompt = request.crop
    ? IMAGE_ANALYSIS_CROP_USER_PROMPT
    : IMAGE_ANALYSIS_USER_PROMPT;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: IMAGE_ANALYSIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: request.image_url, detail: 'high' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  return analysisResultSchema.parse(parsed);
}

function getDefaultMockAnalysis(): AnalysisResult {
  return {
    short_description: 'A stylish outfit piece suitable for various occasions',
    category: 'dress',
    primary_color: 'neutral',
    secondary_colors: [],
    material_or_texture: null,
    silhouette: 'A-line',
    sleeve_length: null,
    strap_type: null,
    length: 'midi',
    neckline: null,
    fit: 'regular',
    notable_details: [],
    occasion: 'versatile',
    style_keywords: ['modern', 'versatile', 'classic'],
    broad_query: 'midi dress',
    balanced_query: 'neutral A-line midi dress',
    specific_query: 'neutral tone A-line midi dress regular fit versatile occasion',
  };
}
