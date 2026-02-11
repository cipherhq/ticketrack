-- RLS Policies for refund_requests table
-- Ensures organizers can create and manage refund requests for their events

-- Enable RLS (idempotent)
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Allow organizers to SELECT their own refund requests
DROP POLICY IF EXISTS "Organizers can view own refund requests" ON public.refund_requests;
CREATE POLICY "Organizers can view own refund requests"
  ON public.refund_requests FOR SELECT
  USING (
    organizer_id IN (
      SELECT id FROM public.organizers WHERE user_id = auth.uid()
    )
  );

-- Allow organizers to INSERT refund requests for their events
DROP POLICY IF EXISTS "Organizers can create refund requests" ON public.refund_requests;
CREATE POLICY "Organizers can create refund requests"
  ON public.refund_requests FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT id FROM public.organizers WHERE user_id = auth.uid()
    )
  );

-- Allow organizers to UPDATE their own refund requests (approve/reject)
DROP POLICY IF EXISTS "Organizers can update own refund requests" ON public.refund_requests;
CREATE POLICY "Organizers can update own refund requests"
  ON public.refund_requests FOR UPDATE
  USING (
    organizer_id IN (
      SELECT id FROM public.organizers WHERE user_id = auth.uid()
    )
  );

-- Allow users to view their own refund requests (as attendees)
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;
CREATE POLICY "Users can view own refund requests"
  ON public.refund_requests FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to create refund requests for their own orders
DROP POLICY IF EXISTS "Users can create own refund requests" ON public.refund_requests;
CREATE POLICY "Users can create own refund requests"
  ON public.refund_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
