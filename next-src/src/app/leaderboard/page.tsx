import { Leaderboard } from '@/components/Leaderboard';

export const metadata = {
  title: 'ValueArena — Leaderboard',
  description: 'Cross-constitution Elo rankings for language models, judged via EigenBench.',
};

export default function LeaderboardPage() {
  return (
    <div className="research-index">
      <header className="research-page-head"><h1>Leaderboard</h1><p>Compare models under a shared constitution.</p><a className="home-panel-link" href="/explore/">Interactive rankings & tradeoffs →</a></header>
      <Leaderboard />
    </div>
  );
}
