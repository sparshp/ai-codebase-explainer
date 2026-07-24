# AI Codebase Explainer

Ask questions about any **public GitHub repository** and get answers grounded in the actual code — with file:line citations.

Paste a repo URL → we index it (parse → chunk → embed) → you chat in Lookup, Architecture, Flow, or Debug mode. Answers stream in real time and cite the chunks they used.

---

## Features

| Feature | Description |
|---------|-------------|
| **GitHub indexing** | Public repos only; async BullMQ job with live progress |
| **Hybrid RAG** | Dense vectors (Chroma) + keyword search (Postgres BM25/ILIKE) fused with RRF |
| **Intent modes** | Lookup · Architecture · Flow · Debug — different prompts & retrieval behaviour |
| **UML diagrams** | Architecture/Flow answers can include Mermaid class, component, or sequence diagrams |
| **Streaming chat** | Server-Sent Events (SSE) with citation badges |
| **Dashboard** | Repo list, stats, health checks, re-index, delete, history |
| **Auth** | Email/password + JWT access & refresh tokens |
| **Local or cloud AI** | Ollama locally; Groq + Hugging Face in production |

---

## How it works

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│  React UI   │────▶│  Express API  (auth, repos, chat, health)         │
│  (Vite)     │◀────│                                                  │
└─────────────┘     │  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
                    │  │  BullMQ    │──│  Ingestion  │──│  GitHub   │ │
                    │  │  (Redis)   │  │  worker     │  │  API      │ │
                    │  └────────────┘  └──────┬──────┘  └───────────┘ │
                    │                         │                        │
                    │         parse → chunk → embed                    │
                    │                         │                        │
                    │              ┌───────────┴───────────┐            │
                    │              ▼                       ▼            │
                    │         Postgres                 Chroma           │
                    │      (chunks, users,           (vectors)         │
                    │       jobs, history)                             │
                    └──────────────────────────────────────────────────┘
```

### Ingestion pipeline

1. Validate URL (GitHub-only, public repo + branch)
2. Enqueue BullMQ job → fetch tree/blobs from GitHub
3. Filter noise (`node_modules`, binaries, lockfiles, >500KB)
4. Parse symbols (tree-sitter for JS/TS) → chunk (~400 tokens)
5. Embed → upsert into **Chroma** + persist chunks in **Postgres** (with `file_sha` for diffs)

### Chat / RAG pipeline

1. Classify intent (LOOKUP / ARCHITECTURE / FLOW / DEBUG)
2. Optionally expand the query
3. **Hybrid retrieve**: embed query → Chroma ANN ∥ Postgres full-text → Reciprocal Rank Fusion
4. Pack context under a token budget
5. Generate with intent-specific system prompt (Groq or Ollama)
6. Map & verify citations against retrieved chunks → stream answer

Postgres is the source of truth for chunk text. If Chroma is wiped (e.g. free-tier disk), vectors are **rebuilt from Postgres** automatically.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, Vite, TypeScript, Tailwind, Zustand, React Router |
| Backend | Node 20, Express 5, TypeScript, Zod, Helmet, Pino |
| Database | PostgreSQL 16 (Neon in prod) |
| Vectors | ChromaDB |
| Queue | BullMQ + Redis (Upstash in prod) |
| Embeddings | Ollama `nomic-embed-text` · HF `sentence-transformers/all-mpnet-base-v2` |
| LLM | Ollama `llama3.2` · Groq `llama-3.1-8b-instant` |
| Parsing | tree-sitter (JavaScript / TypeScript) |

---

## Project structure

```
ai_codebase_explainer/
├── frontend/                 # Vite + React UI
│   └── src/
│       ├── pages/            # Login, Register, Dashboard, Chat
│       ├── components/       # Chat, citations, health bar, repo input
│       ├── api/              # Axios client + endpoints
│       ├── hooks/            # Auth, ingest poll, SSE chat
│       └── store/            # Zustand auth store
├── backend/
│   ├── docker-compose.yml    # Postgres, Redis, Chroma, Ollama
│   ├── src/
│   │   ├── modules/          # auth, repo, chat, health
│   │   ├── workers/          # ingestion worker
│   │   ├── queues/           # BullMQ
│   │   ├── services/         # github, parser, chunker, embedder,
│   │   │                     # chroma, retriever, llm, context
│   │   ├── db/migrations/    # SQL migrations
│   │   └── config/           # env, db, redis, chroma
│   └── .env.example
├── DEPLOY.md                 # Free-tier production checklist
└── render.yaml               # Render blueprint (API + Chroma)
```

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- Docker Desktop
- (Optional) [Ollama](https://ollama.com) models if not using the compose image alone:

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 1. Infrastructure

```bash
cd backend
docker compose up -d
```

| Service | Host port |
|---------|-----------|
| Postgres | `5433` |
| Redis | `6379` |
| Chroma | `8000` |
| Ollama | `11434` |

### 2. Backend

```bash
cp .env.example .env
# Edit JWT_SECRET (openssl rand -hex 32)

npm install
npm run db:migrate
npm run dev          # API → http://localhost:3001
```

Second terminal — ingestion worker:

```bash
npm run dev:worker
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # UI → http://localhost:5173
```

Dev proxy: `/api` → `http://localhost:3001`. Leave `VITE_API_BASE_URL` empty locally.

