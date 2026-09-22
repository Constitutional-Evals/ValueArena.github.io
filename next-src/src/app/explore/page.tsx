import { pageMetadata } from '@/lib/metadata';
import { ResultsExplorer } from '@/components/ResultsExplorer';
export default function ExplorePage() {
  return <div className="research-index"><header className="research-page-head"><h1>Explore the results</h1><p>See how models rank—and how the picture changes with the criteria.</p></header><ResultsExplorer /></div>;
}

export const metadata = pageMetadata("Explore Results \u2014 ValueArena", "Interactive EigenBench model rankings, uncertainty intervals, and comparisons across constitutions.", "/explore/");
