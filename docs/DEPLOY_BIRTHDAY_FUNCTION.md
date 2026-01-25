# Deploy Birthday Email Function

Quick guide to deploy the `send-birthday-emails` function to Supabase.

## Prerequisites

- Node.js and npm installed
- Supabase account and project created
- Environment variables configured (see `BIRTHDAY_EMAIL_SETUP.md`)

**Note**: You can use Supabase CLI via `npx` without global installation, or install it globally if you prefer.

## Deploy Steps

### Option A: Using npx (No Installation Required)

### 1. Login to Supabase

```bash
npx supabase login
```

This will open your browser to authenticate.

### 2. Link Your Project

```bash
npx supabase link --project-ref bkvbvggngttrizbchygy
```

**Your Project Reference**: `bkvbvggngttrizbchygy` (from your Supabase URL)

### 3. Deploy the Function

```bash
npx supabase functions deploy send-birthday-emails
```

### Option B: Install Globally (If You Prefer)

If you want to install Supabase CLI globally but are getting permission errors:

**Fix npm permissions (recommended):**
```bash
# Fix npm permissions without sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g supabase
```

**Or use sudo (not recommended but works):**
```bash
sudo npm install -g supabase
```

Then use `supabase` commands directly (without `npx`).

This will:
- Bundle the function code
- Deploy it to your Supabase project
- Make it available at: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails`

### 4. Verify Deployment

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. You should see `send-birthday-emails` in the list
4. Click on it to view details, logs, and test

### 5. Test the Function

Once deployed, test it manually:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

**Your Function URL**: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails`

Or test via Supabase Dashboard:
1. Go to Edge Functions → `send-birthday-emails`
2. Click "Invoke Function"
3. Use empty body `{}` or test payload

## Troubleshooting

### "Function not found"
- Ensure you've deployed the function: `supabase functions deploy send-birthday-emails`
- Check you're in the correct project: `supabase projects list`

### "Unauthorized" error
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check environment variables are set in Supabase Dashboard

### "Function failed"
- Check function logs in Supabase Dashboard
- Verify `send-email` function is also deployed
- Ensure `RESEND_API_KEY` is set

## Next Steps

After deploying, set up the cron job as described in `BIRTHDAY_EMAIL_SETUP.md`.
