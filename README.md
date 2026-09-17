# ValueArena: Which Model Shares Your Values?

A comparative behavioral measure of value alignment across language models, built on [EigenBench](https://github.com/jchang153/EigenBench).

**Live:** [valuearena.github.io](https://valuearena.github.io)

## What is this?

ValueArena lets you explore how different LLMs align with specific human values. EigenBench supports pairwise comparisons fitted with Bradley–Terry–Davidson and direct criterion ratings normalized into a trust matrix. Both protocols aggregate consensus scores with EigenTrust.

The site has three sections:

- **Chat** — Pick two models and a constitution (e.g. Kindness, Humor, Sarcasm), then chat side-by-side. Vote on which model better reflects the chosen value. Uses OpenRouter for inference directly from the browser.
- **Leaderboard** — Per-constitution Elo rankings from EigenBench experiment runs. View as a ranked table, horizontal bar plot, or cross-constitution pareto heatmap. Group by model or by lab.
- **Experiments** — Browse all EigenBench runs with filtering by collection type and drill-down into protocol-specific artifacts and bootstrap confidence intervals.

## Architecture

The website is a statically exported Next.js application with no runtime backend. Source lives under `next-src/`; a GitHub Action builds it and commits the export to the repository root for GitHub Pages. Run data lives on a [HuggingFace dataset repo](https://huggingface.co/datasets/invi-bhagyesh/ValueArena) and is fetched at page load. Chat uses [OpenRouter](https://openrouter.ai/) with the user's own API key. Votes are stored in localStorage.

```
next-src/src/app/           Static Next.js pages
next-src/src/components/    Chat, leaderboard, experiments, and charts
next-src/src/lib/           Hugging Face data contract and fetch helpers
.github/workflows/          Build-and-publish workflow
```

## Upload results

From the [EigenBench](https://github.com/jchang153/EigenBench) repo:

```bash
# Single run
python3 scripts/upload_results.py --name "my-run" --run-dir runs/my_run/

# Batch (all sub-runs in a folder)
python3 scripts/upload_results.py --batch-dir runs/matrix/ --name "matrix" --note "12 persona LoRAs"
```

Pairwise and direct runs share the same upload command. Direct uploads require a protocol-aware EigenBench uploader. The optional HF Space auto-upload path must also support `evaluation.mode="direct_rating"` before it can accept direct submissions.

New runs appear on the site immediately after upload.

## Local dev

```bash
python3 -m http.server
```

Open `http://localhost:8000`.

## Data

All experiment data is stored on HuggingFace at [`invi-bhagyesh/ValueArena`](https://huggingface.co/datasets/invi-bhagyesh/ValueArena):

```
index.json                  Manifest of all runs
runs/{name}/
  meta.json                 Spec, training log, eigentrust scores, git info
  summary.json              Bootstrap Elo ratings per model
  evaluations.jsonl         Raw evaluation transcripts
  images/                   Protocol-specific plots
  data/                     Optional direct score/trust matrices and bootstrap samples
```

New metadata records `evaluation_mode` as either `pairwise_btd` or `direct_rating`. Missing values on legacy runs are interpreted as `pairwise_btd`. Direct runs may use exhaustive or `partitioned_random_judge` sampling; their run pages report group size, response redundancy, seed, and observed edge coverage. Direct runs omit BTD loss and UV-embedding artifacts.

## Omitted samples

Run and transcript pages show collection coverage before the results. A run
with `meta.inspect.collection_report_file` loads that JSON alongside the Inspect
log and lists omitted judgment samples by scenario, judge, model, and error.
The table can be filtered by judge; long lists load in batches of 40 rows.

EigenBench's updated uploader generates `collection_report.json` by comparing
Inspect judgment keys with `evaluations.jsonl`, and adds the metadata reference.
Re-upload an existing run with that uploader to publish its individual omissions.
The report covers judgment samples present in the named log, not unstarted
samples, retries in other logs, or phases not represented there. Duplicate keys
(such as repeated epochs) are ambiguous and do not produce a verified report.

Without a report, the UI first uses an explicit `missing_direct_judgments`
count, then a labeled direct-rating estimate from dataset count, panel size,
sampler and published judgment count. Unsupported or extended plans remain
unknown. Aggregate edge coverage is never treated as sample completion, and
matching row totals are not presented as proof of zero failures. Partial status
and report download errors remain visible.

Run frontend checks in `next-src` with `npm test`, `npm run typecheck`, and
`npm run build`. Tests use Node 22's experimental TypeScript stripping.
