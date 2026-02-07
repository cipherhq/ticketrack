-- =====================================================
-- FINANCE VIEWS - Materialized Views and Reports
-- Revenue forecasting, aging reports, and analytics
-- =====================================================

-- =====================================================
-- PLATFORM P&L VIEWS
-- =====================================================

-- Daily platform metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_daily_metrics AS
SELECT
  DATE(o.created_at) AS metric_date,
  o.currency,
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.user_id) AS unique_buyers,
  SUM(o.total_amount) AS gross_revenue,
  SUM(COALESCE(o.platform_fee, 0)) AS platform_fees,
  SUM(CASE WHEN o.is_donation THEN o.total_amount ELSE 0 END) AS donation_revenue,
  SUM(CASE WHEN NOT COALESCE(o.is_donation, FALSE) THEN o.total_amount ELSE 0 END) AS ticket_revenue,
  SUM(CASE WHEN o.status = 'refunded' THEN o.total_amount ELSE 0 END) AS refunds
FROM orders o
WHERE o.status IN ('completed', 'refunded')
GROUP BY DATE(o.created_at), o.currency
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_daily_metrics_date_currency
ON platform_daily_metrics(metric_date, currency);

-- Weekly platform metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_weekly_metrics AS
SELECT
  DATE_TRUNC('week', o.created_at)::DATE AS week_start,
  o.currency,
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.user_id) AS unique_buyers,
  COUNT(DISTINCT e.organizer_id) AS active_organizers,
  COUNT(DISTINCT o.event_id) AS active_events,
  SUM(o.total_amount) AS gross_revenue,
  SUM(COALESCE(o.platform_fee, 0)) AS platform_fees,
  AVG(o.total_amount) AS avg_order_value
FROM orders o
JOIN events e ON e.id = o.event_id
WHERE o.status IN ('completed', 'refunded')
GROUP BY DATE_TRUNC('week', o.created_at), o.currency
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_weekly_metrics_week_currency
ON platform_weekly_metrics(week_start, currency);

-- Monthly platform metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_monthly_metrics AS
SELECT
  DATE_TRUNC('month', o.created_at)::DATE AS month_start,
  o.currency,
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.user_id) AS unique_buyers,
  COUNT(DISTINCT e.organizer_id) AS active_organizers,
  COUNT(DISTINCT o.event_id) AS active_events,
  SUM(o.total_amount) AS gross_revenue,
  SUM(COALESCE(o.platform_fee, 0)) AS platform_fees,
  SUM(CASE WHEN o.status = 'refunded' THEN o.total_amount ELSE 0 END) AS refunds,
  AVG(o.total_amount) AS avg_order_value
FROM orders o
JOIN events e ON e.id = o.event_id
WHERE o.status IN ('completed', 'refunded')
GROUP BY DATE_TRUNC('month', o.created_at), o.currency
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_monthly_metrics_month_currency
ON platform_monthly_metrics(month_start, currency);

-- =====================================================
-- REVENUE FORECASTING VIEWS
-- =====================================================

-- Upcoming event revenue forecast
CREATE OR REPLACE VIEW revenue_forecast AS
SELECT
  e.id AS event_id,
  e.title,
  e.start_date,
  e.end_date,
  e.organizer_id,
  org.business_name AS organizer_name,
  e.currency,

  -- Current performance
  COALESCE(SUM(tt.quantity_sold), 0) AS tickets_sold,
  COALESCE(SUM(tt.quantity_available), 0) AS total_capacity,
  CASE
    WHEN SUM(tt.quantity_available) > 0
    THEN ROUND((SUM(tt.quantity_sold)::DECIMAL / SUM(tt.quantity_available)::DECIMAL) * 100, 2)
    ELSE 0
  END AS sell_through_rate,

  -- Current revenue
  COALESCE(SUM(tt.quantity_sold * tt.price), 0) AS current_revenue,

  -- Projected revenue (based on historical sell-through for similar events)
  COALESCE(SUM(tt.quantity_sold * tt.price), 0) * 1.3 AS projected_revenue_optimistic,
  COALESCE(SUM(tt.quantity_sold * tt.price), 0) * 1.15 AS projected_revenue_moderate,
  COALESCE(SUM(tt.quantity_sold * tt.price), 0) * 1.0 AS projected_revenue_conservative,

  -- Max potential
  COALESCE(SUM(tt.quantity_available * tt.price), 0) AS max_potential_revenue,

  -- Days until event
  EXTRACT(DAY FROM (e.start_date - NOW())) AS days_until_event,

  -- Platform fee projection
  COALESCE(SUM(tt.quantity_sold * tt.price), 0) * 0.05 AS projected_platform_fees

FROM events e
LEFT JOIN ticket_types tt ON tt.event_id = e.id
LEFT JOIN organizers org ON org.id = e.organizer_id
WHERE e.status = 'published'
  AND e.start_date > NOW()
GROUP BY e.id, e.title, e.start_date, e.end_date, e.organizer_id, org.business_name, e.currency;

