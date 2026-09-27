// Builds the static matchup packs behind /judge/ from published EigenBench runs.
//
//   node scripts/build-judge-pack.mjs [dir]
//
// With a directory, reads <dir>/<run slug>.jsonl (e.g. dir/8_models/kindness.jsonl);
// otherwise streams each run's evaluations.jsonl from the Hugging Face dataset.
// Writes public/judge/<constitution>.json plus public/judge/index.json.
//
// Each run's evaluations.jsonl is 150–200 MB, far too large for the browser, so
// this keeps a small, readable, deterministic sample: one pair per question,
// judged by at least two different AI judges, with answers short enough to read
// on a phone. Every judge saw both orders of a pair; its verdict here pools the
// criterion choices from both.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import path from 'node:path';

const HF = 'https://huggingface.co/datasets/invi-bhagyesh/ValueArena/resolve/main/runs';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'judge');
const PER_CONSTITUTION = 60;
const RUNS = [
  { id: 'kindness', label: 'Kindness', question: 'Which answer is kinder?', run: '8_models/kindness' },
  { id: 'conservatism', label: 'Conservatism', question: 'Which answer better reflects conservative values?', run: '8_models/conservatism' },
  { id: 'deep_ecology', label: 'Deep ecology', question: 'Which answer better reflects deep ecology?', run: '8_models/deep_ecology' },
];
const MIN_RESPONSE = 200, MAX_RESPONSE = 1500, MAX_SCENARIO = 280;
// A public voting page: leave out explicit, self-harm, drug and heavily profane threads.
const UNSUITABLE = new RegExp(`\\b(${[
  'porn\\w*', 'sex\\w*', 'nude\\w*', 'naked', 'nsfw', 'masturbat\\w*', 'orgasm\\w*', 'horny', 'dick', 'penis', 'vagina\\w*', 'boobs?', 'tits',
  'fetish\\w*', 'onlyfans', 'hj', 'bj', 'blow ?jobs?', 'hand ?jobs?', 'stds?', 'hooker\\w*', 'prostitut\\w*', 'escorts?', 'genital\\w*',
  'erotic\\w*', 'kink\\w*', 'virgin\\w*', 'hook(?:ing|ed)? ?up', 'one[- ]night stands?', 'strip ?clubs?', 'threesome\\w*', 'cheat(?:ing|ed)? on',
  'suicid\\w*', 'self[- ]harm', 'kill (?:my|him|her)self', 'rap(?:e|ed|ist)',
  'drugs?', 'drunk\\w*', 'alcoholics?', 'stoned', 'weed', 'cocaine', 'meth', 'heroin',
  'fuck\\w*', 'shit\\w*', 'cunt\\w*',
].join('|')})\\b`, 'i');

async function* lines(run, dir) {
  const input = dir
    ? createReadStream(path.join(dir, `${run}.jsonl`))
    : Readable.fromWeb((await fetch(`${HF}/${run}/evaluations.jsonl`)).body);
  let n = 0;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    n += 1;
    if (line.trim()) yield { n, value: JSON.parse(line) };
  }
}

const criteriaOf = text => (typeof text === 'string' ? text : '')
  .split(/(?=^Criterion\s+\d+\b)/m).map(s => s.trim()).filter(s => /^Criterion\s+\d+/.test(s))
  .map(s => s.replace(/^Criterion\s+\d+\b\s*(?:for\s+.+?(?=:|\s+prefer\b))?:?\s*/i, '').replace(/^prefer the response that\s*/i, '').replace(/\.$/, '').trim());

// Small seeded PRNG so a rebuild picks the same matchups.
function shuffle(items, seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

async function build({ id, label, question, run }, dir) {
  const groups = new Map();
  let criteria = [];
  for await (const { n, value: r } of lines(run, dir)) {
    if (typeof r.eval1_name !== 'string') continue;
    if (!criteria.length) criteria = criteriaOf(r.constitution);
    const [x, y] = [r.eval1_name, r.eval2_name].sort();
    const key = `${r.scenario_index}|${x}|${y}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { scenarioIndex: r.scenario_index, scenario: r.scenario, models: [x, y], responses: {}, judges: new Map() });
    g.responses[r.eval1_name] = r['eval1 response'];
    g.responses[r.eval2_name] = r['eval2 response'];
    const judge = g.judges.get(r.judge_name) || { votes: { [x]: 0, [y]: 0 }, line: n };
    for (const [, c, v] of String(r['judge response']).matchAll(/<criterion_(\d+)_choice>\s*([012])\s*<\/criterion_\1_choice>/g)) {
      if (Number(c) > criteria.length) continue;
      if (v === '1') judge.votes[r.eval1_name] += 1;
      if (v === '2') judge.votes[r.eval2_name] += 1;
    }
    g.judges.set(r.judge_name, judge);
  }

  const readable = t => typeof t === 'string' && t.length >= MIN_RESPONSE && t.length <= MAX_RESPONSE && !UNSUITABLE.test(t);
  const usable = [...groups.values()].filter(g => g.scenario.length <= MAX_SCENARIO && !UNSUITABLE.test(g.scenario) && g.models.every(m => readable(g.responses[m])));
  // Prefer pairs several judges saw; some runs only ever had one judge per pair.
  const multi = usable.filter(g => g.judges.size >= 2);
  const candidates = multi.length >= PER_CONSTITUTION ? multi : usable;
  // One pair per question, then round-robin over model pairings so no matchup dominates.
  const byPairing = new Map();
  const seenScenario = new Set();
  for (const g of shuffle(candidates, 7)) {
    if (seenScenario.has(g.scenarioIndex)) continue;
    seenScenario.add(g.scenarioIndex);
    const k = g.models.join('|');
    byPairing.set(k, [...(byPairing.get(k) || []), g]);
  }
  const picked = [];
  const queues = shuffle([...byPairing.values()], 11);
  while (picked.length < PER_CONSTITUTION && queues.some(q => q.length)) for (const q of queues) if (q.length && picked.length < PER_CONSTITUTION) picked.push(q.shift());

  const matchups = picked.map(g => {
    const [a, b] = g.models;
    return {
      id: `${id}-${g.scenarioIndex}-${a}-${b}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      scenario: g.scenario.replace(/""/g, '"').trim(),
      a: { model: a, response: g.responses[a] },
      b: { model: b, response: g.responses[b] },
      judges: [...g.judges].map(([name, j]) => {
        const va = j.votes[a], vb = j.votes[b];
        return { name, pick: va > vb ? 'a' : vb > va ? 'b' : 'tie', share: va + vb ? +(va / (va + vb)).toFixed(2) : 0.5, line: j.line };
      }).sort((p, q) => p.name.localeCompare(q.name)),
    };
  });
  const split = matchups.filter(m => new Set(m.judges.map(j => j.pick)).size > 1).length;
  console.log(`${id}: ${candidates.length} candidates, kept ${matchups.length} (${split} with split judges)`);
  return { id, label, question, run, criteria, matchups };
}

const dir = process.argv[2];
mkdirSync(OUT, { recursive: true });
const index = [];
for (const spec of RUNS) {
  const pack = await build(spec, dir);
  writeFileSync(path.join(OUT, `${spec.id}.json`), JSON.stringify(pack));
  index.push({ id: spec.id, label: spec.label, question: spec.question, run: spec.run, count: pack.matchups.length, summary: pack.criteria[0] || '' });
}
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ constitutions: index }, null, 1));
