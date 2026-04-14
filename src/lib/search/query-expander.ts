import type { SearchFilters } from '@/lib/types/products';

/**
 * Query Expansion for Retail Search
 *
 * Maps user-friendly filter terms to the vocabulary retailers actually use
 * in product titles. For example, "formal" → "evening gown", "black tie dress".
 *
 * This addresses the vocabulary mismatch between how users think about
 * fashion (formal, casual) vs how retailers title products (evening gown,
 * day dress, office wear).
 */

// Occasion filter → retail terminology used in product titles
export const OCCASION_EXPANSIONS: Record<string, string[]> = {
  formal: [
    'evening gown',
    'black tie dress',
    'gala dress',
    'ball gown',
    'formal dress',
    'floor length evening',
  ],
  cocktail: [
    'party dress',
    'wedding guest dress',
    'special occasion dress',
    'semi-formal dress',
    'cocktail dress',
  ],
  casual: [
    'day dress',
    'everyday dress',
    'casual dress',
    'sundress',
    'weekend dress',
  ],
  work: [
    'office dress',
    'professional dress',
    'business dress',
    'shift dress',
    'workwear dress',
  ],
};

// Style filter → retail terminology
export const STYLE_EXPANSIONS: Record<string, string[]> = {
  minimalist: ['simple dress', 'clean lines', 'modern minimal'],
  romantic: ['feminine dress', 'floral dress', 'lace dress', 'ruffle dress'],
  boho: ['bohemian dress', 'flowy dress', 'festival dress', 'peasant dress'],
  elegant: ['sophisticated dress', 'refined dress', 'timeless dress'],
  edgy: ['modern dress', 'asymmetric dress', 'structural dress'],
  classic: ['classic dress', 'timeless dress', 'traditional dress'],
  trendy: ['trendy dress', 'fashion forward', 'on trend'],
};

// Length filter → alternate retail terms
export const LENGTH_EXPANSIONS: Record<string, string[]> = {
  midi: ['mid-length dress', 'below knee dress', 'tea length dress', 'midi dress'],
  maxi: ['floor length dress', 'long dress', 'full length dress', 'maxi dress'],
  mini: ['short dress', 'above knee dress', 'mini dress'],
  'knee-length': ['knee length dress', 'knee-length dress'],
};

// Color filter → include common alternate terms
export const COLOR_EXPANSIONS: Record<string, string[]> = {
  black: ['black dress', 'noir dress', 'little black dress'],
  white: ['white dress', 'pure white dress', 'bright white dress'],
  ivory: ['ivory dress', 'cream dress', 'off-white dress'],
  neutral: ['beige dress', 'tan dress', 'camel dress', 'nude dress'],
  brown: ['brown dress', 'chocolate dress', 'mocha dress', 'espresso dress'],
  red: ['red dress', 'crimson dress', 'scarlet dress'],
  burgundy: ['burgundy dress', 'maroon dress', 'wine dress', 'oxblood dress'],
  orange: ['orange dress', 'coral dress', 'tangerine dress', 'peach dress'],
  yellow: ['yellow dress', 'lemon dress', 'mustard dress', 'golden yellow dress'],
  green: ['green dress', 'emerald dress', 'sage dress', 'olive dress'],
  blue: ['blue dress', 'royal blue dress', 'cobalt dress', 'sky blue dress'],
  navy: ['navy dress', 'navy blue dress', 'dark blue dress', 'midnight blue dress'],
  purple: ['purple dress', 'violet dress', 'plum dress', 'lavender dress'],
  pink: ['pink dress', 'blush dress', 'rose dress', 'fuchsia dress'],
  gold: ['gold dress', 'golden dress', 'metallic gold dress', 'champagne dress'],
  silver: ['silver dress', 'metallic silver dress', 'pewter dress', 'platinum dress'],
};

export interface QueryExpansionResult {
  primary: string; // Main query with filters prepended
  variants: string[]; // Alternative queries using retail vocabulary
}

