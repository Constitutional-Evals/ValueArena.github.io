---
title: NYCC
emoji: 📊
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
short_description: NYCC Proxy Agent for character training
app_port: 8501
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference

## API for EigenBench / ValueArena

The same Space also serves an OpenAI-compatible API (`api.py`) next to the chat UI;
nginx routes `/v1/*` and `/healthz` to it and everything else to the UI.

- `POST /v1/chat/completions` with model `nycc-agent` (the full agent: NYCC prompt,
  constitution, tools) or `nycc-base` (the same base model alone), `GET /v1/models`.
- Secret `NYCC_API_KEY`: callers must send it as `Authorization: Bearer …`.
  Optional variables: `AGENT_CONCURRENCY` (default 4), `AGENT_ON_FAILURE` (`answer` or `empty`).
