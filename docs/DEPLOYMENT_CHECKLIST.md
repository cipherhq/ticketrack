# Production Deployment Checklist

## Pre-Deployment

### ✅ Code Changes Ready
- [x] All cleanup tasks completed (unused files removed, IoT features disabled)
- [x] Recent bug fixes (event deletion, location display, recurring event images)
- [x] Manual ticket sales feature added
- [x] Auto-refund functionality implemented
- [x] Sentry error tracking configured
- [x] Security improvements (RLS fixes, console.log audit)

### ✅ Configuration Files
- [x] `vercel.json` - Security headers configured
- [x] `package.json` - All dependencies updated
- [x] `src/lib/sentry.js` - Error tracking initialized

### ⚠️ Environment Variables (Vercel Dashboard)
Ensure these are set in Vercel project settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SENTRY_DSN` (optional, for error tracking)
- `VITE_GOOGLE_MAPS_API_KEY` (for location features)

### ✅ Database Migrations
All SQL migrations should be run in Supabase:
- `database/add_flutterwave_subaccount_fields.sql`
- `supabase/functions/auto-refund-on-cancellation/` - Deploy Edge Function
- `supabase/functions/create-flutterwave-checkout/` - Deploy Edge Function

## Deployment Steps

1. **Commit all changes**
   ```bash
   git add .
   git commit -m "Production deployment: cleanup, bug fixes, and new features"
   ```

2. **Push to main branch**
   ```bash
   git push origin main
   ```

3. **Vercel will auto-deploy** from the main branch

4. **Monitor deployment** in Vercel dashboard

5. **Verify in production**:
   - Check homepage loads
   - Test event creation
   - Test checkout flow
   - Verify location features work
   - Check error tracking (Sentry) if configured

## Post-Deployment

- [ ] Monitor error logs in Sentry (if configured)
- [ ] Test critical user flows
- [ ] Verify all environment variables are set
- [ ] Check Supabase Edge Functions are deployed
- [ ] Monitor Vercel deployment logs

## Rollback Plan

If issues occur:
1. Use Vercel's deployment rollback feature
2. Or revert to previous commit: `git revert HEAD && git push`
