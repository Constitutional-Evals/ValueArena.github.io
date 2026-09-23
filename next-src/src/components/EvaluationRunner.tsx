'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

const apiURL = (process.env.NEXT_PUBLIC_EVALUATION_API_URL || '').replace(/\/$/, '');
const authURL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
type Model = { id: string; label: string };
type Job = { id: string; name: string; state: string; stage: string; engine: string; has_artifacts: boolean; error_code: string | null };

export function EvaluationRunner() {
  const auth = useMemo(() => authURL && authKey ? createClient(authURL, authKey) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [engine, setEngine] = useState('native');
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState('');
  const [scenarios, setScenarios] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [credits, setCredits] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    if (!auth) return;
    let alive = true;
    void auth.auth.getSession().then(({ data, error }) => {
      if (alive) { setSession(data.session); if (error) setError(error.message); }
    });
    const { data } = auth.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [auth]);

  async function request(path: string, options: RequestInit = {}) {
    const { data } = await auth!.auth.getSession();
    if (!data.session) throw new Error('Please sign in again.');
    const response = await fetch(apiURL + path, { ...options, headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...options.headers,
    } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`);
    }
    return response;
  }

  useEffect(() => {
    if (!session || !apiURL) { setJobs([]); setCredits(null); setEnabled(false); return; }
    let alive = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const [account, catalog, runs] = await Promise.all([
          request('/account').then(r => r.json()), request('/models').then(r => r.json()), request('/evaluations').then(r => r.json()),
        ]);
        if (alive) { setCredits(account.credits); setEnabled(account.enabled); setModels(catalog.models); setJobs(runs); }
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { pending = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => { alive = false; clearInterval(timer); };
    // The SDK refreshes tokens inside request(); polling restarts on user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const { error } = await auth!.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/evaluate/` } });
      if (error) throw error;
      setNotice('Check your email for a sign-in link.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const body = JSON.stringify({ name, engine, models: selected,
        criteria: criteria.split('\n').map(s => s.trim()).filter(Boolean),
        scenarios: scenarios.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), max_runtime_seconds: minutes * 60 });
      if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() };
      const response = await request('/evaluations', { method: 'POST', body, headers: { 'Idempotency-Key': submission.current.key } });
      const job: Job = await response.json();
      setJobs(existing => [job, ...existing.filter(j => j.id !== job.id)]);
      submission.current = null;
      setNotice('Evaluation queued. You can close this page; the run continues on the worker.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function cancel(job: Job) {
    try {
      const response = await request(`/evaluations/${job.id}/cancel`, { method: 'POST' });
      const updated = await response.json(); setJobs(current => current.map(j => j.id === job.id ? updated : j));
    } catch (e) { setError((e as Error).message); }
  }

  async function download(job: Job) {
    try {
      const response = await request(`/evaluations/${job.id}/artifacts`);
      if (response.headers.get('content-type')?.includes('application/json')) {
        const { url } = await response.json(); window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const url = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'evaluation.tar.gz'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { setError((e as Error).message); }
  }

  if (!auth || !apiURL) return <p className="evaluation-notice" role="status">The evaluation service is not connected yet.</p>;

  return <>
    {error && <p role="alert" className="evaluation-notice">{error}</p>}
    {notice && <p role="status" className="evaluation-notice">{notice}</p>}
    {!session ? <form className="evaluation-form" onSubmit={login}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button className="button-primary" disabled={busy}>Send sign-in link</button>
    </form> : <>
      <div className="evaluation-account"><span>{session.user.email} · {credits ?? '…'} execution seconds available</span><button onClick={() => void auth.auth.signOut()}>Sign out</button></div>
      {!enabled && <p className="evaluation-notice">This account has not been enabled for evaluations yet.</p>}
      <form className="evaluation-form" onSubmit={submit}>
        <label>Evaluation name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Execution engine<select value={engine} onChange={e => setEngine(e.target.value)}><option value="native">Native EigenBench (default)</option><option value="inspect">Inspect</option></select></label>
        <fieldset><legend>Model panel</legend><p className="story-small">Choose 2–8 models. Each model responds and judges in this first version.</p>
          {!models.length && <p>No models are configured yet.</p>}
          {models.map(model => <label className="evaluation-model" key={model.id}><input type="checkbox" checked={selected.includes(model.id)} onChange={e => setSelected(current => e.target.checked ? [...current, model.id] : current.filter(id => id !== model.id))} />{model.label}</label>)}
        </fieldset>
        <label>Constitution<textarea required rows={5} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="One criterion per line" /><span>Up to 12 criteria.</span></label>
        <label>Scenarios<textarea required rows={7} value={scenarios} onChange={e => setScenarios(e.target.value)} placeholder="Separate scenarios with a blank line" /><span>Up to 200 unique scenarios. Results are private to your account.</span></label>
        <label>Maximum run time (minutes)<input type="number" min={5} max={240} step={1} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} /><span>Reserves {minutes * 60} execution seconds. Unused time is released after worker cleanup; credits are not a currency estimate.</span></label>
        <button className="button-primary" disabled={busy || !enabled || selected.length < 2 || selected.length > 8 || (credits ?? 0) < minutes * 60}>Run evaluation</button>
      </form>
      <section className="evaluation-jobs"><h2>Your evaluations</h2>{!jobs.length && <p>No evaluations yet.</p>}
        {jobs.map(job => <article key={job.id}><div><strong>{job.name}</strong><p>{job.engine === 'inspect' ? 'Inspect' : 'Native EigenBench'} · {job.state === 'running' ? job.stage : job.state}</p>{job.error_code && <p>{job.error_code.replaceAll('_', ' ')}</p>}</div><div className="research-links">
          {['queued', 'provisioning', 'running'].includes(job.state) && <button onClick={() => void cancel(job)}>Cancel</button>}
          {job.has_artifacts && <button onClick={() => void download(job)}>Download results</button>}
        </div></article>)}
      </section>
    </>}
  </>;
}
