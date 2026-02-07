-- =====================================================
-- INVOICE GENERATION - Database Schema
-- Generate PDF earnings statements for organizers
-- =====================================================

-- Main invoices table
CREATE TABLE IF NOT EXISTS organizer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,

  -- Invoice identification
  invoice_number VARCHAR(50) UNIQUE,
  invoice_type VARCHAR(30) DEFAULT 'earnings' CHECK (invoice_type IN (
    'earnings',        -- Regular earnings statement
    'payout',          -- Payout receipt
    'commission',      -- Commission statement (for promoters)
    'credit_note',     -- Credit note for refunds
    'fee_invoice'      -- Platform fee invoice
  )),

  -- Period
  period_start DATE,
  period_end DATE,

  -- Financial summary
  gross_sales DECIMAL(15,2) DEFAULT 0,
  ticket_sales DECIMAL(15,2) DEFAULT 0,
  donations DECIMAL(15,2) DEFAULT 0,
  other_revenue DECIMAL(15,2) DEFAULT 0,

  -- Deductions
  platform_fees DECIMAL(15,2) DEFAULT 0,
  payment_processing_fees DECIMAL(15,2) DEFAULT 0,
  refunds DECIMAL(15,2) DEFAULT 0,
  chargebacks DECIMAL(15,2) DEFAULT 0,
  promoter_commissions DECIMAL(15,2) DEFAULT 0,
  affiliate_commissions DECIMAL(15,2) DEFAULT 0,

  -- Net
  net_earnings DECIMAL(15,2) GENERATED ALWAYS AS (
    gross_sales - platform_fees - payment_processing_fees - refunds - chargebacks - promoter_commissions - affiliate_commissions
  ) STORED,

  -- Payout info
  payout_id UUID,
  payout_amount DECIMAL(15,2),
  payout_date DATE,
  payout_reference VARCHAR(100),

  -- Currency
  currency VARCHAR(3) NOT NULL,

  -- PDF
  pdf_path TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Being generated
    'generated',       -- PDF ready
    'sent',            -- Sent to organizer
    'viewed',          -- Organizer has viewed
    'downloaded'       -- Organizer downloaded
  )),

  -- Delivery
  sent_at TIMESTAMPTZ,
  sent_to_email VARCHAR(255),

  -- Event summary (if event-specific invoice)
  event_id UUID REFERENCES events(id),
  event_summary JSONB DEFAULT '[]', -- Array of {event_id, title, sales, fees}

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES organizer_invoices(id) ON DELETE CASCADE,

  -- Line item details
  line_type VARCHAR(30) NOT NULL CHECK (line_type IN (
    'ticket_sale',
    'donation',
    'platform_fee',
    'processing_fee',
    'refund',
    'chargeback',
    'commission',
    'payout',
    'adjustment',
    'other'
  )),
  description TEXT NOT NULL,

  -- Amounts
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2),
  amount DECIMAL(15,2) NOT NULL,
  is_deduction BOOLEAN DEFAULT FALSE,

  -- References
  event_id UUID REFERENCES events(id),
  order_id UUID REFERENCES orders(id),

  -- Sorting
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice templates
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  template_type VARCHAR(30) NOT NULL,

  -- Template content
  header_html TEXT,
  body_html TEXT,
  footer_html TEXT,
  css TEXT,

  -- Branding
  logo_path TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),

  -- Settings
  show_event_breakdown BOOLEAN DEFAULT TRUE,
  show_order_details BOOLEAN DEFAULT FALSE,
  include_tax_info BOOLEAN DEFAULT FALSE,

  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice generation queue
