'use client';
import { useEffect, useRef, useState } from 'react';
import { evaluationRequest as request } from '@/lib/evaluation';

export function parseAdvancedSpec(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Advanced configuration must be a JSON object.');
  return value as Record<string, unknown>;
}

export function AdvancedConfiguration({ value, onChange, configVersion, getRequest, modelIds }: {
  value: string; onChange: (value: string) => void; configVersion: string;
  getRequest: () => object; modelIds: string[];
}) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(''); const [error, setError] = useState('');
  const [defaults, setDefaults] = useState<object | null>(null);
  const revision = useRef(0);
  useEffect(() => { revision.current++; setPreview(''); setError(''); }, [configVersion]);
  useEffect(() => {
    if (!open || defaults) return;
    let live = true;
    void request('/spec-options').then(r => r.json()).then(data => { if (live) setDefaults(data.defaults); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [open, defaults]);
  let syntaxError = '';
  try { parseAdvancedSpec(value); } catch (e) { syntaxError = (e as Error).message; }
  async function validate() {
    setBusy(true); setError(''); const current = revision.current;
    try {
      const result = await (await request('/spec-preview', { method: 'POST', body: JSON.stringify(getRequest()) })).json();
      if (current === revision.current) setPreview(result.python);
    } catch (e) { if (current === revision.current) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([preview], { type: 'text/x-python' }));
    const link = document.createElement('a'); link.href = url; link.download = 'spec.py'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="eval-advanced" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Advanced configuration</summary>
    <p>Edit spec settings as JSON. Changes here override the form’s defaults and are included when you submit.</p>
    <div className="eval-actions"><button type="button" disabled={!defaults} onClick={() => onChange(JSON.stringify(defaults, null, 2))}>Load all options</button><button type="button" onClick={() => onChange('{}')}>Reset overrides</button></div>
    <label>Spec overrides<textarea aria-label="Advanced spec JSON" rows={16} spellCheck={false} value={value} onChange={e => onChange(e.target.value)} /></label>
    {syntaxError && <p role="alert">{syntaxError}</p>}
    <details><summary>Fields & example</summary><p>Edit <code>evaluation</code>, <code>dataset</code>, <code>constitution.num_criteria</code>, <code>collection</code>, <code>training.bootstrap</code>, or <code>verbose</code>.</p>
      <pre>{JSON.stringify({ collection: { generation: { reflection: { max_tokens: 4096, temperature: 0.2, per_model: modelIds.length ? { [modelIds[0]]: { max_tokens: 2048 } } : {} } } }, training: { bootstrap: { n_bootstraps: 1000 } } }, null, 2)}</pre>
      <p>Model IDs: {modelIds.length ? modelIds.join(', ') : 'Select models first.'}</p>
      <p>The hosted runner supports direct ratings. Pairwise-only training options, extension files, Python code, and arbitrary paths are not accepted. Models, source data, and publication are controlled by the form; output paths and coverage checks are managed by the worker.</p>
    </details>
    {error && <p role="alert">{error}</p>}
    <button className="button-secondary" type="button" disabled={busy || !!syntaxError} onClick={() => void validate()}>{busy ? 'Validating…' : 'Validate & preview spec.py'}</button>
    {preview && <div className="eval-spec-preview"><p role="status">Valid configuration. Preview uses relative paths; the worker supplies its run directory.</p><pre tabIndex={0}>{preview}</pre><button type="button" className="button-secondary" onClick={download}>Download spec.py</button></div>}
  </details>;
}
