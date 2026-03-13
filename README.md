# ticketRack - Phase 2

The World's Most Trusted Event Ticketing Platform

## Features (Phase 2 - Web Public Pages)

### Pages Included
- ✅ Home (Landing page with search, categories, countries)
- ✅ Events (Browse with filters, search, grid/list view)
- ✅ Event Details (Ticket selection, add to cart)
- ✅ Search (Search with recent searches, suggestions)
- ✅ Login / Signup / Forgot Password
- ✅ Cart (Shopping cart with ticket management)
- ✅ Checkout (Payment flow)
- ✅ Payment Success (Confirmation with tickets)
- ✅ My Tickets (User's purchased tickets)
- ✅ Profile (User settings)
- ✅ Organizer Profile (Public organizer page with follow)
- ✅ About / Contact / Help / Privacy / Terms

### Tech Stack
- React 18 + Vite
- Tailwind CSS
- React Router DOM
- Supabase (Auth + Database)
- Lucide React (Icons)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:

**Frontend (Vercel/Client-side):**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Supabase Edge Functions (Server-side):**
Set in Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:
- `SUPABASE_URL` (auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (from API settings)
- `SUPABASE_ANON_KEY` (from API settings)
- `RESEND_API_KEY` (required for email features, get from resend.com)

**Deploy Edge Functions:**
```bash
# Option 1: Use npx (no installation needed)
npx supabase login
npx supabase link --project-ref bkvbvggngttrizbchygy
npx supabase functions deploy send-birthday-emails
npx supabase functions deploy send-email

# Option 2: Install globally (if you prefer)
# Fix npm permissions first:
mkdir ~/.npm-global && npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc && source ~/.zshrc
npm install -g supabase
# Then use: supabase login, supabase link, etc.
```

📚 See `docs/ENVIRONMENT_VARIABLES.md` for complete environment variable documentation.

3. Run development server:
```bash
npm run dev
```

## Deployment

Push to GitHub and Vercel will auto-deploy.

## Next Phases

- Phase 3: Organizer Dashboard (24 pages)
- Phase 4: Admin Portal (17 pages)
- Phase 5: Mobile App (10 screens)
# ticketRack
