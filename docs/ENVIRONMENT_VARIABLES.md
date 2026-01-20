# Environment Variables Documentation

This document describes all environment variables used in Ticketrack.

## Quick Start

1. Copy `.env.example` to `.env.local` (if it exists)
2. Fill in your actual values
3. **Never commit `.env.local` to version control!**

## Required Variables

### Frontend (Client-side)

These variables are prefixed with `VITE_` and are exposed to the browser.

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard > Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key | Supabase Dashboard > Project Settings > API > anon/public key |

**⚠️ Important:** These are safe to expose in client-side code. The `anon` key is designed for public use.

### Backend (Server-side / Edge Functions)

These should **NEVER** be exposed to the browser. Set them in:
- Supabase Dashboard > Edge Functions > Secrets
- Vercel Dashboard > Environment Variables (for CI/CD)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase Dashboard > Project Settings > API > service_role key |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` (for Edge Functions) | Same as above |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` (for Edge Functions) | Same as above |

## Optional Variables

### Email Service

| Variable | Description | Default |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key for email sending | Required for email functionality (including birthday emails) |

Get from: https://resend.com/api-keys

### SMS/WhatsApp Service

| Variable | Description | Default |
|----------|-------------|---------|
| `TERMII_API_KEY` | Termii API key for SMS/WhatsApp | Required for SMS functionality |
| `TERMII_SENDER_ID` | Sender ID for SMS | `Ticketrack` |

Get from: https://www.termii.com/

### Payment Gateways

These are typically configured via Admin Settings in the app, but can also be set as environment variables for Edge Functions.

#### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`

#### Paystack
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`

#### Flutterwave
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_ENCRYPTION_KEY`

#### PayPal
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

## Development Setup

1. Create `.env.local` in the project root:
   ```bash
   cp .env.example .env.local  # If .env.example exists
   ```

2. Add your values:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. For Edge Functions, set secrets in Supabase Dashboard:
   - Go to Project Settings > Edge Functions > Secrets
   - Add `SUPABASE_SERVICE_ROLE_KEY` and other backend secrets

## Production Setup

### Vercel

1. Go to Project Settings > Environment Variables
2. Add variables for each environment:
   - **Production**
   - **Preview** (for pull requests)
   - **Development** (for local development)

3. Variables prefixed with `VITE_` are automatically available in builds
4. Non-`VITE_` variables are server-side only

### Supabase Edge Functions

1. Go to Project Settings > Edge Functions > Secrets
2. Add secrets for production use
3. Secrets are automatically available to all Edge Functions

## Security Best Practices

1. **Never commit `.env.local` or `.env`** - They're in `.gitignore`
2. **Use different keys for development, staging, and production**
3. **Rotate keys regularly**, especially if they're exposed
4. **Service role keys are powerful** - Only use in server-side code
5. **Limit access** - Only team members who need them should have access
6. **Use environment variable managers** - Vercel, Supabase, etc. handle encryption
7. **Audit regularly** - Review who has access to production keys

## Example `.env.local` File

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role (Backend only - NEVER expose to client!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Email Service (Optional)
RESEND_API_KEY=re_your-key-here

# SMS Service (Optional)
TERMII_API_KEY=your-termii-key-here
TERMII_SENDER_ID=Ticketrack
```

## Troubleshooting

### "Environment variable not found"

- **Client-side (`VITE_` prefix)**: Ensure it's set in `.env.local` or Vercel environment variables
- **Server-side**: Ensure it's set in Supabase Edge Function secrets or Vercel environment variables

### "RLS error" or "Permission denied"

- You may be using the wrong key. Use `VITE_SUPABASE_ANON_KEY` for client-side code
- For server-side operations that bypass RLS, use `SUPABASE_SERVICE_ROLE_KEY` in Edge Functions

### Variables not updating in production

- Clear Vercel build cache and redeploy
- Ensure variables are set in the correct environment (Production vs Preview)

## Related Documentation

- [Supabase Environment Variables](https://supabase.com/docs/guides/functions/secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Production Readiness Checklist](../PRODUCTION_READINESS_CHECKLIST.md)