import { createClient } from '@/lib/supabase/server';
import type { PinterestBoard, PinterestPin, PinterestBoardSource } from '@/lib/types/database';
import { connectBrowser } from '@/lib/services/browserbase';
import type { Page, Response } from 'playwright-core';

const PINTEREST_ORIGIN = 'https://www.pinterest.com';
const PINTEREST_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PUBLIC_BOARD_SOURCE_TYPE: PinterestBoardSource = 'public_url';
const BOARD_SCRIPT_ID = '__PWS_INITIAL_PROPS__';
const BOARD_FEED_RESOURCE_PATH = '/resource/BoardFeedResource/get/';
const MAX_SCROLL_ITERATIONS = 80;
const MAX_STALLED_ITERATIONS = 12;
const SCROLL_DELAY_MS = 750;
const PINTEREST_BROWSER_VIEWPORT = { width: 1280, height: 2200 };
const PINTEREST_BROWSER_TIMEOUT_SECONDS = 600;

type JsonRecord = Record<string, unknown>;

interface PinterestInitialState {
  boards?: Record<string, JsonRecord>;
  pins?: Record<string, JsonRecord>;
  feeds?: Record<string, unknown>;
}

interface ParsedPublicBoard {
  pinterestBoardId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pinCount: number;
  expectedPinCount: number | null;
  sourceUrl: string;
  rawPayload: JsonRecord;
}

interface ParsedPublicPin {
  pinterestPinId: string;
  sectionKey: string | null;
  sectionName: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string;
  sourceUrl: string | null;
  rawPayload: JsonRecord;
}

interface ParsedPublicBoardImport {
  board: ParsedPublicBoard;
  pins: ParsedPublicPin[];
}

interface SectionInfo {
  url: string;
  sectionKey: string;
  sectionName: string | null;
}

interface BrowserScrapeResult extends ParsedPublicBoardImport {
  detectedSections: SectionInfo[];
}

export interface PublicImportWarning {
  expected_pin_count: number;
  fetched_pin_count: number;
  message: string;
}

export interface PublicBoardImportResult {
  board: PinterestBoard;
  pins: PinterestPin[];
  warning: PublicImportWarning | null;
  expectedPinCount: number | null;
  fetchedPinCount: number;
}

interface PinterestResourceResponse {
  resource_response?: {
    data?: unknown[];
    bookmark?: string | null;
  };
}

type PublicSourceKind = 'board' | 'section';

interface PublicBoardSourceInfo {
  normalizedUrl: string;
  normalizedPath: string;
  rootBoardPath: string;
  sourceKind: PublicSourceKind;
  sectionKey: string | null;
  sectionName: string | null;
}

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripSectionSuffix(value: string): string {
  return value.split('::section:')[0] ?? value;
}

function stripPinSectionSuffix(value: string): string {
  return stripSectionSuffix(value);
}

function normalizePath(pathname: string): {
  normalizedPath: string;
  rootBoardPath: string;
  sourceKind: PublicSourceKind;
  sectionKey: string | null;
  sectionName: string | null;
} {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    throw new Error(
      'Enter a valid Pinterest board or board section URL like https://www.pinterest.com/username/board-name/'
    );
  }

  if (['pin', 'search', 'ideas'].includes(segments[0].toLowerCase())) {
    throw new Error('Only public Pinterest board or board section URLs are supported.');
  }

  const boardSegments = [segments[0], segments[1]];
  const sectionSegment = segments[2] ?? null;
  const sourceSegments = sectionSegment ? [...boardSegments, sectionSegment] : boardSegments;
  const normalizedPath = `/${sourceSegments.join('/')}/`;
  const rootBoardPath = `/${boardSegments.join('/')}/`;
  const sectionKey = sectionSegment
    ? `${boardSegments.join('/')}/${sectionSegment}`.toLowerCase()
    : null;
  const sectionName = sectionSegment
    ? safeDecodePathSegment(sectionSegment).replace(/[-_]+/g, ' ').trim() || null
    : null;

  return {
    normalizedPath,
    rootBoardPath,
    sourceKind: sectionSegment ? 'section' : 'board',
    sectionKey,
    sectionName,
  };
}

