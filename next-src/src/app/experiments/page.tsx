import { pageMetadata } from '@/lib/metadata';
import { Experiments } from '@/components/Experiments';


export default function ExperimentsPage() {
  return (
    <div className="research-index">
      <header className="research-page-head experiment-intro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="experiment-art" src="/assets/art/experiment-archive.webp" width="640" height="608" alt="" aria-hidden="true" />
        <h1>Experiments</h1><p>Published runs, with model comparisons and the judgments behind them.</p></header>
      <Experiments />
    </div>
  );
}

export const metadata = pageMetadata("Experiments \u2014 ValueArena", "Published EigenBench experiments, model comparisons, configurations, and the judgments behind the results.", "/experiments/");
