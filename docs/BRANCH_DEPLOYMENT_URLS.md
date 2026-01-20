# Branch Deployment URLs

## How Vercel Preview Deployments Work

Vercel automatically creates preview deployments for each branch that is pushed to GitHub. Here's how to find them:

## Finding Your Branch URLs

### Option 1: Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/dashboard
2. Select your **Ticketrack** project
3. Click on **"Deployments"** tab
4. You'll see all deployments listed, including:
   - **Production** (main branch) → `ticketrack.vercel.app` or `ticketrack.com`
   - **Preview** (other branches) → `ticketrack-{branch-name}-{hash}.vercel.app`

### Option 2: GitHub Pull Requests

When you create a PR for a non-main branch, Vercel automatically:
1. Creates a preview deployment
2. Comments on the PR with the preview URL
3. The URL format is: `ticketrack-{branch-name}-{username}.vercel.app`

### Option 3: Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# List all deployments
vercel ls

# Get specific deployment URL
vercel inspect
```

## Current Branches

Based on your repository, you have these branches:

- **`main`** → Production URL (likely `ticketrack.vercel.app` or `ticketrack.com`)
- **`dev`** → Preview URL (check Vercel dashboard)
- **`payment-payout-improvements`** → Preview URL (check Vercel dashboard)

## Typical URL Format

- **Main branch**: `https://ticketrack.vercel.app` or `https://ticketrack.com`
- **Preview branches**: `https://ticketrack-{branch-name}-{hash}.vercel.app`
  - Example: `https://ticketrack-dev-abc123.vercel.app`
  - Example: `https://ticketrack-payment-payout-improvements-xyz789.vercel.app`

## Quick Check

To see all your deployment URLs:

1. **Vercel Dashboard**: https://vercel.com/dashboard → Your Project → Deployments
2. **GitHub**: Check any open Pull Requests for preview URLs
3. **Terminal**: Run `vercel ls` (if Vercel CLI is installed)

## Setting Custom Domain for Branch

If you want a custom domain for a specific branch:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add domain and assign it to a specific branch
3. Or use Vercel's branch-specific domain feature

## Environment Variables per Branch

Remember: Preview deployments use the same environment variables as production unless you:
1. Set branch-specific variables in Vercel Dashboard
2. Or use Vercel's environment variable overrides

---

**Need the exact URL?** Check your Vercel Dashboard or any open Pull Requests for the preview deployment links.