function parsePublicPinterestSource(input: string): PublicBoardSourceInfo {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a valid Pinterest board URL.');
  }

  if (!/(\.|^)pinterest\.com$/i.test(url.hostname)) {
    throw new Error('Only public Pinterest board URLs are supported.');
  }

  const normalized = new URL(PINTEREST_ORIGIN);
  const parsed = normalizePath(url.pathname);
  normalized.pathname = parsed.normalizedPath;

  return {
    normalizedUrl: normalized.toString(),
    normalizedPath: parsed.normalizedPath,
    rootBoardPath: parsed.rootBoardPath,
    sourceKind: parsed.sourceKind,
    sectionKey: parsed.sectionKey,
    sectionName: parsed.sectionName,
  };
}

export function normalizePublicPinterestBoardUrl(input: string): string {
  return parsePublicPinterestSource(input).normalizedUrl;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isNaN(parsed) ? _match : String.fromCodePoint(parsed);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
      const parsed = Number.parseInt(hex, 16);
      return Number.isNaN(parsed) ? _match : String.fromCodePoint(parsed);
    });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

function sanitizeBoardDescription(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+-\s+/, '')
    .replace(/\s+See more ideas about.*$/i, '')
    .replace(/^Explore .*? on Pinterest\.?\s*/i, '')
    .replace(/^Discover recipes, home ideas, style inspiration and other ideas to try\.?\s*/i, '')
    .trim();

  return cleaned || null;
}

function getMetaContent(html: string, key: string): string | null {
  const tags = html.match(/<meta[^>]*>/gi) ?? [];

  for (const tag of tags) {
    if (!new RegExp(`(?:name|property)=["']${key}["']`, 'i').test(tag)) {
      continue;
    }

    const doubleQuoted = tag.match(/content="([^"]*)"/i);
    if (doubleQuoted?.[1]) {
      return cleanText(doubleQuoted[1]);
    }

    const singleQuoted = tag.match(/content='([^']*)'/i);
    if (singleQuoted?.[1]) {
      return cleanText(singleQuoted[1]);
    }
  }

  return null;
}

function getJsonScriptContent(html: string, scriptId: string): string {
  const escapedId = scriptId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(`<script[^>]*id=["']${escapedId}["'][^>]*>([\\s\\S]*?)</script>`, 'i')
  );

  if (!match?.[1]) {
    throw new Error(`Pinterest page is missing ${scriptId}.`);
  }

  return match[1];
}

function getInitialState(html: string): PinterestInitialState {
  const script = getJsonScriptContent(html, BOARD_SCRIPT_ID);
  const payload = JSON.parse(script) as { initialReduxState?: PinterestInitialState };

  if (!payload.initialReduxState) {
    throw new Error('Pinterest page is missing board state.');
  }

  return payload.initialReduxState;
}

function getBestImageUrl(images: unknown): string {
  if (!images || typeof images !== 'object') {
    return '';
  }

  const record = images as Record<string, { url?: string }>;
  const preferredSizes = ['orig', 'originals', '736x', '564x', '474x', '236x', '170x'];

  for (const size of preferredSizes) {
    const url = record[size]?.url;
    if (url) {
      return url;
    }
  }

  for (const image of Object.values(record)) {
    if (image?.url) {
      return image.url;
    }
  }

  return '';
}

function getExpectedPinCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stripTrailingSlash(value: string | null | undefined): string {
  return (value ?? '').replace(/\/+$/, '');
}

function normalizeComparablePath(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  try {
    return stripTrailingSlash(new URL(value, PINTEREST_ORIGIN).pathname);
  } catch {
    return stripTrailingSlash(value);
  }
}

