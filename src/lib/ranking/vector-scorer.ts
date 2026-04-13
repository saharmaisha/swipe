import type { NormalizedProduct, RankingContext } from '@/lib/types/products';

/**
 * Vector Space Model for Fashion Product Ranking
 *
 * Encodes products and user preferences as vectors in a 22-dimensional space,
 * then uses cosine similarity to measure relevance. This provides a mathematically
 * grounded approach to ranking that complements heuristic scoring.
 *
 * Feature Dimensions (22 total):
 * - Occasion: formal, cocktail, casual, work (4)
 * - Style: minimalist, romantic, classic, trendy, boho, elegant, edgy (7)
 * - Length: mini, knee-length, midi, maxi (4)
 * - Color: black, white, red, blue, pink, green, neutral (7)
 */

// Feature dimension definitions
export const FEATURE_DIMENSIONS = {
  occasion: ['formal', 'cocktail', 'casual', 'work'] as const,
  style: ['minimalist', 'romantic', 'classic', 'trendy', 'boho', 'elegant', 'edgy'] as const,
  length: ['mini', 'knee-length', 'midi', 'maxi'] as const,
  color: ['black', 'white', 'red', 'blue', 'pink', 'green', 'neutral'] as const,
};

// Alternate terms that map to canonical features
const OCCASION_SYNONYMS: Record<string, string> = {
  'evening': 'formal',
  'gala': 'formal',
  'black tie': 'formal',
  'ball gown': 'formal',
  'party': 'cocktail',
  'wedding guest': 'cocktail',
  'special occasion': 'cocktail',
  'day': 'casual',
  'everyday': 'casual',
  'weekend': 'casual',
  'sundress': 'casual',
  'office': 'work',
  'professional': 'work',
  'business': 'work',
  'shift': 'work',
};

const LENGTH_SYNONYMS: Record<string, string> = {
  'short': 'mini',
  'above knee': 'mini',
  'above-knee': 'mini',
  'knee': 'knee-length',
  'knee length': 'knee-length',
  'mid-length': 'midi',
  'below knee': 'midi',
  'tea length': 'midi',
  'long': 'maxi',
  'floor length': 'maxi',
  'full length': 'maxi',
};

const COLOR_SYNONYMS: Record<string, string> = {
  'ivory': 'white',
  'cream': 'white',
  'off-white': 'white',
  'navy': 'blue',
  'royal blue': 'blue',
  'cobalt': 'blue',
  'blush': 'pink',
  'rose': 'pink',
  'fuchsia': 'pink',
  'burgundy': 'red',
  'wine': 'red',
  'crimson': 'red',
  'emerald': 'green',
  'sage': 'green',
  'olive': 'green',
  'beige': 'neutral',
  'tan': 'neutral',
  'camel': 'neutral',
  'nude': 'neutral',
  'gray': 'neutral',
  'grey': 'neutral',
};

export type FeatureVector = number[];

export interface VectorScoringResult {
  score: number;
  productVector: FeatureVector;
  preferenceVector: FeatureVector;
}

/**
 * Creates a one-hot encoding for a categorical feature.
 * Returns 1 for matching dimension, 0 for others.
 */
function encodeFeature(
  value: string | undefined | null,
  dimension: readonly string[],
  synonyms?: Record<string, string>
): number[] {
  const vector = new Array(dimension.length).fill(0);

  if (!value) return vector;

  const normalizedValue = value.toLowerCase().trim();

  // Check direct match first
  let matchIndex = dimension.findIndex((d) => normalizedValue.includes(d));

  // Check synonyms if no direct match
  if (matchIndex === -1 && synonyms) {
    for (const [synonym, canonical] of Object.entries(synonyms)) {
      if (normalizedValue.includes(synonym)) {
        matchIndex = dimension.findIndex((d) => d === canonical);
        break;
      }
    }
  }

  if (matchIndex !== -1) {
    vector[matchIndex] = 1;
  }

  return vector;
}

/**
 * Creates a multi-hot encoding for style keywords (multiple can be active).
 */