Open **http://localhost:5173** → register → index a public GitHub repo → chat.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose | Local default |
|----------|---------|---------------|
| `PORT` | API port | `3001` |
| `DATABASE_URL` | Postgres | `postgresql://dev:dev@localhost:5433/codeexplainer` |
| `REDIS_URL` | Redis / Upstash | `redis://localhost:6379` |
| `CHROMA_URL` | Vector DB | `http://localhost:8000` |
| `FRONTEND_URL` | CORS origin | `http://localhost:5173` |
| `EMBED_PROVIDER` | `ollama` \| `huggingface` | `ollama` |
| `LLM_PROVIDER` | `ollama` \| `groq` | `ollama` |
| `JWT_SECRET` | Sign tokens (≥32 chars) | required |
| `GITHUB_TOKEN` | Higher rate limits | optional |
| `RUN_WORKER` | Run worker inside API | `false` locally |
| `HF_API_KEY` / `GROQ_API_KEY` | Cloud providers | prod |
| `ENABLE_RERANK` | LLM rerank (slow) | `false` |
| `MAX_CONTEXT_TOKENS` | Context budget | `2500` |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Empty in dev; production = Render API URL |

Full list: [`backend/.env.example`](./backend/.env.example).

---

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Postgres / Redis / Chroma status |
| `POST` | `/auth/register` | — | Create account → tokens + user |
| `POST` | `/auth/login` | — | Login → tokens + user |
| `POST` | `/auth/refresh` | refresh token | New access + refresh |
| `GET` | `/auth/me` | Bearer | Current user |
| `POST` | `/repos` | Bearer | Start indexing (202) or return existing (200) |
| `GET` | `/repos` | Bearer | List your repos |
| `GET` | `/repos/stats` | Bearer | Aggregate stats |
| `GET` | `/repos/status/:jobId` | Bearer | Ingestion progress |
| `POST` | `/repos/:id/reindex` | Bearer | Full re-index |
| `DELETE` | `/repos/:id` | Bearer | Delete repo + data |
| `GET` | `/repos/:id/history` | Bearer | Past Q&A |
| `POST` | `/chat/query` | —* | Sync answer + citations |
| `POST` | `/chat/query/stream` | —* | SSE stream |

\*Chat routes are rate-limited (20/min). The UI requires login; the API currently does not enforce ownership on chat — treat `repoId` as a secret.

Chat body:

```json
{
  "question": "How does authentication work?",
  "repoId": "<uuid>",
  "conversationId": "<optional>",
  "intent": "ARCHITECTURE"
}
```

`intent`: `LOOKUP` | `ARCHITECTURE` | `FLOW` | `DEBUG`

---

## Production (free tier)

| Piece | Platform |
|-------|----------|
| Frontend | [Vercel](https://vercel.com) |
| API + worker | [Render](https://render.com) (`RUN_WORKER=true`) |
| Chroma | Render (separate web service) |
| Postgres | [Neon](https://neon.tech) |
| Redis | [Upstash](https://upstash.com) (`rediss://`) |
| LLM | [Groq](https://console.groq.com) |
| Embeddings | [Hugging Face](https://huggingface.co/settings/tokens) |

Step-by-step checklist (secrets, migrations, CORS, env): **[DEPLOY.md](./DEPLOY.md)**

### Production notes

- Free Render services **sleep** after ~15 minutes idle (first request can take 30–60s).
- Chroma disk is **ephemeral** — the app rebuilds vectors from Postgres when needed.
- Use `HF_EMBED_MODEL=sentence-transformers/all-mpnet-base-v2` (768-d); Nomic often fails on HF serverless.
- Only **public** GitHub repos are supported without special token setup.

---

## Design decisions

1. **Hybrid retrieval** — code search fails with embeddings alone (symbols, camelCase); BM25 + ILIKE cover keyword hits; RRF merges rankings.
2. **Postgres as source of truth** — chunks + `file_sha` live in SQL; Chroma is a rebuildable index.
3. **Intent routing** — different system prompts and retrieval knobs for “where is X?” vs “how does auth flow?”
4. **Worker in API (prod)** — avoids a paid Render background worker on free tier.
5. **Fail-fast repo validation** — reject non-GitHub / private repos before enqueueing a job.
6. **Null-byte sanitization** — strip binary/NUL content so Postgres UTF-8 inserts never blow up mid-index.
7. **Prompt-injection guard** — detect jailbreak patterns, delimit untrusted question/context with markers, harden system prompts, validate LLM output.

---

## Security — prompt injection

User messages and retrieved code can try to override the system prompt (“Ignore all previous instructions…”). Defenses in `backend/src/services/llm/prompt-guard.ts`:

| Layer | What it does |
|-------|----------------|
| **Input scan** | High-confidence patterns (`ignore previous instructions`, `you are now DAN`, fake `<system>` tags) → **400 ValidationError** |
| **Boundary markers** | Question/context wrapped in `<\|USER_QUESTION\|>` / `<\|CODE_CONTEXT\|>` — system prompt tells the model these are data, not commands |
| **System prompt rules** | Every intent prompt includes non-negotiable anti-override / no-prompt-leak rules |
| **History sanitize** | Strip forged delimiter / system tags from past turns |
| **Output validate** | Jailbreak-style answers replaced or blocked before persist |

This is defense-in-depth, not a guarantee — models can still be socially engineered. Keep temperature low and never put secrets in the system prompt.

---

## Limitations

- Public GitHub repos only (by default)
- Strongest parsing for **JS/TS**; other languages are chunked as text
- Chat API is not yet ownership-scoped (knowing a `repoId` is enough)
- Free-tier cold starts and rate limits (GitHub, Groq, HF)
- Reranking is off by default (`ENABLE_RERANK=false`) for latency
- Prompt-injection defenses reduce risk but cannot fully eliminate jailbreaks on open models

---

## Scripts

### Backend

| Script | Description |
|--------|-------------|
| `npm run dev` | API with hot reload |
| `npm run dev:worker` | Ingestion worker |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run build` | TypeScript compile |
| `npm test` | Vitest |

### Frontend

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |

---

## License

ISC
