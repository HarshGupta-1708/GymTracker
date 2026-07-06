# Deploy web app (Vercel)

The old URL `gym-tracker-flax-beta.vercel.app` is **offline (404)**. Redeploy with these steps.

## One-time setup

1. Create account at **https://vercel.com** (sign in with GitHub)
2. **Add New Project** → Import **HarshGupta-1708/GymTracker**
3. Vercel reads `vercel.json` automatically:
   - Build: `npm run build:web`
   - Output: `dist`

## Environment variables (optional)

Google Sign-In on web uses baked-in client IDs in `constants/googleAuth.js`.  
For overrides, add in Vercel → Project → Settings → Environment Variables:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Web OAuth |
| `EXPO_PUBLIC_COACH_API_URL` | AI Coach API |

## Deploy

Every push to `master` can auto-deploy if enabled in Vercel.

Manual deploy from Mac:
```bash
npm install -g vercel
cd /Users/harshgupta1708/Desktop/GymTracker
vercel --prod
```

## After deploy

1. Copy your URL (e.g. `https://gym-tracker-xxx.vercel.app`)
2. Update **Live demo** link in `README.md`
3. Add **Authorized JavaScript origins** in Google Cloud Console:
   - `https://your-app.vercel.app`

## Netlify (alternative)

```bash
npm run build:web
npx netlify-cli deploy --prod --dir=dist
```