/**
 * Expands a base query with retail-friendly terminology based on filters.
 *
 * Instead of just prepending "formal midi black" to a query, this generates
 * alternative queries like "evening gown mid-length black" that match how
 * retailers actually title their products.
 *
 * @param baseQuery - The original search query (e.g., "floral dress")
 * @param filters - User-selected filters (occasion, style, length, color)
 * @returns Primary query + up to 2 variant queries
 */
export function expandQuery(
  baseQuery: string,
  filters: SearchFilters
): QueryExpansionResult {
  // Build primary query by prepending filter terms directly
  const primaryParts: string[] = [];
  if (filters.occasion) primaryParts.push(filters.occasion);
  if (filters.style_tags?.length) primaryParts.push(filters.style_tags[0]);
  // Add first color for primary query (to avoid overly long queries)
  if (filters.colors?.length) primaryParts.push(filters.colors[0]);
  if (filters.length) primaryParts.push(filters.length);

  const primary = primaryParts.length > 0
    ? `${primaryParts.join(' ')} ${baseQuery}`.trim()
    : baseQuery;

  // Generate variant queries using retail vocabulary
  const variants: string[] = [];

  // Variant 1: Use occasion expansion (most impactful)
  if (filters.occasion && OCCASION_EXPANSIONS[filters.occasion]) {
    const occasionTerms = OCCASION_EXPANSIONS[filters.occasion];
    // Pick a random retail term for variety
    const retailTerm = occasionTerms[0];
    const variantParts: string[] = [retailTerm];

    // Add first color if specified (colors are pretty universal)
    if (filters.colors?.length) variantParts.push(filters.colors[0]);

    // Add length expansion if specified
    if (filters.length && LENGTH_EXPANSIONS[filters.length]) {
      variantParts.push(LENGTH_EXPANSIONS[filters.length][0]);
    }

    variants.push(variantParts.join(' '));
  }

  // Variant 2: Style + length focused
  if (filters.style_tags?.length && STYLE_EXPANSIONS[filters.style_tags[0]]) {
    const styleTerms = STYLE_EXPANSIONS[filters.style_tags[0]];
    const variantParts: string[] = [styleTerms[0]];

    if (filters.length && LENGTH_EXPANSIONS[filters.length]) {
      variantParts.push(LENGTH_EXPANSIONS[filters.length][0]);
    }
    if (filters.colors?.length) variantParts.push(filters.colors[0]);

    variants.push(variantParts.join(' '));
  }

  // Variant 3: Color-focused if we have color expansions
  const firstColor = filters.colors?.[0];
  if (firstColor && COLOR_EXPANSIONS[firstColor]) {
    const colorTerms = COLOR_EXPANSIONS[firstColor];
    // Use a more specific color term (e.g., "navy" instead of "blue")
    if (colorTerms.length > 1) {
      const variantParts: string[] = [];

      // Use alternate color term
      const altColorTerm = colorTerms[1].replace(' dress', '');
      variantParts.push(altColorTerm);

      if (filters.occasion) variantParts.push(filters.occasion);
      if (filters.length) variantParts.push(filters.length);

      variantParts.push('dress');
      variants.push(variantParts.join(' '));
    }
  }

  // Dedupe and limit to 2 variants
  const uniqueVariants = [...new Set(variants)]
    .filter((v) => v !== primary && v.trim().length > 0)
    .slice(0, 2);

  return {
    primary,
    variants: uniqueVariants,
  };
}

/**
 * Generates all search queries to execute.
 * Returns primary + variants + original base query as fallback.
 */
export function generateSearchQueries(
  baseQuery: string,
  filters: SearchFilters
): string[] {
  const expansion = expandQuery(baseQuery, filters);

  // Return queries in order of expected relevance
  const queries = [
    expansion.primary,
    ...expansion.variants,
    baseQuery, // Original as fallback
  ];

  // Dedupe while preserving order
  return [...new Set(queries)].slice(0, 3);
}
