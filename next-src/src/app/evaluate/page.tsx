import { pageMetadata } from '@/lib/metadata';
import { EvaluationRunner } from '@/components/EvaluationRunner';

export const metadata = pageMetadata('Run an Evaluation — ValueArena', 'Configure an EigenBench evaluation with your models, constitution, and scenarios.', '/evaluate/');

export default function EvaluatePage() {
  return <div className="research-index evaluation-page">
    <header className="research-page-head"><h1>Run an evaluation</h1><p>Choose a model panel, define a constitution, and supply scenarios.</p></header>
    <EvaluationRunner />
  </div>;
}
