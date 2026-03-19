import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackAppEvent } from '@/lib/services/app-events';
import { getBoards, importBoardFromUrl, refreshBoardsAndPins } from '@/lib/services/board-sync';
import type { PinterestBoard, PinterestPin } from '@/lib/types/database';
import { boardImportSchema } from '@/lib/utils/validators';

export const maxDuration = 300;

export interface BoardWithPreviews extends PinterestBoard {
  preview_pins: string[];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const boards = await getBoards(user.id);

  // Fetch first 4 pin images for each board
  const boardIds = boards.map(b => b.id);
  const { data: pins } = await supabase
    .from('pinterest_pins')
    .select('board_id, image_url')
    .in('board_id', boardIds)
    .order('imported_at', { ascending: false });

  // Group pins by board and take first 4
  const pinsByBoard = new Map<string, string[]>();
  for (const pin of (pins as Pick<PinterestPin, 'board_id' | 'image_url'>[] || [])) {
    const existing = pinsByBoard.get(pin.board_id) || [];
    if (existing.length < 4) {
      existing.push(pin.image_url);
      pinsByBoard.set(pin.board_id, existing);
    }
  }

  const boardsWithPreviews: BoardWithPreviews[] = boards.map(board => ({
    ...board,
    preview_pins: pinsByBoard.get(board.id) || [],
  }));

  return NextResponse.json({ boards: boardsWithPreviews });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = boardImportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid board import payload' }, { status: 400 });
    }

    if (parsed.data.board_url?.trim()) {
      const { board, boards, warning } = await importBoardFromUrl(user.id, parsed.data.board_url);
      await trackAppEvent({
        userId: user.id,
        eventType: 'board_import_completed',
        path: '/api/pinterest/boards',
        metadata: {
          boardId: board.id,
          sourceUrl: board.source_url,
          warning: warning?.message ?? null,
        },
      });
      return NextResponse.json({ board, boards, warning });
    }

    const result = await refreshBoardsAndPins(user.id);
    await trackAppEvent({
      userId: user.id,
      eventType: 'boards_refresh_completed',
      path: '/api/pinterest/boards',
      metadata: {
        refreshedBoards: result.refreshed_boards,
        failedBoards: result.failed_boards,
        refreshedPinCount: result.refreshed_pin_count,
      },
    });
    return NextResponse.json({
      boards: result.boards,
      refresh: {
        refreshed_boards: result.refreshed_boards,
        failed_boards: result.failed_boards,
        refreshed_pin_count: result.refreshed_pin_count,
        warnings: result.warnings,
        failures: result.failures,
      },
    });
  } catch (error) {
    console.error('Board sync error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync boards';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
