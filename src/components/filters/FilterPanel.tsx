'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { OccasionFilter } from '@/lib/types/products';

const OCCASIONS: { value: OccasionFilter | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'formal', label: 'Formal' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'casual', label: 'Casual' },
  { value: 'work', label: 'Work' },
];

const STYLE_TAGS = [
  'Minimalist',
  'Romantic',
  'Classic',
  'Trendy',
  'Boho',
  'Elegant',
  'Edgy',
];

const LENGTH_OPTIONS = [
  { value: 'mini', label: 'Mini' },
  { value: 'knee-length', label: 'Knee' },
  { value: 'midi', label: 'Midi' },
  { value: 'maxi', label: 'Maxi' },
];

const SLEEVE_OPTIONS = [
  { value: 'sleeveless', label: 'Sleeveless' },
  { value: 'cap', label: 'Cap' },
  { value: 'short', label: 'Short' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'three-quarter', label: '3/4' },
  { value: 'long', label: 'Long' },
  { value: 'puff', label: 'Puff' },
  { value: 'flutter', label: 'Flutter' },
];

// Color swatches with hex values for visual selection
const COLOR_SWATCHES: { value: string; label: string; hex: string }[] = [
  { value: 'black', label: 'Black', hex: '#000000' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
  { value: 'ivory', label: 'Ivory', hex: '#FFFFF0' },
  { value: 'neutral', label: 'Neutral', hex: '#A3A3A3' },
  { value: 'brown', label: 'Brown', hex: '#8B4513' },
  { value: 'red', label: 'Red', hex: '#DC2626' },
  { value: 'burgundy', label: 'Burgundy', hex: '#800020' },
  { value: 'orange', label: 'Orange', hex: '#EA580C' },
  { value: 'yellow', label: 'Yellow', hex: '#FACC15' },
  { value: 'green', label: 'Green', hex: '#16A34A' },
  { value: 'blue', label: 'Blue', hex: '#2563EB' },
  { value: 'navy', label: 'Navy', hex: '#1E3A5F' },
  { value: 'purple', label: 'Purple', hex: '#9333EA' },
  { value: 'pink', label: 'Pink', hex: '#EC4899' },
  { value: 'gold', label: 'Gold', hex: '#D4AF37' },
  { value: 'silver', label: 'Silver', hex: '#C0C0C0' },
];

export interface FilterPanelProps {
  occasion: OccasionFilter | null;
  onOccasionChange: (occasion: OccasionFilter | null) => void;
  styleTags: string[];
  onStyleTagsChange: (tags: string[]) => void;
  length: string;
  onLengthChange: (length: string) => void;
  sleeve: string;
  onSleeveChange: (sleeve: string) => void;
  colors: string[];
  onColorsChange: (colors: string[]) => void;
}

export function FilterPanel({
  occasion,
  onOccasionChange,
  styleTags,
  onStyleTagsChange,
  length,
  onLengthChange,
  sleeve,
  onSleeveChange,
  colors,
  onColorsChange,
}: FilterPanelProps) {
  const toggleStyleTag = (tag: string) => {
    if (styleTags.includes(tag)) {
      onStyleTagsChange(styleTags.filter((t) => t !== tag));
    } else {
      onStyleTagsChange([...styleTags, tag]);
    }
  };

  const toggleColor = (colorValue: string) => {
    if (colors.includes(colorValue)) {
      onColorsChange(colors.filter((c) => c !== colorValue));
    } else {
      onColorsChange([...colors, colorValue]);
    }
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (occasion) count++;
    if (styleTags.length > 0) count++;
    if (length) count++;
    if (sleeve) count++;
    if (colors.length > 0) count++;
    return count;
  }, [occasion, styleTags, length, sleeve, colors]);

  const clearAllFilters = () => {
    onOccasionChange(null);
    onStyleTagsChange([]);
    onLengthChange('');
    onSleeveChange('');
    onColorsChange([]);
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      {/* Header with active count and clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Refine results</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Occasion Filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Occasion</Label>
        <div className="flex flex-wrap gap-1.5">
          {OCCASIONS.map((opt) => (
            <Button
              key={opt.label}
              variant={occasion === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onOccasionChange(opt.value)}
              className="h-7 px-3 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Style Tags */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Style</Label>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_TAGS.map((tag) => {
            const isSelected = styleTags.includes(tag.toLowerCase());
            return (
              <Button
                key={tag}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleStyleTag(tag.toLowerCase())}
                className="h-7 px-3 text-xs"
              >
                {tag}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Length - Pills instead of hidden dropdown */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Length</Label>
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={length === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onLengthChange(length === opt.value ? '' : opt.value)}
              className="h-7 px-3 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Sleeve */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sleeve</Label>
        <div className="flex flex-wrap gap-1.5">
          {SLEEVE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sleeve === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSleeveChange(sleeve === opt.value ? '' : opt.value)}
              className="h-7 px-3 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Color - Visual swatches (multi-select) */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((swatch) => {
            const isSelected = colors.includes(swatch.value);
            return (
              <button
                key={swatch.value}
                onClick={() => toggleColor(swatch.value)}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 scale-110'
                    : 'border-muted hover:scale-105',
                  swatch.value === 'white' && !isSelected && 'border-gray-300',
                  swatch.value === 'ivory' && !isSelected && 'border-gray-300'
                )}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.label}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${swatch.label}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
