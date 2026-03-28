import type { NormalizedProduct, RankingContext } from '@/lib/types/products';

const MAINSTREAM_RETAILERS = new Set([
  'asos', 'zara', 'h&m', 'hm', 'target', 'nordstrom', 'mango', 'uniqlo',
  'gap', 'banana republic', 'express', 'old navy', 'forever 21', 'topshop',
  'amazon', 'walmart', 'shein', 'boohoo', 'prettylittlething', 'missguided',
  'lulus', 'revolve', 'free people', 'anthropologie', 'urban outfitters',
]);

const LENGTH_KEYWORDS: Record<string, string[]> = {
  mini: ['mini'],
  'above-knee': ['above knee', 'above-the-knee'],
  'knee-length': ['knee length', 'knee-length'],
  midi: ['midi', 'mid length', 'mid-length'],
  maxi: ['maxi', 'floor length', 'floor-length'],
  cropped: ['cropped', 'crop'],
  'hip-length': ['hip length', 'hip-length'],
  'tunic-length': ['tunic length', 'tunic-length', 'longline'],
  ankle: ['ankle', 'ankle length', 'ankle-length'],
  'full-length': ['full length', 'full-length'],
};

const LENGTH_CONFLICTS: Record<string, string[]> = {
  mini: ['knee-length', 'midi', 'maxi', 'ankle', 'full-length'],
  'above-knee': ['midi', 'maxi', 'ankle', 'full-length'],
  'knee-length': ['mini', 'maxi', 'cropped', 'ankle', 'full-length'],
  midi: ['mini', 'above-knee', 'maxi', 'cropped'],
  maxi: ['mini', 'above-knee', 'knee-length', 'midi', 'cropped', 'hip-length'],
  cropped: ['midi', 'maxi', 'hip-length', 'tunic-length', 'ankle', 'full-length'],
  'hip-length': ['cropped', 'maxi', 'tunic-length'],
  'tunic-length': ['cropped', 'hip-length', 'mini'],
  ankle: ['mini', 'above-knee', 'cropped', 'maxi'],
  'full-length': ['mini', 'above-knee', 'cropped'],
};

const SLEEVE_KEYWORDS: Record<string, string[]> = {
  sleeveless: ['sleeveless', 'without sleeves'],
  cap: ['cap sleeve', 'cap sleeves'],
  short: ['short sleeve', 'short sleeves'],
  elbow: ['elbow sleeve', 'elbow sleeves'],
  'three-quarter': ['three quarter sleeve', 'three quarter sleeves', '3/4 sleeve', '3/4 sleeves'],
  long: ['long sleeve', 'long sleeves'],
  puff: ['puff sleeve', 'puff sleeves'],
  flutter: ['flutter sleeve', 'flutter sleeves'],
};

const SLEEVE_CONFLICTS: Record<string, string[]> = {
  sleeveless: ['cap', 'short', 'elbow', 'three-quarter', 'long'],
  cap: ['sleeveless', 'elbow', 'three-quarter', 'long'],
  short: ['sleeveless', 'elbow', 'three-quarter', 'long'],
  elbow: ['sleeveless', 'cap', 'short', 'long'],
  'three-quarter': ['sleeveless', 'cap', 'short', 'long'],
  long: ['sleeveless', 'cap', 'short', 'elbow', 'three-quarter'],
};

const FIT_KEYWORDS: Record<string, string[]> = {
  fitted: ['fitted', 'slim fit', 'bodycon', 'body hugging', 'body-hugging'],
  relaxed: ['relaxed', 'easy fit', 'easy-fit'],
  oversized: ['oversized', 'oversize'],
  tailored: ['tailored', 'structured', 'sharp fit'],
};

const FIT_CONFLICTS: Record<string, string[]> = {
  fitted: ['relaxed', 'oversized'],
  relaxed: ['fitted', 'tailored'],
  oversized: ['fitted', 'tailored'],
  tailored: ['relaxed', 'oversized'],
};

