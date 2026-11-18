# 🚀 Deployment Guide — ITAHAR GOVERNMENT POLYTECHNIC Library Portal

> **Architecture:** Frontend → Netlify (free) | Backend → Railway (free tier) | Database → Railway MySQL or PlanetScale

---

## 📐 Deployment Architecture

```
┌─────────────────────┐        HTTPS API calls        ┌──────────────────────────┐
│                     │  ─────────────────────────►   │                          │
│   Netlify (CDN)     │                               │   Railway / Render       │
│   public/ folder    │  ◄─────────────────────────   │   Node.js + Express API  │
│   index.html        │        JSON responses          │   PORT=3000 → server.js  │
│   app.js            │                               │                          │
│   config.js (gen.)  │                               └──────────────┬───────────┘
└─────────────────────┘                                              │ mysql2
                                                                     ▼
                                                        ┌──────────────────────────┐
                                                        │   Cloud MySQL            │
                                                        │   Railway MySQL /        │
                                                        │   PlanetScale /          │
                                                        │   Any VPS MySQL          │
                                                        └──────────────────────────┘
```

> [!IMPORTANT]
> The backend source code, `.env`, and DB credentials are **never** pushed to Netlify.
> Only the `public/` folder (HTML, JS, generated config.js) is published.

---

## PART 1 — Set Up Cloud MySQL Database

### Option A: Railway MySQL (Easiest — same platform as backend)

