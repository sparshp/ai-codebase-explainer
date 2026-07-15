# AI Codebase Explainer

RAG-powered app that indexes a GitHub repo and answers questions with citations.

## Local development

See step-by-step commands in conversation history, or:

```powershell
cd backend
docker compose up -d
npm install
npm run db:migrate
npm run dev          # API :3001
# second terminal
npm run dev:worker
# third terminal
cd ../frontend
npm install
npm run dev
```

## Production (free tier)

Follow **[DEPLOY.md](./DEPLOY.md)** — Vercel + Render + Neon + Upstash + Groq + Hugging Face.
