import type { IndexRun, MetaJson, SummaryRow } from './types';

export function experimentGroup(run: IndexRun): string {
  return typeof run.group === 'string' && run.group ? run.group : run.slug.includes('/') ? run.slug.slice(0, run.slug.lastIndexOf('/')) : '';
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return JSON.stringify(value) ?? 'undefined';
}
export function comparisonIssues(a: IndexRun, b: IndexRun, x: MetaJson, y: MetaJson): string[] {
  const issues: string[] = [];
  if (!experimentGroup(a) || experimentGroup(a) !== experimentGroup(b)) issues.push('Choose two runs from the same experiment.');
  const trait = (value: string) => value.toLowerCase().trim().replace(/^oct_/, '');
  if (!a.constitution || !b.constitution || trait(a.constitution) === trait(b.constitution)) issues.push('Choose two different constitutions.');
  for (const [label, left, right] of [
    ['Model panel', x.models, y.models], ['Dataset settings', x.dataset, y.dataset],
    ['Scoring settings', x.evaluation, y.evaluation],
    ['Generation settings', x.collection?.generation, y.collection?.generation],
  ] as [string, unknown, unknown][]) {
    if (!left || !right || (typeof left === 'object' && !Object.keys(left).length) || (typeof right === 'object' && !Object.keys(right).length)) issues.push(`${label} are not recorded for both runs.`);
    else if (stable(left) !== stable(right)) issues.push(`${label} differ between these runs.`);
  }
  for (const key of ['sampler_mode', 'sampler_seed', 'group_size', 'response_redundancy']) {
    if (x.collection?.[key] !== y.collection?.[key]) issues.push(`Sampling setting ${key} differs.`);
  }
  return issues;
}
export function validRows(rows: SummaryRow[]): SummaryRow[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row.model_name || !Number.isFinite(row.elo_mean) || seen.has(row.model_name)) return false;
    seen.add(row.model_name); return true;
  });
}
export function interval(row: SummaryRow): [number, number] | null {
  const lo = row.elo_ci_lower, hi = row.elo_ci_upper;
  return typeof lo === 'number' && typeof hi === 'number' && Number.isFinite(lo) && Number.isFinite(hi) && lo <= row.elo_mean && hi >= row.elo_mean ? [lo, hi] : null;
}
export function sharedRows(x: SummaryRow[], y: SummaryRow[]) {
  const byName = new Map(validRows(y).map(r => [r.model_name, r]));
  return validRows(x).flatMap(a => { const b = byName.get(a.model_name); return b ? [{ name: a.model_name, x: a, y: b }] : []; });
}
export function extent(rows: SummaryRow[]): [number, number] {
  const values = validRows(rows).flatMap(r => interval(r) ?? [r.elo_mean]);
  if (!values.length) return [1400, 1600];
  const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max(20, (hi - lo) * .1);
  return [Math.floor((lo - pad) / 10) * 10, Math.ceil((hi + pad) / 10) * 10];
}
