# Supabase SMTP Setup - Where to Configure

## ⚠️ Important: Use Authentication, NOT Providers!

SMTP settings for email verification are configured in **Authentication**, not in **Providers**.

## Navigation Path

### Correct Location:
1. **Supabase Dashboard** → Your Project
2. **Settings** (gear icon in left sidebar)
3. **Authentication** (under Settings)
4. **Email** tab (click this tab)
5. Scroll down to **SMTP Settings** section

### ❌ Wrong Location:
- **Settings** → **Authentication** → **Providers** tab
  - This is for OAuth providers (Google, GitHub, Facebook, etc.)
  - NOT for SMTP email configuration

## Visual Guide

```
Supabase Dashboard
├── Settings (gear icon)
│   ├── Authentication
│   │   ├── Email ← **SMTP Settings are HERE**
│   │   ├── Providers ← NOT here (this is for OAuth)
│   │   ├── URL Configuration
│   │   └── ...
```

## What You'll See in Email Tab

In the **Email** tab, you'll find:

1. **Sender details:**
   - Sender email address
   - Sender name

2. **SMTP provider settings:**
   - Host
   - Port number
   - Username
   - Password
   - Minimum interval per user

## Resend SMTP Configuration

Once you're in the **Email** tab, configure:

- **Host**: `smtp.resend.com`
- **Port**: `587`
- **Username**: `resend`
- **Password**: Your Resend API key
- **Sender email**: `tickets@ticketrack.com`
- **Sender name**: `Ticketrack`

## Common Mistake

❌ **Don't go to:** Settings → Authentication → **Providers**  
✅ **Go to:** Settings → Authentication → **Email**

Providers is for:
- Google OAuth
- GitHub OAuth
- Facebook OAuth
- Apple OAuth
- etc.

Email tab is for:
- SMTP configuration
- Email templates
- Email verification settings

## Still Can't Find It?

If you don't see the Email tab:
1. Make sure you're in **Settings** → **Authentication**
2. Look for tabs at the top: "Email", "Providers", "URL Configuration", etc.
3. Click the **"Email"** tab
4. Scroll down to find SMTP Settings section

## Quick Test

After configuring SMTP:
1. Stay in the **Email** tab
2. Look for a "Test SMTP" or "Send Test Email" button
3. Or try signing up a test user
4. Check Supabase Logs for SMTP errors
