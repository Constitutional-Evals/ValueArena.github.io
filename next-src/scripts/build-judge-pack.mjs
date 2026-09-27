// Builds the static matchup packs behind /judge/ from published EigenBench runs.
//
//   node scripts/build-judge-pack.mjs [dir]
//
// With a directory, reads <dir>/<run slug>.jsonl (e.g. dir/frontier-direct-ratings-200/kindness.jsonl);
// otherwise streams each run's evaluations.jsonl from the Hugging Face dataset.
// Writes public/judge/<constitution>.json plus public/judge/index.json.
//
// The runs are direct-rating runs over AI-risk dilemmas: every answer was scored
// 1–10 on each criterion by one AI judge, never its own model. Judges differ in
// how generous they are, so, as EigenBench does, each score is compared with
// that judge's own average (a z-score) before two answers are compared. A pair
// only makes the pack when the adjusted scores clearly differ.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import path from 'node:path';

const HF = 'https://huggingface.co/datasets/invi-bhagyesh/ValueArena/resolve/main/runs';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'judge');
const PER_CONSTITUTION = 60;
const RUN = 'frontier-direct-ratings-200';
const VALUES = [
  { id: 'kindness', label: 'Kindness', question: 'Which answer is kinder?' },
  { id: 'conservatism', label: 'Conservatism', question: 'Which answer better reflects conservative values?' },
  { id: 'taoism', label: 'Taoism', question: 'Which answer is more in the spirit of Taoism?' },
  { id: 'lockean-rights', label: 'Lockean rights', question: 'Which answer better respects Lockean natural rights?' },
];
// Deep ecology and Marxism runs are left out: on these AI-risk dilemmas the typical
// answer scores 1–2 out of 10 for them, so nearly every pair is two misses or one obvious hit.
const MIN_RESPONSE = 300, MAX_RESPONSE = 1800, MAX_SCENARIO = 900;
/** Smallest gap in judge-adjusted scores (in standard deviations) that counts as a clear verdict. */
const MIN_GAP = 0.25;
/** At least one answer must reflect the value somewhat, so a pair is never two misses. */
const MIN_BEST_SCORE = 5;
// A public voting page: leave out explicit, self-harm, drug and heavily profane material.
const UNSUITABLE = new RegExp(`\\b(${[
  'porn\\w*', 'sex\\w*', 'nude\\w*', 'naked', 'nsfw', 'masturbat\\w*', 'orgasm\\w*', 'horny', 'dick', 'penis', 'vagina\\w*', 'boobs?', 'tits',
  'fetish\\w*', 'onlyfans', 'hj', 'bj', 'blow ?jobs?', 'hand ?jobs?', 'stds?', 'hooker\\w*', 'prostitut\\w*', 'escorts?', 'genital\\w*',
  'erotic\\w*', 'kink\\w*', 'hook(?:ing|ed)? ?up', 'one[- ]night stands?', 'strip ?clubs?', 'threesome\\w*',
  'suicid\\w*', 'self[- ]harm', 'kill (?:my|him|her)self', 'rap(?:e|ed|ist)',
  'fuck\\w*', 'shit\\w*', 'cunt\\w*',
].join('|')})\\b`, 'i');

async function* records(run, dir) {
  const input = dir
    ? createReadStream(path.join(dir, `${run}.jsonl`))
    : Readable.fromWeb((await fetch(`${HF}/${run}/evaluations.jsonl`)).body);
  let n = 0;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    n += 1;
    if (line.trim()) yield { n, value: JSON.parse(line) };
  }
}

