# How to Find Your Sentry DSN

## Steps to Get Your Sentry DSN

1. **Go to Sentry Dashboard**: https://sentry.io

2. **Select Your Project** (or create a new one)
   - If you haven't created a project, click "Create Project"
   - Choose "React" as the platform

3. **Go to Project Settings**
   - Click on your project name in the left sidebar
   - Click on **"Settings"** (gear icon) in the top right
   - OR
   - Click on **"Client Keys (DSN)"** in the left sidebar under "Project Settings"

4. **Find Your DSN**
   - You'll see a section labeled "Client Keys (DSN)"
   - The DSN will look like this:
     ```
     https://abc123def456@o123456.ingest.sentry.io/7890123
     ```
   - It starts with `https://` and contains:
     - A public key (long alphanumeric string)
     - Your organization ID (o123456)
     - Your project ID (7890123)

5. **Copy the DSN**
   - Click the "Copy" button next to the DSN
   - Or manually copy the full URL

## Format

A valid Sentry DSN should:
- ✅ Start with `https://`
- ✅ Contain `@o` followed by your org ID
- ✅ Contain `ingest.sentry.io`
- ✅ End with your project ID

**Example:**
```
https://a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6@o1234567.ingest.sentry.io/1234567
```

## What You're Looking At

If you see something that starts with `sntrys_`, that's likely:
- An authentication token (not the DSN)
- An internal Sentry key
- A different type of credential

**The DSN is specifically labeled "Client Keys (DSN)" in your project settings.**

## After Getting Your DSN

Add it to your environment variables:

**`.env.local` (for development):**
```env
VITE_SENTRY_DSN=https://your-actual-dsn-here@o123456.ingest.sentry.io/1234567
```

**Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add `VITE_SENTRY_DSN` with your DSN
3. Select environments (Production, Preview, Development)
4. Save and redeploy

## Still Can't Find It?

1. Make sure you're in the **correct project**
2. Look for **"Client Keys (DSN)"** in the left sidebar
3. Or go to: `Settings` → `Projects` → `[Your Project]` → `Client Keys (DSN)`

The DSN is public and safe to use in client-side code (it's meant for that purpose).
