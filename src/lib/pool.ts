/**
 * Run tasks with a concurrency cap and an overall deadline. GitHub triggers
 * secondary rate limits on burst concurrency even for authenticated callers,
 * and a feed that returns partial data now beats a complete one in two minutes.
 */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  deadlineMs: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<R | null>> {
  const results = new Array<R | null>(items.length).fill(null);
  const expiresAt = Date.now() + deadlineMs;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      if (Date.now() > expiresAt) return;
      try {
        results[index] = await fn(items[index]);
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
