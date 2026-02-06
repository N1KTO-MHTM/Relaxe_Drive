/** Shorten long IDs (e.g. User ID, driver id) for compact display. Full value in title for copy. */
export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return '—';
  if (id.length <= len) return id;
  return id.slice(0, len) + '…';
}
