-- =====================================================
-- EXPENSE TRACKING - Database Schema
-- Track platform operational expenses
-- =====================================================

-- Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES expense_categories(id),
  budget_limit DECIMAL(15,2),
  budget_period VARCHAR(20) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main expenses table
CREATE TABLE IF NOT EXISTS platform_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorization
  category_id UUID REFERENCES expense_categories(id),
  category VARCHAR(50),
  subcategory VARCHAR(50),

  -- Description
  description TEXT NOT NULL,
  detailed_notes TEXT,

  -- Financial
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0)) STORED,

  -- Date
  expense_date DATE NOT NULL,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(20), -- daily, weekly, monthly, yearly
  recurrence_end_date DATE,
  parent_expense_id UUID REFERENCES platform_expenses(id), -- For recurring instances

  -- Vendor info
  vendor VARCHAR(100),
  vendor_contact VARCHAR(100),
  vendor_reference VARCHAR(100),

  -- Payment
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  paid_at TIMESTAMPTZ,

  -- Receipt/documentation
  receipt_path TEXT,
  receipt_number VARCHAR(100),
  supporting_docs JSONB DEFAULT '[]',

  -- Approval
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Awaiting approval
    'approved',       -- Approved
    'rejected',       -- Rejected
    'paid',           -- Paid
    'cancelled'       -- Cancelled
  )),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Cost allocation
  cost_center VARCHAR(50),
  project_id UUID,
  event_id UUID REFERENCES events(id), -- If expense is event-specific
  allocations JSONB DEFAULT '[]', -- For split allocations

  -- Metadata
  tags TEXT[],
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense budgets
CREATE TABLE IF NOT EXISTS expense_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Budget scope
  category_id UUID REFERENCES expense_categories(id),
  cost_center VARCHAR(50),
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
    'monthly', 'quarterly', 'yearly'
  )),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  budget_amount DECIMAL(15,2) NOT NULL,
  spent_amount DECIMAL(15,2) DEFAULT 0,
  remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (budget_amount - spent_amount) STORED,

  -- Alerts
  warning_threshold DECIMAL(5,2) DEFAULT 80, -- Percentage
  alert_sent BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(category_id, cost_center, currency, period_start)
);

-- Expense reports
CREATE TABLE IF NOT EXISTS expense_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report info
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) DEFAULT 'standard',

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Totals
  total_expenses DECIMAL(15,2) DEFAULT 0,
  total_by_category JSONB DEFAULT '{}',
  currency VARCHAR(3) DEFAULT 'NGN',

  -- Comparison
  previous_period_total DECIMAL(15,2),
  change_percentage DECIMAL(10,2),

  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),

  -- Export
  pdf_path TEXT,
  csv_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense approval workflow
