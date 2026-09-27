import test from 'node:test';
import assert from 'node:assert/strict';
import { agreement, stats } from '../src/lib/judge.ts';

const vote = (pick, judges, at, a = 'Alpha', b = 'Beta') => ({ id: `m${at}`, constitution: 'kindness', pick, a, b, judges: judges.map(([name, p]) => ({ name, pick: p })), at });

test('agreement counts judges that made the same call', () => {
  assert.deepEqual(agreement('a', [{ pick: 'a' }, { pick: 'b' }, { pick: 'a' }]), { agreed: 2, total: 3 });
  assert.deepEqual(agreement('tie', [{ pick: 'a' }, { pick: 'tie' }]), { agreed: 1, total: 2 });
});

test('stats pools judge verdicts, ranks judges and models, and tracks the streak', () => {
  const s = stats([
    vote('a', [['J1', 'a'], ['J2', 'b']], 1),
    vote('b', [['J1', 'b'], ['J2', 'b']], 2),
    vote('tie', [['J1', 'a'], ['J2', 'a']], 3, 'Alpha', 'Gamma'),
  ]);
  assert.equal(s.votes, 3);
  assert.equal(s.agreementRate, 3 / 6);
  assert.deepEqual(s.judges.map(j => [j.name, j.agreed, j.total]), [['J1', 2, 3], ['J2', 1, 3]]);
  // Alpha: win, loss, tie → 1.5 of 3; Beta: loss, win → 1 of 2; Gamma: tie → .5 of 1.
  assert.deepEqual(s.models.map(m => [m.model, m.score, m.games]), [['Alpha', 1.5, 3], ['Beta', 1, 2], ['Gamma', .5, 1]]);
  // The latest vote had no judge agreeing, so the streak is broken.
  assert.equal(s.streak, 0);
  assert.equal(stats([vote('a', [['J1', 'a']], 1), vote('b', [['J1', 'b'], ['J2', 'b']], 2)]).streak, 2);
});

test('stats is empty-safe', () => {
  const s = stats([]);
  assert.equal(s.agreementRate, null);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.models, []);
});
