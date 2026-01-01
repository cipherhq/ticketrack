import { Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider, useFinance } from '@/contexts/FinanceContext';
import { FinanceLayout } from '@/layouts/FinanceLayout';
import { FinanceLogin } from '@/pages/finance/FinanceLogin';
import { FinanceDashboard } from '@/pages/finance/FinanceDashboard';
import { Loader2 } from 'lucide-react';

// Placeholder components - we'll build these next
const EventPayouts = () => <div>Event Payouts - Coming</div>;
const AffiliatePayouts = () => <div>Affiliate Payouts - Coming</div>;
const PayoutHistory = () => <div>Payout History - Coming</div>;
const RevenueOverview = () => <div>Revenue Overview - Coming</div>;
const RevenueByCountry = () => <div>Revenue By Country - Coming</div>;
const RevenueByCategory = () => <div>Revenue By Category - Coming</div>;
const FinanceReports = () => <div>Finance Reports - Coming</div>;
const FinanceSettings = () => <div>Finance Settings - Coming</div>;

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
        <Route path="payouts/affiliates" element={<AffiliatePayouts />} />
        <Route path="payouts/history" element={<PayoutHistory />} />
        
        {/* Revenue */}
        <Route path="revenue/overview" element={<RevenueOverview />} />
        <Route path="revenue/country" element={<RevenueByCountry />} />
        <Route path="revenue/category" element={<RevenueByCategory />} />
        
        {/* Reports & Settings */}
        <Route path="reports" element={<FinanceReports />} />
        <Route path="settings" element={<FinanceSettings />} />
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