function isMatchingFeedSourcePath(
  sourcePath: string | null,
  source: PublicBoardSourceInfo
): boolean {
  if (!sourcePath) {
    return true;
  }

  const normalizedSourcePath = normalizeComparablePath(sourcePath);
  const normalizedPath = normalizeComparablePath(source.normalizedPath);
  const rootPath = normalizeComparablePath(source.rootBoardPath);

  if (source.sourceKind === 'section') {
    return normalizedSourcePath === normalizedPath;
  }

  return (
    normalizedSourcePath === normalizedPath ||
    normalizedSourcePath === rootPath ||
    normalizedSourcePath.startsWith(`${rootPath}/`)
  );
}

function extractSectionUrlsFromHtml(
  html: string,
  source: PublicBoardSourceInfo
): Array<{ url: string; sectionKey: string; sectionName: string | null }> {
  if (source.sourceKind === 'section') {
    return [];
  }

  const matches = html.matchAll(/href=["']([^"'#?]+(?:\?[^"']*)?)["']/gi);
  const sections = new Map<string, { url: string; sectionKey: string; sectionName: string | null }>();
  const rootPath = normalizeComparablePath(source.rootBoardPath);

  for (const match of matches) {
    const href = match[1];
    if (!href) {
      continue;
    }

    try {
      const url = new URL(href, PINTEREST_ORIGIN);
      if (!/(\.|^)pinterest\.com$/i.test(url.hostname)) {
        continue;
      }

      const parsed = normalizePath(url.pathname);
      if (
        parsed.sourceKind !== 'section' ||
        normalizeComparablePath(parsed.rootBoardPath) !== rootPath ||
        !parsed.sectionKey
      ) {
        continue;
      }

      const normalizedUrl = new URL(PINTEREST_ORIGIN);
      normalizedUrl.pathname = parsed.normalizedPath;

      sections.set(parsed.sectionKey, {
        url: normalizedUrl.toString(),
        sectionKey: parsed.sectionKey,
        sectionName: parsed.sectionName,
      });
    } catch {
      continue;
    }
  }

  return Array.from(sections.values()).sort((a, b) =>
    (a.sectionName || a.sectionKey).localeCompare(b.sectionName || b.sectionKey)
  );
}

function getBoardFromState(state: PinterestInitialState, rootBoardPath: string): JsonRecord {
  const boards = Object.values(state.boards ?? {});

  if (boards.length === 0) {
    throw new Error('Pinterest board data was not found on the page.');
  }

  const matchingBoard = boards.find((board) => {
    const boardUrl = typeof board.url === 'string' ? board.url : null;
    return normalizeComparablePath(boardUrl) === normalizeComparablePath(rootBoardPath);
  });

  return matchingBoard ?? boards[0];
}

function getFeedPinIds(state: PinterestInitialState, pinterestBoardId: string): string[] {
  const feed = state.feeds?.[`boardfeed:${pinterestBoardId}`];

  if (Array.isArray(feed)) {
    return feed
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const typedItem = item as { type?: string; id?: string };
        return typedItem.type === 'pin' ? typedItem.id ?? null : null;
      })
      .filter((id): id is string => Boolean(id));
  }

  return [];
}

function getPinDescription(pin: JsonRecord): string | null {
  return (
    cleanText(pin.description) ||
    cleanText(pin.unauth_on_page_description) ||
    cleanText(pin.seo_alt_text) ||
    cleanText(pin.auto_alt_text)
  );
}

