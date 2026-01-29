# Event Creation Data - Complete Reference

This document contains all data fields, validation rules, and business logic for event creation. Use this as a reference for building the mobile app.

## Navigation Tabs (in order)
1. **Event Details** - Basic info, description, visibility
2. **Date & Time** - Scheduling, recurring, multi-day
3. **Venue Details** - Location, amenities
4. **Ticketing** - Tickets, pricing, transfers
5. **Speakers** - Artists/Headliners (optional)
6. **Media & Sponsors** - Images, videos, sponsors

---

## 1. EVENT DETAILS TAB

### Required Fields
| Field | Type | Validation |
|-------|------|------------|
| `title` | string | Required, only alphanumeric + `\s\-',.!?&()` allowed |
| `slug` | string | Required, min 3 chars, must be unique (auto-generated from title if not provided) |
| `eventType` | string | Required, selected from categories |
| `category` | string | Required, auto-set from eventType |
| `description` | string (HTML) | Required, min 25 characters |

### Optional Fields
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `visibility` | enum | `'public'` | Options: `public`, `unlisted`, `password`, `invite_only`, `email_whitelist` |
| `accessPassword` | string | `''` | Required if visibility = `password` |
| `accessSettings` | object | `{}` | Contains `inviteCodes[]` or `emailWhitelist[]` for private events |

### Visibility Options
```javascript
visibility: 'public' | 'unlisted' | 'password' | 'invite_only' | 'email_whitelist'

// If password:
accessPassword: string (required)

// If invite_only:
accessSettings.inviteCodes: [
  { code: string, name?: string, maxUses?: number, expiresAt?: date }
]

// If email_whitelist:
accessSettings.emailWhitelist: [
  { email: string }
]
```

---

## 2. DATE & TIME TAB

### Required Fields
| Field | Type | Validation |
|-------|------|------------|
| `startDate` | date string | Required, format: `YYYY-MM-DD` |
| `startTime` | time string | Required, format: `HH:mm` |
| `endTime` | time string | Required, format: `HH:mm` |
| `endDate` | date string | Required for single events, format: `YYYY-MM-DD` |

