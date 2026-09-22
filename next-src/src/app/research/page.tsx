import { pageMetadata } from '@/lib/metadata';

import { ResearchStory } from '@/components/ResearchStory';

export default function ResearchPage() {

  return <div className="research-home story-home">
    <section className="research-intro art-section-intro" aria-labelledby="home-title">
      <img className="section-pixel-art" src="/assets/art/character-plant.webp" width="256" height="256" alt="" aria-hidden="true" />
      <p className="research-eyebrow">LAISR Lab · Character-training research</p>
      <h1 id="home-title">Side effects of character training</h1>
      <p className="research-deck">Language models can be trained to be more loving, humorous, or poetic. We study how those traits take hold, how they interact, and the side effects they leave behind.</p>
      <div className="research-links"><a className="research-primary" href="#side-effects">See the findings ↓</a><a href="/explore/">Open the explorer ↗</a></div>
    </section>
    <ResearchStory />
    <footer className="research-footer">
      <span>LAISR Lab</span>
      <div><a href="https://github.com/ValueArena/ValueArena.github.io">Code ↗</a><a href="https://huggingface.co/datasets/invi-bhagyesh/ValueArena">Data ↗</a><a href="/leaderboard/">Leaderboard →</a></div>
    </footer>
  </div>;
}

export const metadata = pageMetadata("Character Training Research \u2014 ValueArena", "LAISR Lab research on character training, interactions between model traits, and cross-constitution side effects.", "/research/");
