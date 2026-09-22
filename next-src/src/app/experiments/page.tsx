import { Experiments } from '@/components/Experiments';

export const metadata = {
  title: 'ValueArena — Experiments',
  description: 'Every EigenBench run published to ValueArena, with its configuration and results.',
};

export default function ExperimentsPage() {
  return (
    <div className="research-index">
      <header className="research-page-head"><h1>Experiments</h1><p>Published runs, with model comparisons and the judgments behind them.</p></header>
      <Experiments />
    </div>
  );
}
