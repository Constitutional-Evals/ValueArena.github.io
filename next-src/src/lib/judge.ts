// You vs the AI judges: matchup packs, the visitor's votes, and what they add up to.
//
// Packs are static JSON built by scripts/build-judge-pack.mjs from published
// EigenBench direct-rating runs: each answer was scored by one AI judge, and the
// verdict compares the two scores after adjusting for each judge's strictness.
// Votes stay in this browser until community voting has a backend; saveVote()
// is the one place that will need to send them on.

export type Pick = 'a' | 'b' | 'tie';

export interface JudgeVerdict {
  name: string;
  /** The answer this judge scored. */
  side: 'a' | 'b';
  /** Mean criterion score on the pack's scale. */
  score: number;
  /** The score relative to this judge's own average, in standard deviations. */
  z: number;
  /** The answer this judge's score points to: its own answer if above its average, else the other. */
  pick: Pick;
  /** Line in the run's evaluations.jsonl, for linking to the judge's reasoning. */
  line: number;
}

export interface Matchup {
  id: string;
  scenario: string;
  a: { model: string; response: string };
  b: { model: string; response: string };
  /** The answer with the higher judge-adjusted score. */
  verdict: 'a' | 'b';
  judges: JudgeVerdict[];
}

export interface PackInfo { id: string; label: string; question: string; run: string; count: number; summary: string }
export interface Pack { id: string; label: string; question: string; run: string; scale: number; criteria: string[]; matchups: Matchup[] }

export interface Vote {
  id: string;
  constitution: string;
  /** In the pack's a/b terms, not the on-screen order. */
  pick: Pick;
  a: string;
  b: string;
  verdict: 'a' | 'b';
  judges: { name: string; pick: Pick }[];
  at: number;
}

const STORE = 'va-judge-votes-v2';

export function loadVotes(): Vote[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Records a vote, replacing any earlier vote on the same matchup. */
export function saveVote(vote: Vote): Vote[] {
  const votes = [...loadVotes().filter(v => v.id !== vote.id), vote];
  try { localStorage.setItem(STORE, JSON.stringify(votes)); } catch { /* private mode: keep this session only */ }
  return votes;
}

export function clearVotes(): Vote[] {
  try { localStorage.removeItem(STORE); } catch { /* nothing stored */ }
  return [];
}

export interface JudgeStats {
  votes: number;
  /** Share of votes that matched the AI judges' verdict. */
  agreementRate: number | null;
  /** Consecutive latest votes that matched the verdict. */
  streak: number;
  /** Per judge: how often its score pointed to the answer the visitor picked. */
  judges: { name: string; agreed: number; total: number; rate: number }[];
  models: { model: string; score: number; games: number; rate: number }[];
}

export function stats(votes: Vote[]): JudgeStats {
  const judges = new Map<string, { agreed: number; total: number }>();
  const models = new Map<string, { score: number; games: number }>();
  for (const v of votes) {
    for (const j of v.judges) {
      const row = judges.get(j.name) || { agreed: 0, total: 0 };
      row.total += 1;
      if (j.pick === v.pick) row.agreed += 1;
      judges.set(j.name, row);
    }
    for (const [model, side] of [[v.a, 'a'], [v.b, 'b']] as const) {
      const row = models.get(model) || { score: 0, games: 0 };
      row.games += 1;
      row.score += v.pick === side ? 1 : v.pick === 'tie' ? .5 : 0;
      models.set(model, row);
    }
  }
  let streak = 0;
  for (const v of [...votes].sort((p, q) => q.at - p.at)) {
    if (v.pick === v.verdict) streak += 1; else break;
  }
  return {
    votes: votes.length,
    agreementRate: votes.length ? votes.filter(v => v.pick === v.verdict).length / votes.length : null,
    streak,
    judges: [...judges].map(([name, r]) => ({ name, ...r, rate: r.agreed / r.total })).sort((p, q) => q.rate - p.rate || q.total - p.total),
    models: [...models].map(([model, r]) => ({ model, ...r, rate: r.score / r.games })).sort((p, q) => q.rate - p.rate || q.games - p.games),
  };
}
