-- Add bajideace@gmail.com as a promoter
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    v_organizer_id UUID;
    v_user_id UUID;
    v_promo_code TEXT;
BEGIN
    -- Get the first organizer (or you can specify a specific one)
    SELECT id INTO v_organizer_id FROM organizers LIMIT 1;

    IF v_organizer_id IS NULL THEN
        RAISE EXCEPTION 'No organizers found in the database';
    END IF;

    -- Check if user exists with this email
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'bajideace@gmail.com';

    -- Generate a unique promo code
    v_promo_code := 'BAJI' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Check if promoter already exists
    IF EXISTS (SELECT 1 FROM promoters WHERE email = 'bajideace@gmail.com') THEN
        -- Update existing promoter to active
        UPDATE promoters
        SET status = 'active',
            is_active = true,
            user_id = COALESCE(user_id, v_user_id),
            updated_at = NOW()
        WHERE email = 'bajideace@gmail.com';

        RAISE NOTICE 'Promoter already exists - updated to active status';
    ELSE
        -- Insert new promoter
        INSERT INTO promoters (
            organizer_id,
            user_id,
            email,
            name,
            full_name,
            short_code,
            referral_code,
            commission_type,
            commission_value,
            commission_rate,
            status,
            is_active,
            total_clicks,
            total_sales,
            total_revenue,
            total_commission,
            paid_commission,
            total_earned,
            total_paid,
            created_at,
            updated_at
        ) VALUES (
            v_organizer_id,
            v_user_id,
            'bajideace@gmail.com',
            'Bajide',
            'Bajide Ace',
            v_promo_code,
            v_promo_code,
            'percentage',
            10,  -- 10% commission
            10,
            'active',
            true,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Promoter created with code: %', v_promo_code;
    END IF;
END $$;

-- Show the created/updated promoter
SELECT id, email, short_code, referral_code, commission_type, commission_value, status, is_active
FROM promoters
WHERE email = 'bajideace@gmail.com';
