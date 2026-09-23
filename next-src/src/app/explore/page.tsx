import { pageMetadata } from '@/lib/metadata';
import { ResultsExplorer } from '@/components/ResultsExplorer';
export default function ExplorePage() {
  return <div className="research-index"><header className="research-page-head"><h1>Explore the results</h1><p>See how models rank on each constitution, and how the order changes when you switch.</p></header><ResultsExplorer /></div>;
}

export const metadata = pageMetadata("Explore Results \u2014 ValueArena", "EigenBench rankings with error bars, plus side-by-side comparisons of two constitutions.", "/explore/");
