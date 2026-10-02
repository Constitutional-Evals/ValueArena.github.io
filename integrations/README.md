# Integrations

## `nycc-agent-space/`

Files for a Hugging Face Space (for example `LAISR/NYCC-API`) that serves the
NYCC agent from `LAISR/NYCC` behind an OpenAI-compatible API, so ValueArena can
evaluate it as an agent endpoint (see "Agent endpoints" in `backend/README.md`).

1. Duplicate the `LAISR/NYCC` Space (or create a Docker Space and push its code).
2. Add `api.py` and replace `Dockerfile` and `README.md` with the ones here.
3. Set the secrets `OPENROUTER_API_KEY` and `NYCC_API_KEY`.
4. Add the catalog entry from `backend/catalog.example.json` to `backend/catalog.json`,
   set `AGENT_NYCC_KEY` (the same value as `NYCC_API_KEY`) on the API service, and redeploy.
