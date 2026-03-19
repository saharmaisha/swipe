import { createClient } from '@/lib/supabase/server';
import { refreshImportedPublicBoard, type PublicImportWarning } from './pinterest-public';
import type { PinterestPin } from '@/lib/types/database';

export interface ImportPinsResult {
  pins: PinterestPin[];
  warning: PublicImportWarning | null;
  expectedPinCount: number | null;
  fetchedPinCount: number;
}

function toAbsolutePinterestBoardUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return `https://www.pinterest.com${trimmed.endsWith('/') ? trimmed : `${trimmed}/`}`;
  }

  try {
    const url = new URL(trimmed);
    if (!/(\.|^)pinterest\.com$/i.test(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function getLegacyBoardUrlFromPayload(rawPayload: Record<string, unknown> | null): string | null {
  if (!rawPayload) {
    return null;
  }

  const boardValue = rawPayload.board;
  if (!boardValue || typeof boardValue !== 'object') {
    return null;
  }

  const board = boardValue as Record<string, unknown>;
  return typeof board.url === 'string' ? toAbsolutePinterestBoardUrl(board.url) : null;
}

export async function importPins(userId: string, boardId: string): Promise<ImportPinsResult> {
  const supabase = await createClient();
  const { data: board } = await supabase
    .from('pinterest_boards')
    .select('pinterest_board_id, source_type, source_url')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single();

  if (!board) throw new Error('Board not found');

  if (board.source_type === 'public_url') {
    return refreshImportedPublicBoard(userId, boardId);
  }

  const { data: legacyPin } = await supabase
    .from('pinterest_pins')
    .select('raw_payload')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recoveredUrl = getLegacyBoardUrlFromPayload(
    (legacyPin?.raw_payload as Record<string, unknown> | null) || null
  );

  if (recoveredUrl) {
    const { error: updateError } = await supabase
      .from('pinterest_boards')
      .update({
        source_type: 'public_url',
        source_url: recoveredUrl,
      })
      .eq('id', boardId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to recover board source URL: ${updateError.message}`);
    }

    return refreshImportedPublicBoard(userId, boardId);
  }

  throw new Error('This board can only be refreshed from its original public Pinterest URL.');
}

export async function getPins(userId: string, boardId: string): Promise<PinterestPin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pinterest_pins')
    .select('*')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .order('imported_at', { ascending: false });

  return (data as PinterestPin[]) || [];
}

export async function getPin(userId: string, pinId: string): Promise<PinterestPin | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pinterest_pins')
    .select('*')
    .eq('id', pinId)
    .eq('user_id', userId)
    .single();

  return data as PinterestPin | null;
}
