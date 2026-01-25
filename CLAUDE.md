# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run all Playwright tests
npm test

# Run a specific test file
npx playwright test tests/auth.spec.cjs

# Run tests with UI
npx playwright test --ui
```

### Supabase Edge Functions

```bash
# Deploy edge functions (requires Supabase CLI)
npx supabase login
npx supabase link --project-ref bkvbvggngttrizbchygy
npx supabase functions deploy <function-name>
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **UI Components**: Radix UI primitives with Tailwind styling
- **Testing**: Playwright (E2E)
- **Deployment**: Vercel (frontend) + Supabase (backend)

### Project Structure

```
src/
├── App.jsx              # Main app with routes, lazy loading, Sentry
├── main.jsx             # Entry point
├── contexts/            # React Context providers (auth, cart, feature flags, etc.)
├── components/
│   ├── ui/              # Reusable Radix-based design system components
│   └── *.jsx            # Feature-specific components
├── pages/
│   ├── admin/           # Admin portal (43 pages)
│   ├── organizer/       # Organizer dashboard (37 pages)
│   ├── finance/         # Finance manager pages (12 pages)
│   └── *.jsx            # Public pages
├── lib/                 # Utilities (supabase client, email, OTP, logging)
├── services/            # Business logic layer wrapping Supabase queries
├── routes/              # Route definitions (AdminRoutes, OrganizerRoutes, etc.)
└── hooks/               # Custom React hooks

supabase/functions/      # Deno/TypeScript edge functions
database/                # SQL migration files
tests/                   # Playwright E2E tests (*.cjs files)
```

### Path Aliases
- `@/` maps to `/src` (configured in vite.config.js)

### Key Architectural Patterns

**State Management**: Context-based (no Redux). Main contexts:
- `AuthContext` - Authentication, OTP, session management
- `CartContext` - Shopping cart with localStorage persistence
- `FeatureFlagsContext` - Country-based feature toggles
- `OrganizerContext`, `AdminContext`, `FinanceContext` - Role-specific data

**Multi-tenant Design**:
- Role-based access (attendee, organizer, admin, promoter, finance)
- `organizer_id` foreign keys for data isolation
- Supabase RLS (Row Level Security) policies on all tables

**Multi-currency Support**: NGN, USD, GBP, EUR, GHS, KES, ZAR, CAD, AUD with country-based feature flags

**Payment Providers**: Paystack, Flutterwave, Stripe, PayPal via Edge Functions

### Edge Functions (`supabase/functions/`)

Payment processing, email/SMS/WhatsApp delivery, webhook handlers, and automated tasks. Key functions:
- `send-email` - Primary email service with 55+ templates
- `create-*-subaccount` - Payment provider merchant setup
- `process-refund` - Refund processing
- `auto-refund-on-cancellation` - Event cancellation automation
- `paystack-webhook`, `stripe-webhook` - Payment webhooks

## Environment Variables

**Frontend** (prefix with `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Backend** (Supabase Edge Function secrets):
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (email)
- `TERMII_API_KEY` (SMS)
- Payment provider keys (Stripe, Paystack, Flutterwave, PayPal)

See `docs/ENVIRONMENT_VARIABLES.md` for complete documentation.

## Testing

Tests are in `tests/` directory using Playwright. Test files use `.cjs` extension.

```bash
# Run all tests
npm test

# Run specific test
npx playwright test tests/checkout.spec.cjs

# Run with headed browser
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

Tests run against `http://localhost:5173` (dev server starts automatically).