### Optional Fields
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timezone` | string | Auto-detected | IANA timezone (e.g., `Africa/Lagos`) |
| `gateOpeningTime` | time string | `null` | Must be before startTime |
| `isMultiDay` | boolean | `false` | Multi-day event toggle |
| `eventDays` | array | `[]` | Required if isMultiDay=true |
| `isRecurring` | boolean | `false` | Recurring event toggle |
| `recurringType` | enum | `'weekly'` | `daily`, `weekly`, `monthly` |
| `recurringDays` | number[] | `[]` | Day indices (0=Sun, 6=Sat) |
| `recurringEndType` | enum | `'occurrences'` | `never`, `occurrences`, `date` |
| `recurringOccurrences` | number | `4` | If recurringEndType=occurrences |
| `recurringEndDate` | date string | `''` | If recurringEndType=date |

### Multi-Day Event Structure
```javascript
eventDays: [
  {
    id?: string,           // UUID (for existing)
    dayNumber: number,     // 1, 2, 3...
    date: string,          // Required: YYYY-MM-DD
    startTime?: string,    // HH:mm
    endTime?: string,      // HH:mm
    title?: string,        // Day title
    description?: string,  // Day description
    activities?: [
      {
        id?: string,
        title: string,
        startTime?: string,
        endTime?: string,
        description?: string,
        location?: string,
        sortOrder: number
      }
    ]
  }
]
```

### Validation Rules
- `isMultiDay` and `isRecurring` CANNOT both be true
- `endDate` cannot be before `startDate`
- `endTime` must be after `startTime` for same-day events
- `gateOpeningTime` must be before `startTime`
- Multi-day: each day's date must be after previous day
- Recurring with `date` end type: `recurringEndDate` required

---

## 3. VENUE DETAILS TAB

### Required Fields
| Field | Type | Validation |
|-------|------|------------|
| `venueAddress` | string | Required for in-person events |

### Optional Fields
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `venueName` | string | `''` | Venue name |
| `googleMapLink` | string | `''` | Google Maps embed URL |
| `venueType` | enum | `'indoor'` | `indoor`, `outdoor`, `hybrid` |
| `venueCapacity` | number | `null` | Total venue capacity |
| `seatingType` | enum | `'Seated'` | `Standing`, `Seated`, `Mixed` |
| `city` | string | `''` | City name |
| `country` | string | `''` | Country code (e.g., `NG`, `GB`) |
| `venueLat` | number | `null` | Latitude for map |
| `venueLng` | number | `null` | Longitude for map |
| `isVirtual` | boolean | `false` | Virtual event toggle |
| `streamingUrl` | string | `''` | Stream URL (if virtual) |
| `streamingPlatform` | string | `''` | Platform name (Zoom, etc.) |

### Venue Amenity Flags (all boolean, default false)
| Field | Description |
|-------|-------------|
| `isAdultOnly` | 18+ event |
| `isWheelchairAccessible` | Accessible venue |
| `isBYOB` | Bring your own drinks |
| `isPhotographyAllowed` | Photos permitted |
| `isRecordingAllowed` | Video recording permitted |
| `isParkingAvailable` | Parking on-site |
| `isOutsideFoodAllowed` | Outside food permitted |
| `dressCode` | string - dress requirements |

---

## 4. TICKETING TAB

### Required Fields
| Field | Type | Validation |
|-------|------|------------|
| `currency` | string | Required for paid events |
| `tickets` | array | At least 1 valid ticket if not free event |

### Optional Fields
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `isFree` | boolean | `false` | Free event toggle |
| `acceptsDonations` | boolean | `false` | Accept donations (for free events) |
| `donationAmounts` | number[] | `[500, 1000, 2500]` | Suggested donation amounts |
| `allowCustomDonation` | boolean | `true` | Allow custom donation amount |
| `donationFeeHandling` | enum | `'absorb'` | `absorb` or `pass_to_attendee` |
| `feeHandling` | enum | `'pass_to_attendee'` | `absorb` or `pass_to_attendee` |
| `maxTicketsPerOrder` | number | `10` | Max tickets per order (1-100) |
| `allowTransfers` | boolean | `false` | Allow ticket transfers |
| `maxTransfers` | number | `2` | Max transfer count per ticket |
| `transferFee` | number | `0` | Fee charged for transfer |
| `notifyOrganizerOnSale` | boolean | `true` | Email organizer on each sale |

### Ticket Structure
```javascript
tickets: [
  {
    id: number,              // Local ID (for UI)
    dbId?: string,           // Database UUID (for edit mode)
    name: string,            // Required: Ticket name
    price: number,           // Required if not free (> 0)
    quantity: number,        // Required: Available quantity (> 0)
    description?: string,    // Ticket description
    isRefundable: boolean,   // Default: true
    isTableTicket?: boolean, // Table ticket flag
    seatsPerTable?: number   // If table ticket
  }
]
```

### Currency Options
```javascript
currencies: {
  NGN: { symbol: '₦', name: 'Nigerian Naira', provider: 'paystack' },
  GBP: { symbol: '£', name: 'British Pound', provider: 'stripe' },
  USD: { symbol: '$', name: 'US Dollar', provider: 'stripe' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', provider: 'stripe' },
  GHS: { symbol: 'GH₵', name: 'Ghanaian Cedi', provider: 'paystack' },
  // More may be added via database
}
```

### Ticket Validation
- If `isFree = false`: at least 1 ticket with name, quantity > 0, price > 0
- If `isFree = true`: tickets optional (free RSVP)
- Each ticket name must have quantity > 0
- Each paid ticket must have price > 0

---

## 5. SPEAKERS TAB (Optional)

### Structure
```javascript
speakers: [
  {
    tempId: number,          // Local ID for UI
    dbId?: string,           // Database UUID (edit mode)
    name: string,            // Required if adding speaker
    role?: string,           // e.g., "Keynote Speaker", "DJ"
    bio?: string,            // Speaker bio
    image_url?: string,      // Existing image URL
    imageFile?: File,        // New image file to upload
    imagePreview?: string,   // Blob URL for preview
    social_links: {
      twitter?: string,
      instagram?: string,
      linkedin?: string,
      website?: string
    }
  }
]
```

### Validation
- Entire tab is optional
- If adding a speaker, only `name` is required
- Image: max 5MB, formats: jpg, png, webp

---

## 6. MEDIA & SPONSORS TAB (Optional)

### Banner Image (Required)
```javascript
bannerImage: File | null     // New image to upload
bannerPreview: string        // URL or blob preview

// Validation: Required, max 5MB, jpg/png/webp
```

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| `promoVideoUrl` | string | YouTube/Vimeo/TikTok URL |
| `venueLayoutImage` | File | Venue seating layout |
| `eventImages` | File[] | Gallery images |
| `sponsorLogos` | array | Sponsor logos |

### Sponsor Structure
```javascript
sponsorLogos: [
  {
    id?: string,       // Database ID
    file?: File,       // New file to upload
    preview: string,   // URL or blob preview
  }
]
```

---

## 7. PUBLISHING OPTIONS

```javascript
publishOption: 'now' | 'schedule' | 'draft'

// If 'schedule':
publishDate: string   // YYYY-MM-DD
publishTime: string   // HH:mm
```

---

## CUSTOM FORM FIELDS (Optional)

Custom questions to ask attendees during checkout.

```javascript
customFields: [
  {
    id?: string,
    field_label: string,      // Question text
    field_type: 'text' | 'textarea' | 'dropdown' | 'checkbox',
    field_options?: string[], // For dropdown type
    is_required: boolean,
    display_order: number
  }
]
```

---

## DATABASE FIELD MAPPING

| Frontend Field | Database Column |
|----------------|-----------------|
| `title` | `title` |
| `slug` | `slug` (auto-generated if not unique) |
| `eventType` | `event_type` |
| `category` | `category` |
| `description` | `description` |
| `startDate + startTime` | `start_date` (ISO timestamp) |
| `endDate + endTime` | `end_date` (ISO timestamp) |
| `gateOpeningTime` | `gate_opening_time` |
| `timezone` | `timezone` |
| `isMultiDay` | `is_multi_day` |
| `isRecurring` | `is_recurring` |
| `recurringType` | `recurring_type` |
| `recurringDays` | `recurring_days` (JSONB array) |
| `recurringEndType` | `recurring_end_type` |
| `recurringOccurrences` | `recurring_occurrences` |
| `recurringEndDate` | `recurring_end_date` |
| `venueName` | `venue_name` |
| `venueAddress` | `venue_address` |
| `googleMapLink` | `google_map_link` |
| `venueType` | `venue_type` |
| `seatingType` | `seating_type` |
| `venueCapacity` | `total_capacity` |
| `city` | `city` |
| `country` | `country_code` |
| `venueLat` | `venue_lat` |
| `venueLng` | `venue_lng` |
| `isAdultOnly` | `is_adult_only` |
| `isWheelchairAccessible` | `is_wheelchair_accessible` |
| `isBYOB` | `is_byob` |
| `isPhotographyAllowed` | `is_photography_allowed` |
| `isRecordingAllowed` | `is_recording_allowed` |
| `isParkingAvailable` | `is_parking_available` |
| `isOutsideFoodAllowed` | `is_outside_food_allowed` |
| `dressCode` | `dress_code` |
| `isFree` | `is_free` |
| `acceptsDonations` | `accepts_donations` |
| `donationAmounts` | `donation_amounts` (JSONB array) |
| `allowCustomDonation` | `allow_custom_donation` |
| `donationFeeHandling` | `donation_fee_handling` |
| `maxTicketsPerOrder` | `max_tickets_per_order` |
| `bannerImage` | `image_url` |
| `promoVideoUrl` | `promo_video_url` |
| `feeHandling` | `fee_handling` |
| `isVirtual` | `is_virtual` |
| `streamingUrl` | `streaming_url` |
| `streamingPlatform` | `streaming_platform` |
| `currency` | `currency` |
| `visibility` | `visibility` |
| `accessPassword` | `access_password` |
| `accessSettings` | `access_settings` (JSONB) |
| `allowTransfers` | `allow_transfers` |
| `maxTransfers` | `max_transfers` |
| `transferFee` | `transfer_fee` |
| `notifyOrganizerOnSale` | `notify_organizer_on_sale` |
| `publishOption` | `status` (`published`, `scheduled`, `draft`) |
| `publishDate + publishTime` | `publish_at` |

---

## RELATED DATABASE TABLES

### events (main table)
Primary event data - see field mapping above.

### ticket_types
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id)
name VARCHAR(255) NOT NULL
description TEXT
price DECIMAL(10,2) DEFAULT 0
currency VARCHAR(3)
quantity_available INTEGER NOT NULL
quantity_sold INTEGER DEFAULT 0
is_active BOOLEAN DEFAULT true
sort_order INTEGER DEFAULT 0
is_refundable BOOLEAN DEFAULT true
is_table_ticket BOOLEAN DEFAULT false
seats_per_table INTEGER
min_per_order INTEGER DEFAULT 1
max_per_order INTEGER DEFAULT 10
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### event_speakers
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
role VARCHAR(100)
bio TEXT
image_url TEXT
social_links JSONB DEFAULT '{}'
display_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### event_sponsors
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
name VARCHAR(255)
logo_url TEXT
website_url TEXT
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### event_days (multi-day events)
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
day_number INTEGER NOT NULL
date DATE NOT NULL
start_time TIME
end_time TIME
title VARCHAR(255)
description TEXT
created_at TIMESTAMPTZ
```

### event_day_activities
```sql
id UUID PRIMARY KEY
event_day_id UUID REFERENCES event_days(id) ON DELETE CASCADE
title VARCHAR(255) NOT NULL
start_time TIME
end_time TIME
description TEXT
location VARCHAR(255)
sort_order INTEGER DEFAULT 0
```

### event_custom_fields
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
field_label VARCHAR(255) NOT NULL
field_type VARCHAR(50) NOT NULL  -- text, textarea, dropdown, checkbox
field_options JSONB               -- for dropdown options
is_required BOOLEAN DEFAULT false
display_order INTEGER DEFAULT 0
```

### event_invite_codes (for invite_only visibility)
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
code VARCHAR(50) NOT NULL
name VARCHAR(255)
max_uses INTEGER
times_used INTEGER DEFAULT 0
expires_at TIMESTAMPTZ
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ
```

### event_email_whitelist (for email_whitelist visibility)
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id) ON DELETE CASCADE
email VARCHAR(255) NOT NULL
created_at TIMESTAMPTZ
```

### event_history (audit log)
```sql
id UUID PRIMARY KEY
event_id UUID REFERENCES events(id)
changed_by UUID REFERENCES auth.users(id)
change_type VARCHAR(50)  -- created, updated, deleted
previous_data JSONB
new_data JSONB
changed_fields TEXT[]
created_at TIMESTAMPTZ
```

---

## BUSINESS LOGIC SUMMARY

### 1. Slug Generation
- Auto-generated from title: lowercase, replace spaces/special chars with `-`
- Made unique by appending `-2`, `-3`, etc. if slug exists
- Max length: 50 characters for base, 100 for child events

### 2. Recurring Events
- Creates parent event first
- Generates child events with `parent_event_id` reference
- Child events get slug: `{parent-slug}-{YYYY-MM-DD}`
- Each child gets its own ticket_types (copied from parent)
- Child events have `is_recurring = false`

### 3. Multi-day Events
- Parent event `start_date` = first day, `end_date` = last day's end
- Days stored in `event_days` table
- Activities stored in `event_day_activities` table
- Cannot combine with recurring events

### 4. Image Upload
- Storage bucket: `event-images`
- Path format: `{organizer_id}/{timestamp}.{ext}`
- Speaker images: `{event_id}/speakers/{timestamp}.{ext}`
- Sponsor logos: `{event_id}/sponsor_{index}_{timestamp}.{ext}`

### 5. Currency → Payment Provider Mapping
| Currency | Payment Provider |
|----------|------------------|
| NGN, GHS | Paystack |
| USD, GBP, CAD, EUR | Stripe |
| KES, ZAR | Flutterwave |

### 6. Fee Handling
- `absorb`: Organizer pays platform fees (deducted from payout)
- `pass_to_attendee`: Buyer pays fees on top of ticket price

### 7. Event Status Flow
```
draft → published
draft → scheduled → published (auto on publish_at)
published → cancelled
```

### 8. Email Notifications
- On event publish: Email sent to organizer
- On each sale (if `notify_organizer_on_sale = true`): Email to organizer

### 9. Edit Mode Logic
- Load existing data from database
- Track `dbId` for existing tickets/speakers
- Update existing records, insert new ones
- Log changes to `event_history` table

---

## API ENDPOINTS (Supabase)

### Tables (via Supabase client)
```javascript
supabase.from('events').insert/update/select
supabase.from('ticket_types').insert/update/select
supabase.from('event_speakers').insert/update/delete
supabase.from('event_sponsors').insert/delete
supabase.from('event_days').insert/delete
supabase.from('event_day_activities').insert
supabase.from('event_custom_fields').insert/delete
supabase.from('event_invite_codes').insert
supabase.from('event_email_whitelist').insert
supabase.from('event_history').insert
```

### Storage (for images)
```javascript
supabase.storage.from('event-images').upload(path, file)
supabase.storage.from('event-images').getPublicUrl(path)
```

### Edge Functions
```javascript
supabase.functions.invoke('send-email', { body: {...} })
supabase.functions.invoke('ai-compose', { body: {...} })  // AI description
```

---

## COMPLETE FORM STATE TEMPLATE

```javascript
const initialFormData = {
  // Event Details
  title: '',
  slug: '',
  eventType: '',
  category: '',
  description: '',
  visibility: 'public',
  accessPassword: '',
  accessSettings: {},

  // Date & Time
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  gateOpeningTime: '',
  timezone: 'Africa/Lagos',
  isMultiDay: false,
  eventDays: [],
  isRecurring: false,
  recurringType: 'weekly',
  recurringDays: [],
  recurringEndType: 'occurrences',
  recurringOccurrences: 4,
  recurringEndDate: '',

  // Venue
  venueName: '',
  venueAddress: '',
  googleMapLink: '',
  venueType: 'indoor',
  venueCapacity: '',
  seatingType: 'Seated',
  city: '',
  country: '',
  venueLat: null,
  venueLng: null,
  isVirtual: false,
  streamingUrl: '',
  streamingPlatform: '',
  isAdultOnly: false,
  isWheelchairAccessible: false,
  isBYOB: false,
  isPhotographyAllowed: true,
  isRecordingAllowed: true,
  isParkingAvailable: false,
  isOutsideFoodAllowed: false,
  dressCode: '',

  // Ticketing
  currency: '',
  isFree: false,
  acceptsDonations: false,
  donationAmounts: [500, 1000, 2500],
  allowCustomDonation: true,
  donationFeeHandling: 'absorb',
  feeHandling: 'pass_to_attendee',
  maxTicketsPerOrder: 10,
  allowTransfers: false,
  maxTransfers: 2,
  transferFee: 0,
  notifyOrganizerOnSale: true,

  // Media
  promoVideoUrl: '',

  // Custom Fields
  customFields: [],

  // Publishing
  publishOption: 'now',
  publishDate: '',
  publishTime: '',

  // Terms
  agreedToTerms: false,
};

const initialTickets = [
  { id: 1, name: '', price: '', quantity: '', description: '', isRefundable: true }
];

const initialSpeakers = [];

const initialSponsorLogos = [];
```

---

## VALIDATION SUMMARY BY TAB

### Details Tab
- [x] title: required, valid characters
- [x] slug: required, min 3 chars, unique
- [x] eventType: required
- [x] category: required
- [x] description: required, min 25 chars
- [x] accessPassword: required if visibility='password'

### DateTime Tab
- [x] startDate: required
- [x] startTime: required
- [x] endTime: required
- [x] endDate: required (unless recurring/multi-day)
- [x] isMultiDay + isRecurring: cannot both be true
- [x] endDate >= startDate
- [x] gateOpeningTime < startTime

### Venue Tab
- [x] venueAddress: required (unless isVirtual)

### Ticketing Tab
- [x] currency: required (unless isFree)
- [x] At least 1 valid ticket (unless isFree)
- [x] Each ticket: name required, quantity > 0, price > 0 (if paid)

### Speakers Tab
- [x] Optional tab - no validation to proceed
- [x] If adding speaker: name required

### Media Tab
- [x] bannerImage: required
