# Production deploy — free tier checklist

## Stack

| Piece | Free platform |
|-------|----------------|
| Frontend | [Vercel](https://vercel.com) |
| API + worker + Chroma | [Render](https://render.com) (2 free web services) |
| Postgres | [Neon](https://neon.tech) |
| Redis | [Upstash](https://upstash.com) |
| LLM | [Groq](https://console.groq.com) |
| Embeddings | [Hugging Face](https://huggingface.co/settings/tokens) |

> Render free web services sleep after ~15 min idle (cold start ~30–60s).  
> Chroma disk is ephemeral — app auto-rebuilds vectors from Postgres when needed.  
> Worker runs **inside** the API (`RUN_WORKER=true`) so you don't need a paid background worker.

---

## A. Before you deploy (security)

1. **Revoke** any GitHub PAT that lived in `backend/.env` and create a new one if you need private-repo access.
2. Confirm `.env` is **not** committed (see `.gitignore`).

---

## B. Create free accounts + copy secrets

Do these in order and keep the values in a notes app:

### 1. Neon Postgres
1. https://neon.tech → New project  
2. Copy **pooled** connection string (`?sslmode=require`) → `DATABASE_URL`

### 2. Upstash Redis
1. https://upstash.com → Create Redis (TLS)  
2. Copy Redis URL (`rediss://...`) → `REDIS_URL`

### 3. Groq
1. https://console.groq.com → API Keys → Create  
2. → `GROQ_API_KEY`

### 4. Hugging Face
1. https://huggingface.co/settings/tokens → Create token (Read)  
2. → `HF_API_KEY`

### 5. GitHub token (optional)
- Public repos: skip  
- Private / higher rate limit: classic PAT with `repo` → `GITHUB_TOKEN`

---

## C. Push code to GitHub

```powershell
cd "c:\Users\Sparsh Prajapati\Documents\ai_codebase_explainer"
git init
git add .
git commit -m "Prepare production free-tier deployment"
```

Then on https://github.com/new create repo `ai-codebase-explainer` (public), and:

```powershell
git remote add origin https://github.com/YOUR_USER/ai-codebase-explainer.git
git branch -M main
git push -u origin main
```

---

## D. Run migrations against Neon (from your PC)

```powershell
cd "c:\Users\Sparsh Prajapati\Documents\ai_codebase_explainer\backend"
$env:DATABASE_URL="postgresql://...your-neon-pooled-url..."
npm run db:migrate
```

---

## E. Deploy backend on Render

1. https://dashboard.render.com/blueprints → **New Blueprint Instance**  
2. Connect the GitHub repo  
3. Confirm services from `render.yaml`:
   - `codeexplainer-chroma`
   - `codeexplainer-api` (`RUN_WORKER=true`)
4. Fill **secret** env vars when asked:

```
DATABASE_URL=...neon...
REDIS_URL=...upstash rediss...
GROQ_API_KEY=gsk_...
HF_API_KEY=hf_...
GITHUB_TOKEN=           # optional
FRONTEND_URL=https://YOUR-APP.vercel.app   # set after Vercel (step F), then redeploy API
```

5. Wait for both services to go live.  
6. Open `https://codeexplainer-api.onrender.com/health` — expect `"status":"ok"` (or chroma ok after first wake).

If Chroma URL looks wrong, set manually on the API:

```
CHROMA_URL=https://codeexplainer-chroma.onrender.com
```

---

## F. Deploy frontend on Vercel

1. https://vercel.com/new → Import the same GitHub repo  
2. **Root Directory:** `frontend`  
3. Environment variable:

```
VITE_API_BASE_URL=https://codeexplainer-api.onrender.com
```

4. Deploy → copy the Vercel URL  
5. Back in Render → `codeexplainer-api` → Environment → set:

```
FRONTEND_URL=https://your-app.vercel.app
```

6. **Manual Deploy** the API once so CORS updates.

---

## G. Smoke test production

1. Open Vercel URL → Register / Login  
2. Index a **public** GitHub repo (first request may be slow — cold start)  
3. Wait until status is `ready`  
4. Ask a question in chat  

Dashboard **System** bar should show Postgres / Redis / Chroma.

---

## Local vs production env

| Variable | Local | Production |
|----------|--------|------------|
| `EMBED_PROVIDER` | `ollama` | `huggingface` |
| `LLM_PROVIDER` | `ollama` | `groq` |
| `RUN_WORKER` | unset (separate process) | `true` |
| `VITE_API_BASE_URL` | unset (Vite `/api` proxy) | Render API URL |
| `FRONTEND_URL` | `http://localhost:5173` | Vercel URL |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| CORS blocked | `FRONTEND_URL` exact Vercel URL, no trailing slash; redeploy API |
| Ingestion stuck | Check API logs for worker; HF / GitHub / Redis env set |
| Slow first hit | Free cold start — normal |
| Empty answers after chroma sleep/redeploy | App rebuilds vectors from Postgres automatically |
| Health chroma down | Hit chroma URL once to wake it, retry `/health` |
