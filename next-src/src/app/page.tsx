'use client';

import { useEffect, useState } from 'react';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { ResultsExplorer } from '@/components/ResultsExplorer';
import { HomeRanking } from '@/components/HomeRanking';
import { ExperimentsPreview } from '@/components/ExperimentsPreview';

export default function HomePage() {
  const [active, setActive] = useState('tradeoffs');
  const contents = [['tradeoffs', 'Humor vs. sarcasm'], ['values', 'Model rankings'], ['how-it-works', 'Method'], ['evidence', 'Experiments'], ['related-research', 'Research']];
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
      <p className="research-deck">EigenBench scores language models on how well their answers fit a written set of values, which we call a constitution. Browse the rankings, compare models across constitutions, and read the actual responses and judgments behind every score.</p>
      <div className="home-actions"><a className="button-primary" href="/explore/">Explore results <span aria-hidden>↗</span></a><a className="button-secondary" href="/research/eigenbench/">How EigenBench works <span aria-hidden>→</span></a></div>
    </section>
    <FeaturedCarousel />
    <nav className="story-jump home-contents" aria-label="On this page"><span>Contents</span>{contents.map(([id, title], index) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{title}</a>)}</nav>

    <section className="story-section home-featured" id="tradeoffs">
      <div className="story-copy"><h2>Humor and sarcasm</h2><p>Each dot is a model, scored once for humor and once for sarcasm. Hover over a dot to see which model it is, click it to read how it was judged, or filter by model family below.</p></div>
      <ResultsExplorer embedded />
    </section>

    <section className="story-section" id="values">
      <div className="story-copy"><h2>Model rankings by constitution</h2><p>Pick a constitution to see how the models ranked on it. Each ranking comes from a single run, so its scores only compare the models, scenarios and judges in that run.</p></div>
      <HomeRanking />
    </section>

    <section className="story-section" id="how-it-works">
      <div className="story-copy art-section-intro"><img className="section-pixel-art" src="/assets/art/constitution-notebook.webp" width="256" height="256" alt="" aria-hidden="true" loading="lazy" /><h2>How EigenBench works</h2><p>Every model answers the same scenarios. Then the models take turns as judges, reading each other’s answers with the names removed and deciding which fits the constitution better. EigenBench turns those judgments into scores.</p></div>
      <dl className="arena-protocol">
        <div><dt>Responses</dt><dd>Every model answers the same scenario. What it chooses to do shows what it cares about.</dd></div>
        <div><dt>Judgments</dt><dd>Judges either pick the better of two unnamed answers or rate each answer against the constitution.</dd></div>
        <div><dt>Aggregation</dt><dd>EigenTrust gives more say to judges whose own answers the other judges rate highly, then combines everything into one score per model.</dd></div>
      </dl>
      <div className="arena-method-note"><strong>Why the error bars?</strong><p>A different sample of scenarios or judgments could shuffle the order a little. The bootstrap intervals show how much, so you can tell a real gap from noise.</p><a href="/research/eigenbench/">About EigenBench →</a></div>
    </section>

    <section className="story-section" id="evidence">
      <div className="story-copy">
        <h2>Published experiments</h2><p>Open a run to see which models took part, how many judgments were collected, and the judgments themselves. The explorer lets you compare rankings across constitutions.</p></div>
      <ExperimentsPreview />
      <div className="research-links arena-evidence-links"><a className="research-primary" href="/explore/">Explore rankings & tradeoffs ↗</a><a href="/compare/">Compare models yourself →</a></div>
      <p className="story-small">A higher score means a model’s answers fit the chosen constitution better. It says nothing about whether the model is safer or better aligned overall. The model at the top of the sarcasm ranking is just very sarcastic.</p>
    </section>

    <section className="story-closing" id="related-research">
      <div className="art-section-intro"><img className="section-pixel-art" src="/assets/art/character-side-effects.webp" width="256" height="256" alt="" aria-hidden="true" loading="lazy" /><h2>The side effects of character training</h2><p>We used EigenBench to study character training: train a model to be, say, more loving, then check what else changed. We also looked at what happens when a prompt pulls against the trained trait, and how things shift over the course of training.</p><div className="research-links"><a className="research-primary" href="/research/character-training/">Read the overview →</a></div></div>
    </section>
    <footer className="research-footer"><a href="/research/">Research from LAISR Lab</a><div><a href="https://github.com/ValueArena/ValueArena.github.io">Code ↗</a><a href="https://huggingface.co/datasets/invi-bhagyesh/ValueArena">Data ↗</a><a href="/leaderboard/">Leaderboard →</a></div></footer>
  </div>;
}
