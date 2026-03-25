'use client';

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { BoardCard, BoardCardSkeleton } from '@/components/boards/BoardCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImportProgress } from '@/components/shared/ImportProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LayoutGrid, RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { PinterestBoard } from '@/lib/types/database';
import { useTourTrigger } from '@/components/tour/useTourTrigger';

interface BoardWithPreviews extends PinterestBoard {
  preview_pins?: string[];
}

interface BoardGroup {
  parentName: string;
  boards: BoardWithPreviews[];
}

// Helper to extract parent board ID from pinterest_board_id
function getParentBoardId(pinterestBoardId: string): string {
  return pinterestBoardId.split('::section:')[0];
}

// Helper to check if this is a section (has ::section: in the ID)
function isSection(board: PinterestBoard): boolean {
  return board.pinterest_board_id.includes('::section:');
}

// Helper to get parent name from board name (before the " / ")
function getParentName(boardName: string): string {
  const parts = boardName.split(' / ');
  return parts[0];
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<BoardWithPreviews[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [boardUrl, setBoardUrl] = useState('');

  useTourTrigger('boards');

  // Group boards by parent
  const groupedBoards = useMemo(() => {
    const groups = new Map<string, BoardGroup>();
    const standaloneBoards: BoardWithPreviews[] = [];

    // First pass: identify all parent board IDs that have sections
    const parentIdsWithSections = new Set<string>();
    for (const board of boards) {
      if (isSection(board)) {
        parentIdsWithSections.add(getParentBoardId(board.pinterest_board_id));
      }
    }

    // Second pass: group boards
    for (const board of boards) {
      const parentId = getParentBoardId(board.pinterest_board_id);

      if (isSection(board)) {
        // This is a section, add to its parent group
        const parentName = getParentName(board.name);
        if (!groups.has(parentId)) {
          groups.set(parentId, { parentName, boards: [] });
        }
        groups.get(parentId)!.boards.push(board);
      } else if (parentIdsWithSections.has(board.pinterest_board_id)) {
        // This is a parent board that has sections
        const parentName = board.name;
        if (!groups.has(board.pinterest_board_id)) {
          groups.set(board.pinterest_board_id, { parentName, boards: [] });
        }
        // Add parent board first in the group
        groups.get(board.pinterest_board_id)!.boards.unshift(board);
      } else {
        // Standalone board with no sections
        standaloneBoards.push(board);
      }
    }

    return { groups: Array.from(groups.values()), standalone: standaloneBoards };
  }, [boards]);

  const fetchBoards = async () => {
    try {
      const res = await fetch('/api/pinterest/boards');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load boards');
      }
      const data = await res.json();
      setBoards(data.boards || []);
    } catch {
      toast.error('Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const syncBoards = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/pinterest/boards', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh boards');
      }

      setBoards(data.boards || []);
      const refresh = data.refresh as
        | {
            refreshed_boards: number;
            failed_boards: number;
            refreshed_pin_count: number;
            warnings?: Array<{ board_name: string; warning: { message: string } }>;
            failures?: Array<{ board_name?: string }>;
          }
        | undefined;

      if (refresh) {
        if (refresh.failed_boards > 0) {
          const firstFailed = refresh.failures?.[0]?.board_name;
          toast.error(
            `Refreshed ${refresh.refreshed_boards} boards (${refresh.failed_boards} failed)`,
            {
              description: firstFailed ? `Could not refresh: ${firstFailed}` : undefined,
            }
          );
        } else if (refresh.warnings?.length) {
          const firstWarning = refresh.warnings[0];
          toast.warning(
            `Refreshed ${refresh.refreshed_boards} board${refresh.refreshed_boards === 1 ? '' : 's'}`,
            {
              description: `${firstWarning.board_name}: ${firstWarning.warning.message}`,
            }
          );
        } else {
          toast.success(
            `Refreshed ${refresh.refreshed_boards} board${refresh.refreshed_boards === 1 ? '' : 's'} with ${refresh.refreshed_pin_count} pins`
          );
        }
      } else {
        toast.success('All boards refreshed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh boards');
    } finally {
      setSyncing(false);
    }
  };

  const importBoard = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!boardUrl.trim()) {
      toast.error('Paste a Pinterest board URL first');
      return;
    }

    setImporting(true);

    try {
      const res = await fetch('/api/pinterest/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ board_url: boardUrl }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import board');
      }

      setBoards(data.boards || []);
      setBoardUrl('');
      const importedSourceUrl = data.board?.source_url;
      let sourceSegments: string[] = [];
      if (typeof importedSourceUrl === 'string') {
        try {
          sourceSegments = new URL(importedSourceUrl).pathname.split('/').filter(Boolean);
        } catch {
          sourceSegments = [];
        }
      }
      const successMessage =
        sourceSegments.length >= 3 ? 'Section imported successfully' : 'Board imported successfully';

      if (data.warning?.message) {
        toast.warning(successMessage, {
          description: data.warning.message,
        });
      } else {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import board');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Import Pinterest boards to start finding products.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <BoardCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import Pinterest boards to start finding products.
          </p>
        </div>
        {boards.length > 0 && (
          <Button
            data-tour="refresh-button"
            onClick={syncBoards}
            disabled={syncing}
            variant="ghost"
            size="sm"
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing\u2026' : 'Refresh all'}
          </Button>
        )}
      </div>

      <form onSubmit={importBoard} className="flex gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              data-tour="board-url-input"
              type="url"
              placeholder="Paste a public Pinterest board URL"
              value={boardUrl}
              onChange={(event) => setBoardUrl(event.target.value)}
              disabled={importing}
              className="h-10"
            />
            <Button
              data-tour="board-import-button"
              type="submit"
              disabled={importing}
              size="sm"
              className="gap-2 h-10 px-4 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {importing ? 'Importing\u2026' : 'Import'}
            </Button>
          </div>
          {importing ? (
            <p className="text-xs text-muted-foreground">
              Large boards with sections can take a minute or two while Veri loads every section.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only public boards can be imported. Smaller boards (under ~200 pins) work best&mdash;for larger boards, we recommend importing individual sections.
            </p>
          )}
          {syncing ? (
            <p className="text-xs text-muted-foreground">
              Refreshing every board can take longer when Pinterest has to re-import lots of sectioned pins.
            </p>
          ) : null}
        </div>
      </form>

      {boards.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No boards yet"
          description="Paste a public Pinterest board URL above to get started."
        />
      ) : (
        <div className="space-y-8" data-tour="boards-grid">
          {/* Grouped boards (boards with sections) */}
          {groupedBoards.groups.map((group) => (
            <div key={group.parentName} className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">{group.parentName}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.boards.map((board) => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          ))}

          {/* Standalone boards (no sections) */}
          {groupedBoards.standalone.length > 0 && (
            <div className="space-y-3">
              {groupedBoards.groups.length > 0 && (
                <h2 className="text-sm font-medium text-muted-foreground">Other boards</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedBoards.standalone.map((board) => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importing && <ImportProgress />}
    </div>
  );
}