function parseBoardPin(
  pin: JsonRecord,
  expectedBoardId: string,
  source: PublicBoardSourceInfo
): ParsedPublicPin | null {
  const board = asRecord(pin.board);
  const boardId = typeof board?.id === 'string' ? board.id : null;
  const boardUrl = typeof board?.url === 'string' ? board.url : null;

  if (boardId && boardId !== expectedBoardId) {
    return null;
  }

  if (boardUrl) {
    const norm = normalizeComparablePath(boardUrl);
    const root = normalizeComparablePath(source.rootBoardPath);
    const sectionPath = normalizeComparablePath(source.normalizedPath);
    const matchesRoot = norm === root;
    const matchesSection = source.sectionKey && norm === sectionPath;
    if (!matchesRoot && !matchesSection) {
      return null;
    }
  }

  const rawPinId = String(pin.id ?? '');
  const pinterestPinId = source.sectionKey
    ? `${rawPinId}::section:${source.sectionKey}`
    : rawPinId;
  const imageUrl = getBestImageUrl(pin.images);

  if (!pinterestPinId || !imageUrl) {
    return null;
  }

  return {
    pinterestPinId,
    sectionKey: source.sectionKey,
    sectionName: source.sectionName,
    title: cleanText(pin.grid_title) || cleanText(pin.title),
    description: getPinDescription(pin),
    imageUrl,
    sourceUrl: cleanText(pin.link),
    rawPayload: pin,
  };
}

function parsePublicBoard(html: string, source: PublicBoardSourceInfo): ParsedPublicBoardImport {
  const state = getInitialState(html);
  const rawBoard = getBoardFromState(state, source.rootBoardPath);
  const rawBoardId = String(rawBoard.id ?? '');

  if (!rawBoardId) {
    throw new Error('Pinterest board ID is missing from the page.');
  }

  const pinterestBoardId = source.sectionKey
    ? `${rawBoardId}::section:${source.sectionKey}`
    : rawBoardId;

  const rawPins = state.pins ?? {};
  const feedPinIds = getFeedPinIds(state, rawBoardId);
  const candidatePinsById = new Map<string, JsonRecord>();

  for (const pinId of feedPinIds) {
    const pin = rawPins[pinId];
    if (pin) {
      candidatePinsById.set(pinId, pin);
    }
  }

  for (const [pinId, pin] of Object.entries(rawPins)) {
    if (pin) {
      candidatePinsById.set(pinId, pin);
    }
  }

  const candidatePins = Array.from(candidatePinsById.values());
  const pins = candidatePins
    .map((pin) => parseBoardPin(pin, rawBoardId, source))
    .filter((pin): pin is ParsedPublicPin => Boolean(pin));

  if (pins.length === 0) {
    throw new Error('No pins could be extracted from this public Pinterest board.');
  }

  const boardTitleBase = cleanText(rawBoard.name) ?? 'Imported Pinterest board';
  const boardTitle =
    source.sourceKind === 'section' && source.sectionName
      ? `${boardTitleBase} / ${source.sectionName}`
      : boardTitleBase;
  const boardImage =
    getBestImageUrl(rawBoard.cover_images) ||
    cleanText(getMetaContent(html, 'og:image'));
  const boardDescription =
    sanitizeBoardDescription(cleanText(rawBoard.description)) ||
    sanitizeBoardDescription(cleanText(getMetaContent(html, 'description')));

  return {
    board: {
      pinterestBoardId,
      name: boardTitle,
      description: boardDescription,
      imageUrl: boardImage,
      pinCount: pins.length,
      expectedPinCount: getExpectedPinCount(rawBoard.pin_count),
      sourceUrl: source.normalizedUrl,
      rawPayload: rawBoard,
    },
    pins,
  };
}

