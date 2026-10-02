---
title: NYCC Agent API
emoji: 📊
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
short_description: OpenAI-compatible API for the NYCC agent (EigenBench)
app_port: 7860
---

OpenAI-compatible endpoint for the NYCC agent, used to evaluate it with
EigenBench and ValueArena. Same code as the LAISR/NYCC Space plus `api.py`.

- `POST /v1/chat/completions` with model `nycc-agent` (the full agent: NYCC
  prompt, constitution, tools) or `nycc-base` (the same base model alone).
- `GET /v1/models`, `GET /healthz`.

Secrets: `OPENROUTER_API_KEY` (required) and `NYCC_API_KEY` (callers send it as
`Authorization: Bearer …`). Optional variables: `AGENT_CONCURRENCY` (default 4)
and `AGENT_ON_FAILURE` (`answer` or `empty`). See `api.py` for details.
