/** Decode a run query once, preserving spaces and encoded literal plus signs. */
export function runSlug(search: string, preferred: 'slug' | 'run' = 'slug'): string {
  const params = new URLSearchParams(search);
  const raw = params.get(preferred) || params.get(preferred === 'slug' ? 'run' : 'slug') || '';
  if (!raw || !/^[a-zA-Z0-9 _./+-]+$/.test(raw)) return '';
  if (raw.split('/').some((part) => !part || part === '.' || part === '..')) return '';
  return raw;
}