const MODE_WEIGHTS = {
  exact: {
    lengthMatch: 0.1,
    lengthConflict: 0.26,
    sleeveMatch: 0.06,
    sleeveConflict: 0.14,
    fitMatch: 0.05,
    fitConflict: 0.1,
    keywordMatch: 0.03,
  },
  similar: {
    lengthMatch: 0.08,
    lengthConflict: 0.2,
    sleeveMatch: 0.05,
    sleeveConflict: 0.1,
    fitMatch: 0.04,
    fitConflict: 0.07,
    keywordMatch: 0.025,
  },
  both: {
    lengthMatch: 0.08,
    lengthConflict: 0.2,
    sleeveMatch: 0.05,
    sleeveConflict: 0.1,
    fitMatch: 0.04,
    fitConflict: 0.07,
    keywordMatch: 0.025,
  },
  vibe: {
    lengthMatch: 0.05,
    lengthConflict: 0.12,
    sleeveMatch: 0.03,
    sleeveConflict: 0.06,
    fitMatch: 0.025,
    fitConflict: 0.04,
    keywordMatch: 0.02,
  },
} as const;

export function rankByHeuristics(
  products: NormalizedProduct[],
  ctx: RankingContext
): NormalizedProduct[] {
  return products
    .map((product) => ({
      ...product,
      match_score: computeScore(product, ctx),
    }))
    .sort((a, b) => b.match_score - a.match_score);
}

function computeScore(product: NormalizedProduct, ctx: RankingContext): number {
  let score = product.match_score || 0.5;
  const searchableText = getSearchableText(product);
  const modeWeights = MODE_WEIGHTS[ctx.mode] || MODE_WEIGHTS.similar;

  if (product.source_provider === 'serpapi-google-lens') {
    score += 0.08;
  }

  // Budget fit: boost products within budget
  if (product.numeric_price !== null) {
    if (ctx.budget_max && product.numeric_price <= ctx.budget_max) {
      score += 0.15;
      if (product.numeric_price <= ctx.budget_max * 0.7) {
        score += 0.05; // extra boost for well under budget
      }
    }
    if (ctx.budget_max && product.numeric_price > ctx.budget_max) {
      score -= 0.2;
    }
    if (ctx.budget_min && product.numeric_price < ctx.budget_min) {
      score -= 0.05; // slight penalty for suspiciously cheap
    }
  }

  const retailerLower = product.retailer.toLowerCase();

  // Mainstream retailer preference
  if (MAINSTREAM_RETAILERS.has(retailerLower)) {
    score += 0.1;
  }

  // Excluded retailers
  if (ctx.excluded_retailers.length > 0) {
    const excluded = ctx.excluded_retailers.map((r) => r.toLowerCase());
    if (excluded.includes(retailerLower)) {
      score -= 0.5;
    }
  }

  // Attribute overlap with analysis
  if (ctx.analysis_attributes.category) {
    if (matchesLiteral(searchableText, ctx.analysis_attributes.category)) {
      score += 0.05;
    }
  }
  if (ctx.analysis_attributes.primary_color) {
    if (matchesLiteral(searchableText, ctx.analysis_attributes.primary_color)) {
      score += 0.05;
    }
  }
  if (ctx.analysis_attributes.silhouette && matchesLiteral(searchableText, ctx.analysis_attributes.silhouette)) {
    score += 0.04;
  }
  if (ctx.analysis_attributes.neckline && matchesLiteral(searchableText, ctx.analysis_attributes.neckline)) {
    score += 0.03;
  }
  if (ctx.analysis_attributes.material_or_texture && matchesLiteral(searchableText, ctx.analysis_attributes.material_or_texture)) {
    score += 0.03;
  }
  if (ctx.analysis_attributes.strap_type && matchesLiteral(searchableText, ctx.analysis_attributes.strap_type)) {
    score += 0.025;
  }

  score = applyCanonicalAttributeScoring(
    score,
    searchableText,
    ctx.analysis_attributes.length,
    LENGTH_KEYWORDS,
    LENGTH_CONFLICTS,
    modeWeights.lengthMatch,
    modeWeights.lengthConflict
  );
  score = applyCanonicalAttributeScoring(
    score,
    searchableText,
    ctx.analysis_attributes.sleeve_length,
    SLEEVE_KEYWORDS,
    SLEEVE_CONFLICTS,
    modeWeights.sleeveMatch,
    modeWeights.sleeveConflict
  );
  score = applyCanonicalAttributeScoring(
    score,
    searchableText,
    ctx.analysis_attributes.fit,
    FIT_KEYWORDS,
    FIT_CONFLICTS,
    modeWeights.fitMatch,
    modeWeights.fitConflict
  );

  if (ctx.analysis_attributes.style_keywords?.length) {
    const matchingKeywords = ctx.analysis_attributes.style_keywords.filter((keyword) =>
      matchesLiteral(searchableText, keyword)
    );
    score += Math.min(matchingKeywords.length, 3) * modeWeights.keywordMatch;
  }

  return Math.max(0, Math.min(1, score));
}