CREATE TABLE IF NOT EXISTS invoice_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id),

  -- What to generate
  invoice_type VARCHAR(30) NOT NULL,
  period_start DATE,
  period_end DATE,
  event_id UUID REFERENCES events(id),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed'
  )),

  -- Result
  invoice_id UUID REFERENCES organizer_invoices(id),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_invoices_organizer ON organizer_invoices(organizer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON organizer_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON organizer_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON organizer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON organizer_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON organizer_invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON organizer_invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON invoice_line_items(line_type);

CREATE INDEX IF NOT EXISTS idx_invoice_queue_status ON invoice_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_invoice_queue_organizer ON invoice_generation_queue(organizer_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE organizer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_generation_queue ENABLE ROW LEVEL SECURITY;

-- Organizers can view their invoices
CREATE POLICY "Organizers view own invoices" ON organizer_invoices
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can view their invoice line items
CREATE POLICY "Organizers view own invoice items" ON invoice_line_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM organizer_invoices WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access
CREATE POLICY "Service role manages invoices" ON organizer_invoices
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages invoice items" ON invoice_line_items
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages templates" ON invoice_templates
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages invoice queue" ON invoice_generation_queue
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_organizer_id UUID,
  p_invoice_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_year VARCHAR;
  v_sequence INTEGER;
  v_invoice_number VARCHAR;
BEGIN
  -- Determine prefix
  v_prefix := CASE p_invoice_type
    WHEN 'earnings' THEN 'INV'
    WHEN 'payout' THEN 'PAY'
    WHEN 'commission' THEN 'COM'
    WHEN 'credit_note' THEN 'CRN'
    WHEN 'fee_invoice' THEN 'FEE'
    ELSE 'INV'
  END;

  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Get next sequence for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 9 FOR 6) AS INTEGER)
  ), 0) + 1 INTO v_sequence
  FROM organizer_invoices
  WHERE invoice_number LIKE v_prefix || v_year || '%';

  v_invoice_number := v_prefix || v_year || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Queue invoice generation
