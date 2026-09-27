import test from 'node:test';
import assert from 'node:assert/strict';
import { stats } from '../src/lib/judge.ts';

const vote = (pick, verdict, judges, at, a = 'Alpha', b = 'Beta') => ({ id: `m${at}`, constitution: 'kindness', pick, verdict, a, b, judges: judges.map(([name, p]) => ({ name, pick: p })), at });

test('stats scores agreement against the verdict and ranks judges and models', () => {
  const s = stats([
    vote('a', 'a', [['J1', 'a'], ['J2', 'b']], 1),
    vote('b', 'b', [['J1', 'b'], ['J2', 'b']], 2),
    vote('tie', 'a', [['J1', 'a'], ['J2', 'a']], 3, 'Alpha', 'Gamma'),
  ]);
  assert.equal(s.votes, 3);
  assert.equal(s.agreementRate, 2 / 3);
  // J1 pointed to the visitor's pick twice in three votes, J2 once.
  assert.deepEqual(s.judges.map(j => [j.name, j.agreed, j.total]), [['J1', 2, 3], ['J2', 1, 3]]);
  // Alpha: win, loss, tie → 1.5 of 3; Beta: loss, win → 1 of 2; Gamma: tie → .5 of 1.
  assert.deepEqual(s.models.map(m => [m.model, m.score, m.games]), [['Alpha', 1.5, 3], ['Beta', 1, 2], ['Gamma', .5, 1]]);
  // The latest vote missed the verdict, so the streak is broken.
  assert.equal(s.streak, 0);
  assert.equal(stats([vote('b', 'a', [], 1), vote('a', 'a', [], 2), vote('b', 'b', [], 3)]).streak, 2);
});

test('stats is empty-safe', () => {
  const s = stats([]);
  assert.equal(s.agreementRate, null);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.models, []);
});
