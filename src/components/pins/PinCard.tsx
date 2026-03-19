'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Check, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinCardProps {
  pin: {
    id: string;
    board_id?: string;
    title: string | null;
    image_url: string;
    source_url: string | null;
  };
  selected?: boolean;
  showSelection?: boolean;
  hasCrop?: boolean;
  onToggleSelect?: (pinId: string, selected: boolean) => void;
  onCropClick?: (pinId: string) => void;
  'data-tour'?: string;
}

export function PinCard({
  pin,
  selected = false,
  showSelection = false,
  hasCrop = false,
  onToggleSelect,
  onCropClick,
  'data-tour': dataTour,
}: PinCardProps) {
  const handleToggle = () => {
    onToggleSelect?.(pin.id, !selected);
  };

  const handleCropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCropClick?.(pin.id);
  };

  return (
    <Card
      data-tour={dataTour}
      className={cn(
        'overflow-hidden transition-all group relative',
        showSelection && 'cursor-pointer',
        selected && 'ring-2 ring-foreground',
      )}
    >
      <div
        className="aspect-[3/4] relative bg-muted overflow-hidden"
        onClick={showSelection ? handleToggle : undefined}
      >
        <Image
          src={pin.image_url}
          alt={pin.title || 'Pin'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        {/* Selection indicator */}
        {showSelection && (
          <div
            className={cn(
              'absolute top-2 left-2 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors',
              selected
                ? 'bg-foreground border-foreground'
                : 'bg-background/70 border-background/70 backdrop-blur-sm',
            )}
          >
            {selected && <Check className="h-3.5 w-3.5 text-background" />}
          </div>
        )}

        {/* Crop button - shows on hover or if has crop */}
        {onCropClick && (
          <button
            type="button"
            onClick={handleCropClick}
            className={cn(
              'absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all',
              hasCrop
                ? 'bg-foreground text-background'
                : 'bg-background/70 text-foreground backdrop-blur-sm opacity-0 group-hover:opacity-100',
            )}
          >
            <Crop className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dim overlay when selectable but not selected */}
        {showSelection && !selected && (
          <div className="absolute inset-0 bg-background/10 group-hover:bg-transparent transition-colors" />
        )}
      </div>
    </Card>
  );
}