async function fetchPublicBoardHtml(boardUrl: string): Promise<string> {
  const response = await fetch(boardUrl, {
    cache: 'no-store',
    headers: {
      'user-agent': PINTEREST_USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Pinterest board page (${response.status})`);
  }

  return response.text();
}

function getBoardFeedRequestInfo(responseUrl: string): {
  boardId: string | null;
  sourcePath: string | null;
} {
  const url = new URL(responseUrl);
  const sourcePath = url.searchParams.get('source_url');
  const dataParam = url.searchParams.get('data');

  if (!dataParam) {
    return { boardId: null, sourcePath };
  }

  try {
    const payload = JSON.parse(dataParam) as { options?: { board_id?: string | number } };
    return {
      boardId:
        payload.options?.board_id !== undefined && payload.options?.board_id !== null
          ? String(payload.options.board_id)
          : null,
      sourcePath,
    };
  } catch {
    return {
      boardId: null,
      sourcePath,
    };
  }
}

async function scrapePublicPinterestBoardWithBrowser(
  source: PublicBoardSourceInfo,
  fallbackParsed: ParsedPublicBoardImport,
  options?: { extractSections?: boolean }
): Promise<BrowserScrapeResult> {
  return withPinterestBrowser((page) =>
    scrapePublicPinterestBoardPage(page, source, fallbackParsed, options)
  );
}

async function withPinterestBrowser<T>(callback: (page: Page) => Promise<T>): Promise<T> {
  const { browser, page } = await connectBrowser({
    viewport: PINTEREST_BROWSER_VIEWPORT,
    userAgent: PINTEREST_USER_AGENT,
    timeoutSeconds: PINTEREST_BROWSER_TIMEOUT_SECONDS,
  });

  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function scrapePublicPinterestBoardPage(
  page: Page,
  source: PublicBoardSourceInfo,
  fallbackParsed: ParsedPublicBoardImport,
  options?: { extractSections?: boolean }
): Promise<BrowserScrapeResult> {
  const targetPinCount = fallbackParsed.board.expectedPinCount;
  const pinMap = new Map<string, ParsedPublicPin>(
    fallbackParsed.pins.map((pin) => [pin.pinterestPinId, pin])
  );
  const responseTasks = new Set<Promise<void>>();

  const handleResponse = (response: Response) => {
    if (!response.url().includes(BOARD_FEED_RESOURCE_PATH)) {
      return;
    }

    const task = (async () => {
      const requestInfo = getBoardFeedRequestInfo(response.url());

      if (
        requestInfo.boardId !== stripSectionSuffix(fallbackParsed.board.pinterestBoardId) ||
        !isMatchingFeedSourcePath(requestInfo.sourcePath, source)
      ) {
        return;
      }

      const payload = (await response.json()) as PinterestResourceResponse;
      const data = payload.resource_response?.data;

      if (!Array.isArray(data)) {
        return;
      }

      for (const item of data) {
        const parsedPin = parseBoardPin(
          item as JsonRecord,
          stripSectionSuffix(fallbackParsed.board.pinterestBoardId),
          source
        );

        if (parsedPin) {
          pinMap.set(parsedPin.pinterestPinId, parsedPin);
        }
      }
    })().finally(() => {
      responseTasks.delete(task);
    });

    responseTasks.add(task);
  };

  page.on('response', handleResponse);

  try {
    await page.goto(source.normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('a[href*="/pin/"]', { timeout: 15000 });

    let stalledIterations = 0;
    let lastPinCount = pinMap.size;

    for (
      let iteration = 0;
      iteration < MAX_SCROLL_ITERATIONS && stalledIterations < MAX_STALLED_ITERATIONS;
      iteration += 1
    ) {
      if (targetPinCount && pinMap.size >= targetPinCount) {
        break;
      }

      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(window.innerHeight * 0.9));
      });
      await page.waitForTimeout(SCROLL_DELAY_MS);
      await Promise.allSettled([...responseTasks]);

      const currentPinCount = pinMap.size;
      if (currentPinCount === lastPinCount) {
        stalledIterations += 1;
      } else {
        stalledIterations = 0;
        lastPinCount = currentPinCount;
      }
    }

    await Promise.allSettled([...responseTasks]);

    // Extract section URLs from the rendered DOM before closing browser
    let detectedSections: SectionInfo[] = [];
    if (options?.extractSections && source.sourceKind === 'board') {
      const rootPath = source.rootBoardPath;
      detectedSections = await page.evaluate((rootBoardPath: string) => {
        const sections: Array<{ url: string; sectionKey: string; sectionName: string | null }> = [];
        const rootPathNormalized = rootBoardPath.toLowerCase().replace(/\/$/, '');
        const seen = new Set<string>();

        // Find all anchor tags
        const links = document.querySelectorAll('a[href]');
        links.forEach((link) => {
          const href = link.getAttribute('href');
          if (!href) return;

          try {
            const url = new URL(href, 'https://www.pinterest.com');
            if (!/(\.|^)pinterest\.com$/i.test(url.hostname)) return;

            const segments = url.pathname.split('/').filter(Boolean);
            // Section URLs have 3 segments: username/board/section
            if (segments.length !== 3) return;

            const boardPath = `/${segments[0]}/${segments[1]}`;
            if (boardPath.toLowerCase() !== rootPathNormalized) return;

            const sectionKey = `${segments[0]}/${segments[1]}/${segments[2]}`.toLowerCase();
            if (seen.has(sectionKey)) return;
            seen.add(sectionKey);

            // Format section name: replace hyphens with spaces, capitalize words
            const rawName = segments[2].replace(/-/g, ' ');
            const sectionName = rawName.replace(/\b\w/g, (c) => c.toUpperCase());

            sections.push({
              url: `https://www.pinterest.com/${segments[0]}/${segments[1]}/${segments[2]}/`,
              sectionKey,
              sectionName,
            });
          } catch {
            // Ignore invalid URLs
          }
        });

        return sections.sort((a, b) =>
          (a.sectionName || a.sectionKey).localeCompare(b.sectionName || b.sectionKey)
        );
      }, rootPath);
    }

    // Store results before finally block
    const result: BrowserScrapeResult =
      pinMap.size <= fallbackParsed.pins.length
        ? { ...fallbackParsed, detectedSections }
        : {
            board: {
              ...fallbackParsed.board,
              pinCount: pinMap.size,
            },
            pins: Array.from(pinMap.values()),
            detectedSections,
          };
    return result;
  } finally {
    page.off('response', handleResponse);
  }
}

