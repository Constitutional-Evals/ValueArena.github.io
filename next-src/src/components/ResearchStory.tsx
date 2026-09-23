'use client';

import { useState } from 'react';

const root = '/research/character-training';
const variance = [
  { name: 'Loving', character: 95.2, prompt: 4.8 },
  { name: 'Sarcasm', character: 71.2, prompt: 28.8 },
  { name: 'Misalignment', character: 42.6, prompt: 57.4 },
];

function PaperFigure({ file, alt, caption, width, height }: { file: string; alt: string; caption: string; width: number; height: number }) {
  return <figure className="story-paper-figure">
    <a href={`${root}/${file}.webp`} target="_blank" rel="noopener" aria-label={`Open full-size figure: ${alt}`}>
      {/* Original paper figures retain their numeric labels and uncertainty. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${root}/${file}.webp`} alt={alt} width={width} height={height} loading="lazy" />
    </a>
    <figcaption>{caption} <a href={`${root}/${file}.webp`} target="_blank" rel="noopener">View full size ↗</a></figcaption>
  </figure>;
}

export function ResearchStory() {
  const [matrix, setMatrix] = useState<'trained' | 'prompted'>('trained');
  return <>
    <nav className="story-jump" aria-label="On this page">
      <a href="#measuring-values">Measuring values</a>
      <a href="#side-effects">Side effects</a>
      <a href="#training-and-prompts">Training & prompts</a>
      <a href="#through-training">Through training</a>
    </nav>

    <section className="story-section story-method" id="measuring-values">
      <div className="story-copy"><p className="story-kicker">01 / The question</p>
        <h2>What changes when we teach a model a character?</h2>
        <p>A constitution describes a trait in words. Character training tries to make that trait part of a model’s behavior. EigenBench measures what comes through in its responses—and what else changes along the way.</p>
      </div>
      <ol className="story-protocol" aria-label="EigenBench evaluation overview">
        <li><span>01</span><strong>One scenario. Different responses.</strong><p>Models answer the same dilemma.</p></li>
        <li><span>02</span><strong>A constitution sets the criteria.</strong><p>Other models judge the anonymous responses.</p></li>
        <li><span>03</span><strong>Peer judgments become scores.</strong><p>EigenBench aggregates preferences into a ranking.</p></li>
      </ol>
      <p className="story-small">ValueArena is the place to explore those scores and read the judgments behind them. <a href="/research/eigenbench/">How EigenBench works →</a></p>
    </section>

    <section className="story-section" id="side-effects">
      <div className="story-copy"><p className="story-kicker">02 / Character training</p>
        <h2>Training one trait can move many others.</h2>
        <p>In the paper’s Qwen2.5-7B study, character training strengthens the intended traits—but also shifts behavior under other constitutions. The diagonal shows the target effect. Everything off it is a side effect.</p>
      </div>
      <div className="story-figure-toolbar"><div className="story-switch" role="group" aria-label="Compare training and prompting">
        <button aria-pressed={matrix === 'trained'} onClick={() => setMatrix('trained')}>Character-trained</button>
        <button aria-pressed={matrix === 'prompted'} onClick={() => setMatrix('prompted')}>Prompted</button>
      </div><span>11 traits · One base model</span></div>
      <div aria-live="polite" className="story-finding">
        {matrix === 'trained' ? <p><strong>Look at the goodness row.</strong> Every other training direction lowers its score relative to the base model in this experiment.</p> : <p><strong>Prompting produces a different pattern.</strong> Some traits respond strongly to a system prompt; goodness is more robust here than under character training.</p>}
      </div>
      <PaperFigure file={matrix} width={1430} height={1221} alt={`${matrix === 'trained' ? 'Character training' : 'Prompting'} matrix: 11 evaluation traits by 11 intervention traits, showing Elo gain over the base model.`} caption="Rows: evaluation criteria. Columns: training or prompting criteria. Red means higher scores than the base; blue means lower. Cell uncertainties are bootstrap standard deviations." />
      <details className="story-details"><summary>How to read these results</summary><p>Higher scores mean stronger expression of the evaluated constitution, including traits such as sarcasm or misalignment. They are not a general measure of safety. Each row is a separate EigenBench evaluation, anchored to the base model. These are figures from the paper snapshot, not a live aggregate of every ValueArena run.</p></details>
    </section>

    <section className="story-section" id="training-and-prompts">
      <div className="story-copy"><p className="story-kicker">03 / How deeply do traits stick?</p>
        <h2>A prompt does not override every trait equally.</h2>
        <p>What happens when a character-trained model receives a different constitution as a prompt? In a study crossing three trained characters with three prompts, training explains much more of the score variation for loving than for misalignment.</p>
      </div>
      <figure className="story-variance">
        <div className="story-variance-head"><span>Share attributed to</span><span><i className="variance-character" />Character training</span><span><i className="variance-prompt" />Prompting</span></div>
        {variance.map(row => <div className="story-variance-row" key={row.name}>
          <span>{row.name}</span>
          <div className="story-variance-track" role="img" aria-label={`${row.name}: character training ${row.character} percent, prompting ${row.prompt} percent of the reported variance split.`}>
            <span className="variance-character" style={{ width: `${row.character}%` }} title={`Character training: ${row.character}%`}>{row.character}%</span>
            <span className="variance-prompt" style={{ width: `${row.prompt}%` }} title={`Prompting: ${row.prompt}%`}>{row.prompt >= 10 ? `${row.prompt}%` : ''}</span>
          </div><span className="story-variance-prompt-value">{row.prompt}% prompt</span>
        </div>)}
        <figcaption>Reported training–prompt variance split from the paper’s two-way ANOVA. These percentages describe score variation in this experiment, not the percentage of a trait retained.</figcaption>
      </figure>
      <details className="story-details"><summary>See the underlying train–prompt experiment</summary>
        <PaperFigure file="train-prompt" width={2200} height={642} alt="Train-versus-prompt matrix for loving, misalignment, and sarcasm, with a base-model comparison." caption="Groups identify the trained character; columns within each group identify the prompt. Values are Elo gain over base, with bootstrap standard deviations." />
      </details>
    </section>

    <section className="story-section" id="through-training">
      <div className="story-copy"><p className="story-kicker">04 / Inside the training process</p>
        <h2>The final checkpoint is only part of the story.</h2>
        <p>Open Character Training first uses preference training (DPO), then trains on the model’s own reflections and interactions. Evaluating checkpoints across both stages shows the target trait and its side effects evolving together.</p>
      </div>
      <div className="story-training-path" aria-label="Open Character Training stages"><span>Base model</span><span aria-hidden>→</span><span>DPO</span><span aria-hidden>→</span><span>Introspection</span><span aria-hidden>→</span><span>Final character</span></div>
      <PaperFigure file="checkpoints" width={1981} height={1857} alt="Loving-training checkpoints evaluated across 11 constitutions. Loving gains accompany changes in other traits, including lower goodness scores." caption="One training direction: loving. Columns are DPO and introspection checkpoints, plus a released OCT comparison. Values are Elo gain over base, with bootstrap standard deviations." />
    </section>

    <section className="story-closing" id="keep-exploring">
      <div><p className="story-kicker">From the overview to the evidence</p><h2>Choose a value. Follow the judgments.</h2><p>Explore the full rankings, compare traits, or read how an individual response was judged.</p>
        <div className="research-links"><a className="research-primary" href="/explore/">Explore results ↗</a><a href="/experiments/">Browse all runs →</a><a href="/compare/">Compare models →</a></div>
      </div>
      <details className="story-details"><summary>Scope and sources</summary>
        <p>Featured results come from <cite>Side Effects of Character Training: Quantifying Cross-Constitution Drift in LLMs</cite>, using Qwen2.5-7B-Instruct and AIRiskDilemmas. They do not establish the same effects for every model family or scenario distribution. Rankings also depend on the judge population; the paper notes that adversarial traits can make judges less reliable.</p>
        <p>Figures and table values reflect the supplied paper snapshot of September 22, 2026. <a href={`${root}/sources.json`}>Figure and data provenance ↗</a> · <a href="https://huggingface.co/datasets/invi-bhagyesh/ValueArena">Published evaluation data ↗</a></p>
      </details>
    </section>
  </>;
}