-- =====================================================
-- AGING REPORTS VIEWS
-- =====================================================

-- Outstanding payouts aging
CREATE OR REPLACE VIEW outstanding_payouts_aging AS
SELECT
  eb.organizer_id,
  org.business_name AS organizer_name,
  eb.currency,

  -- Total outstanding
  SUM(eb.available_balance) AS total_outstanding,

  -- Aging buckets
  SUM(CASE
    WHEN eb.payout_eligible_at IS NULL OR eb.payout_eligible_at > NOW()
    THEN eb.available_balance
    ELSE 0
  END) AS not_yet_eligible,

  SUM(CASE
    WHEN eb.payout_eligible_at <= NOW() AND eb.payout_eligible_at > NOW() - INTERVAL '7 days'
    THEN eb.available_balance
    ELSE 0
  END) AS aging_0_7_days,

  SUM(CASE
    WHEN eb.payout_eligible_at <= NOW() - INTERVAL '7 days' AND eb.payout_eligible_at > NOW() - INTERVAL '14 days'
    THEN eb.available_balance
    ELSE 0
  END) AS aging_8_14_days,

  SUM(CASE
    WHEN eb.payout_eligible_at <= NOW() - INTERVAL '14 days' AND eb.payout_eligible_at > NOW() - INTERVAL '30 days'
    THEN eb.available_balance
    ELSE 0
  END) AS aging_15_30_days,

  SUM(CASE
    WHEN eb.payout_eligible_at <= NOW() - INTERVAL '30 days'
    THEN eb.available_balance
    ELSE 0
  END) AS aging_30_plus_days,

  -- Status breakdown
  COUNT(CASE WHEN eb.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN eb.status = 'eligible' THEN 1 END) AS eligible_count,
  COUNT(CASE WHEN eb.status = 'hold' THEN 1 END) AS on_hold_count,

  -- Oldest unpaid
  MIN(eb.payout_eligible_at) FILTER (WHERE eb.status = 'eligible') AS oldest_eligible_date

FROM escrow_balances eb
LEFT JOIN organizers org ON org.id = eb.organizer_id
WHERE eb.status IN ('pending', 'eligible', 'hold')
  AND eb.available_balance > 0
GROUP BY eb.organizer_id, org.business_name, eb.currency;

-- Chargeback aging
CREATE OR REPLACE VIEW chargeback_aging AS
SELECT
  organizer_id,
  currency,

  -- Total counts
  COUNT(*) AS total_chargebacks,
  SUM(disputed_amount) AS total_disputed_amount,

  -- Status breakdown
  COUNT(*) FILTER (WHERE status IN ('opened', 'needs_response')) AS needs_attention,
  COUNT(*) FILTER (WHERE status = 'under_review') AS under_review,
  COUNT(*) FILTER (WHERE status = 'won') AS won,
  COUNT(*) FILTER (WHERE status = 'lost') AS lost,

  -- Evidence due aging
  COUNT(*) FILTER (WHERE evidence_due_by < NOW()) AS evidence_overdue,
  COUNT(*) FILTER (WHERE evidence_due_by BETWEEN NOW() AND NOW() + INTERVAL '3 days') AS evidence_due_soon,

  -- Amount by status
  SUM(disputed_amount) FILTER (WHERE status IN ('opened', 'needs_response', 'under_review')) AS pending_amount,
  SUM(disputed_amount) FILTER (WHERE status = 'won') AS recovered_amount,
  SUM(disputed_amount) FILTER (WHERE status = 'lost') AS lost_amount

FROM chargebacks
GROUP BY organizer_id, currency;

-- =====================================================
-- ORGANIZER ANALYTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW organizer_financial_summary AS
SELECT
  o.id AS organizer_id,
  o.business_name,
  o.country_code,

  -- Total earnings
  COALESCE(SUM(ord.total_amount) FILTER (WHERE ord.status = 'completed'), 0) AS total_gross_sales,
  COALESCE(SUM(ord.platform_fee) FILTER (WHERE ord.status = 'completed'), 0) AS total_platform_fees,
  COALESCE(SUM(ord.total_amount - COALESCE(ord.platform_fee, 0)) FILTER (WHERE ord.status = 'completed'), 0) AS total_net_earnings,

  -- Refunds & chargebacks
  COALESCE(SUM(ord.total_amount) FILTER (WHERE ord.status = 'refunded'), 0) AS total_refunds,

  -- Payouts
  COALESCE((
    SELECT SUM(net_amount)
    FROM payouts p
    WHERE p.organizer_id = o.id AND p.status = 'completed'
  ), 0) AS total_paid_out,

  -- Pending
  COALESCE((
    SELECT SUM(available_balance)
    FROM escrow_balances eb
    WHERE eb.organizer_id = o.id AND eb.status IN ('pending', 'eligible')
  ), 0) AS pending_balance,

  -- Event count
  (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id) AS total_events,
  (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.status = 'published' AND e.start_date > NOW()) AS upcoming_events,

  -- Order stats
  COUNT(DISTINCT ord.id) FILTER (WHERE ord.status = 'completed') AS total_orders,
  AVG(ord.total_amount) FILTER (WHERE ord.status = 'completed') AS avg_order_value