export async function scrapePublicPinterestBoard(boardUrl: string): Promise<ParsedPublicBoardImport> {
  const source = parsePublicPinterestSource(boardUrl);
  const html = await fetchPublicBoardHtml(source.normalizedUrl);
  const fallbackParsed = parsePublicBoard(html, source);

  try {
    const result = await scrapePublicPinterestBoardWithBrowser(source, fallbackParsed);
    // Strip detectedSections since this function returns ParsedPublicBoardImport
    return { board: result.board, pins: result.pins };
  } catch (error) {
    console.warn('Browser-driven Pinterest import failed, falling back to static parse.', error);
    return fallbackParsed;
  }
}

async function scrapeSectionWithBrowser(
  section: { url: string; sectionKey: string; sectionName: string | null },
  rootBoardId: string,
  source: PublicBoardSourceInfo
): Promise<{ sectionPinIds: string[] }> {
  return withPinterestBrowser((page) => scrapeSectionPage(page, section, rootBoardId, source));
}

async function scrapeSectionPage(
  page: Page,
  section: { url: string; sectionKey: string; sectionName: string | null },
  rootBoardId: string,
  source: PublicBoardSourceInfo
): Promise<{ sectionPinIds: string[] }> {
  const sectionPinIds = new Set<string>();
  const responseTasks = new Set<Promise<void>>();
  let resolvedBoardId: string | null = null;

  const handleResponse = (response: Response) => {
    if (!response.url().includes(BOARD_FEED_RESOURCE_PATH)) {
      return;
    }

    const task = (async () => {
      const requestInfo = getBoardFeedRequestInfo(response.url());
      if (!isMatchingFeedSourcePath(requestInfo.sourcePath, source)) {
        return;
      }

      if (requestInfo.boardId) {
        resolvedBoardId = requestInfo.boardId;
      }

      const payload = (await response.json()) as PinterestResourceResponse;
      const data = payload.resource_response?.data;
      if (!Array.isArray(data)) {
        return;
      }

      const expectedBoardId = resolvedBoardId ?? rootBoardId;
      for (const item of data) {
        const parsedPin = parseBoardPin(item as JsonRecord, expectedBoardId, source);
        if (parsedPin) {
          sectionPinIds.add(stripPinSectionSuffix(parsedPin.pinterestPinId));
        }
      }
    })().finally(() => {
      responseTasks.delete(task);
    });

    responseTasks.add(task);
  };

  page.on('response', handleResponse);

  try {
    await page.goto(section.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('a[href*="/pin/"]', { timeout: 15000 });

    const collectDomPinIds = async () => {
      const pinIds = await page.evaluate(() => {
        const ids = new Set<string>();

        document.querySelectorAll('a[href*="/pin/"]').forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (!href) return;

          try {
            const url = new URL(href, 'https://www.pinterest.com');
            const match = url.pathname.match(/\/pin\/(\d+)/i);
            if (match?.[1]) {
              ids.add(match[1]);
            }
          } catch {
            // ignore malformed anchor URLs
          }
        });

        return Array.from(ids);
      });

      for (const pinId of pinIds) {
        sectionPinIds.add(pinId);
      }
    };

    await collectDomPinIds();

    let stalledIterations = 0;
    let lastPinCount = sectionPinIds.size;

    for (
      let iteration = 0;
      iteration < MAX_SCROLL_ITERATIONS && stalledIterations < MAX_STALLED_ITERATIONS;
      iteration += 1
    ) {
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(window.innerHeight * 0.9));
      });
      await page.waitForTimeout(SCROLL_DELAY_MS);
      await Promise.allSettled([...responseTasks]);
      await collectDomPinIds();

      const currentPinCount = sectionPinIds.size;
      if (currentPinCount === lastPinCount) {
        stalledIterations += 1;
      } else {
        stalledIterations = 0;
        lastPinCount = currentPinCount;
      }
    }

    await Promise.allSettled([...responseTasks]);
  } finally {
    page.off('response', handleResponse);
  }

  return { sectionPinIds: Array.from(sectionPinIds) };
}

