# Ticketrack - Event Ticketing Platform

Africa's premier event ticketing platform built with React, Supabase, and Paystack.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Payments**: Paystack
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Paystack account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/cipherhq/ticketrack.git
cd ticketrack
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with your credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── admin/       # Admin portal components
│   ├── organizer/   # Organizer dashboard components
│   ├── web/         # Public website components
│   ├── shared/      # Shared components
│   └── ui/          # UI primitives (shadcn/ui)
├── contexts/        # React contexts (Auth, etc.)
├── hooks/           # Custom React hooks
├── lib/             # Utilities and Supabase client
├── types/           # TypeScript types
└── styles/          # Global styles
```

## Features

### For Attendees
- Browse and search events
- Secure ticket purchasing
- Digital tickets with QR codes
- Order history

### For Organizers
- Event management
- Ticket type configuration
- Sales analytics
- Check-in tools
- Payout management

### For Admins
- Organizer verification
- Platform analytics
- Payout processing
- Support management

## Security

- Row Level Security (RLS) on all tables
- Input validation and sanitization
- Rate limiting
- Encrypted sensitive data
- CSRF protection
- Secure session management

## License

MIT

