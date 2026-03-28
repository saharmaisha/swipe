import type { ShoppingProvider } from './types';
import type {
  RawProduct,
  NormalizedProduct,
  TextSearchInput,
  ImageSearchInput,
  RankingContext,
} from '@/lib/types/products';
import { rankByHeuristics } from '@/lib/ranking/ranker';
import { dedupeByUrl } from '@/lib/ranking/deduper';

const CACHE_TTL_MS = 60 * 60 * 1000;
const lensCache = new Map<string, { data: RawProduct[]; timestamp: number }>();

function getCacheKey(imageUrl: string): string {
  return `lens:${imageUrl}`;
}

function getFromCache(imageUrl: string): RawProduct[] | null {
  const key = getCacheKey(imageUrl);
  const cached = lensCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    lensCache.delete(key);
    return null;
  }

  return cached.data;
}

function setInCache(imageUrl: string, data: RawProduct[]): void {
  const key = getCacheKey(imageUrl);
  lensCache.set(key, { data, timestamp: Date.now() });

  if (lensCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of lensCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        lensCache.delete(k);
      }
    }
  }
}

interface LensVisualMatch {
  position: number;
  title: string;
  link?: string;
  source?: string;
  source_icon?: string;
  price?: {
    value?: string;
    extracted_value?: number;
    currency?: string;
  };
  in_stock?: boolean;
  thumbnail?: string;
  image?: string;
}

interface LensApiResponse {
  visual_matches?: LensVisualMatch[];
  error?: string;
}

export class SerpApiLensProvider implements ShoppingProvider {
  name = 'serpapi-google-lens';

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TEXT_SHOPPING_PROVIDER_KEY || '';
  }

  async searchByTextQueries(_input: TextSearchInput): Promise<RawProduct[]> {
    return [];
  }

  async searchByImage(input: ImageSearchInput): Promise<RawProduct[]> {
    if (!this.apiKey) {
      console.warn('[SerpAPI Lens] No TEXT_SHOPPING_PROVIDER_KEY set');
      return [];
    }

    const cached = getFromCache(input.image_url);
    if (cached) {
      return this.applyBudgetFilter(cached, input.budget_max);
    }

    try {
      const url = new URL('https://serpapi.com/search');
      url.searchParams.set('engine', 'google_lens');
      url.searchParams.set('url', input.image_url);
      url.searchParams.set('type', 'visual_matches');
      url.searchParams.set('api_key', this.apiKey);

      const res = await fetch(url.toString());

      if (!res.ok) {
        console.error(`[SerpAPI Lens] HTTP ${res.status} for image: ${input.image_url}`);
        return [];
      }

      const data: LensApiResponse = await res.json();

      if (data.error) {
        console.error(`[SerpAPI Lens] API error: ${data.error}`);
        return [];
      }

      const results: RawProduct[] = (data.visual_matches || [])
        .filter((m) => m.link && m.title)
        .map((m, idx) => ({
          id: `lens-${idx}-${m.position}`,
          title: m.title,
          retailer: m.source || 'Unknown',
          price: m.price?.extracted_value ?? undefined,
          currency: m.price?.currency || 'USD',
          price_text: m.price?.value || '',
          image_url: m.thumbnail || m.image || '',
          product_url: m.link || '',
          retailer_url: m.link || '',
          in_stock: m.in_stock,
        }));

      setInCache(input.image_url, results);

      return this.applyBudgetFilter(results, input.budget_max);
    } catch (err) {
      console.error(`[SerpAPI Lens] Fetch error:`, err);
      return [];
    }
  }

  private applyBudgetFilter(results: RawProduct[], budgetMax?: number): RawProduct[] {
    if (!budgetMax) return results;
    return results.filter((r) => {
      const price = typeof r.price === 'number' ? r.price : null;
      return price === null || price <= budgetMax;
    });
  }

  normalizeProducts(raw: RawProduct[]): NormalizedProduct[] {
    return raw
      .filter((r) => r.product_url && r.title)
      .map((r) => ({
        provider_product_id:
          (r.id as string) || `lens-${Math.random().toString(36).slice(2, 8)}`,
        source_provider: this.name,
        title: r.title,
        retailer: (r.retailer as string) || 'Unknown',
        price_text:
          (r.price_text as string) ||
          (typeof r.price === 'number' ? `$${(r.price as number).toFixed(2)}` : 'N/A'),
        numeric_price: typeof r.price === 'number' ? (r.price as number) : null,
        currency: (r.currency as string) || 'USD',
        image_url: (r.image_url as string) || '',
        product_url: (r.product_url as string) || '',
        retailer_url: (r.retailer_url as string) || null,
        match_reason: '',
        match_score: 0.75,
      }));
  }

  rankProducts(products: NormalizedProduct[], ctx: RankingContext): NormalizedProduct[] {
    return rankByHeuristics(products, ctx);
  }

  dedupeProducts(products: NormalizedProduct[]): NormalizedProduct[] {
    return dedupeByUrl(products);
  }
}