CREATE TABLE IF NOT EXISTS expense_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  category_id UUID REFERENCES expense_categories(id),
  currency VARCHAR(3),

  -- Threshold
  min_amount DECIMAL(15,2) DEFAULT 0,
  max_amount DECIMAL(15,2),

  -- Approvers
  required_approver_role VARCHAR(50),
  required_approver_id UUID REFERENCES auth.users(id),

  -- Settings
  auto_approve BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 1,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_expenses_category ON platform_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON platform_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON platform_expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON platform_expenses(vendor);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON platform_expenses(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center ON platform_expenses(cost_center);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON platform_expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budgets_category ON expense_budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON expense_budgets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON expense_budgets(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_expense_reports_period ON expense_reports(period_start, period_end);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_approval_rules ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages expense categories" ON expense_categories
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages expenses" ON platform_expenses
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages budgets" ON expense_budgets
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages expense reports" ON expense_reports
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages approval rules" ON expense_approval_rules
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Create expense
CREATE OR REPLACE FUNCTION create_expense(
  p_category VARCHAR,
  p_description TEXT,
  p_amount DECIMAL,
  p_currency VARCHAR,
  p_expense_date DATE,
  p_vendor VARCHAR DEFAULT NULL,
  p_is_recurring BOOLEAN DEFAULT FALSE,
  p_recurrence_pattern VARCHAR DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_expense_id UUID;
  v_category_id UUID;
BEGIN
  -- Get or create category
  SELECT id INTO v_category_id FROM expense_categories WHERE name = p_category;

  IF v_category_id IS NULL THEN
    INSERT INTO expense_categories (name) VALUES (p_category)
    RETURNING id INTO v_category_id;
  END IF;

  -- Create expense
  INSERT INTO platform_expenses (
    category_id, category, description, amount, currency,
    expense_date, vendor, is_recurring, recurrence_pattern,
    created_by
  ) VALUES (
    v_category_id, p_category, p_description, p_amount, p_currency,
    p_expense_date, p_vendor, p_is_recurring, p_recurrence_pattern,
    p_created_by
  )
  RETURNING id INTO v_expense_id;

  -- Update budget spent
  PERFORM update_budget_spent(v_category_id, p_currency, p_amount, p_expense_date);

  RETURN json_build_object(
    'success', true,
    'expense_id', v_expense_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update budget spent amount
CREATE OR REPLACE FUNCTION update_budget_spent(
  p_category_id UUID,
  p_currency VARCHAR,
  p_amount DECIMAL,
  p_expense_date DATE
)
RETURNS VOID AS $$
BEGIN
  UPDATE expense_budgets SET
    spent_amount = spent_amount + p_amount,
    updated_at = NOW()
  WHERE category_id = p_category_id
    AND currency = p_currency
    AND p_expense_date BETWEEN period_start AND period_end
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get expense summary
CREATE OR REPLACE FUNCTION get_expense_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_currency VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_expenses', COALESCE(SUM(total_amount), 0),
    'expense_count', COUNT(*),
    'by_category', (
      SELECT json_object_agg(category, cat_data)
      FROM (
        SELECT
          category,
          json_build_object(
            'total', SUM(total_amount),
            'count', COUNT(*)
          ) as cat_data
        FROM platform_expenses
        WHERE expense_date BETWEEN p_start_date AND p_end_date
          AND (p_currency IS NULL OR currency = p_currency)
          AND status IN ('approved', 'paid')
        GROUP BY category
      ) cat_summary
    ),
    'by_vendor', (
      SELECT json_object_agg(vendor, vendor_total)
      FROM (
        SELECT vendor, SUM(total_amount) as vendor_total
        FROM platform_expenses
        WHERE expense_date BETWEEN p_start_date AND p_end_date
          AND (p_currency IS NULL OR currency = p_currency)
          AND status IN ('approved', 'paid')
          AND vendor IS NOT NULL
        GROUP BY vendor
        ORDER BY vendor_total DESC
        LIMIT 10
      ) vendor_summary
    ),
    'by_status', (
      SELECT json_object_agg(status, status_total)
      FROM (
        SELECT status, SUM(total_amount) as status_total
        FROM platform_expenses
        WHERE expense_date BETWEEN p_start_date AND p_end_date
          AND (p_currency IS NULL OR currency = p_currency)
        GROUP BY status
      ) status_summary
    ),
    'daily_trend', (
      SELECT json_agg(daily_data ORDER BY expense_date)
      FROM (
        SELECT expense_date, SUM(total_amount) as daily_total
        FROM platform_expenses
        WHERE expense_date BETWEEN p_start_date AND p_end_date
          AND (p_currency IS NULL OR currency = p_currency)
          AND status IN ('approved', 'paid')
        GROUP BY expense_date
      ) daily_summary
    )
  ) INTO v_result
  FROM platform_expenses
  WHERE expense_date BETWEEN p_start_date AND p_end_date
    AND (p_currency IS NULL OR currency = p_currency)
    AND status IN ('approved', 'paid');

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS JSON AS $$
DECLARE
  v_alerts JSON;
BEGIN
  SELECT json_agg(alert_data) INTO v_alerts
  FROM (
    SELECT
      eb.id,
      ec.name as category,
      eb.budget_amount,
      eb.spent_amount,
      eb.remaining_amount,
      eb.currency,
      ROUND((eb.spent_amount / eb.budget_amount * 100)::NUMERIC, 2) as spent_percentage,
      eb.warning_threshold
    FROM expense_budgets eb
    LEFT JOIN expense_categories ec ON ec.id = eb.category_id
    WHERE eb.is_active = TRUE
      AND CURRENT_DATE BETWEEN eb.period_start AND eb.period_end
      AND (eb.spent_amount / eb.budget_amount * 100) >= eb.warning_threshold
      AND NOT eb.alert_sent
  ) alert_data;

  -- Mark alerts as sent
  UPDATE expense_budgets SET
    alert_sent = TRUE,
    updated_at = NOW()
  WHERE is_active = TRUE
    AND CURRENT_DATE BETWEEN period_start AND period_end
    AND (spent_amount / budget_amount * 100) >= warning_threshold
    AND NOT alert_sent;

  RETURN COALESCE(v_alerts, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate recurring expenses
CREATE OR REPLACE FUNCTION generate_recurring_expenses()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_expense RECORD;
  v_next_date DATE;
BEGIN
  FOR v_expense IN
    SELECT * FROM platform_expenses
    WHERE is_recurring = TRUE
      AND parent_expense_id IS NULL
      AND (recurrence_end_date IS NULL OR recurrence_end_date > CURRENT_DATE)
  LOOP
    -- Calculate next occurrence date
    v_next_date := CASE v_expense.recurrence_pattern
      WHEN 'daily' THEN v_expense.expense_date + INTERVAL '1 day'
      WHEN 'weekly' THEN v_expense.expense_date + INTERVAL '1 week'
      WHEN 'monthly' THEN v_expense.expense_date + INTERVAL '1 month'
      WHEN 'yearly' THEN v_expense.expense_date + INTERVAL '1 year'
    END;

    -- Check if we need to create the next instance
    IF v_next_date <= CURRENT_DATE THEN
      -- Check if instance doesn't already exist
      IF NOT EXISTS (
        SELECT 1 FROM platform_expenses
        WHERE parent_expense_id = v_expense.id
          AND expense_date = v_next_date
      ) THEN
        INSERT INTO platform_expenses (
          category_id, category, subcategory, description, detailed_notes,
          amount, currency, tax_amount, expense_date,
          is_recurring, recurrence_pattern, recurrence_end_date,
          parent_expense_id, vendor, vendor_contact,
          payment_method, cost_center, tags, created_by
        ) VALUES (
          v_expense.category_id, v_expense.category, v_expense.subcategory,
          v_expense.description, v_expense.detailed_notes,
          v_expense.amount, v_expense.currency, v_expense.tax_amount, v_next_date,
          FALSE, NULL, NULL,
          v_expense.id, v_expense.vendor, v_expense.vendor_contact,
          v_expense.payment_method, v_expense.cost_center, v_expense.tags, v_expense.created_by
        );

        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_expense_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON platform_expenses
  FOR EACH ROW EXECUTE FUNCTION update_expense_timestamp();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default expense categories
INSERT INTO expense_categories (name, description, sort_order) VALUES
('Payment Processing', 'Stripe, Paystack, Flutterwave fees', 1),
('Infrastructure', 'Server, hosting, cloud services', 2),
('Software & Tools', 'SaaS subscriptions and licenses', 3),
('Marketing', 'Advertising and promotion', 4),
('Customer Support', 'Support tools and services', 5),
('Legal & Compliance', 'Legal fees, compliance costs', 6),
('Office & Admin', 'Office supplies, admin costs', 7),
('Personnel', 'Salaries, benefits, contractors', 8),
('Communication', 'Email, SMS, messaging services', 9),
('Other', 'Miscellaneous expenses', 99)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION create_expense TO service_role;
GRANT EXECUTE ON FUNCTION update_budget_spent TO service_role;
GRANT EXECUTE ON FUNCTION get_expense_summary TO service_role;
GRANT EXECUTE ON FUNCTION check_budget_alerts TO service_role;
GRANT EXECUTE ON FUNCTION generate_recurring_expenses TO service_role;
