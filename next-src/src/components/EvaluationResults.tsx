'use client';
import { useEffect, useState } from 'react';
import { evaluationAuth, evaluationRequest as request, type EvaluationJob } from '@/lib/evaluation';
import type { Summary } from '@/lib/types';
import { EloBarChart } from './EloBarChart';

type RecordRow = { scenario: string; scenario_index: number; model: string; judge: string; response: string; reflection: string; judgment: string };
type Result = { job: EvaluationJob; summary: Summary; criteria: string[]; record_count: number; batch_count: number };
export function EvaluationResults() {
  const [id, setId] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(''); const [records, setRecords] = useState<RecordRow[]>([]);
  const [batch, setBatch] = useState(0); const [loading, setLoading] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id') || '';
    setId(id); let alive = true;
    async function load() {
      try { const value = await (await request(`/results/${id}`, {}, true)).json(); if (alive) { setResult(value); setError(''); } }
      catch (e) { if (alive) { setResult(null); setRecords([]); setError((e as Error).message); } }
    }
    if (id) void load(); else setError('No evaluation selected.');
    const auth = evaluationAuth(); const subscription = auth?.auth.onAuthStateChange(() => { if (id) void load(); });
    return () => { alive = false; subscription?.data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!result || !result.batch_count || !id) return;
    let alive = true; setLoading(true); setRecords([]);
    void request(`/results/${id}/records/${batch}`, {}, true).then(r => r.json()).then(data => { if (alive) setRecords(data.records); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [result, id, batch]);
  return <div className="research-index evaluation-results"><a href="/evaluate/">← Your evaluations</a>{error && <p role="alert" className="evaluation-notice">{error} <a href="/evaluate/">Log in</a> to view private results.</p>}{!result && !error && <p role="status">Loading results…</p>}{result && <>
    <header className="research-page-head"><p className="eval-kicker">{result.job.visibility} · {result.job.engine === 'inspect' ? 'Inspect' : 'Native EigenBench'}</p><h1>{result.job.name}</h1><p>{result.job.constitution} · {result.job.models_count} models · {result.job.scenario_count} scenarios</p></header>
    <section><h2>Model ranking</h2><p>Higher Elo means more of the evaluated trait. Bars show the reported uncertainty intervals.</p><div className="eval-result-chart"><EloBarChart summary={result.summary} /></div><div className="eval-table-scroll"><table className="eval-results-table"><thead><tr><th>Model</th><th>Elo</th><th>95% interval</th></tr></thead><tbody>{[...result.summary].sort((a, b) => b.elo_mean - a.elo_mean).map(r => <tr key={r.model_index}><td>{r.model_name}</td><td>{r.elo_mean.toFixed(1)}</td><td>{r.elo_ci_lower != null && r.elo_ci_upper != null ? `${r.elo_ci_lower.toFixed(1)} – ${r.elo_ci_upper.toFixed(1)}` : '—'}</td></tr>)}</tbody></table></div></section>
    <details className="eval-section"><summary>Constitution · {result.criteria.length} criteria</summary><ol>{result.criteria.map((c, i) => <li key={i}>{c}</li>)}</ol></details>
    <section className="eval-section"><h2>Responses & judgments</h2><p>{result.record_count.toLocaleString()} judgments. Open a response to read its judge’s reflection and rating.</p>{result.batch_count > 0 && <div className="eval-pagination"><button disabled={batch === 0 || loading} onClick={() => setBatch(n => n - 1)}>← Previous</button><span>Page {batch + 1} of {result.batch_count}</span><button disabled={batch + 1 >= result.batch_count || loading} onClick={() => setBatch(n => n + 1)}>Next →</button></div>}{loading && <p role="status">Loading judgments…</p>}{records.map((r, i) => <article key={`${batch}-${i}`} className="eval-transcript"><p className="eval-kicker">Scenario {r.scenario_index + 1} · {r.model} · judged by {r.judge}</p><h3>{r.scenario}</h3><div className="eval-response">{r.response}</div><details><summary>Judge’s reflection & rating</summary><h4>Reflection</h4><div className="eval-response">{r.reflection || 'No reflection recorded.'}</div><h4>Rating</h4><pre>{r.judgment || 'No raw rating recorded.'}</pre></details></article>)}</section>
  </>}</div>;
}
