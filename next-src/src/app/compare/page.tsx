import { pageMetadata } from '@/lib/metadata';
import { Chat } from '@/components/Chat';


export default function ComparePage() {
  return <Chat />;
}

export const metadata = pageMetadata("Compare Models \u2014 ValueArena", "Language model responses side by side, evaluated against a shared constitution.", "/compare/");
