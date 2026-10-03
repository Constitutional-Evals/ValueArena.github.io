# Integrations

## `nycc-agent-space/`

Adds an OpenAI-compatible API to the existing `LAISR/NYCC` Space, next to its chat
UI, so ValueArena can evaluate the NYCC agent as an agent endpoint (see "Agent
endpoints" in `backend/README.md`). A Space serves one port, so nginx shares it:
`/v1/*` and `/healthz` go to the API (`api.py`), everything else to the chat UI.

1. In the `LAISR/NYCC` Space repository, add `api.py`, `nginx.conf` and `start.sh`
   and replace `Dockerfile` and `README.md` with the ones here.
2. Add the Space secret `NYCC_API_KEY` (any long random string, e.g. `openssl rand -hex 32`).
   The Space's existing `OPENROUTER_API_KEY` is reused.
3. On the ValueArena API service, set `AGENT_NYCC_KEY` to the same value, add the
   `nycc-agent` entry from `backend/catalog.example.json` to `backend/catalog.json`,
   and redeploy.

The UI and the API share the Space's hardware: during an evaluation, chat replies
slow down. Raise the Space's hardware or lower `AGENT_CONCURRENCY` if that matters.
