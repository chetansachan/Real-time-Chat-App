export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Cursor pagination helper. Callers fetch `limit + 1` rows; the extra row tells
 * us whether another page exists without a second query.
 */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: last ? last.id : null };
}

/** True when `candidate` sorts after `cursor` (UUIDv7 ids are time-ordered). */
export function isNewerThan(candidate: string, cursor: string | null): boolean {
  return cursor === null || candidate > cursor;
}