function toRootBoardPin(pin: ParsedPublicPin): ParsedPublicPin {
  return {
    ...pin,
    pinterestPinId: stripPinSectionSuffix(pin.pinterestPinId),
  };
}

async function scrapeBoardWithSections(boardUrl: string): Promise<ParsedPublicBoardImport> {
  const source = parsePublicPinterestSource(boardUrl);
  const html = await fetchPublicBoardHtml(source.normalizedUrl);
  const rootFallback = parsePublicBoard(html, source);

  return withPinterestBrowser(async (page) => {
    let rootParsed: BrowserScrapeResult;
    try {
      rootParsed = await scrapePublicPinterestBoardPage(page, source, rootFallback, {
        extractSections: true,
      });
    } catch (error) {
      console.warn('Browser-driven Pinterest import failed, falling back to static parse.', error);
      rootParsed = { ...rootFallback, detectedSections: [] };
    }

    const sectionUrls =
      rootParsed.detectedSections.length > 0
        ? rootParsed.detectedSections
        : extractSectionUrlsFromHtml(html, source);

    if (sectionUrls.length === 0) {
      return rootParsed;
    }

    const pinsById = new Map<string, ParsedPublicPin>(
      rootParsed.pins.map((pin) => [stripPinSectionSuffix(pin.pinterestPinId), toRootBoardPin(pin)])
    );

    const rootBoardId = stripSectionSuffix(rootParsed.board.pinterestBoardId);

    for (const section of sectionUrls) {
      try {
        const sectionParsed = await scrapeSectionPage(page, section, rootBoardId, {
          ...source,
          normalizedUrl: section.url,
          normalizedPath: `/${section.sectionKey}/`,
          sectionKey: section.sectionKey,
          sectionName: section.sectionName,
        });
        for (const rootPinId of sectionParsed.sectionPinIds) {
          const existing = pinsById.get(rootPinId);

          if (existing) {
            pinsById.set(rootPinId, {
              ...existing,
              sectionKey: existing.sectionKey || section.sectionKey,
              sectionName: existing.sectionName || section.sectionName,
            });
          }
        }
      } catch (error) {
        console.warn(`Section import failed for ${section.url}`, error);
      }
    }

    const mergedPins = Array.from(pinsById.values());

    return {
      board: {
        ...rootParsed.board,
        pinCount: pinsById.size,
      },
      pins: mergedPins,
    };
  });
}

