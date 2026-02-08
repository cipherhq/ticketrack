import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PromoterProvider } from '@/contexts/PromoterContext';
import { PromoterLayout } from '@/layouts/PromoterLayout';
import { PromoterDashboard } from '@/pages/promoter/PromoterDashboard';
import { PromoterPerformance } from '@/pages/promoter/PromoterPerformance';
import { BankAccountManagement } from '@/pages/promoter/BankAccountManagement';
import { PaymentHistory } from '@/pages/promoter/PaymentHistory';
import { PromoterTaxDocuments } from '@/pages/promoter/TaxDocuments';
import { PromoterProfile } from '@/pages/promoter/PromoterProfile';
import { PromoterKYC } from '@/pages/promoter/PromoterKYC';
import PromoterSupport from '@/pages/promoter/PromoterSupport';
import { AcceptInvitation } from '@/pages/promoter/AcceptInvitation';
import { Loader2 } from 'lucide-react';

export function PromoterRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PromoterProvider>
      <Routes>
        <Route path="accept" element={<AcceptInvitation />} />
        <Route element={<PromoterLayout />}>
          <Route index element={<PromoterDashboard />} />
          <Route path="performance" element={<PromoterPerformance />} />
          <Route path="bank-accounts" element={<BankAccountManagement />} />
          <Route path="payment-history" element={<PaymentHistory />} />
          <Route path="tax-documents" element={<PromoterTaxDocuments />} />
          <Route path="kyc" element={<PromoterKYC />} />
          <Route path="profile" element={<PromoterProfile />} />
          <Route path="support" element={<PromoterSupport />} />
        </Route>
      </Routes>
    </PromoterProvider>
  );
}
