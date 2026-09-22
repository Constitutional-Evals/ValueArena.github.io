import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonIssues, interval, sharedRows, extent } from '../src/lib/chart-data.ts';

const a = { slug: 'experiment/humor', constitution: 'humor' };
const b = { slug: 'experiment/sarcasm', constitution: 'sarcasm' };
const meta = {
  models: { base: { id: 'base', type: 'local' } },
  dataset: { count: 400, start: 0 },
  evaluation: { mode: 'direct_rating' },
  collection: { generation: { temperature: 0 }, sampler_seed: 42 },
};
test('matched comparisons tolerate metadata key order but reject changed settings', () => {
  assert.deepEqual(comparisonIssues(a, b, meta, { ...meta, dataset: { start: 0, count: 400 } }), []);
  for (const field of ['models', 'dataset', 'evaluation']) {
    assert.ok(comparisonIssues(a, b, meta, { ...meta, [field]: { different: true } }).length);
    assert.ok(comparisonIssues(a, b, meta, { ...meta, [field]: {} }).length);
  }
  assert.ok(comparisonIssues(a, b, meta, { ...meta, collection: { generation: { temperature: 1 } } }).length);
  assert.ok(comparisonIssues(a, { ...b, slug: 'another/sarcasm' }, meta, meta).length);
  assert.ok(comparisonIssues(a, a, meta, meta).length);
});
test('tradeoff points require exact model matches and finite scores', () => {
  const row = (model_name, elo_mean) => ({ model_name, elo_mean });
  const result = sharedRows([row('base', 1500), row('base', 1501), row('other', 1700), row('bad', NaN)], [row('base', 1600), row('Other', 1800), row('bad', 1500)]);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'base');
  assert.equal(result[0].x.elo_mean, 1500);
});
test('missing or invalid intervals are omitted, and single-point axes remain usable', () => {
  const row = { model_name: 'base', elo_mean: 1500 };
  assert.equal(interval(row), null);
  assert.equal(interval({ ...row, elo_ci_lower: 1600, elo_ci_upper: 1400 }), null);
  assert.equal(interval({ ...row, elo_ci_lower: 1400, elo_ci_upper: Infinity }), null);
  assert.deepEqual(interval({ ...row, elo_ci_lower: 1450, elo_ci_upper: 1550 }), [1450, 1550]);
  const [low, high] = extent([row]);
  assert.ok(low < row.elo_mean && high > row.elo_mean);
  assert.deepEqual(extent([]), [1400, 1600]);
});
