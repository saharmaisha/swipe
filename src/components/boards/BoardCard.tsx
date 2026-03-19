'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PinterestBoard } from '@/lib/types/database';

interface BoardWithPreviews extends PinterestBoard {
  preview_pins?: string[];
}

export function BoardCard({ board }: { board: BoardWithPreviews }) {
  const syncedAgo = board.last_synced_at
    ? formatTimeAgo(new Date(board.last_synced_at))
    : null;
  const isSection = getIsSection(board);
  const previews = board.preview_pins || [];

  return (
    <Link href={`/boards/${board.id}`}>
      <Card className="overflow-hidden hover:shadow-md hover:ring-primary/20 transition-all cursor-pointer group h-full">
        <div className="p-4 flex gap-4 h-full">
          {/* 2x2 Preview Grid */}
          <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted grid grid-cols-2 grid-rows-2 gap-px">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative bg-muted">
                {previews[i] ? (
                  <Image
                    src={previews[i]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <h3 className="font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {board.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {board.pin_count} pin{board.pin_count === 1 ? '' : 's'}
              </span>
              {syncedAgo && (
                <>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="text-xs text-muted-foreground">{syncedAgo}</span>
                </>
              )}
              {isSection && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Section
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function getIsSection(board: PinterestBoard): boolean {
  if (board.source_type !== 'public_url' || !board.source_url) return false;
  try {
    const segments = new URL(board.source_url).pathname.split('/').filter(Boolean);
    return segments.length >= 3;
  } catch {
    return false;
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function BoardCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full">
      <div className="p-4 flex gap-4 h-full">
        {/* 2x2 Preview Grid Skeleton */}
        <Skeleton className="w-20 h-20 shrink-0 rounded-lg" />

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </Card>
  );
}
