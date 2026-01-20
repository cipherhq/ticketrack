# Vercel Deployment URLs - Complete Guide

## Current Status

From your `npx vercel ls` output, I can see:
- ✅ All deployments are **Production** environment (from `main` branch)
- ⚠️ Recent deployments (2h-7h ago) show **● Error** status
- ✅ Older deployments (24h-3d ago) show **● Ready** status

## Finding Branch-Specific URLs

### Option 1: List All Deployments (Including Previews)

```bash
# Show all deployments including preview branches
npx vercel ls --all

# Or with more details
npx vercel inspect
```

### Option 2: Check Specific Branch

```bash
# List deployments for a specific branch
npx vercel ls --scope bajides-projects

# Or check what branches have deployments
npx vercel inspect --scope bajides-projects
```

### Option 3: Vercel Dashboard (Best for Branch URLs)

1. Go to: https://vercel.com/dashboard
2. Select **ticketrack** project
3. Click **"Deployments"** tab
4. Filter by:
   - **Production** = main branch
   - **Preview** = other branches (dev, payment-payout-improvements)

## Understanding Your Output

From your `npx vercel ls` output:

**Recent Deployments (Errors):**
- `https://ticketrack-o26r4qkn5-bajides-projects.vercel.app` - Error (2h ago)
- `https://ticketrack-3dxpsv2c8-bajides-projects.vercel.app` - Error (2h ago)
- `https://ticketrack-6n613e8kk-bajides-projects.vercel.app` - Error (2h ago)
- ... (multiple errors in last 7 hours)

**Working Deployments:**
- `https://ticketrack-lisssiaia-bajides-projects.vercel.app` - Ready (24h ago) ✅
- `https://ticketrack-87pqe6aq1-bajides-projects.vercel.app` - Ready (2d ago) ✅

## Why No Preview Deployments Show?

If you don't see `dev` or `payment-payout-improvements` branches:

1. **They haven't been pushed recently** - Vercel only creates previews when branches are pushed
2. **They're filtered out** - Use `--all` flag to see previews
3. **They're in a different project** - Check if they're under a different Vercel project

## Commands to Find Branch URLs

```bash
# 1. List all deployments (including previews)
npx vercel ls --all

# 2. Get project info with branch details
npx vercel inspect

# 3. List deployments with branch names
npx vercel ls --scope bajides-projects --all
```

## Production URL

Based on your output, your **main branch (production)** URL is likely:
- `https://ticketrack-lisssiaia-bajides-projects.vercel.app` (most recent working deployment)
- Or check Vercel Dashboard for the production domain

## Next Steps

1. **Check for preview deployments:**
   ```bash
   npx vercel ls --all
   ```

2. **Or check Vercel Dashboard:**
   - Go to Deployments tab
   - Look for "Preview" environment deployments
   - These will show which branch they're from

3. **Fix recent deployment errors:**
   - Check Vercel Dashboard → Deployments → Click on error deployment
   - View build logs to see what failed

---

**Note**: All your current deployments show as "Production" which means they're all from the `main` branch. Preview deployments for `dev` and `payment-payout-improvements` will only appear if those branches have been pushed to GitHub recently.
