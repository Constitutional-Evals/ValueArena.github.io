import { pageMetadata } from '@/lib/metadata';
import { Leaderboard } from '@/components/Leaderboard';


export default function LeaderboardPage() {
  return (
    <div className="research-index">
      <header className="research-page-head"><h1>Leaderboard</h1><p>Compare models under a shared constitution.</p><a className="home-panel-link" href="/explore/">Interactive rankings & tradeoffs →</a></header>
      <Leaderboard />
    </div>
  );
}

export const metadata = pageMetadata("Leaderboard \u2014 ValueArena", "Published language model rankings across EigenBench constitutions, with scores and uncertainty.", "/leaderboard/");