function encodeStyleKeywords(
  keywords: string[] | undefined,
  dimension: readonly string[]
): number[] {
  const vector = new Array(dimension.length).fill(0);

  if (!keywords || keywords.length === 0) return vector;

  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase().trim();
    const index = dimension.findIndex((d) => normalized.includes(d) || d.includes(normalized));
    if (index !== -1) {
      vector[index] = 1;
    }
  }

  return vector;
}

/**
 * Converts a product to a feature vector based on its title.
 * Parses the title to detect fashion attributes.
 */
export function productToVector(product: NormalizedProduct): FeatureVector {
  const titleLower = product.title.toLowerCase();

  return [
    // Occasion features (4 dimensions)
    ...encodeFeature(titleLower, FEATURE_DIMENSIONS.occasion, OCCASION_SYNONYMS),
    // Style features (7 dimensions) - check title for style keywords
    ...encodeStyleKeywords([titleLower], FEATURE_DIMENSIONS.style),
    // Length features (4 dimensions)
    ...encodeFeature(titleLower, FEATURE_DIMENSIONS.length, LENGTH_SYNONYMS),
    // Color features (7 dimensions)
    ...encodeFeature(titleLower, FEATURE_DIMENSIONS.color, COLOR_SYNONYMS),
  ];
}

/**
 * Converts user preferences/filters to a target vector.
 * This is what we're trying to match products against.
 */
export function preferencesToVector(ctx: RankingContext): FeatureVector {
  return [
    // Occasion (from filter or analysis)
    ...encodeFeature(
      ctx.analysis_attributes.occasion,
      FEATURE_DIMENSIONS.occasion,
      OCCASION_SYNONYMS
    ),
    // Style keywords (multi-hot encoding)
    ...encodeStyleKeywords(ctx.analysis_attributes.style_keywords, FEATURE_DIMENSIONS.style),
    // Length preference
    ...encodeFeature(
      ctx.analysis_attributes.length,
      FEATURE_DIMENSIONS.length,
      LENGTH_SYNONYMS
    ),
    // Color preference
    ...encodeFeature(
      ctx.analysis_attributes.primary_color,
      FEATURE_DIMENSIONS.color,
      COLOR_SYNONYMS
    ),
  ];
}

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between 0 (orthogonal) and 1 (identical direction).
 *
 * cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
 */
export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  // Handle zero vectors (no features detected)
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Computes weighted cosine similarity using learned weights per dimension.
 * Allows certain features (e.g., occasion) to matter more than others.
 */
export function weightedCosineSimilarity(
  a: FeatureVector,
  b: FeatureVector,
  weights: FeatureVector
): number {
  if (a.length !== b.length || a.length !== weights.length) {
    throw new Error('Vector length mismatch');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const weightedA = a[i] * weights[i];
    const weightedB = b[i] * weights[i];
    dotProduct += weightedA * weightedB;
    normA += weightedA * weightedA;
    normB += weightedB * weightedB;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Computes the vector similarity score for a product against user preferences.
 * Returns detailed scoring information for debugging.
 */
export function computeVectorScore(
  product: NormalizedProduct,
  ctx: RankingContext,
  weights?: FeatureVector
): VectorScoringResult {
  const productVector = productToVector(product);
  const preferenceVector = preferencesToVector(ctx);

  const score = weights
    ? weightedCosineSimilarity(productVector, preferenceVector, weights)
    : cosineSimilarity(productVector, preferenceVector);

  return {
    score,
    productVector,
    preferenceVector,
  };
}

/**
 * Default weights: equal importance for all 22 dimensions.
 * These can be optimized via gradient descent using swipe data.
 */
export const DEFAULT_WEIGHTS: FeatureVector = new Array(22).fill(1);

/**
 * Returns the total number of feature dimensions.
 */
export function getFeatureDimensionCount(): number {
  return (
    FEATURE_DIMENSIONS.occasion.length +
    FEATURE_DIMENSIONS.style.length +
    FEATURE_DIMENSIONS.length.length +
    FEATURE_DIMENSIONS.color.length
  );
}
