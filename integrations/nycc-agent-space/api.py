"""
OpenAI-compatible endpoint for the NYCC agent, so EigenBench (and ValueArena's
hosted evaluations) can evaluate the agent the same way it evaluates a model.

    POST /v1/chat/completions   model "nycc-agent" or "nycc-base"
    GET  /v1/models
    GET  /healthz

"nycc-agent" answers EigenBench's response requests with the full agent loop:
the NYCC system prompt, the constitution and the MCP tools, exactly as the
Streamlit UI runs it. EigenBench marks those requests with one fixed system
message ("Without making any mention of being an AI, respond in character…");
the agent receives that instruction ahead of the scenario, as every other model
in the run does.

Every other request — EigenBench's reflection and judging prompts — goes to the
agent's base model with the caller's messages untouched. Those prompts need a
strict output format (<criterion_N_rating> tags), which the agent's JSON action
loop would break. "nycc-base" always takes this route, which makes it a
baseline: the same model without the NYCC prompt, constitution or tools.

Configuration (Space variables and secrets):
    OPENROUTER_API_KEY   required, as for the UI
    NYCC_API_KEY         if set, callers must send "Authorization: Bearer <key>"
    AGENT_CONCURRENCY    simultaneous requests, default 4
    AGENT_ON_FAILURE     "answer" (default) returns the agent's own fallback
                         sentence, which is what a real user would see; "empty"
                         returns an empty completion so the caller retries.

In the Space, start.sh runs this on 127.0.0.1:8000 and nginx exposes it at /v1 on
the Space's public port, next to the chat UI. Locally: uvicorn api:app --port 8000
"""

import asyncio
import os
import secrets
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict

sys.path.insert(0, str(Path(__file__).resolve().parent / "orchestrators"))
from agent_chatbot import (  # noqa: E402
    MCP_SERVER_SCRIPT,
    MCPToolClient,
    _COULD_NOT_ANSWER,
    _format_tool_catalog,
    answer_query_agentic,
)
from mcp_client import OPENROUTER_MODEL, call_model  # noqa: E402

API_KEY = os.getenv("NYCC_API_KEY", "")
CONCURRENCY = max(1, int(os.getenv("AGENT_CONCURRENCY", "4")))
ON_FAILURE = os.getenv("AGENT_ON_FAILURE", "answer")
RESPONSE_PROMPT = "Without making any mention of being an AI, respond in character"
MODELS = ("nycc-agent", "nycc-base")

state = {}


@asynccontextmanager
async def lifespan(app):
    # One MCP server process for the whole API; requests share its session.
    async with MCPToolClient(MCP_SERVER_SCRIPT) as client:
        tools = await client.session.list_tools()
        state.update(client=client, catalog=_format_tool_catalog(tools.tools), gate=asyncio.Semaphore(CONCURRENCY))
        yield


app = FastAPI(title="NYCC agent API", lifespan=lifespan)


class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: str
    content: str | list | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    model: str = "nycc-agent"
    messages: list[Message]
    temperature: float | None = None
    max_tokens: int | None = None
    max_completion_tokens: int | None = None


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return ""


def _complete(messages: list, temperature: float, max_tokens: int) -> tuple[str, str]:
    """call_model for the passthrough route, as (content, finish_reason).

    The base model reasons before answering. When its reasoning uses the whole token budget,
    OpenRouter returns no content and call_model fails on it; EigenBench's rating budget (512
    tokens) is short enough for that to happen, and the 500s were retried indefinitely. Retry
    once with room to reason, then return an empty, cut-off answer, which the caller can treat
    as an invalid judgment. Provider errors (rate limits, credit) become 502s with their message.
    """
    for budget in (max_tokens, min(8192, max(4 * max_tokens, 2048))):
        try:
            return call_model(messages, temperature, budget), "stop"
        except AttributeError as error:  # content was null
            if "NoneType" not in str(error):
                raise
        except RuntimeError as error:  # "Model request failed (status): provider message"
            raise HTTPException(502, str(error)) from error
    return "", "length"


def _authorize(authorization: str | None):
    if not API_KEY:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, API_KEY):
        raise HTTPException(401, "Invalid API key")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "base_model": OPENROUTER_MODEL, "tools_loaded": "catalog" in state}


@app.get("/v1/models")
def models(authorization: str | None = Header(default=None)):
    _authorize(authorization)
    return {"object": "list", "data": [{"id": m, "object": "model", "owned_by": "LAISR"} for m in MODELS]}


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    if req.model not in MODELS:
        raise HTTPException(404, f"Unknown model {req.model!r}; use one of {', '.join(MODELS)}")
    messages = [{"role": m.role, "content": _text(m.content)} for m in req.messages]
    system = "\n".join(m["content"] for m in messages if m["role"] == "system").strip()
    users = [m["content"] for m in messages if m["role"] == "user"]
    tools_used: list[str] = []
    finish_reason = "stop"
    async with state["gate"]:
        if req.model == "nycc-agent" and system.startswith(RESPONSE_PROMPT) and users:
            result = await answer_query_agentic(state["client"], state["catalog"], f"{system}\n\n{users[-1]}")
            content = result["final_answer"]
            tools_used = [step["action"] for step in result["steps"]]
            if content == _COULD_NOT_ANSWER and ON_FAILURE == "empty":
                content = ""
        else:
            temperature = 0.7 if req.temperature is None else req.temperature
            max_tokens = req.max_completion_tokens or req.max_tokens or 4096
            content, finish_reason = await asyncio.to_thread(_complete, messages, temperature, max_tokens)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": req.model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": finish_reason}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        # Not part of the OpenAI schema; clients ignore it. Useful when reading logs.
        "nycc_tools_used": tools_used,
    }
