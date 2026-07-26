const CURSOR_KEY =
  /^(cursor|end_cursor|next_cursor|next_max_id|nextMaxId|max_id)$/i;

export function extractCursor(value: unknown): string | undefined {
  const candidates: string[] = [];
  const visit = (node: unknown, depth: number): void => {
    if (depth > 12 || node === null) return;
    if (Array.isArray(node)) {
      for (const child of node.slice(0, 100)) visit(child, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (
        CURSOR_KEY.test(key) &&
        (typeof child === "string" || typeof child === "number")
      ) {
        candidates.push(String(child));
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return candidates.find((candidate) => candidate.length > 0);
}
