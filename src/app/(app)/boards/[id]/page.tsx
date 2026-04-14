'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { PixelCrop } from 'react-image-crop';
import { toast } from 'sonner';
import { ArrowLeft, Image, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { PinCard } from '@/components/pins/PinCard';
import { PinCropModal } from '@/components/pins/PinCropModal';
import { SectionCard, type SectionData } from '@/components/sections/SectionCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { SearchProgress } from '@/components/shared/SearchProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSwipeStore } from '@/store/swipe-store';
import type { PinterestBoard, PinterestPin } from '@/lib/types/database';
import type { OccasionFilter } from '@/lib/types/products';
import { useTourTrigger } from '@/components/tour/useTourTrigger';

const ALL_SECTIONS = '__all__';

export default function BoardDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = params.id as string;
  const highlightPinId = searchParams.get('highlightPin');
  const setSearchData = useSwipeStore((state) => state.setSearchData);
  const [pins, setPins] = useState<PinterestPin[]>([]);
  const [board, setBoard] = useState<PinterestBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [budgetMax, setBudgetMax] = useState('150');
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState(ALL_SECTIONS);
  const [viewMode, setViewMode] = useState<'sections' | 'pins'>('sections');

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropModalPin, setCropModalPin] = useState<PinterestPin | null>(null);
  const [pinCrops, setPinCrops] = useState<Map<string, PixelCrop>>(new Map());
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter state
  const [occasion, setOccasion] = useState<OccasionFilter | null>(null);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [lengthFilter, setLengthFilter] = useState('');
  const [sleeveFilter, setSleeveFilter] = useState('');
  const [colorFilter, setColorFilter] = useState<string[]>([]);

  useTourTrigger('boardDetail');

  const deleteBoard = async () => {
    if (!board) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${board.name}"? This will also delete all saved items and search history for this board.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/pinterest/boards?board_id=${boardId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete board');
      }

      toast.success('Board deleted');
      router.push('/boards');
    } catch {
      toast.error('Failed to delete board');
      setDeleting(false);
    }
  };

  const fetchPins = async () => {
    try {
      const res = await fetch(`/api/pinterest/boards/${boardId}/pins`);
      const data = await res.json();
      setPins((data.pins || []) as PinterestPin[]);
      setBoard((data.board as PinterestBoard) || null);
    } catch {
      toast.error('Failed to load pins');
    } finally {
      setLoading(false);
    }
  };

  const importPins = async () => {
    setImporting(true);
    try {
      const res = await fetch(`/api/pinterest/boards/${boardId}/pins`, { method: 'POST' });
      const data = await res.json();
      setPins(data.pins || []);
      setSelectedPinIds(new Set());

      if (data.warning?.message) {
        toast.warning(data.warning.message, {
          description: 'Saved what was fetched so you can continue testing.',
        });
      } else {
        toast.success(`Imported ${data.pins?.length || 0} pins`);
      }
    } catch {
      toast.error('Failed to import pins');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/preferences');
        const data = await response.json();
        if (response.ok && data.preferences?.default_budget_max !== null) {
          setBudgetMax(String(data.preferences.default_budget_max));
        }
      } catch {
        // keep default budget
      }
    };

    void loadPreferences();
  }, []);

  const sections = useMemo((): SectionData[] => {
    const sectionMap = new Map<string, SectionData>();

    for (const pin of pins) {
      if (!pin.section_key) {
        continue;
      }

      const existing = sectionMap.get(pin.section_key);
      if (existing) {
        existing.count += 1;
        if (existing.previewImages.length < 4) {
          existing.previewImages.push(pin.image_url);
        }
      } else {
        sectionMap.set(pin.section_key, {
          key: pin.section_key,
          name: pin.section_name || 'Untitled section',
          count: 1,
          previewImages: [pin.image_url],
        });
      }
    }

    return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pins]);

  useEffect(() => {
    if (activeSection === ALL_SECTIONS) {
      return;
    }

    if (!sections.some((section) => section.key === activeSection)) {
      setActiveSection(ALL_SECTIONS);
    }
  }, [activeSection, sections]);

  // Set initial view mode when pins load
  useEffect(() => {
    if (loading) {
      return;
    }

    if (highlightPinId) {
      setActiveSection(ALL_SECTIONS);
      setSelectedPinIds(new Set());
      setViewMode('pins');
      return;
    }

    setViewMode(sections.length > 0 ? 'sections' : 'pins');
  }, [highlightPinId, loading, sections.length]);

  const clearHighlightParam = useCallback(() => {
    if (!searchParams.has('highlightPin')) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('highlightPin');
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (loading || !highlightPinId || viewMode !== 'pins') {
      return;
    }

    const pinExists = pins.some((pin) => pin.id === highlightPinId);
    if (!pinExists) {
      clearHighlightParam();
      return;
    }

    const pinElement = document.getElementById(`pin-${highlightPinId}`);
    if (!pinElement) {
      return;
    }

    setHighlightedPinId(highlightPinId);
    pinElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timeoutId = window.setTimeout(() => {
      setHighlightedPinId((current) => (current === highlightPinId ? null : current));
      clearHighlightParam();
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clearHighlightParam, highlightPinId, loading, pins, viewMode]);

  const allPinsPreviewImages = useMemo(() => {
    return pins.slice(0, 4).map((pin) => pin.image_url);
  }, [pins]);

  const visiblePins = useMemo(() => {
    if (activeSection === ALL_SECTIONS) {
      return pins;
    }

    return pins.filter((pin) => pin.section_key === activeSection);
  }, [activeSection, pins]);

  const selectedPins = useMemo(
    () => visiblePins.filter((pin) => selectedPinIds.has(pin.id)),
    [selectedPinIds, visiblePins]
  );

  const togglePinSelection = (pinId: string, selected: boolean) => {
    setSelectedPinIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(pinId);
      } else {
        next.delete(pinId);
      }
      return next;
    });
  };

  const handleCropClick = useCallback(
    (pinId: string) => {
      const pin = pins.find((value) => value.id === pinId);
      if (pin) {
        setCropModalPin(pin);
        setCropModalOpen(true);
      }
    },
    [pins]
  );

  const handleCropSave = useCallback(
    (crop: PixelCrop | null) => {
      if (!cropModalPin) return;

      setPinCrops((prev) => {
        const next = new Map(prev);
        if (crop) {
          next.set(cropModalPin.id, crop);
        } else {
          next.delete(cropModalPin.id);
        }
        return next;
      });
    },
    [cropModalPin]
  );

  const runBoardSearch = async (searchScope: 'all_board' | 'selected_pins') => {
    const pinsForSearch = searchScope === 'all_board' ? visiblePins : selectedPins;
    if (pinsForSearch.length === 0) {
      toast.error('Select at least one pin first.');
      return;
    }

    const selectedIdsForSearch = Array.from(selectedPinIds).filter((pinId) =>
      pinsForSearch.some((pin) => pin.id === pinId)
    );

    const cropData: Record<string, { x: number; y: number; width: number; height: number }> = {};
    pinCrops.forEach((crop, pinId) => {
      cropData[pinId] = {
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      };
    });

    setSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_id: boardId,
          board_name: board?.name,
          pins: pinsForSearch,
          selected_pin_ids: selectedIdsForSearch,
          search_scope: searchScope,
          budget_max: budgetMax ? parseFloat(budgetMax) : undefined,
          pin_crops: Object.keys(cropData).length > 0 ? cropData : undefined,
          mode: 'similar',
          occasion: occasion || undefined,
          style_tags: styleTags.length > 0 ? styleTags : undefined,
          length: lengthFilter || undefined,
          sleeve_preference: sleeveFilter || undefined,
          colors: colorFilter.length > 0 ? colorFilter : undefined,
        }),
      });
      const data = await res.json();
      if (data.search_run_id && data.products) {
        setSearchData({
          searchRun: data.search_run,
          products: data.products,
          analyses: data.analyses,
          selectedPins: data.selected_pins,
          board: data.board,
        });
        router.push(`/results/${data.search_run_id}`);
      } else if (res.status === 429 || data.error?.includes('Rate limit')) {
        toast.error("You've reached the search limit", {
          description: 'Please wait an hour before searching again.',
        });
      } else {
        toast.error(data.error || 'Search failed');
      }
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  if (loading) return <LoadingState />;

  const hasSelection = selectedPins.length > 0;
  const activeSectionLabel =
    activeSection === ALL_SECTIONS
      ? 'All pins'
      : sections.find((section) => section.key === activeSection)?.name || 'Section';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        {viewMode === 'pins' && sections.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setViewMode('sections')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Link href="/boards">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{board?.name || 'Board'}</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'sections' ? (
              <>{sections.length} section{sections.length === 1 ? '' : 's'}</>
            ) : (
              <>
                {visiblePins.length} pin{visiblePins.length === 1 ? '' : 's'}
                {activeSection !== ALL_SECTIONS && <span> in {activeSectionLabel}</span>}
                {hasSelection && (
                  <span className="text-foreground font-medium"> &middot; {selectedPins.length} selected</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button onClick={importPins} disabled={importing || deleting} variant="ghost" size="sm" className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Syncing...' : 'Re-sync'}
          </Button>
          <Button
            onClick={deleteBoard}
            disabled={deleting || importing || searching}
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {importing ? (
        <p className="text-xs text-muted-foreground">
          Re-syncing a large board with sections can take a minute while Pinterest section pins finish loading.
        </p>
      ) : null}

      {viewMode === 'sections' && sections.length > 0 ? (
        /* Sections Overview */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionCard
            section={{
              key: ALL_SECTIONS,
              name: 'All pins',
              count: pins.length,
              previewImages: allPinsPreviewImages,
            }}
            onClick={() => {
              setActiveSection(ALL_SECTIONS);
              setViewMode('pins');
              setSelectedPinIds(new Set());
            }}
          />
          {sections.map((section) => (
            <SectionCard
              key={section.key}
              section={section}
              onClick={() => {
                setActiveSection(section.key);
                setViewMode('pins');
                setSelectedPinIds(new Set());
              }}
            />
          ))}
        </div>
      ) : (
        /* Pins View */
        <>
          {pins.length > 0 && (
            <div className="flex flex-col gap-4 py-4 border-y">
              {sections.length > 0 && (
                <div className="w-full">
                  <Tabs
                    value={activeSection}
                    onValueChange={(value) => {
                      setActiveSection(value);
                      setSelectedPinIds(new Set());
                    }}
                  >
                    <TabsList variant="line" className="flex-wrap h-auto">
                      <TabsTrigger value={ALL_SECTIONS}>All ({pins.length})</TabsTrigger>
                      {sections.map((section) => (
                        <TabsTrigger key={section.key} value={section.key}>
                          {section.name} ({section.count})
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Search Filters */}
              <div data-tour="filter-panel">
                <FilterPanel
                  occasion={occasion}
                  onOccasionChange={setOccasion}
                  styleTags={styleTags}
                  onStyleTagsChange={setStyleTags}
                  length={lengthFilter}
                  onLengthChange={setLengthFilter}
                  sleeve={sleeveFilter}
                  onSleeveChange={setSleeveFilter}
                  colors={colorFilter}
                  onColorsChange={setColorFilter}
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="budget" className="text-xs text-muted-foreground">
                    Max budget
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      data-tour="budget-input"
                      id="budget"
                      type="number"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      className="pl-7 w-28 h-9"
                      min={0}
                    />
                  </div>
                </div>

              <div className="flex gap-2 ml-auto">
                {hasSelection && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground h-9"
                    onClick={() => setSelectedPinIds(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
                {hasSelection ? (
                  <Button
                    data-tour="search-button"
                    onClick={() => runBoardSearch('selected_pins')}
                    disabled={searching}
                    size="sm"
                    className="gap-2 h-9"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {searching
                      ? 'Searching...'
                      : `Search ${selectedPins.length} pin${selectedPins.length === 1 ? '' : 's'}`}
                  </Button>
                ) : (
                  <Button
                    data-tour="search-button"
                    onClick={() => runBoardSearch('all_board')}
                    disabled={searching || visiblePins.length === 0}
                    size="sm"
                    className="gap-2 h-9"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {searching
                      ? 'Searching...'
                      : activeSection === ALL_SECTIONS
                        ? 'Search all pins'
                        : 'Search this section'}
                  </Button>
                )}
              </div>
              </div>
            </div>
          )}

          {visiblePins.length === 0 ? (
            <EmptyState
              icon={Image}
              title={pins.length === 0 ? 'No pins yet' : `No pins in ${activeSectionLabel}`}
              description={
                pins.length === 0
                  ? 'Sync this board to import its pins.'
                  : 'Try another section or re-sync the board.'
              }
              action={{ label: 'Sync now', onClick: importPins }}
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Tap to select, or use the crop icon to focus on specific areas.
              </p>
              <div data-tour="pins-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visiblePins.map((pin, index) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    selected={selectedPinIds.has(pin.id)}
                    showSelection
                    hasCrop={pinCrops.has(pin.id)}
                    highlighted={highlightedPinId === pin.id}
                    onToggleSelect={togglePinSelection}
                    onCropClick={handleCropClick}
                    data-tour={index === 0 ? 'pin-card' : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {cropModalPin && (
        <PinCropModal
          open={cropModalOpen}
          onOpenChange={setCropModalOpen}
          imageUrl={cropModalPin.image_url}
          pinTitle={cropModalPin.title}
          existingCrop={pinCrops.get(cropModalPin.id) || null}
          onSave={handleCropSave}
        />
      )}

      {searching && (
        <SearchProgress
          pinCount={selectedPins.length > 0 ? selectedPins.length : visiblePins.length}
        />
      )}
    </div>
  );
}
