# Codex runner: Codex CLI + the tools it uses to read the web (curl, pdftotext, python3, jq, ripgrep, scholar),
# and the source library (downloaded pages and PDFs with their text).
# The container is the sandbox: it only gets the OpenAI key, never the database or n8n credentials.
FROM node:22-bookworm-slim
ARG CODEX_VERSION=0.161.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl poppler-utils python3 jq ripgrep git \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g @openai/codex@${CODEX_VERSION} \
 && npm cache clean --force
ENV CODEX_HOME=/codex-home RUNS_DIR=/runs LIBRARY_DIR=/library TOOLS_DIR=/app/tools PORT=8787
RUN mkdir -p /codex-home /runs /library /app && chown -R node:node /codex-home /runs /library /app
COPY --chown=node:node server.mjs /app/server.mjs
COPY --chown=node:node tools /app/tools
RUN chmod +x /app/tools/bin/scholar /app/tools/*.py
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:8787/health || exit 1
CMD ["node", "/app/server.mjs"]
