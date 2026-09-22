import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata("Experiment Results \u2014 ValueArena", "EigenBench experiment results, model scores, evaluation coverage, and judgments.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