CREATE OR REPLACE FUNCTION queue_invoice_generation(
  p_organizer_id UUID,
  p_invoice_type VARCHAR,
  p_period_start DATE,
  p_period_end DATE,
  p_event_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO invoice_generation_queue (
    organizer_id, invoice_type, period_start, period_end, event_id
  ) VALUES (
    p_organizer_id, p_invoice_type, p_period_start, p_period_end, p_event_id
  )
  RETURNING id INTO v_queue_id;

  RETURN json_build_object('success', true, 'queue_id', v_queue_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate earnings invoice
CREATE OR REPLACE FUNCTION generate_earnings_invoice(
  p_organizer_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_event_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_organizer RECORD;
  v_invoice_id UUID;
  v_invoice_number VARCHAR;
  v_gross_sales DECIMAL := 0;
  v_ticket_sales DECIMAL := 0;
  v_donations DECIMAL := 0;
  v_platform_fees DECIMAL := 0;
  v_processing_fees DECIMAL := 0;
  v_refunds DECIMAL := 0;
  v_chargebacks DECIMAL := 0;
  v_promoter_comm DECIMAL := 0;
  v_affiliate_comm DECIMAL := 0;
  v_currency VARCHAR;
  v_event_summary JSONB := '[]'::JSONB;
BEGIN
  -- Get organizer
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  IF v_organizer IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Organizer not found');
  END IF;

  -- Get currency
  v_currency := COALESCE(v_organizer.payout_currency, 'NGN');

  -- Calculate totals from orders
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(CASE WHEN is_donation THEN 0 ELSE total_amount END), 0),
    COALESCE(SUM(CASE WHEN is_donation THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(platform_fee), 0)
  INTO v_gross_sales, v_ticket_sales, v_donations, v_platform_fees
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE e.organizer_id = p_organizer_id
    AND o.status = 'completed'
    AND o.paid_at::DATE BETWEEN p_period_start AND p_period_end
    AND (p_event_id IS NULL OR o.event_id = p_event_id)
    AND o.currency = v_currency;

  -- Get refunds
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_refunds
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE e.organizer_id = p_organizer_id
    AND o.status = 'refunded'
    AND o.refunded_at::DATE BETWEEN p_period_start AND p_period_end
    AND (p_event_id IS NULL OR o.event_id = p_event_id)
    AND o.currency = v_currency;

  -- Get chargebacks
  SELECT COALESCE(SUM(disputed_amount), 0) INTO v_chargebacks
  FROM chargebacks
  WHERE organizer_id = p_organizer_id
    AND opened_at::DATE BETWEEN p_period_start AND p_period_end
    AND status = 'lost'
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND currency = v_currency;

  -- Get promoter commissions
  SELECT COALESCE(SUM(ps.commission_amount), 0) INTO v_promoter_comm
  FROM promoter_sales ps
  JOIN events e ON e.id = ps.event_id
  WHERE e.organizer_id = p_organizer_id
    AND ps.created_at::DATE BETWEEN p_period_start AND p_period_end
    AND (p_event_id IS NULL OR ps.event_id = p_event_id);

  -- Get affiliate commissions
  SELECT COALESCE(SUM(ac.commission_amount), 0) INTO v_affiliate_comm
  FROM affiliate_commissions ac
  JOIN orders o ON o.id = ac.order_id
  JOIN events e ON e.id = o.event_id
  WHERE e.organizer_id = p_organizer_id
    AND ac.created_at::DATE BETWEEN p_period_start AND p_period_end
    AND (p_event_id IS NULL OR o.event_id = p_event_id);

  -- Build event summary
  SELECT json_agg(event_data) INTO v_event_summary FROM (
    SELECT json_build_object(
      'event_id', e.id,
      'title', e.title,
      'sales', SUM(o.total_amount),
      'orders', COUNT(o.id),
      'fees', SUM(o.platform_fee)
    ) as event_data
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE e.organizer_id = p_organizer_id
      AND o.status = 'completed'
      AND o.paid_at::DATE BETWEEN p_period_start AND p_period_end
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
    GROUP BY e.id, e.title
  ) subq;

  -- Generate invoice number
  v_invoice_number := generate_invoice_number(p_organizer_id, 'earnings');

  -- Create invoice
  INSERT INTO organizer_invoices (
    organizer_id, invoice_number, invoice_type,
    period_start, period_end,
    gross_sales, ticket_sales, donations,
    platform_fees, payment_processing_fees, refunds, chargebacks,
    promoter_commissions, affiliate_commissions,
    currency, event_id, event_summary, status
  ) VALUES (
    p_organizer_id, v_invoice_number, 'earnings',
    p_period_start, p_period_end,
    v_gross_sales, v_ticket_sales, v_donations,
    v_platform_fees, v_processing_fees, v_refunds, v_chargebacks,
    v_promoter_comm, v_affiliate_comm,
    v_currency, p_event_id, v_event_summary, 'draft'
  )
  RETURNING id INTO v_invoice_id;

  -- Add line items
  -- Ticket sales
  IF v_ticket_sales > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, sort_order)
    VALUES (v_invoice_id, 'ticket_sale', 'Ticket Sales', v_ticket_sales, 1);
  END IF;

  -- Donations
  IF v_donations > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, sort_order)
    VALUES (v_invoice_id, 'donation', 'Donations', v_donations, 2);
  END IF;

  -- Platform fees
  IF v_platform_fees > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, is_deduction, sort_order)
    VALUES (v_invoice_id, 'platform_fee', 'Platform Service Fees', v_platform_fees, true, 10);
  END IF;

  -- Refunds
  IF v_refunds > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, is_deduction, sort_order)
    VALUES (v_invoice_id, 'refund', 'Refunds Issued', v_refunds, true, 11);
  END IF;

  -- Chargebacks
  IF v_chargebacks > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, is_deduction, sort_order)
    VALUES (v_invoice_id, 'chargeback', 'Chargebacks (Lost)', v_chargebacks, true, 12);
  END IF;

  -- Promoter commissions
  IF v_promoter_comm > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, is_deduction, sort_order)
    VALUES (v_invoice_id, 'commission', 'Promoter Commissions', v_promoter_comm, true, 13);
  END IF;

  -- Affiliate commissions
  IF v_affiliate_comm > 0 THEN
    INSERT INTO invoice_line_items (invoice_id, line_type, description, amount, is_deduction, sort_order)
    VALUES (v_invoice_id, 'commission', 'Affiliate Commissions', v_affiliate_comm, true, 14);
  END IF;

  -- Update status to generated
  UPDATE organizer_invoices SET status = 'generated' WHERE id = v_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'gross_sales', v_gross_sales,
    'net_earnings', v_gross_sales - v_platform_fees - v_refunds - v_chargebacks - v_promoter_comm - v_affiliate_comm
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark invoice as sent
CREATE OR REPLACE FUNCTION mark_invoice_sent(
  p_invoice_id UUID,
  p_email VARCHAR
)
RETURNS VOID AS $$
BEGIN
  UPDATE organizer_invoices SET
    status = 'sent',
    sent_at = NOW(),
    sent_to_email = p_email,
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON organizer_invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default invoice template
INSERT INTO invoice_templates (name, template_type, header_html, body_html, footer_html, is_default)
VALUES (
  'Default Earnings Statement',
  'earnings',
  '<div class="header"><h1>Earnings Statement</h1></div>',
  '<div class="body">{{content}}</div>',
  '<div class="footer"><p>Generated by Ticketrack</p></div>',
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION generate_invoice_number TO service_role;
GRANT EXECUTE ON FUNCTION queue_invoice_generation TO service_role;
GRANT EXECUTE ON FUNCTION generate_earnings_invoice TO service_role;
GRANT EXECUTE ON FUNCTION mark_invoice_sent TO service_role;