FROM organizers o
LEFT JOIN events e ON e.organizer_id = o.id
LEFT JOIN orders ord ON ord.event_id = e.id
GROUP BY o.id, o.business_name, o.country_code;

-- =====================================================
-- PROVIDER COMPARISON VIEW
-- =====================================================

CREATE OR REPLACE VIEW payment_provider_comparison AS
SELECT
  payment_provider,
  currency,

  -- Volume
  COUNT(*) AS transaction_count,
  SUM(total_amount) AS total_volume,
  AVG(total_amount) AS avg_transaction,

  -- Fees (estimated based on standard rates)
  SUM(total_amount) * CASE payment_provider
    WHEN 'stripe' THEN 0.029
    WHEN 'paystack' THEN 0.015
    WHEN 'flutterwave' THEN 0.014
    ELSE 0.025
  END AS estimated_processing_fees,

  -- Success rate
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL /
     NULLIF(COUNT(*), 0)::DECIMAL) * 100,
    2
  ) AS success_rate,

  -- Refund rate
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'refunded')::DECIMAL /
     NULLIF(COUNT(*), 0)::DECIMAL) * 100,
    2
  ) AS refund_rate

FROM orders
WHERE payment_provider IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY payment_provider, currency
ORDER BY total_volume DESC;

-- =====================================================
-- REFRESH FUNCTIONS
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_finance_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_daily_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_weekly_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_monthly_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Get P&L summary for a period
CREATE OR REPLACE FUNCTION get_platform_pnl(
  p_start_date DATE,
  p_end_date DATE,
  p_currency VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,

    -- Revenue
    'gross_revenue', COALESCE(SUM(o.total_amount), 0),
    'ticket_revenue', COALESCE(SUM(CASE WHEN NOT COALESCE(o.is_donation, FALSE) THEN o.total_amount ELSE 0 END), 0),
    'donation_revenue', COALESCE(SUM(CASE WHEN o.is_donation THEN o.total_amount ELSE 0 END), 0),

    -- Platform income
    'platform_fees', COALESCE(SUM(o.platform_fee), 0),
    'fast_payout_fees', COALESCE((
      SELECT SUM(fee_amount) FROM fast_payout_requests
      WHERE status = 'completed' AND completed_at::DATE BETWEEN p_start_date AND p_end_date
    ), 0),

    -- Costs
    'refunds', COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN o.total_amount ELSE 0 END), 0),

    -- Net
    'order_count', COUNT(DISTINCT o.id),
    'unique_customers', COUNT(DISTINCT o.user_id),
    'avg_order_value', ROUND(AVG(o.total_amount)::NUMERIC, 2)
  ) INTO v_result
  FROM orders o
  WHERE o.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND o.status IN ('completed', 'refunded')
    AND (p_currency IS NULL OR o.currency = p_currency);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get aging summary
CREATE OR REPLACE FUNCTION get_aging_summary(p_currency VARCHAR DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'payouts', (
      SELECT row_to_json(summary)
      FROM (
        SELECT
          SUM(total_outstanding) as total,
          SUM(not_yet_eligible) as not_eligible,
          SUM(aging_0_7_days) as "0_7_days",
          SUM(aging_8_14_days) as "8_14_days",
          SUM(aging_15_30_days) as "15_30_days",
          SUM(aging_30_plus_days) as "30_plus_days"
        FROM outstanding_payouts_aging
        WHERE (p_currency IS NULL OR currency = p_currency)
      ) summary
    ),
    'chargebacks', (
      SELECT row_to_json(summary)
      FROM (
        SELECT
          SUM(total_chargebacks) as total_count,
          SUM(total_disputed_amount) as total_amount,
          SUM(needs_attention) as needs_attention,
          SUM(evidence_overdue) as evidence_overdue,
          SUM(pending_amount) as pending_amount
        FROM chargeback_aging
        WHERE (p_currency IS NULL OR currency = p_currency)
      ) summary
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON platform_daily_metrics TO authenticated;
GRANT SELECT ON platform_weekly_metrics TO authenticated;
GRANT SELECT ON platform_monthly_metrics TO authenticated;
GRANT SELECT ON revenue_forecast TO authenticated;
GRANT SELECT ON outstanding_payouts_aging TO service_role;
GRANT SELECT ON chargeback_aging TO service_role;
GRANT SELECT ON organizer_financial_summary TO authenticated;
GRANT SELECT ON payment_provider_comparison TO service_role;

GRANT EXECUTE ON FUNCTION refresh_finance_materialized_views TO service_role;
GRANT EXECUTE ON FUNCTION get_platform_pnl TO service_role;
GRANT EXECUTE ON FUNCTION get_aging_summary TO service_role;
