# Deployment Guide — Smart Prompt Generator

Production deployment runs two Docker containers (backend `127.0.0.1:8006`, frontend
`127.0.0.1:3006`) behind the **host** nginx on `brollysolutions.in`, which terminates
TLS and proxies both under the `/prompt_generator/` path.

```
Internet ──HTTPS──▶ host nginx (TLS) ──▶ 127.0.0.1:8006  backend  (FastAPI/Gunicorn)
                                     └──▶ 127.0.0.1:3006  frontend (Next.js standalone)
```

Run every command from the repo root on the server unless noted. `COMPOSE` below is
shorthand for the two-file invocation — define it once per shell session:

```bash
alias COMPOSE='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

---

## 0. One-time prerequisites (skip if already done)

- [ ] Docker Engine + Docker Compose v2 installed (`docker compose version`).
- [ ] The repo cloned on the server.
- [ ] Host nginx installed, and the API/frontend `location` blocks from
      `nginx/prompt_generator.conf` pasted into your site config
      (e.g. `/etc/nginx/sites-available/…`), then `sudo nginx -t && sudo systemctl reload nginx`.
- [ ] A TLS certificate for `brollysolutions.in` (Let's Encrypt / certbot). The app
      only serves HTTP internally — **TLS is the host nginx's job.**

---

## 1. Create the production `.env` (REQUIRED — never commit it)

Create `.env` in the repo root (next to the compose files). Start from the template:

```bash
cp .env.example .env
```

Then fill it in. **These are the values that matter for production:**

```bash
# --- Strong random secret (rotate from the dev value!) ---
#   Generate one and paste it here:
#   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=<paste-a-strong-random-secret-here>

# --- AI provider keys (rotate any that were ever shared) ---
GROQ_API_KEY=...            # or GROQ_API_KEY_1..N for rotation
GEMINI_API_KEY=...          # or GEMINI_API_KEY_1..N for rotation

# --- URLs ---
NEXT_PUBLIC_API_URL=https://brollysolutions.in/prompt_generator/api
FRONTEND_URL=https://brollysolutions.in

# --- Google OAuth (only if you use "Sign in with Google") ---
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://brollysolutions.in/prompt_generator/api/auth/google
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...

# --- Production flags (MUST be exactly these) ---
USE_BASE_PATH=true
ALLOW_TEMPLATE_MUTATIONS=false
ALLOW_PRO_TOGGLE=false
FORCE_HSTS=true
```

Checklist:
- [ ] `JWT_SECRET` is a fresh strong value (changing it logs out existing users — expected).
- [ ] API keys are set (and rotated if they were ever pasted/shared).
- [ ] `ALLOW_TEMPLATE_MUTATIONS=false` and `ALLOW_PRO_TOGGLE=false` — closes the dev-only endpoints.
- [ ] `FORCE_HSTS=true` — sends the HTTPS-enforcement header.
- [ ] `.env` permissions locked down: `chmod 600 .env`.

> **Note on Google login:** if you set a Google client ID, its **authorized redirect URI**
> and **authorized JavaScript origins** in the Google Cloud console must include
> `https://brollysolutions.in`. If you don't use Google login, leave those vars blank —
> the email/password flow works without them.

---

## 2. Build & start

The Dockerfile and dependencies changed, so you **must** rebuild — a plain `up` reuses the old image:

```bash
COMPOSE up --build -d
```

- [ ] Wait ~40s for the backend health check, then confirm both are healthy:

```bash
COMPOSE ps
```

Expect both services `Up` and the backend `(healthy)`. If the backend shows
`Restarting` or `Exited`, see **Troubleshooting** below.

---

## 3. Verify (bottom-up: container → nginx → browser)

```bash
# 1. Backend answers directly (bypasses nginx)
curl -i http://127.0.0.1:8006/prompt_generator/api/health
#    -> HTTP/1.1 200 OK  {"status":"healthy", ...}

# 2. Frontend answers directly
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3006/prompt_generator/
#    -> 200

# 3. Through nginx over HTTPS (public path)
curl -i https://brollysolutions.in/prompt_generator/api/health
#    -> HTTP/2 200  {"status":"healthy", ...}
```

