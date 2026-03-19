import { createClient } from '@/lib/supabase/server';
import { importPublicPinterestBoard, type PublicImportWarning } from './pinterest-public';
import { importPins } from './pin-import';
import type { PinterestBoard } from '@/lib/types/database';

export interface RefreshBoardsResult {
  boards: PinterestBoard[];
  refreshed_boards: number;
  failed_boards: number;
  refreshed_pin_count: number;
  warnings: Array<{
    board_id: string;
    board_name: string;
    warning: PublicImportWarning;
  }>;
  failures: Array<{
    board_id: string;
    board_name: string;
    error: string;
  }>;
}

export async function syncBoards(userId: string): Promise<PinterestBoard[]> {
  return getBoards(userId);
}

export async function getBoards(userId: string): Promise<PinterestBoard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pinterest_boards')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  return (data as PinterestBoard[]) || [];
}

export async function importBoardFromUrl(
  userId: string,
  boardUrl: string
): Promise<{ board: PinterestBoard; boards: PinterestBoard[]; warning: PublicImportWarning | null }> {
  const { board, warning } = await importPublicPinterestBoard(userId, boardUrl);
  const boards = await getBoards(userId);

  return { board, boards, warning };
}

export async function refreshBoardsAndPins(userId: string): Promise<RefreshBoardsResult> {
  await syncBoards(userId);
  const boards = await getBoards(userId);
  const failures: RefreshBoardsResult['failures'] = [];
  const warnings: RefreshBoardsResult['warnings'] = [];
  let refreshedBoards = 0;
  let refreshedPinCount = 0;

  for (const board of boards) {
    try {
      const result = await importPins(userId, board.id);
      refreshedBoards += 1;
      refreshedPinCount += result.pins.length;
      if (result.warning) {
        warnings.push({
          board_id: board.id,
          board_name: board.name,
          warning: result.warning,
        });
      }
    } catch (error) {
      failures.push({
        board_id: board.id,
        board_name: board.name,
        error: error instanceof Error ? error.message : 'Unknown refresh error',
      });
    }
  }

  const refreshedBoardsList = await getBoards(userId);

  return {
    boards: refreshedBoardsList,
    refreshed_boards: refreshedBoards,
    failed_boards: failures.length,
    refreshed_pin_count: refreshedPinCount,
    warnings,
    failures,
  };
}
