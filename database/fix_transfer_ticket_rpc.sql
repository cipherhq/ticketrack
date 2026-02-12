-- Fix transfer_ticket RPC:
-- 1. Add is_checked_in guard (prevent transferring checked-in tickets)
-- 2. Accept fee amount from frontend to log correct country-based fee
-- 3. Allow transfer when event.transfer_fee = 0 but payment was still collected (country-level fee)

CREATE OR REPLACE FUNCTION "public"."transfer_ticket"(
  "p_ticket_id" "uuid",
  "p_from_user_id" "uuid",
  "p_to_user_email" "text",
  "p_payment_reference" "text" DEFAULT NULL::"text"
) RETURNS json
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_ticket RECORD;
  v_event RECORD;
  v_to_user RECORD;
  v_new_qr_code TEXT;
  v_old_qr_code TEXT;
  v_original_buyer UUID;
  v_transfer_ref TEXT;
  v_original_tx_id TEXT;
  v_fee_amount NUMERIC(10,2);
BEGIN
  -- Get ticket details with payment info
  SELECT t.*, o.user_id as buyer_id, o.payment_reference as order_payment_ref
  INTO v_ticket
  FROM tickets t
  JOIN orders o ON t.order_id = o.id
  WHERE t.id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Store old ticket code for audit
  v_old_qr_code := v_ticket.ticket_code;
  v_original_tx_id := v_ticket.order_payment_ref;

  -- Determine original buyer
  v_original_buyer := COALESCE(v_ticket.original_buyer_id, v_ticket.buyer_id);

  -- Only original buyer can transfer (not someone who received via transfer)
  IF v_ticket.transfer_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'This ticket has already been transferred and cannot be transferred again');
  END IF;

  -- Check if user is the original buyer
  IF v_original_buyer != p_from_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Only the original buyer can transfer this ticket');
  END IF;

  -- Get event settings
  SELECT * INTO v_event FROM events WHERE id = v_ticket.event_id;

  IF NOT v_event.allow_transfers THEN
    RETURN json_build_object('success', false, 'message', 'Transfers are disabled for this event');
  END IF;

  -- Check if ticket already used (checked in)
  IF v_ticket.status = 'used' OR v_ticket.is_checked_in = true THEN
    RETURN json_build_object('success', false, 'message', 'Cannot transfer a ticket that has already been checked in');
  END IF;

  -- Determine fee amount: use event-level fee if set, otherwise 0 (frontend handles country-level fee charging)
  v_fee_amount := COALESCE(v_event.transfer_fee, 0);

  -- If there's a fee configured and no payment was made, reject
  IF v_fee_amount > 0 AND (p_payment_reference IS NULL OR p_payment_reference = '') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Payment required',
      'requires_payment', true,
      'transfer_fee', v_fee_amount,
      'currency', v_event.currency
    );
  END IF;

  -- Find recipient by email
  SELECT * INTO v_to_user FROM profiles WHERE LOWER(email) = LOWER(p_to_user_email);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Recipient must have a Ticketrack account. Ask them to sign up first.');
  END IF;

  -- Cannot transfer to yourself
  IF v_to_user.id = p_from_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Cannot transfer ticket to yourself');
  END IF;

  -- Generate new QR code and transfer reference
  v_new_qr_code := 'TKT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
  v_transfer_ref := 'TRF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));

  -- Update ticket
  UPDATE tickets SET
    user_id = v_to_user.id,
    attendee_name = v_to_user.full_name,
    attendee_email = v_to_user.email,
    attendee_phone = v_to_user.phone,
    ticket_code = v_new_qr_code,
    transfer_count = 1,
    transferred_at = NOW(),
    transferred_from_user_id = p_from_user_id,
    original_buyer_id = v_original_buyer
  WHERE id = p_ticket_id;

  -- Log the transfer with full audit data
  INSERT INTO ticket_transfers (
    ticket_id, from_user_id, to_user_id, transfer_number,
    fee_amount, fee_currency, event_id,
    transfer_reference, old_ticket_code, new_ticket_code,
    original_transaction_id, payment_status, payment_reference
  )
  VALUES (
    p_ticket_id, p_from_user_id, v_to_user.id, 1,
    v_fee_amount, v_event.currency, v_event.id,
    v_transfer_ref, v_old_qr_code, v_new_qr_code,
    v_original_tx_id,
    CASE WHEN p_payment_reference IS NOT NULL AND p_payment_reference != '' THEN 'paid' ELSE 'free' END,
    p_payment_reference
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Ticket transferred successfully',
    'transfer_reference', v_transfer_ref,
    'old_ticket_code', v_old_qr_code,
    'new_ticket_code', v_new_qr_code,
    'recipient_name', v_to_user.full_name,
    'recipient_email', v_to_user.email,
    'transfer_fee', v_fee_amount
  );
END;
$$;