- [ ] All three return 200. If step 1/2 pass but step 3 fails → nginx config issue.
      If step 1 fails → the backend is down (check logs).

Then smoke-test the real flow in a browser at
`https://brollysolutions.in/prompt_generator/`:
- [ ] Sign up / log in.
- [ ] Generate a prompt → you get **tailored** questions (not 3 generic ones — that
      would mean the AI keys aren't loading).
- [ ] Generate the final prompt and hit **Test** → a real, complete response.

---

## 4. Post-deploy hardening (do soon, not blockers)

**Database backups** — the whole app state is one SQLite file on the `sqlite_data`
volume. Add a nightly backup cron on the host:

```bash
# crontab -e  →  daily 3am consistent backup (uses SQLite's online backup)
0 3 * * * docker compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml \
  exec -T backend sh -c 'python -c "import sqlite3,os; \
  src=sqlite3.connect(os.environ[\"DB_PATH\"]); \
  dst=sqlite3.connect(\"/app/data/backup.db\"); src.backup(dst); dst.close(); src.close()"' \
  && docker cp $(docker compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml ps -q backend):/app/data/backup.db \
  /var/backups/prompt_gen/db-$(date +\%F).db
```
Keep the last N days and copy them off-box (S3, another host, etc.).

- [ ] **Branch protection:** in GitHub, require the `CI` workflow to pass before merging to `main`.
- [ ] **Error tracking:** wire up Sentry (or similar) so production errors surface without tailing logs.

---

## 5. Redeploy (after future changes)

```bash
git pull
COMPOSE up --build -d      # rebuilds only what changed
COMPOSE ps                 # confirm healthy
```

Roll back to the previous version:

```bash
git checkout <previous-commit>
COMPOSE up --build -d
```

---

## Troubleshooting

**502 Bad Gateway from the browser** — nginx reached the host but the backend gave no
valid response. Diagnose:

```bash
COMPOSE logs backend --tail 80
COMPOSE ps
```

| Log shows | Cause | Fix |
|---|---|---|
| `OOMKilled` / `SIGKILL` / worker exceeded memory | Memory limit too low for the worker count | Lower `WEB_CONCURRENCY` or raise `memory:` in `docker-compose.prod.yml` |
| `ModuleNotFoundError: 'slowapi'` | Image not rebuilt | `COMPOSE up --build -d` |
| `RuntimeError: JWT_SECRET ... required` | `.env` missing / no `JWT_SECRET` | Create `.env` (Step 1) |
| `gunicorn: command not found` | Broken image | Rebuild; if it persists, report it |
| Python traceback | A specific bug | Read the trace |

**Generic AI questions instead of tailored ones** — the AI keys aren't loading. Check
`GROQ_API_KEY` / `GEMINI_API_KEY` in `.env`, then `COMPOSE up -d` to reload.

**Google login popup blocked / COOP warning** — ensure the host nginx does **not**
override `Cross-Origin-Opener-Policy` on the frontend location (the app already sends
`same-origin-allow-popups`), and that `https://brollysolutions.in` is an authorized
origin in the Google Cloud console.

**Frontend points at the wrong API** — `NEXT_PUBLIC_API_URL` is baked in at **build**
time. If you change it, you must rebuild the frontend image (`COMPOSE up --build -d`).

---

## Reference

| Item | Value |
|---|---|
| Backend (host) | `127.0.0.1:8006` → container `:8000` |
| Frontend (host) | `127.0.0.1:3006` → container `:3000` |
| Public base path | `/prompt_generator/` |
| API base | `https://brollysolutions.in/prompt_generator/api` |
| Health check | `/prompt_generator/api/health` |
| DB (in container) | `/app/data/prompt_scores.db` on volume `sqlite_data` |
| Backend workers | `WEB_CONCURRENCY` env (default 2 in prod) |
