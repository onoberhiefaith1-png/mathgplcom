/**
 * Paged reads for the public Academia pack. PostgREST returns at most 1000
 * rows per request, so a large school would silently lose rows. Every pack
 * table query goes through `selectAll`, which splits long id lists into chunks
 * and reads each chunk page by page until a short page comes back.
 */
export const PAGE_SIZE = 1000;
export const ID_CHUNK = 150;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** The slice of the Supabase client the pack builder uses (kept loose so tests can mock it). */
export type PackDb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * All rows of `table` whose `column` is in `ids`. Rows are ordered by `order`
 * (when given), then `tiebreak`, so pages never skip or repeat a row. Rows of
 * one parent id always share a chunk, so per-parent order is unchanged.
 */
export async function selectAll(
  db: PackDb, table: string, columns: string, column: string, ids: string[],
  order: string | null = "position", tiebreak: string | null = "id",
): Promise<Row[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const rows: Row[] = [];
  for (const part of chunk(unique, ID_CHUNK)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = db.from(table).select(columns).in(column, part);
      if (order) query = query.order(order);
      if (tiebreak && tiebreak !== order) query = query.order(tiebreak);
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`academia-pack ${table}: ${error.message}`);
      const page: Row[] = data ?? [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}