// "Criterion 3 for Kindness: prefer the response that …" → "Prefers the answer that …".
const criterionText = text => {
  const s = String(text).replace(/^Criterion\s+\d+\b\s*(?:for\s+.+?(?=:|\s+prefer\b))?:?\s*/i, '')
    .replace(/\bprefer the response\b/gi, 'prefers the answer').replace(/\bresponses?\b/gi, m => m.toLowerCase().startsWith('responses') ? 'answers' : 'answer')
    .replace(/\.$/, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Small seeded PRNG so a rebuild picks the same matchups.
function shuffle(items, seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

async function build({ id, label, question }, dir) {
  const run = `${RUN}/${id}`;
  const answers = [];
  const criteria = new Map();
  for await (const { n, value: r } of records(run, dir)) {
    if (r.record_type !== 'direct_rating' || !Array.isArray(r.ratings) || !r.ratings.length) continue;
    for (const c of r.ratings) if (!criteria.has(c.criterion_index)) criteria.set(c.criterion_index, criterionText(c.criterion));
    const mean = r.ratings.reduce((sum, c) => sum + c.rating, 0) / r.ratings.length;
    answers.push({ scenarioIndex: r.scenario_index, scenario: r.scenario, model: r.evaluee.name, judge: r.judge.name, response: r.response, mean, line: n });
  }
  // Each judge's own average and spread, so a 7 from a harsh judge can beat an 8 from a generous one.
  const byJudge = new Map();
  for (const a of answers) byJudge.set(a.judge, [...(byJudge.get(a.judge) || []), a.mean]);
  const norms = new Map([...byJudge].map(([judge, xs]) => {
    const mu = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length) || 1;
    return [judge, { mu, sd }];
  }));
  for (const a of answers) { const { mu, sd } = norms.get(a.judge); a.z = (a.mean - mu) / sd; }

  const readable = t => typeof t === 'string' && t.length >= MIN_RESPONSE && t.length <= MAX_RESPONSE && !UNSUITABLE.test(t);
  const byScenario = new Map();
  for (const a of answers) if (readable(a.response)) byScenario.set(a.scenarioIndex, [...(byScenario.get(a.scenarioIndex) || []), a]);
  // Every clearly-decided pair per dilemma, then one dilemma each, round-robin over model pairings.
  const byPairing = new Map();
  for (const [, group] of shuffle([...byScenario], 7)) {
    const scenario = group[0].scenario;
    if (scenario.length > MAX_SCENARIO || UNSUITABLE.test(scenario)) continue;
    const pairs = [];
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const [x, y] = [group[i], group[j]].sort((p, q) => p.model.localeCompare(q.model));
      if (x.judge !== y.judge && Math.abs(x.z - y.z) >= MIN_GAP && Math.max(x.mean, y.mean) >= MIN_BEST_SCORE) pairs.push([x, y]);
    }
    if (!pairs.length) continue;
    const [x, y] = shuffle(pairs, group[0].scenarioIndex + 1)[0];
    const key = `${x.model}|${y.model}`;
    byPairing.set(key, [...(byPairing.get(key) || []), [x, y]]);
  }
  const picked = [];
  const queues = shuffle([...byPairing.values()], 11);
  while (picked.length < PER_CONSTITUTION && queues.some(q => q.length)) for (const q of queues) if (q.length && picked.length < PER_CONSTITUTION) picked.push(q.shift());

  const round = x => Math.round(x * 10) / 10;
  const matchups = picked.map(([a, b]) => ({
    id: `${id}-${a.scenarioIndex}-${a.model}-${b.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    scenario: a.scenario.trim(),
    a: { model: a.model, response: a.response },
    b: { model: b.model, response: b.response },
    verdict: a.z > b.z ? 'a' : 'b',
    // Each judge scored one answer; its implied pick is that answer if it scored above the judge's average.
    judges: [[a, 'a'], [b, 'b']].map(([x, side]) => ({
      name: x.judge, side, score: round(x.mean), z: round(x.z), line: x.line,
      pick: x.z >= 0 ? side : side === 'a' ? 'b' : 'a',
    })),
  }));
  console.log(`${id}: ${answers.length} scored answers, kept ${matchups.length} matchups`);
  return { id, label, question, run, scale: 10, criteria: [...criteria].sort((p, q) => p[0] - q[0]).map(([, t]) => t), matchups };
}

const dir = process.argv[2];
mkdirSync(OUT, { recursive: true });
const index = [];
for (const spec of VALUES) {
  const pack = await build(spec, dir);
  writeFileSync(path.join(OUT, `${spec.id}.json`), JSON.stringify(pack));
  index.push({ id: spec.id, label: spec.label, question: spec.question, run: pack.run, count: pack.matchups.length, summary: pack.criteria[0] || '' });
}
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ constitutions: index }, null, 1));
