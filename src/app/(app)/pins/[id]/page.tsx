'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PinImageCropper } from '@/components/pins/PinImageCropper';
import { AnalysisSummary } from '@/components/analysis/AnalysisSummary';
import { SearchQueryPanel } from '@/components/analysis/SearchQueryPanel';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Sparkles, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSwipeStore } from '@/store/swipe-store';
import type { PinterestPin, PinAnalysis } from '@/lib/types/database';
import type { PixelCrop } from 'react-image-crop';
export default function PinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pinId = params.id as string;
  const setSearchData = useSwipeStore((s) => s.setSearchData);
  const boardId = searchParams.get('boardId') || undefined;
  const boardName = searchParams.get('boardName') || undefined;

  const [pin, setPin] = useState<PinterestPin | null>(null);
  const [analysis, setAnalysis] = useState<PinAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [crop, setCrop] = useState<PixelCrop | null>(null);

  const [budgetMax, setBudgetMax] = useState('150');

  useEffect(() => {
    const fetchPin = async () => {
      if (!boardId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/pinterest/boards/${boardId}/pins`);
        const data = await res.json();
        const found = data.pins?.find((p: PinterestPin) => p.id === pinId);
        setPin(found || null);
      } catch {
        toast.error('Failed to load pin');
      } finally {
        setLoading(false);
      }
    };
    fetchPin();
  }, [boardId, pinId]);

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

  const handleCropComplete = useCallback((newCrop: PixelCrop | null) => {
    setCrop(newCrop);
  }, []);

  const handleAnalyze = async () => {
    if (!pin) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_id: pin.id,
          image_url: pin.image_url,
          crop: crop ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height } : undefined,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        toast.success('Analysis complete');
      } else {
        toast.error('Analysis failed');
      }
    } catch {
      toast.error('Failed to analyze pin');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSearch = async () => {
    if (!analysis) return;
    setSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          pin,
          pin_id: pin?.id,
          board_id: boardId || pin?.board_id,
          board_name: boardName,
          budget_max: budgetMax ? parseFloat(budgetMax) : undefined,
          mode: 'similar',
        }),
      });
      const data = await res.json();
      if (data.search_run_id && data.products) {
        setSearchData({
          searchRun: data.search_run,
          products: data.products,
          analyses: data.analyses || [data.analysis].filter(Boolean),
          selectedPins: data.selected_pins || (pin ? [pin] : []),
          board: data.board || (boardId && boardName ? { id: boardId, name: boardName } : null),
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

  if (!pin) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-3">
        <p className="text-muted-foreground">This pin could not be found.</p>
        <Link href="/boards">
          <Button variant="outline" size="sm">Back to boards</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={boardId ? `/boards/${boardId}` : '/boards'}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate">
            {pin.title || 'Pin detail'}
          </h1>
          {boardId && (
            <Link
              href={`/boards/${boardId}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              From: {boardName || 'Board'}
              {pin.section_name && ` / ${pin.section_name}`}
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div data-tour="pin-image">
            <PinImageCropper imageUrl={pin.image_url} onCropComplete={handleCropComplete} />
          </div>

          <Button
            data-tour="crop-button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analyzing
              ? 'Analyzing\u2026'
              : crop
                ? 'Analyze cropped area'
                : 'Analyze this pin'}
          </Button>
        </div>

        <div className="space-y-4">
          {analysis ? (
            <>
              <AnalysisSummary analysis={analysis} />
              <SearchQueryPanel analysis={analysis} />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Find products from this pin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="budget" className="text-xs text-muted-foreground">Max budget</Label>
                    <div className="relative max-w-[140px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        id="budget"
                        type="number"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        className="pl-7 h-9"
                        min={0}
                      />
                    </div>
                  </div>

                  <Button
                    data-tour="pin-search-button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="w-full gap-2"
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {searching ? 'Searching\u2026' : 'Find products'}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Analyze this pin to identify its style and find similar products at better prices.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