1. Go to [railway.app](https://railway.app) → **New Project** → **Add a database** → **MySQL**
2. Wait for provisioning (~30 s)
3. Click the MySQL service → **Connect** tab → copy these values:
   ```
   MYSQLHOST      →  DB_HOST
   MYSQLPORT      →  DB_PORT
   MYSQLUSER      →  DB_USER
   MYSQLPASSWORD  →  DB_PASSWORD
   MYSQLDATABASE  →  DB_NAME   (rename to itahar_library if needed)
   ```
4. In Railway MySQL → **Query** tab, paste and run:
   - First run: `database/schema.sql`
   - Then run:   `database/seed.sql`

### Option B: PlanetScale (Free MySQL-compatible, requires SSL)

1. [planetscale.com](https://planetscale.com) → New database → `itahar_library`
2. Create a branch `main` → Connect → Driver: **Node.js**
3. Copy the connection string values, also set **`DB_SSL=true`** in backend env

---

## PART 2 — Deploy the Backend on Railway

### 2.1 — Push only the backend files to a Git repo

> [!CAUTION]
> Your `.gitignore` already excludes `.env` and `node_modules/`.
> Confirm `.env` is **not** staged before pushing.

```bash
# From project root
git init
git add .
git status          # verify .env is NOT listed
git commit -m "Initial backend commit"
git remote add origin https://github.com/YOUR_USERNAME/itahar-library-backend.git
git push -u origin main
```

### 2.2 — Create Railway service from GitHub

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Select your repo → Railway auto-detects Node.js
3. Railway → Service → **Settings**:
   - **Start Command:** `node server.js`
   - **Root Directory:** `/` (leave blank)
4. Railway → Service → **Variables** tab → add all these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_ADAPTER` | `mysql` |
| `DB_HOST` | *(from Railway MySQL or PlanetScale)* |
| `DB_PORT` | `3306` |
| `DB_USER` | *(your cloud DB user)* |
| `DB_PASSWORD` | *(your cloud DB password)* |
| `DB_NAME` | `itahar_library` |
| `DB_SSL` | `false` *(set `true` for PlanetScale)* |
| `JWT_SECRET` | *(generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)* |
| `JWT_EXPIRES_IN` | `7d` |
| `ALLOWED_ORIGINS` | *(fill in after Netlify deploy, e.g. `https://your-site.netlify.app`)* |
| `COLLEGE_NAME` | `ITAHAR GOVERNMENT POLYTECHNIC` |
| `INSTITUTION_CODE` | `ITP-WB` |

5. Railway will deploy and give you a public URL like:
   ```
   https://itahar-library-api.up.railway.app
   ```
6. Test it: open `https://itahar-library-api.up.railway.app/api/health` in your browser. You should see:
   ```json
   { "status": "ONLINE", "database_adapter": "MYSQL", ... }
   ```

> [!TIP]
> Copy the Railway backend URL — you'll need it in Part 3.

---

## PART 3 — Deploy the Frontend on Netlify

### 3.1 — Netlify configuration already in place

The following files are already configured in your project:

| File | Purpose |
|---|---|
| `netlify.toml` | Build command + publish directory + headers |
| `public/_redirects` | SPA fallback (all routes → index.html) |
| `scripts/build_frontend.js` | Generates `public/config.js` with backend URL |
| `public/index.html` | Loads `/config.js` before `app.js` |

**Build settings summary:**

| Setting | Value |
|---|---|
| **Build command** | `node scripts/build_frontend.js` |
| **Publish directory** | `public` |
| **Node version** | 20 (set in netlify.toml) |

### 3.2 — Deploy steps

#### Method A: Netlify CLI (fastest)

```bash
# Install Netlify CLI globally (once)
npm install -g netlify-cli

# From project root
netlify login
netlify init        # follow prompts: "Create & configure a new site"
                    # Build command:     node scripts/build_frontend.js
                    # Publish directory: public

# Set the backend URL env var in Netlify
netlify env:set VITE_API_BASE https://itahar-library-api.up.railway.app

# Deploy
netlify deploy --prod
```

#### Method B: Netlify Web Dashboard

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Connect your GitHub repo (can be the same repo)
3. Configure build:
   - **Base directory:** *(leave blank)*
   - **Build command:** `node scripts/build_frontend.js`
   - **Publish directory:** `public`
4. Click **Environment variables** → Add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | `https://itahar-library-api.up.railway.app` |

5. Click **Deploy site**

Netlify will:
1. Run `node scripts/build_frontend.js` → generates `public/config.js` with your backend URL
2. Publish the `public/` folder to its CDN

### 3.3 — Update CORS on the backend

After Netlify gives you a URL (e.g. `https://magical-name-123.netlify.app`):

1. Go to Railway → your backend service → Variables
2. Update `ALLOWED_ORIGINS`:
   ```
   https://magical-name-123.netlify.app
   ```
3. Railway redeploys automatically

---

## PART 4 — Verification Checklist

```
□ Backend health:   curl https://itahar-library-api.up.railway.app/api/health
□ Frontend loads:   Open https://your-site.netlify.app in browser
□ Login works:      Admin login: admin@itahar.ac.in / Admin@123
□ Books load:       Search tab shows seeded books
□ CORS no errors:   Browser DevTools → Console shows no CORS errors
□ API calls OK:     DevTools → Network tab → all /api/ calls return 200
```

---

## PART 5 — Local Development (unchanged)

```powershell
# 1. Start XAMPP → start Apache + MySQL
# 2. Run the backend
cd C:\Users\Asus\.gemini\antigravity\scratch\itahar-polytechnic-library
node server.js

# 3. Open browser at http://localhost:3000
```

The local server still serves `public/` from the same origin, so `API_BASE = ''` and
all `/api/...` calls go to `http://localhost:3000/api/...` exactly as before.

---

## PART 6 — File Security Checklist

| File | Committed to Git? | Deployed to Netlify? |
|---|---|---|
| `.env` | ❌ No (.gitignore) | ❌ No |
| `server.js` | ✅ Yes (backend repo) | ❌ No (backend only) |
| `config/db.js` | ✅ Yes (backend repo) | ❌ No |
| `database/schema.sql` | ✅ Yes | ❌ No |
| `public/index.html` | ✅ Yes | ✅ Yes (CDN) |
| `public/app.js` | ✅ Yes | ✅ Yes (CDN) |
| `public/config.js` | ❌ No (.gitignore) | ✅ Yes (generated at build time) |
| `node_modules/` | ❌ No (.gitignore) | ❌ No |

> [!NOTE]
> `public/config.js` only contains the backend URL — no passwords, no JWT secret.
> It is generated fresh on every Netlify build from the `VITE_API_BASE` env var.

---

## Recommended Free-Tier Stack

| Service | Free Tier | Link |
|---|---|---|
| **Netlify** | 100 GB bandwidth/month | [netlify.com](https://netlify.com) |
| **Railway** | \$5 credit/month (backend) | [railway.app](https://railway.app) |
| **Railway MySQL** | Included with Railway | Same project |
| **PlanetScale** | 5 GB storage, 1 B reads/month | [planetscale.com](https://planetscale.com) |
