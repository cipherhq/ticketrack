# How to Check Deployment URLs (Without Installing Vercel CLI)

Since you're having npm permission issues, here are alternative ways to check your branch deployment URLs:

## Option 1: Use npx (No Installation Needed) ✅ Recommended

```bash
# List all deployments without installing anything
npx vercel ls

# Or get project info
npx vercel inspect
```

This uses `npx` which downloads and runs Vercel CLI temporarily without installing it globally.

## Option 2: Vercel Dashboard (Easiest) ✅

1. Go to: https://vercel.com/dashboard
2. Click on your **Ticketrack** project
3. Click **"Deployments"** tab
4. You'll see all deployments with their URLs:
   - Production (main branch)
   - Preview deployments (dev, payment-payout-improvements, etc.)

## Option 3: GitHub Pull Requests

1. Go to: https://github.com/cipherhq/ticketrack/pulls
2. Open any PR for `dev` or `payment-payout-improvements`
3. Vercel automatically comments with the preview URL

## Option 4: Fix npm Permissions (If You Want Global Install)

If you want to install Vercel CLI globally, fix npm permissions first:

### Solution A: Use npx (Recommended - No Fix Needed)
```bash
# Just use npx - no installation needed!
npx vercel ls
```

### Solution B: Fix npm Permissions
```bash
# Fix npm permissions (same as before)
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin

# Then install
npm i -g vercel
```

### Solution C: Use Local npm Directory
```bash
# Create local npm directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Install to local directory
npm install -g vercel
```

## Quick Check Command

**Easiest way (no installation):**
```bash
npx vercel ls
```

This will show all your deployments and their URLs!

## Expected Output

When you run `npx vercel ls`, you'll see something like:

```
Production: https://ticketrack.vercel.app
Preview:    https://ticketrack-dev-abc123.vercel.app
Preview:    https://ticketrack-payment-payout-improvements-xyz789.vercel.app
```

---

**TL;DR**: Just use `npx vercel ls` - no installation needed! 🚀
