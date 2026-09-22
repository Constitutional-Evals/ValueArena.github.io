import { ResultsExplorer } from '@/components/ResultsExplorer';
export const metadata = { title: 'Explore results — ValueArena', description: 'Interactive model rankings, uncertainty, and tradeoffs across constitutions.' };
export default function ExplorePage() {
  return <div className="research-index"><header className="research-page-head"><h1>Explore the results</h1><p>See how models rank—and how the picture changes with the criteria.</p></header><ResultsExplorer /></div>;
}
