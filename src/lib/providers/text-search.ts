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

// In-memory cache for SerpAPI responses (1 hour TTL)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const searchCache = new Map<string, { data: RawProduct[]; timestamp: number }>();

function getCacheKey(query: string): string {
  return `serpapi:${query.toLowerCase().trim()}`;
}

function getFromCache(query: string): RawProduct[] | null {
  const key = getCacheKey(query);
  const cached = searchCache.get(key);
  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }

  return cached.data;
}

function setInCache(query: string, data: RawProduct[]): void {
  const key = getCacheKey(query);
  searchCache.set(key, { data, timestamp: Date.now() });

  // Cleanup old entries (keep cache from growing unbounded)
  if (searchCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        searchCache.delete(k);
      }
    }
  }
}

interface SerpApiShoppingResult {
  position: number;
  title: string;
  link?: string;
  source: string;
  price?: string;
  extracted_price?: number;
  currency?: string;
  thumbnail?: string;
  product_link?: string;
  product_id?: string;
}

interface SerpApiResponse {
  shopping_results?: SerpApiShoppingResult[];
  error?: string;
}

function parsePriceText(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export class SerpApiTextShoppingProvider implements ShoppingProvider {
  name = 'serpapi-google-shopping';

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TEXT_SHOPPING_PROVIDER_KEY || '';
  }

  async searchByTextQueries(input: TextSearchInput): Promise<RawProduct[]> {
    if (!this.apiKey) {
      console.warn('[SerpAPI] No TEXT_SHOPPING_PROVIDER_KEY set');
      return [];
    }

    // Use only balanced_query (first query) for efficiency
    // Increase results per query to compensate for fewer queries
    const queries = [input.queries[0]];
    const resultsByQuery = await Promise.all(
      queries.map(async (query, queryIndex) => {
        // Check cache first
        const cached = getFromCache(query);
        if (cached) {
          return cached;
        }

        try {
          // SerpAPI only supports GET requests with URL parameters
          // API key in URL is acceptable for server-side calls
          const url = new URL('https://serpapi.com/search');
          url.searchParams.set('engine', 'google_shopping');
          url.searchParams.set('q', query);
          url.searchParams.set('api_key', this.apiKey);
          url.searchParams.set('num', '40');

          const res = await fetch(url.toString());

          if (!res.ok) {
            console.error(`[SerpAPI] HTTP ${res.status} for query: ${query}`);
            return [];
          }

          const data: SerpApiResponse = await res.json();

          if (data.error) {
            console.error(`[SerpAPI] API error: ${data.error}`);
            return [];
          }

          const results = (data.shopping_results || []).map((r) => ({
            id: r.product_id || `serpapi-${queryIndex}-${r.position}-${query.slice(0, 10)}`,
            title: r.title,
            retailer: r.source,
            price: r.extracted_price ?? parsePriceText(r.price) ?? undefined,
            currency: r.currency || 'USD',
            price_text: r.price || '',
            image_url: r.thumbnail || '',
            product_url: r.product_link || r.link || '',
          }));

          // Cache the results
          setInCache(query, results);

          return results;
        } catch (err) {
          console.error(`[SerpAPI] Fetch error for query "${query}":`, err);
          return [];
        }
      })
    );

    const allResults = resultsByQuery.flat();

    // Client-side budget filtering (more reliable than Google's tbs parameter)
    if (input.budget_max) {
      const max = input.budget_max;
      return allResults.filter((r) => {
        const price = typeof r.price === 'number' ? r.price : null;
        return price === null || price <= max;
      });
    }

    return allResults;
  }

  async searchByImage(_input: ImageSearchInput): Promise<RawProduct[]> {
    return [];
  }

  normalizeProducts(raw: RawProduct[]): NormalizedProduct[] {
    return raw
      .filter((r) => r.product_url && r.title)
      .map((r) => ({
        provider_product_id:
          (r.id as string) || `serpapi-${Math.random().toString(36).slice(2, 8)}`,
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
        match_reason: '',
        match_score: 0.65,
      }));
  }

  rankProducts(products: NormalizedProduct[], ctx: RankingContext): NormalizedProduct[] {
    return rankByHeuristics(products, ctx);
  }

  dedupeProducts(products: NormalizedProduct[]): NormalizedProduct[] {
    return dedupeByUrl(products);
  }
}
