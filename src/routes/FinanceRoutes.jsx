import { Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider, useFinance } from '@/contexts/FinanceContext';
import { FinanceLayout } from '@/layouts/FinanceLayout';
import { FinanceLogin } from '@/pages/finance/FinanceLogin';
import { FinanceDashboard } from '@/pages/finance/FinanceDashboard';
import { EventPayouts } from '@/pages/finance/EventPayouts';
import { PromoterPayouts } from '@/pages/finance/PromoterPayouts';
import { AffiliatePayouts } from '@/pages/finance/AffiliatePayouts';
import { PayoutHistory } from '@/pages/finance/PayoutHistory';
import { BackOfficeFunding } from '@/pages/finance/BackOfficeFunding';
import { RevenueOverview } from '@/pages/finance/RevenueOverview';
import { RevenueByCountry } from '@/pages/finance/RevenueByCountry';
import { RevenueByCategory } from '@/pages/finance/RevenueByCategory';
import { FinanceReports } from '@/pages/finance/FinanceReports';
import { FinanceSettings } from '@/pages/finance/FinanceSettings';
import { AdminFeeManagement } from "@/pages/admin/AdminFeeManagement";
import { EscrowManagement } from '@/pages/finance/EscrowManagement';
import { TransactionAuditLog } from '@/pages/finance/TransactionAuditLog';
import { ChargebacksManagement } from '@/pages/finance/ChargebacksManagement';
import { ChargebackDetail } from '@/pages/finance/ChargebackDetail';
import { PlatformPnL } from '@/pages/finance/PlatformPnL';
import { SettlementReports } from '@/pages/finance/SettlementReports';
import { BankReconciliation } from '@/pages/finance/BankReconciliation';
import { InvoiceGeneration } from '@/pages/finance/InvoiceGeneration';
import { PaymentBatching } from '@/pages/finance/PaymentBatching';
import { PendingApprovals } from '@/pages/finance/PendingApprovals';
import { ExpenseTracking } from '@/pages/finance/ExpenseTracking';
import { RevenueForecast } from '@/pages/finance/RevenueForecast';
import { AgingReports } from '@/pages/finance/AgingReports';
import { Loader2 } from "lucide-react";
// Auth guard component
function FinanceGuard({ children }) {
  const { financeUser, loading } = useFinance();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (!financeUser) {
    return <Navigate to="/finance/login" replace />;
  }

  return children;
}

// Main Finance Routes
export function FinanceRoutes() {
  return (
    <Routes>
      {/* Public: Login */}
      <Route path="/login" element={<FinanceLogin />} />
      
      {/* Protected: All other routes */}
      <Route
        element={
          <FinanceGuard>
            <FinanceLayout />
          </FinanceGuard>
        }
      >
        <Route index element={<Navigate to="/finance/dashboard" replace />} />
        <Route path="dashboard" element={<FinanceDashboard />} />
        
        {/* Payouts */}
        <Route path="payouts/events" element={<EventPayouts />} />
        <Route path="payouts/promoters" element={<PromoterPayouts />} />
        <Route path="payouts/affiliates" element={<AffiliatePayouts />} />
        <Route path="payouts/history" element={<PayoutHistory />} />
        <Route path="payouts/funding" element={<BackOfficeFunding />} />
        
        {/* Revenue */}
        <Route path="revenue/overview" element={<RevenueOverview />} />
        <Route path="revenue/country" element={<RevenueByCountry />} />
        <Route path="revenue/category" element={<RevenueByCategory />} />
        
        {/* Reports & Settings */}
        <Route path="reports" element={<FinanceReports />} />
        <Route path="settings" element={<FinanceSettings />} />
        <Route path="fees" element={<AdminFeeManagement />} />

        {/* Escrow & Payouts Management */}
        <Route path="escrow" element={<EscrowManagement />} />
        <Route path="batching" element={<PaymentBatching />} />
        <Route path="approvals" element={<PendingApprovals />} />

        {/* Chargebacks & Disputes */}
        <Route path="chargebacks" element={<ChargebacksManagement />} />
        <Route path="chargebacks/:id" element={<ChargebackDetail />} />

        {/* Reconciliation & Settlements */}
        <Route path="settlements" element={<SettlementReports />} />
        <Route path="bank-reconciliation" element={<BankReconciliation />} />

        {/* Audit & Transactions */}
        <Route path="audit-log" element={<TransactionAuditLog />} />

        {/* P&L & Analytics */}
        <Route path="pnl" element={<PlatformPnL />} />
        <Route path="expenses" element={<ExpenseTracking />} />
        <Route path="forecast" element={<RevenueForecast />} />
        <Route path="aging" element={<AgingReports />} />

        {/* Invoicing */}
        <Route path="invoices" element={<InvoiceGeneration />} />
      </Route>      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/finance/dashboard" replace />} />
    </Routes>
  );
}

// Wrapper with Provider
export function FinanceApp() {
  return (
    <FinanceProvider>
      <FinanceRoutes />
    </FinanceProvider>
  );
}
