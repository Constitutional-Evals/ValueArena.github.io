'use client';

import { useEffect, useState } from 'react';
import { ResultsExplorer } from '@/components/ResultsExplorer';
import { HomeRanking } from '@/components/HomeRanking';
import { ExperimentsPreview } from '@/components/ExperimentsPreview';

export default function HomePage() {
  const [active, setActive] = useState('tradeoffs');
  const contents = [['tradeoffs', 'Two traits at once'], ['values', 'Model rankings'], ['how-it-works', 'Method'], ['evidence', 'Experiments'], ['related-research', 'Research']];
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('.arena-home section[id]').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const moved: Record<string, string> = { '#leaderboard': '/leaderboard/', '#experiments': '/experiments/' };
    if (moved[window.location.hash]) window.location.replace(moved[window.location.hash]);
  }, []);
  return <div className="research-home story-home arena-home">
    <section className="research-intro has-pixel-art" aria-labelledby="home-title">
      <h1 id="home-title">Measuring values in language models</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-pixel-art" src="/assets/art/model-conversation.webp" width="768" height="507" alt="" aria-hidden="true" />
      <p className="research-deck">EigenBench measures how language models express different values. This site presents the resulting rankings, comparisons across constitutions, and the responses and judgments behind each evaluation.</p>
      <div className="home-actions"><a className="button-primary" href="/explore/">Explore results <span aria-hidden>↗</span></a><a className="button-secondary" href="/methodology/">How EigenBench works <span aria-hidden>→</span></a></div>
    </section>
    <nav className="story-jump home-contents" aria-label="On this page"><span>Contents</span>{contents.map(([id, title], index) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{title}</a>)}</nav>

    <section className="story-section home-featured" id="tradeoffs">
      <div className="story-copy"><h2>Humor and sarcasm</h2><p>Each point is one model, evaluated under two constitutions. Hover to identify it, select it to read its judgments, or filter a model family below.</p></div>
      <ResultsExplorer embedded />
    </section>

    <section className="story-section" id="values">
      <div className="story-copy"><h2>Model rankings by constitution</h2><p>Kindness, humor, goodness: each constitution defines its own criteria. Select one to see a published ranking. Scores belong to that run’s models, scenarios, and judges.</p></div>
      <HomeRanking />
    </section>

    <section className="story-section" id="how-it-works">
      <div className="story-copy"><h2>How EigenBench works</h2><p>Models answer shared scenarios, then judge anonymous responses against a constitution. EigenBench combines these perspectives into relative scores.</p></div>
      <dl className="arena-protocol">
        <div><dt>Responses</dt><dd>Models answer the same scenario, revealing their priorities through their choices.</dd></div>
        <div><dt>Judgments</dt><dd>Judges compare anonymous responses or rate them against the constitution’s criteria.</dd></div>
        <div><dt>Aggregation</dt><dd>EigenTrust uses the pattern of peer judgments to assign weights and relative scores.</dd></div>
      </dl>
      <div className="arena-method-note"><strong>Why show uncertainty?</strong><p>Scores can change with the sampled scenarios and judgments. Bootstrap intervals help show how precisely a run estimates its rankings.</p><a href="/methodology/">Read the method →</a></div>
    </section>

    <section className="story-section" id="evidence">
      <div className="story-copy experiment-intro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="experiment-art" src="/assets/art/experiment-archive.webp" width="640" height="608" alt="" aria-hidden="true" loading="lazy" />
        <h2>Published experiments</h2><p>Open a run to inspect the model panel, coverage, and individual judgments. Or use the explorer to compare rankings and paired constitutions.</p></div>
      <ExperimentsPreview />
      <div className="research-links arena-evidence-links"><a className="research-primary" href="/explore/">Explore rankings & tradeoffs ↗</a><a href="/compare/">Compare models yourself →</a></div>
      <p className="story-small">Higher scores mean stronger expression of the selected constitution. They are not a universal measure of safety or alignment.</p>
    </section>

    <section className="story-closing" id="related-research">
      <div><h2>The side effects of character training</h2><p>Our character-training study uses EigenBench to examine the intended effects and side effects of character training, how prompts interact with trained traits, and what changes across checkpoints.</p><div className="research-links"><a className="research-primary" href="/research/">Read the visual overview →</a></div></div>
    </section>
    <footer className="research-footer"><a href="/research/">Research from LAISR Lab</a><div><a href="https://github.com/ValueArena/ValueArena.github.io">Code ↗</a><a href="https://huggingface.co/datasets/invi-bhagyesh/ValueArena">Data ↗</a><a href="/leaderboard/">Leaderboard →</a></div></footer>
  </div>;
}
