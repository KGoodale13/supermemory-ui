# Memory Observatory

A deliberately small, read-only UI for a self-hosted Supermemory instance. The graph is the default view; container tags and semantic search are one click away in the bottom dock.

## Run

```bash
cp .env.example .env
# edit SUPERMEMORY_API_URL and, if required, SUPERMEMORY_API_KEY
pnpm install
pnpm build
pnpm start
```

Open `http://localhost:8787`. `DEMO_FALLBACK=true` supplies sample data when the API cannot be reached; set it to `false` in production if you prefer hard failures.

For local UI development, run `pnpm dev` and open `http://localhost:5173`.

## API usage

The Node server uses only built-in modules and proxies:

- `POST /v3/documents/documents` for documents with their memory entries and inferred container tags
- `POST /v4/search` for hybrid semantic search

Request logging is intentionally not implemented. The self-hosted API does not expose a documented console-log endpoint, and this UI does not create its own telemetry.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPERMEMORY_API_URL` | `http://127.0.0.1:8788` | Self-hosted API origin |
| `SUPERMEMORY_API_KEY` | empty | Optional bearer token |
| `PORT` | `8787` | UI server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DEMO_FALLBACK` | `true` | Use sample data if upstream fails |
