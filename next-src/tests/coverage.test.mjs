import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCoverage, parseCollectionReport } from '../src/lib/coverage.ts';

const meta = {
  evaluation_mode: 'direct_rating',
  models: Object.fromEntries(Array.from({ length: 27 }, (_, i) => [`m${i}`, {}])),
  dataset: { count: 400 },
  collection: { sampler_mode: 'balanced_unique_judge', response_redundancy: 1 },
  analysis: { total_direct_judgments: 7754, observed_edge_coverage: 1 },
};
test('full edge coverage does not hide the 3046 missing judgments', () => {
  assert.deepEqual(estimateCoverage(meta), { source: 'estimate', omitted: 3046, exported: 7754, expected: 10800, partial: false, inconsistent: false });
});
test('unknown, zero shortfall, and explicit partial results stay distinct', () => {
  assert.equal(estimateCoverage({}).omitted, null);
  assert.equal(estimateCoverage({ ...meta, analysis: { total_direct_judgments: 10800 } }).source, 'estimate');
  const partial = estimateCoverage({ ...meta, collection: { status: 'partial', missing_direct_judgments: 2 } });
  assert.equal(partial.source, 'reported');
  assert.equal(partial.omitted, 2);
  assert.equal(partial.partial, true);
});
test('extended or unsupported plans never claim zero omissions', () => {
  assert.equal(estimateCoverage({ ...meta, analysis: { total_direct_judgments: 11000 } }).omitted, null);
  assert.equal(estimateCoverage({ ...meta, collection: { sampler_mode: 'custom' } }).source, 'unknown');
  assert.equal(estimateCoverage({ ...meta, evaluation_mode: 'pairwise_btd' }).source, 'unknown');
});
test('all-to-all respects excluded self judgments', () => {
  const result = estimateCoverage({ ...meta, evaluation: { mode: 'direct_rating', direct_rating: { include_self: false } }, collection: { sampler_mode: 'all_to_all' } });
  assert.equal(result.expected, 400 * 27 * 26);
});
const report = {
  schema_version: 1, source: 'inspect_log', log_file: 'run.eval',
  logged_samples: 2, exported_samples: 1, omitted_samples: 1, failed_samples: 1,
  omissions: [{ sample_id: 's0', scenario_index: 0, scenario: 'A dilemma', judge: 'judge', models: ['model'], reason: 'sample_error', error: 'Truncated' }],
};
test('verified report preserves failure details', () => {
  assert.deepEqual(parseCollectionReport(report), report);
  assert.ok(parseCollectionReport({ ...report, logged_samples: 1, exported_samples: 1, omitted_samples: 0, failed_samples: 0, omissions: [] }));
});
test('malformed and inconsistent reports are unavailable, not complete', () => {
  for (const bad of [null, {}, { ...report, omitted_samples: -1 }, { ...report, omissions: [] }, { ...report, exported_samples: 2 }, { ...report, failed_samples: 0 }, { ...report, omissions: [null] }]) {
    assert.equal(parseCollectionReport(bad), null);
  }
});
