// You vs the AI judges: matchup packs, the visitor's votes, and what they add up to.
//
// Packs are static JSON built by scripts/build-judge-pack.mjs from published
// EigenBench runs. Votes stay in this browser until community voting has a
// backend; saveVote() is the one place that will need to send them on.

export type Pick = 'a' | 'b' | 'tie';

export interface JudgeVerdict {
  name: string;
  pick: Pick;
  /** Share of this judge's criterion choices that went to answer a (ties excluded). */
  share: number;
  /** Line in the run's evaluations.jsonl, for linking to the judge's reasoning. */
  line: number;
}

export interface Matchup {
  id: string;
  scenario: string;
  a: { model: string; response: string };
  b: { model: string; response: string };
  judges: JudgeVerdict[];
}

export interface PackInfo { id: string; label: string; question: string; run: string; count: number; summary: string }
export interface Pack { id: string; label: string; question: string; run: string; criteria: string[]; matchups: Matchup[] }

export interface Vote {
  id: string;
  constitution: string;
  /** In the pack's a/b terms, not the on-screen order. */
  pick: Pick;
  a: string;
  b: string;
  judges: { name: string; pick: Pick }[];
  at: number;
}

const STORE = 'va-judge-votes-v1';

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

/** How many of the matchup's judges made the same call as the visitor. */
export function agreement(vote: Pick, judges: { pick: Pick }[]) {
  return { agreed: judges.filter(j => j.pick === vote).length, total: judges.length };
}

export interface JudgeStats {
  votes: number;
  /** Judge verdicts that matched the visitor's pick, over all verdicts seen. */
  agreementRate: number | null;
  /** Consecutive latest votes where most judges agreed. */
  streak: number;
  judges: { name: string; agreed: number; total: number; rate: number }[];
  models: { model: string; score: number; games: number; rate: number }[];
}

export function stats(votes: Vote[]): JudgeStats {
  let agreed = 0, seen = 0;
  const judges = new Map<string, { agreed: number; total: number }>();
  const models = new Map<string, { score: number; games: number }>();
  for (const v of votes) {
    for (const j of v.judges) {
      const row = judges.get(j.name) || { agreed: 0, total: 0 };
      row.total += 1; seen += 1;
      if (j.pick === v.pick) { row.agreed += 1; agreed += 1; }
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
    const { agreed: n, total } = agreement(v.pick, v.judges);
    if (total && n * 2 > total) streak += 1; else break;
  }
  return {
    votes: votes.length,
    agreementRate: seen ? agreed / seen : null,
    streak,
    judges: [...judges].map(([name, r]) => ({ name, ...r, rate: r.agreed / r.total })).sort((p, q) => q.rate - p.rate || q.total - p.total),
    models: [...models].map(([model, r]) => ({ model, ...r, rate: r.score / r.games })).sort((p, q) => q.rate - p.rate || q.games - p.games),
  };
}
