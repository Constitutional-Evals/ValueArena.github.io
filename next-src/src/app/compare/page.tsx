import { pageMetadata } from '@/lib/metadata';
import { Chat } from '@/components/Chat';


export default function ComparePage() {
  return <Chat />;
}

export const metadata = pageMetadata("Compare Models \u2014 ValueArena", "Ask two models the same question and vote for the answer that better fits a constitution.", "/compare/");
