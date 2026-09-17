import type { MetaJson } from './types';

export interface OmittedSample {
  sample_id: string;
  scenario_index: number | null;
  scenario: string;
  judge: string;
  models: string[];
  reason: 'sample_error' | 'not_exported';
  error: string | null;
}
export interface CollectionReport {
  schema_version: 1;
  source: 'inspect_log';
  log_file: string;
  logged_samples: number;
  exported_samples: number;
  omitted_samples: number;
  failed_samples: number;
  omissions: OmittedSample[];
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Invalid or incomplete evidence must never turn into a zero-failure claim. */
export function parseCollectionReport(value: unknown): CollectionReport | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as CollectionReport;
  if (r.schema_version !== 1 || r.source !== 'inspect_log' || typeof r.log_file !== 'string') return null;
  if ([r.logged_samples, r.exported_samples, r.omitted_samples, r.failed_samples].some(v => count(v) === null)) return null;
  if (r.exported_samples + r.omitted_samples !== r.logged_samples || r.failed_samples > r.omitted_samples) return null;
  if (!Array.isArray(r.omissions) || r.omissions.length !== r.omitted_samples) return null;
  for (const row of r.omissions) {
    if (!row || typeof row.sample_id !== 'string' || typeof row.scenario !== 'string' || typeof row.judge !== 'string') return null;
    if (row.scenario_index !== null && count(row.scenario_index) === null) return null;
    if (!Array.isArray(row.models) || !row.models.every(m => typeof m === 'string')) return null;
    if (!['sample_error', 'not_exported'].includes(row.reason) || (row.error !== null && typeof row.error !== 'string')) return null;
  }
  if (r.omissions.filter(row => row.reason === 'sample_error').length !== r.failed_samples) return null;
  return r;
}

export interface CoverageEstimate {
  source: 'reported' | 'estimate' | 'unknown';
  omitted: number | null;
  exported: number | null;
  expected: number | null;
  partial: boolean;
  inconsistent: boolean;
}

export function estimateCoverage(meta: MetaJson): CoverageEstimate {
  const collection = meta.collection || {};
  const mode = meta.evaluation?.mode || meta.evaluation_mode;
  const exported = count(meta.analysis?.total_direct_judgments) ?? count(meta.log?.total_direct_judgments);
  const reported = count(collection.missing_direct_judgments);
  const partial = collection.status === 'partial';
  const base: CoverageEstimate = { source: 'unknown', omitted: null, exported, expected: null, partial, inconsistent: false };
  if (reported !== null) return { ...base, source: 'reported', omitted: reported };
  if (mode !== 'direct_rating' && mode !== 'direct') return base;
  const scenarios = count(meta.dataset?.count);
  const models = Object.keys(meta.models || {}).length;
  const sampler = collection.sampler_mode || 'all_to_all';
  let perScenario: number;
  if (sampler === 'all_to_all' || sampler === 'exhaustive') {
    perScenario = models * (meta.evaluation?.direct_rating?.include_self === false ? models - 1 : models);
  } else if (['balanced_unique_judge', 'partitioned_random_judge', 'partitioned', 'random_partition'].includes(String(sampler))) {
    const redundancy = count(collection.response_redundancy ?? 1);
    if (!redundancy || redundancy > models) return base;
    perScenario = models * redundancy;
  } else return base;
  if (!scenarios || !models || exported === null) return base;
  const expected = scenarios * perScenario;
  if (!Number.isSafeInteger(expected) || expected <= 0) return base;
  // Extended panels can have more judgments than a single-pass spec predicts.
  if (exported > expected) return { ...base, expected, inconsistent: true };
  return { ...base, source: 'estimate', expected, omitted: expected - exported };
}
