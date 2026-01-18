# 🚀 Deploy Auto-Refund Edge Function

The `auto-refund-on-cancellation` Edge Function needs to be deployed to Supabase before the test can run.

## Quick Deploy (CLI - Recommended)

```bash
# 1. Make sure you're logged in
npx supabase login

# 2. Link to your project (if not already linked)
npx supabase link --project-ref bkvbvggngttrizbchygy

# 3. Deploy the function
npx supabase functions deploy auto-refund-on-cancellation
```

## Alternative: Deploy via Dashboard

1. Go to: https://supabase.com/dashboard/project/bkvbvggngttrizbchygy/functions
2. Click **"Deploy a new function"** or **"Create function"**
3. Function name: `auto-refund-on-cancellation`
4. Copy the entire content from: `supabase/functions/auto-refund-on-cancellation/index.ts`
5. Paste it into the editor
6. Click **Deploy**

## Verify Deployment

After deploying, you can test it:

```bash
# Test the function directly
curl -X POST https://bkvbvggngttrizbchygy.supabase.co/functions/v1/auto-refund-on-cancellation \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test-event-id","reason":"Test"}'
```

Or just run the test bot again - it should work now!

```bash
npm run test:auto-refund
```

## Troubleshooting

### Error: "Function not found" after deployment
- Wait 1-2 minutes for deployment to propagate
- Check Supabase Dashboard → Edge Functions to confirm it's listed

### Error: "Permission denied"
- Make sure you're using the service role key (not anon key)
- Check you're logged into Supabase CLI: `npx supabase login`

### Error: "Project not linked"
- Link your project: `npx supabase link --project-ref bkvbvggngttrizbchygy`
