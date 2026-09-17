import test from 'node:test';
import assert from 'node:assert/strict';
import { runSlug } from '../src/lib/run-slug.ts';

test('run and transcript links preserve spaces, literal plus, and nested slugs', () => {
  for (const name of ['OLMo OCT - Humor', 'OLMo Prompted + OCT - Humor', 'oct-olmo/humor']) {
    for (const key of ['run', 'slug']) {
      const query = `?${key}=${encodeURIComponent(name)}`;
      assert.equal(runSlug(query), name);
      assert.equal(runSlug(query, 'run'), name);
    }
  }
  assert.equal(runSlug('?slug=OLMo+OCT+-+Humor'), 'OLMo OCT - Humor');
});

test('invalid and traversing run paths are rejected', () => {
  for (const value of ['', '../secret', 'a/../b', '/root', 'a//b', 'a?x=1']) {
    assert.equal(runSlug(`?slug=${encodeURIComponent(value)}`), '');
  }
});
