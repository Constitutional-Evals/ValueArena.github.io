import { pageMetadata } from '@/lib/metadata';
import { JudgeArena } from '@/components/JudgeArena';

export const metadata = pageMetadata('You vs the AI judges — ValueArena', 'Pick the answer that better fits a value, then see whether the AI judges agreed with you and which models share your values.', '/judge/');

export default function JudgePage() {
  return <JudgeArena />;
}
