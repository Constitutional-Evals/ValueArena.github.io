import { pageMetadata } from '@/lib/metadata';
import { HomeRanking } from '@/components/HomeRanking';

export const metadata = pageMetadata('EigenBench — ValueArena', 'A comparative behavioral measure of value alignment, using model responses and collective judgments.', '/research/eigenbench/');

export default function EigenBenchPaper() {
  return <div className="research-home story-home">
    <section className="research-intro art-section-intro">
      <a className="paper-back" href="/research/">← All research</a>
      <img className="section-pixel-art" src="/assets/art/model-conversation.webp" width="256" height="256" alt="" />
      <h1>EigenBench</h1>
      <p className="research-deck">A Comparative Behavioral Measure of Value Alignment</p>
      <p className="paper-authors">Jonathn Chang, Leonhard Piff, Suvadip Sana, Jasmine X. Li, and Lionel Levine</p>
      <div className="research-links"><a className="research-primary" href="https://arxiv.org/abs/2509.01938">Read the paper ↗</a><a href="/explore/">Published results →</a></div>
    </section>
    <section className="story-section">
      <div className="story-copy"><h2>Values expressed through behavior</h2><p>EigenBench compares a panel of language models against a written constitution. Models answer shared scenarios and judge one another’s responses. EigenTrust aggregates these judgments into scores reflecting the panel’s weighted consensus.</p></div>
      <ol className="story-protocol" aria-label="Evaluation process">
        <li><span>01</span><strong>Constitution</strong><p>A written value system defines the evaluation criteria.</p></li>
        <li><span>02</span><strong>Responses and judgments</strong><p>The model panel answers scenarios and evaluates other models’ answers.</p></li>
        <li><span>03</span><strong>Relative scores</strong><p>Peer judgments are combined into a comparative measure of alignment.</p></li>
      </ol>
      <p className="story-small">The paper evaluates agreement with human judgments and recovery of GPQA rankings without ground-truth labels. <a href="https://arxiv.org/abs/2509.01938">Source: EigenBench paper ↗</a></p>
    </section>
    <section className="story-section">
      <div className="story-copy"><h2>Published evaluations</h2><p>These interactive rankings come from current ValueArena runs; they are not the paper’s original experimental figures.</p></div>
      <HomeRanking />
    </section>
    <section className="story-closing"><div><h2>Reading the scores</h2><p>Scores describe relative alignment within a model panel and constitution. They do not establish an objective hierarchy of values or a universal safety ranking. The choice of scenarios, criteria, and judges matters.</p><div className="research-links"><a href="/experiments/">Experiments →</a><a href="/compare/">Model responses →</a><a href="/research/character-training/">Character-training study →</a></div></div></section>
  </div>;
}
