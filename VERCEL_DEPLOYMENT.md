# Vercel Deployment Guide for PalmPesa Pay-to-Unlock

## 📋 Prerequisites
- Vercel account (sign up at https://vercel.com)
- GitHub, GitLab, or Bitbucket account with your project repository
- Your PalmPesa API token ready

## 🚀 Deployment Steps

### Step 1: Push Your Project to Git
```bash
git init
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### Step 2: Deploy to Vercel
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your repository (GitHub/GitLab/Bitbucket)
4. Click "Import"

### Step 3: Set Environment Variables
In the Vercel Dashboard, go to **Project Settings → Environment Variables** and add:

| Variable Name | Value | Notes |
|---|---|---|
| `PALMPESA_API_TOKEN` | `lQvIDIKKhMUKP7HThhah6BzMzZfrWCvOFFdBiSHv5aUQJbTwmpI38Z35hLl7` | Your PalmPesa API key |
| `APP_BASE_URL` | `https://your-project-name.vercel.app` | Replace with your actual Vercel domain |
| `PORT` | `3000` | Keep as default (Vercel handles this) |

**Example:**
- If your Vercel project URL is `https://palmpesa-app.vercel.app`
- Set `APP_BASE_URL=https://palmpesa-app.vercel.app`

### Step 4: Deploy
1. Click "Deploy"
2. Wait for the build to complete (2-3 minutes)
3. Your app will be live at your Vercel domain

## ✅ Verify Deployment

After deployment completes:
1. Visit your Vercel domain (e.g., https://palmpesa-app.vercel.app)
2. Test the payment flow by entering a test phone number
3. Check the API endpoints respond correctly

## 🔧 Update Environment Variables After Initial Deploy

If you need to update `APP_BASE_URL` after deployment:
1. Go to Vercel Dashboard → Your Project
2. **Settings** → **Environment Variables**
3. Edit `APP_BASE_URL` to match your actual production domain
4. Click **Save**
5. A new deployment will trigger automatically

## 📝 Important Notes

- **Never commit `.env` to Git** - Vercel uses their dashboard to manage secrets
- The `vercel.json` file handles routing for your Express server and static files
- Your video file `WhatsApp Video 2026-08-18 at 01.41.04.mp4` must be in `public/images/`
- PalmPesa webhooks will hit `{YOUR_VERCEL_DOMAIN}/api/webhook/palmpesa`

## 🐛 Troubleshooting

**Issue: "Cannot find module" errors**
- Solution: Ensure all dependencies are in `package.json`

**Issue: Environment variables not working**
- Solution: Redeploy after adding env vars (Vercel sometimes requires this)

**Issue: Video not loading**
- Solution: Verify the video file is in `public/images/` before pushing to Git

**Issue: Webhook not firing**
- Solution: Verify `APP_BASE_URL` matches your actual Vercel domain exactly

## 📞 Support
For Vercel help: https://vercel.com/docs
For PalmPesa issues: Contact your PalmPesa account manager
