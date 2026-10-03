FROM python:3.12-slim

# Hugging Face Spaces (and most managed container hosts) run the container as a
# non-root user with uid 1000. Anything the app writes at runtime — Streamlit's
# config dir, the feedback folder — has to belong to that user or the app dies
# on startup with a PermissionError.
RUN useradd -m -u 1000 user

# nginx shares the Space's single public port between the chat UI and the API.
RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY local_ai.py api.py nginx.conf start.sh ./
COPY orchestrators ./orchestrators
COPY ui ./ui
COPY prompts ./prompts
COPY url_resources.yaml .
COPY mcp ./mcp

RUN chown -R user:user /app

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    FEEDBACK_DIR=/home/user/feedback

EXPOSE 8501

# 8501 (app_port) is nginx: /v1/* goes to the OpenAI-compatible agent API used by
# EigenBench and ValueArena (api.py), everything else to the agent chat UI.
CMD ["bash", "start.sh"]
