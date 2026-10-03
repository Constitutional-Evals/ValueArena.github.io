#!/usr/bin/env bash
# Runs the chat UI, the agent API and the nginx router together. If any one of
# them exits, the container exits too, so the Space restarts instead of serving
# half an app.
set -u
uvicorn api:app --host 127.0.0.1 --port 8000 &
streamlit run ui/agent_chatbot_ui.py --server.address 127.0.0.1 --server.port 8502 --server.headless true &
nginx -c "$PWD/nginx.conf" -g 'daemon off;' &
wait -n
exit $?
