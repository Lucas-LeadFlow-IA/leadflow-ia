# ---- stage 1: build the static dashboard ------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY dashboard/web/package.json dashboard/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY dashboard/web/ ./
RUN NEXT_TELEMETRY_DISABLED=1 npx next build

# ---- stage 2: python runtime (non-root) -------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN useradd --create-home --uid 10001 trader
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=web /web/out ./dashboard/web/out
RUN rm -rf .venv dashboard/web/node_modules && mkdir -p data runtime models reports \
    && chown -R trader:trader /app
USER trader
ENV API_HOST=0.0.0.0 API_PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"
# PAPER by default (TRADING_MODE from .env). LIVE needs an interactive terminal:
#   docker compose run --rm -it app python main.py run --live
CMD ["python", "main.py", "run"]
