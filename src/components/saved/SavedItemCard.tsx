'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { ProductResult } from '@/lib/types/database';

interface SavedItemCardProps {
  product: ProductResult;
  savedAt: string;
  onDelete?: () => void;
  'data-tour'?: string;
}

export function SavedItemCard({
  product,
  savedAt,
  onDelete,
  'data-tour': dataTour,
}: SavedItemCardProps) {
  const hasPinImage = product.source_pin_image_url && product.source_pin_id && product.board_id;

  return (
    <Card data-tour={dataTour} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-3">
          {/* Image comparison section */}
          <div className="flex gap-2 shrink-0 p-3 pr-0">
            {hasPinImage && (
              <Link
                href={`/pins/${product.source_pin_id}?boardId=${product.board_id}`}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-20 h-24 relative bg-muted rounded overflow-hidden ring-1 ring-border group-hover:ring-primary transition-colors">
                  <Image
                    src={product.source_pin_image_url!}
                    alt="Inspiration"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">Inspiration</span>
              </Link>
            )}
            <div className="flex flex-col items-center gap-1">
              <div className="w-20 h-24 relative bg-muted rounded overflow-hidden ring-1 ring-border">
                <Image
                  src={product.image_url}
                  alt={product.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">Product</span>
            </div>
          </div>

          {/* Details section */}
          <div className="flex-1 py-3 pr-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight line-clamp-2">{product.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{product.retailer}</span>
                  <span className="font-semibold text-sm">{product.price_text}</span>
                </div>
              </div>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View product
              </a>
              <span className="text-xs text-muted-foreground">
                Saved {formatDate(savedAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
