'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateCoverage, parseCollectionReport, type CollectionReport } from '@/lib/coverage';
import { hfImageURL } from '@/lib/hf';
import { inspectViewerURL } from '@/lib/protocol';
import type { MetaJson } from '@/lib/types';

export function CollectionCoverage({ meta, slug }: { meta: MetaJson; slug: string }) {
  const [state, setState] = useState<{ loading: boolean; report: CollectionReport | null; error: boolean }>({ loading: false, report: null, error: false });
  const [judge, setJudge] = useState('');
  const [limit, setLimit] = useState(40);
  const file = meta.inspect?.collection_report_file;
  const url = file && /^[\w-]+\.json$/.test(file) ? hfImageURL(`runs/${slug}/${file}`) : null;
  useEffect(() => {
    const controller = new AbortController();
    setJudge(''); setLimit(40);
    setState({ loading: Boolean(url), report: null, error: false });
    if (url) {
      fetch(url, { signal: controller.signal }).then(async res => {
        if (!res.ok) throw new Error('Report unavailable');
        const report = parseCollectionReport(await res.json());
        if (!report || report.log_file !== meta.inspect?.log_file) throw new Error('Invalid report');
        if (!controller.signal.aborted) setState({ loading: false, report, error: false });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ loading: false, report: null, error: true });
      });
    }
    return () => controller.abort();
  }, [url, meta.inspect?.log_file]);

  const { report } = state;
  const estimate = estimateCoverage(meta);
  const omissions = report?.omissions || [];
  const judges = useMemo(() => [...new Set(omissions.map(row => row.judge))].sort(), [omissions]);
  const filtered = judge ? omissions.filter(row => row.judge === judge) : omissions;
  const omitted = report?.omitted_samples ?? estimate.omitted;
  const inspectURL = inspectViewerURL(meta, slug);
  const additionalShortfall = Boolean(report && estimate.source === 'estimate' && estimate.omitted !== null && estimate.omitted > report.omitted_samples);
  const warning = (omitted !== null && omitted > 0) || additionalShortfall || estimate.partial;
  return (
    <section className={`card collection-coverage${warning ? ' collection-coverage-warning' : ''}`} aria-label="Collection coverage">
      <h2>Collection coverage</h2>
      {state.loading ? <p role="status">Loading omitted samples…</p> : report ? <>
        <p className="coverage-headline"><strong>{report.omitted_samples.toLocaleString()} logged samples omitted</strong> · {report.exported_samples.toLocaleString()} of {report.logged_samples.toLocaleString()} included in the export</p>
      </> : <>
        <p className="coverage-headline"><strong>{estimate.source === 'reported' ? `${omitted?.toLocaleString()} missing judgments reported` : estimate.source === 'estimate' ? `${omitted?.toLocaleString()} judgments short of the spec total (estimate)` : 'Omitted sample count unavailable'}</strong></p>
        {estimate.exported !== null && <p>{estimate.exported.toLocaleString()} judgments in the published analysis{estimate.expected !== null ? `; ${estimate.expected.toLocaleString()} expected from the spec` : ''}.</p>}
        <p className="card-caption">{estimate.source === 'estimate' ? 'A row-count estimate, not a verified failure count. Matching totals do not prove every planned judgment succeeded.' : estimate.source === 'reported' ? 'Reported by the run metadata. Individual omitted samples have not been published.' : 'This run has no verified omission report. Missing information does not mean zero failures.'} {estimate.inconsistent ? 'The totals differ from a single-pass plan; an extended run needs its original assignments to verify coverage.' : ''}</p>
      </>}
      {additionalShortfall && <p className="coverage-warning-text">The spec-based estimate is {estimate.omitted?.toLocaleString()} missing judgments overall. Some may be absent from the published log; the table only covers logged omissions.</p>}
      {estimate.partial && <p className="coverage-warning-text">The collection is marked partial.</p>}
      {warning && <p className="coverage-warning-text">Rankings and transcripts may represent only the successful subset.</p>}
      {state.error && <p role="status">The omission report could not be loaded. {estimate.source !== 'unknown' ? 'Showing metadata-based information instead.' : 'Failure details remain unavailable.'}</p>}
      <div className="coverage-actions">
        {inspectURL && <a className="tx-btn" href={inspectURL} target="_blank" rel="noreferrer">Inspect sample details →</a>}
        {url && report && <a className="tx-btn" href={url} target="_blank" rel="noreferrer">Download omission report</a>}
      </div>
      {omissions.length > 0 && <details className="coverage-details">
        <summary>View {omissions.length.toLocaleString()} omitted samples</summary>
        <label>Judge <select value={judge} onChange={event => { setJudge(event.target.value); setLimit(40); }}>
          <option value="">All judges</option>{judges.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <p>{filtered.length.toLocaleString()} omitted samples{judge ? ` for ${judge}` : ''}</p>
        <div className="coverage-table-wrap"><table className="elo-table">
          <thead><tr><th>Scenario</th><th>Judge</th><th>Model(s)</th><th>Reason</th></tr></thead>
          <tbody>{filtered.slice(0, limit).map((row, index) => <tr key={`${row.sample_id}-${index}`}>
            <td><details><summary>{row.scenario_index ?? 'Unknown'} · {row.sample_id}</summary><p className="coverage-scenario">{row.scenario || 'Scenario text unavailable.'}</p></details></td>
            <td>{row.judge}</td><td>{row.models.join(', ')}</td>
            <td className="coverage-reason">{row.reason === 'sample_error' ? row.error || 'Sample failed; no error message recorded.' : 'Not present in the export; no sample error recorded.'}</td>
          </tr>)}</tbody>
        </table></div>
        {filtered.length > limit && <button className="tx-btn" onClick={() => setLimit(n => n + 40)}>Show more omitted samples</button>}
      </details>}
    </section>
  );
}
