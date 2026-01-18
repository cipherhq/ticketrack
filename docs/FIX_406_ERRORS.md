# Fixing 406 Errors for saved_events and followers

## Problem

You're seeing `406 (Not Acceptable)` errors in the Network tab for:
- `saved_events?select=id&user_id=eq...`
- `followers?select=id&user_id=eq...`

A 406 error means the server cannot produce a response matching the request's Accept headers. This is often caused by:
1. RLS policies blocking the request
2. Missing or incorrect query parameters
3. Supabase client header issues

## Root Cause

The queries in `OrganizerPublicProfile.jsx` and `WebEventDetails.jsx` are trying to check if a user has saved/followed, but when the user is **not logged in**, these queries fail with 406 because:
- The queries use `.eq('user_id', user.id)` but `user` is `null`
- RLS policies may be blocking unauthenticated requests
- The queries should gracefully handle the case when `user` is null

## Solution

### Fix 1: Add Null Checks Before Queries

Update the queries to only run when `user` exists:

**In `OrganizerPublicProfile.jsx`:**

```javascript
// Check if user is following the organizer
useEffect(() => {
  async function checkIfFollowing() {
    // ✅ Add this check
    if (!user || !id) return;
    
    try {
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('user_id', user.id)
        .eq('organizer_id', id)
        .single()
      
      setIsFollowing(!!data)
    } catch (err) {
      // Not following - that's fine
      setIsFollowing(false)
    }
  }
  
  checkIfFollowing()
}, [user, id])
```

**In `WebEventDetails.jsx`:**

```javascript
// Check if user has saved this event
useEffect(() => {
  async function checkIfSaved() {
    // ✅ Add this check
    if (!user || !event) return;
    
    try {
      const { data, error } = await supabase
        .from('saved_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', event.id)
        .single()
      
      if (data && !error) {
        setIsFavorite(true)
      } else {
        setIsFavorite(false)
      }
    } catch (err) {
      // Not saved - that's fine
      setIsFavorite(false)
    }
  }
  
  checkIfSaved()
}, [user, event])

// Check if user is following the organizer
useEffect(() => {
  async function checkIfFollowing() {
    // ✅ Add this check
    if (!user || !event?.organizer?.id) return;
    
    try {
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('user_id', user.id)
        .eq('organizer_id', event.organizer.id)
        .single()
      
      setIsFollowing(!!data)
    } catch (err) {
      // Not following - that's fine
      setIsFollowing(false)
    }
  }
  
  checkIfFollowing()
}, [user, event?.organizer?.id])
```

### Fix 2: Update RLS Policies (If Needed)

If RLS policies are too restrictive, you may need to allow unauthenticated reads for checking follow/save status. However, this is **not recommended** for security reasons. Instead, ensure queries only run when authenticated.

### Fix 3: Use Optional Chaining in Queries

For the followers count query in `OrganizerPublicProfile.jsx`:

```javascript
// This query should work even without auth (public count)
const { count: followCount } = await supabase
  .from('followers')
  .select('*', { count: 'exact', head: true })
  .eq('organizer_id', id)

setFollowersCount(followCount || 0)
```

This should work because it's just counting, not filtering by `user_id`. If it still returns 406, check your RLS policy for the `followers` table.

## Verification

After applying the fixes:

1. **Open DevTools → Network tab**
2. **Clear the network log**
3. **Refresh the page**
4. **Check for 406 errors**:
   - ✅ Should see no 406 errors when not logged in
   - ✅ Should see successful requests when logged in
   - ✅ Follow/Save buttons should work correctly

## Expected Behavior

- **Not logged in**: No queries to `saved_events` or `followers` with `user_id` filter
- **Logged in**: Queries run successfully, buttons show correct state
- **Public follower count**: Always works (doesn't require auth)

## Additional Notes

The 406 error is likely happening because:
1. The Supabase client is trying to make a request with `user_id=eq.null` or similar
2. RLS policies are rejecting the request
3. Supabase returns 406 instead of 401/403 in some cases

The fix ensures queries only run when we have a valid `user.id`, preventing these errors.