export function generateMatchReason(product: NormalizedProduct, ctx: RankingContext): string {
  const reasons: string[] = [];
  const searchableText = getSearchableText(product);

  if (product.numeric_price !== null && ctx.budget_max && product.numeric_price <= ctx.budget_max) {
    reasons.push('Under budget');
  }

  const retailerLower = product.retailer.toLowerCase();
  if (MAINSTREAM_RETAILERS.has(retailerLower)) {
    reasons.push('Mainstream retailer');
  }

  if (ctx.analysis_attributes.length && matchesCanonicalAttribute(searchableText, ctx.analysis_attributes.length, LENGTH_KEYWORDS)) {
    reasons.push('Matching length');
  }

  if (ctx.analysis_attributes.sleeve_length && matchesCanonicalAttribute(searchableText, ctx.analysis_attributes.sleeve_length, SLEEVE_KEYWORDS)) {
    reasons.push('Matching sleeves');
  }

  if (product.match_score >= 0.85) {
    reasons.push('Strong match');
  } else if (product.match_score >= 0.7) {
    reasons.push('Good match');
  }

  return reasons.join(' · ') || 'Similar style';
}

function getSearchableText(product: NormalizedProduct): string {
  return normalizeText([product.title, product.retailer].filter(Boolean).join(' '));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesLiteral(searchableText: string, value: string): boolean {
  const normalizedValue = normalizeText(value);
  return normalizedValue.length > 0 && searchableText.includes(normalizedValue);
}

function detectCanonicalKey(
  value: string,
  keywords: Record<string, string[]>
): string | null {
  const normalizedValue = normalizeText(value);

  for (const [key, terms] of Object.entries(keywords)) {
    if (terms.some((term) => normalizedValue.includes(normalizeText(term)))) {
      return key;
    }
  }

  return null;
}

function detectCanonicalKeys(
  searchableText: string,
  keywords: Record<string, string[]>
): string[] {
  return Object.entries(keywords)
    .filter(([, terms]) => terms.some((term) => searchableText.includes(normalizeText(term))))
    .map(([key]) => key);
}

function matchesCanonicalAttribute(
  searchableText: string,
  value: string,
  keywords: Record<string, string[]>
): boolean {
  const expectedKey = detectCanonicalKey(value, keywords);
  if (!expectedKey) {
    return matchesLiteral(searchableText, value);
  }

  return detectCanonicalKeys(searchableText, keywords).includes(expectedKey);
}

function applyCanonicalAttributeScoring(
  score: number,
  searchableText: string,
  desiredValue: string | undefined,
  keywords: Record<string, string[]>,
  conflicts: Record<string, string[]>,
  matchBoost: number,
  conflictPenalty: number
): number {
  if (!desiredValue) {
    return score;
  }

  const desiredKey = detectCanonicalKey(desiredValue, keywords);
  if (!desiredKey) {
    return matchesLiteral(searchableText, desiredValue) ? score + matchBoost : score;
  }

  const titleKeys = detectCanonicalKeys(searchableText, keywords);

  if (titleKeys.includes(desiredKey)) {
    score += matchBoost;
  }

  if (titleKeys.some((key) => conflicts[desiredKey]?.includes(key))) {
    score -= conflictPenalty;
  }

  return score;
}
