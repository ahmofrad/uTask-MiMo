export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type CursorPaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: CursorPaginationMeta;
};

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export function parsePaginationParams(params: CursorPaginationParams) {
  const limit = Math.min(
    Math.max(params.limit ?? DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  );
  return {
    take: limit + 1, // Fetch one extra to determine hasMore
    skip: params.cursor ? 1 : 0,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    limit,
  };
}

export function buildPaginatedMeta<T extends { id: string }>(
  items: T[],
  limit: number,
): CursorPaginationMeta {
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();
  }
  const lastItem = items[items.length - 1];
  return {
    nextCursor: hasMore && lastItem ? lastItem.id : null,
    hasMore,
  };
}
