# Supabase Email Templates

Copy these templates into **Supabase Dashboard → Authentication → Email Templates**

---

## 1. Confirm Signup (OTP Version)

**Subject:** `Your Ticketrack verification code: {{ .Token }}`

**Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">TICKETRACK</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your Gateway to Amazing Events</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px; text-align: center;">Verify Your Email</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px; text-align: center;">
                Enter this code to complete your signup:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px dashed #2969FF; border-radius: 16px; padding: 32px; text-align: center; margin: 0 0 32px;">
                <div style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #2969FF; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">{{ .Token }}</div>
                <p style="color: #64748b; font-size: 13px; margin: 16px 0 0;">Code expires in 24 hours</p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2025 Ticketrack. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">
                <a href="https://ticketrack.com" style="color: #2969FF; text-decoration: none;">ticketrack.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Magic Link (Alternative - if you prefer links)

**Subject:** `Sign in to Ticketrack`

**Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">TICKETRACK</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your Gateway to Amazing Events</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px; text-align: center;">Sign In to Ticketrack</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px; text-align: center;">
                Click the button below to sign in to your account:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">Sign In</a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 16px; text-align: center;">
                Or copy this link:
              </p>
              <p style="background: #f1f5f9; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 12px; color: #475569; margin: 0;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                If you didn't request this, you can safely ignore this email.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">
                © 2025 Ticketrack · <a href="https://ticketrack.com" style="color: #2969FF; text-decoration: none;">ticketrack.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Password Reset

**Subject:** `Reset your Ticketrack password`

**Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header (Red for security) -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">🔒 TICKETRACK</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px; text-align: center;">Reset Your Password</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px; text-align: center;">
                We received a request to reset your password. Click below to create a new one:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">Reset Password</a>
              </div>
              
              <!-- Warning -->
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">⚠️ Didn't request this?</p>
                <p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0;">Someone may be trying to access your account. Ignore this email if you didn't request a reset.</p>
              </div>
              
              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
                This link expires in 1 hour for security.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2025 Ticketrack · <a href="https://ticketrack.com" style="color: #2969FF; text-decoration: none;">ticketrack.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Invite User

**Subject:** `You've been invited to Ticketrack`

**Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">TICKETRACK</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your Gateway to Amazing Events</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px; text-align: center;">You're Invited! 🎉</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px; text-align: center;">
                You've been invited to join Ticketrack. Click below to accept and set up your account:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
              </div>
              
              <!-- Benefits -->
              <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <p style="color: #166534; font-size: 14px; margin: 0 0 12px; font-weight: 600;">What you can do:</p>
                <ul style="color: #166534; font-size: 14px; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Discover amazing events</li>
                  <li style="margin-bottom: 8px;">Buy tickets securely</li>
                  <li>Get event reminders</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2025 Ticketrack · <a href="https://ticketrack.com" style="color: #2969FF; text-decoration: none;">ticketrack.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to Enable OTP Instead of Email Links

In **Supabase Dashboard → Authentication → Email Templates → Confirm signup**:

1. Check **"Use OTP verification"** (if available)
2. Or in your app code, use:
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    emailRedirectTo: undefined // Don't use redirect
  }
})
// Then user enters OTP code via:
await supabase.auth.verifyOtp({ email, token: userEnteredCode, type: 'signup' })
```

This makes users enter the code manually instead of clicking a link.
