import { pageMetadata } from '@/lib/metadata';
import { Leaderboard } from '@/components/Leaderboard';


export default function LeaderboardPage() {
  return (
    <div className="research-index">
      <header className="research-page-head"><h1>Leaderboard</h1><p>How the models rank on each constitution.</p><a className="home-panel-link" href="/explore/">Interactive rankings & tradeoffs →</a></header>
      <Leaderboard />
    </div>
  );
}

export const metadata = pageMetadata("Leaderboard \u2014 ValueArena", "Model rankings for every EigenBench constitution, with scores and error bars.", "/leaderboard/");