function buildPublicImportWarning(
  expectedPinCount: number | null,
  fetchedPinCount: number
): PublicImportWarning | null {
  if (!expectedPinCount || fetchedPinCount >= expectedPinCount) {
    return null;
  }

  return {
    expected_pin_count: expectedPinCount,
    fetched_pin_count: fetchedPinCount,
    message: `Fetched ${fetchedPinCount} of ${expectedPinCount} pins from Pinterest.`,
  };
}

export async function importPublicPinterestBoard(
  userId: string,
  boardUrl: string
): Promise<PublicBoardImportResult> {
  const source = parsePublicPinterestSource(boardUrl);
  const parsed =
    source.sourceKind === 'board'
      ? await scrapeBoardWithSections(boardUrl)
      : await scrapePublicPinterestBoard(boardUrl);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const expectedPinCount = parsed.board.expectedPinCount;
  const fetchedPinCount = parsed.pins.length;
  const warning = buildPublicImportWarning(expectedPinCount, fetchedPinCount);

  const { data: board, error: boardError } = await supabase
    .from('pinterest_boards')
    .upsert(
      {
        user_id: userId,
        pinterest_board_id: parsed.board.pinterestBoardId,
        name: parsed.board.name,
        description: parsed.board.description,
        image_url: parsed.board.imageUrl,
        pin_count: parsed.board.pinCount,
        source_type: PUBLIC_BOARD_SOURCE_TYPE,
        source_url: parsed.board.sourceUrl,
        last_synced_at: now,
      },
      { onConflict: 'user_id,pinterest_board_id' }
    )
    .select('*')
    .single();

  if (boardError || !board) {
    throw new Error(boardError?.message || 'Failed to save imported board.');
  }

  const { error: deleteError } = await supabase
    .from('pinterest_pins')
    .delete()
    .eq('user_id', userId)
    .eq('board_id', board.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const pinRows = parsed.pins.map((pin) => ({
    user_id: userId,
    board_id: board.id,
    pinterest_pin_id: pin.pinterestPinId,
    section_key: pin.sectionKey,
    section_name: pin.sectionName,
    title: pin.title,
    description: pin.description,
    image_url: pin.imageUrl,
    source_url: pin.sourceUrl,
    raw_payload: pin.rawPayload,
    imported_at: now,
  }));

  const { data: pins, error: pinError } = await supabase
    .from('pinterest_pins')
    .upsert(pinRows, { onConflict: 'user_id,pinterest_pin_id' })
    .select('*');

  if (pinError) {
    throw new Error(pinError.message);
  }

  const persistedPins = (pins as PinterestPin[]) || [];

  return {
    board: board as PinterestBoard,
    pins: persistedPins.sort((a, b) =>
      a.imported_at < b.imported_at ? 1 : -1
    ),
    warning,
    expectedPinCount,
    fetchedPinCount,
  };
}

export async function refreshImportedPublicBoard(
  userId: string,
  boardId: string
): Promise<PublicBoardImportResult> {
  const supabase = await createClient();
  const { data: board, error } = await supabase
    .from('pinterest_boards')
    .select('id, source_type, source_url')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single();

  if (error || !board) {
    throw new Error('Board not found.');
  }

  if (board.source_type !== PUBLIC_BOARD_SOURCE_TYPE || !board.source_url) {
    throw new Error('This board was not imported from a public Pinterest URL.');
  }

  return importPublicPinterestBoard(userId, board.source_url);
}
