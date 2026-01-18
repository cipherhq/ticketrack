# Comprehensive Test Bot - Usage Guide

## Issue: Service Role Key Queries

**Problem**: The bot has an issue where the first query to `organizers` table works (RLS verification passes), but subsequent queries fail with "Invalid API key" error. This appears to be a Supabase client issue with service role key persistence.

**Workaround**: Use command-line arguments to provide existing user_id and organizer_id.

## Usage Options

### Option 1: Use Existing IDs via Command-Line Arguments

```bash
# Provide user_id and organizer_id from your database
npm run test:comprehensive -- --user-id=YOUR_USER_ID --organizer-id=YOUR_ORGANIZER_ID

# Example:
npm run test:comprehensive -- --user-id=123e4567-e89b-12d3-a456-426614174000 --organizer-id=987fcdeb-51a2-43d1-b789-123456789abc
```

### Option 2: Create Test Accounts First

1. **Create a user account** in your app (via signup page)
2. **Create an organizer account** in your app (via organizer setup)
3. **Get the IDs** from Supabase dashboard or your database
4. **Run the bot** with those IDs

### Option 3: Use Database Directly

If you have access to the database:

```sql
-- Get an existing user_id and organizer_id
SELECT id, email FROM profiles LIMIT 1;
SELECT id, user_id, business_name FROM organizers WHERE user_id IS NOT NULL LIMIT 1;

-- Then use those IDs in the bot command
```

## Getting IDs from Supabase Dashboard

1. Go to **Table Editor** → `profiles` table
2. Copy a `id` (user_id) 
3. Go to **Table Editor** → `organizers` table  
4. Find an organizer with that `user_id`
5. Copy the organizer `id`

Then run:
```bash
npm run test:comprehensive -- --user-id=<user_id> --organizer-id=<organizer_id>
```

## What the Bot Tests

Once you provide the IDs, the bot will test:

1. ✅ User Account (uses provided ID)
2. ✅ Organizer Account Creation  
3. ✅ Single Event Creation
4. ✅ Recurring Event Creation
5. ✅ Ticket Type Creation
6. ✅ Order Creation
7. ✅ Ticket Creation
8. ✅ Promo Code Creation
9. ✅ Waitlist Entry Creation
10. ✅ Payout Calculation
11. ✅ Free Event Creation
12. ✅ Custom Fields Creation
13. ✅ Refund Flow

## Expected Output

Once IDs are provided, you should see:
```
✅ [PASS] Create User Account: Using provided user_id
✅ [PASS] Create Organizer Account: ...
✅ [PASS] Create Single Event: ...
... (all tests should pass)
```

## Troubleshooting

### "Invalid API key" Errors
- This is a known issue with Supabase client and service role keys
- **Solution**: Use command-line arguments to bypass user lookup queries

### "No existing users/organizers found"
- **Solution**: Create accounts in the app first, or provide IDs via command-line

### RLS Verification Passes but Queries Fail
- This is the service role key query issue
- **Solution**: Use command-line arguments to provide existing IDs
