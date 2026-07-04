# GymTracker AI Coach — Step-by-Step Setup

Your code is backed up on GitHub:
- **Stable backup (before AI):** commit `d143dfd`
- **AI Phase 1:** Coach tab + local RAG + free Groq API backend

---

## How it works (free RAG)

```
You ask question
    → App reads YOUR workouts (on device)
    → Builds compact context (RAG retrieve)
    → Sends context + question to Groq free API (via Render)
    → AI answers using ONLY your data
```

- **No model training** on your history
- **Free Groq tokens** (llama-3.1-8b-instant — fast)
- **Free Render hosting** for the API
- **20 questions/day** limit (configurable)

**Without API setup:** Coach still works in **Local mode** (structured answers from your logs, no natural AI language).

---

# PHASE 0 — DONE ✅ (by assistant)

| What | Status |
|------|--------|
| Push current app to GitHub | ✅ `d143dfd` on `master` |
| Coach tab in app | ✅ Last tab (robot icon) |
| RAG retriever (`utils/coachRetriever.js`) | ✅ |
| Chat UI (`screens/CoachScreen.js`) | ✅ |
| Backend code (`coach-api/`) | ✅ Ready to deploy |
| Local fallback (no API key needed) | ✅ |

**Test now (no setup needed):**
```bash
npm run start:clear
```
→ Login → **Coach** tab → tap **Deadlift trend** → get answer from your local data.

---

# PHASE 1 — YOUR TURN: Groq free API key

### Why?
Groq gives **free, fast** AI (no credit card for dev tier). Your app sends workout context; Groq returns natural coach language.

### Steps

1. Open **https://console.groq.com**
2. Sign up (free)
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)
5. **Save it somewhere safe** — you will paste it in Render in Phase 2

### Free limits (approx)
- Thousands of requests/day on free tier (enough for personal use)
- Model: `llama-3.1-8b-instant` (fast) or `llama-3.3-70b-versatile` (smarter, still free)

**When done, reply:** `Phase 1 done` (you don't need to send the key in chat — only paste in Render).

---

# PHASE 2 — YOUR TURN: Firebase service account

### Why?
The API must verify **you are logged in** so nobody else can use your coach endpoint. Firebase Admin verifies your Google login token.

### Steps

1. Open **https://console.firebase.google.com**
2. Select project **`gymtracker-1708`**
3. Click ⚙️ **Project settings** → **Service accounts**
4. Click **Generate new private key** → download JSON file
5. Open the JSON file in a text editor
6. **Minify to ONE line** (remove line breaks) — you'll paste this in Render as `FIREBASE_SERVICE_ACCOUNT_JSON`

Example shape (don't share publicly):
```json
{"type":"service_account","project_id":"gymtracker-1708",...}
```

**When done, reply:** `Phase 2 done`

---

# PHASE 3 — YOUR TURN: Deploy API on Render (free)

### Why?
API keys must **never** live inside the phone app. Render hosts your `coach-api` free and keeps secrets safe.

### Steps

1. Open **https://render.com** → Sign up with **GitHub**
2. Connect repo **`HarshGupta-1708/GymTracker`**
3. Click **New +** → **Blueprint** (or **Web Service**)
   - If Blueprint: Render reads `render.yaml` automatically
   - If Web Service manually:
     - **Root Directory:** `coach-api`
     - **Build:** `npm install`
     - **Start:** `npm start`
     - **Plan:** Free
4. Add **Environment Variables** in Render dashboard:

| Key | Value |
|-----|-------|
| `GROQ_API_KEY` | Your Groq key from Phase 1 |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full one-line JSON from Phase 2 |
| `COACH_DAILY_LIMIT` | `20` |
| `ALLOW_DEMO_COACH` | `true` (optional, for demo user) |

5. Deploy → wait until **Live**
6. Copy your URL, e.g. `https://gymtracker-coach-api.onrender.com`
7. Test in browser: `https://YOUR-URL.onrender.com/health`
   - Should show `"ok": true` and `"groqConfigured": true`

**Note:** Free Render sleeps after ~15 min idle. First request may take 30–60 seconds to wake up.

**When done, reply:** `Phase 3 done` + your Render URL

---

# PHASE 4 — YOUR TURN: Connect app to API

### Why?
The app needs your Render URL to call the AI instead of local-only mode.

### Option A — `.env` file (recommended)

Create file **`GymTracker/.env`**:
```
EXPO_PUBLIC_COACH_API_URL=https://YOUR-URL.onrender.com
```

Restart Expo:
```bash
npm run start:clear
```

### Option B — `app.json` extra (alternative)

In `app.json` under `expo`:
```json
"extra": {
  "coachApiUrl": "https://YOUR-URL.onrender.com"
}
```
(Then we'd read from Constants — Option A is simpler with Expo 54.)

**When done, reply:** `Phase 4 done`

---

# PHASE 5 — Test checklist

| Test | Expected |
|------|----------|
| Coach tab opens | Chat + quick prompts |
| "Deadlift trend" | Numbers from YOUR logs |
| Google login → ask question | Natural AI reply, badge "AI" |
| Demo user → ask question | Works (local or demo if ALLOW_DEMO_COACH) |
| 21st question same day | Daily limit message |
| `/health` endpoint | groqConfigured: true |

**When done, reply:** `Phase 5 done` or describe any error.

---

# PHASE 6 — Assistant adds (after you complete 1–5)

- Streaming responses (text appears word-by-word)
- Thread history in Firestore sync
- Weekly auto-summary notification
- "Add suggested workout to Today" button
- Gemini fallback if Groq rate-limits

---

# Rollback if anything breaks

```bash
git checkout d143dfd -- .
# or clone fresh and checkout that commit
```

Or on GitHub: **Commits** → `d143dfd` → browse files.

---

# File map

| File | Purpose |
|------|---------|
| `screens/CoachScreen.js` | Chat UI |
| `utils/coachRetriever.js` | RAG — pulls data from workouts |
| `utils/coachApi.js` | Calls Render API |
| `utils/coachChat.js` | Saves chat history |
| `constants/coach.js` | API URL + quick prompts |
| `coach-api/server.js` | Express server for Render |
| `coach-api/src/groq.js` | Free Groq LLM calls |
| `render.yaml` | One-click Render deploy |

---

# FAQ

**Is my data used to train AI?**  
No. Groq API processes your request and does not train on it (see Groq terms). We only send retrieved workout snippets, not your whole database.

**Cost?**  
$0 for Groq free tier + Render free tier at personal scale.

**Why not run AI on phone?**  
Too heavy. Cloud free API is faster and accurate.

**Demo user without Google?**  
Works in local mode always. Set `ALLOW_DEMO_COACH=true` on Render for demo AI calls.

---

## Current status

| Phase | Who | Status |
|-------|-----|--------|
| 0 — Backup + code | Assistant | ✅ Done |
| 1 — Groq key | **You** | ⏳ Pending |
| 2 — Firebase service account | **You** | ⏳ Pending |
| 3 — Render deploy | **You** | ⏳ Pending |
| 4 — Connect app URL | **You** | ⏳ Pending |
| 5 — Test | **You** | ⏳ Pending |
| 6 — Polish features | Assistant | After Phase 5 |

**Start with Phase 1.** When finished, message: **`Phase 1 done`** and we continue.
