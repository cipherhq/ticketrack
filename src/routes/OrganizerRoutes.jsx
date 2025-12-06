import { Routes, Route, Navigate } from 'react-router-dom';
import { OrganizerLayout } from '../layouts/OrganizerLayout';
import { OrganizerProvider, useOrganizer } from '../contexts/OrganizerContext';

// Page imports
import { OrganizerHome } from '../pages/organizer/OrganizerHome';
import { EventManagement } from '../pages/organizer/EventManagement';
import { CreateEvent } from '../pages/organizer/CreateEvent';
import { ManageAttendees } from '../pages/organizer/ManageAttendees';
import { OrganizerFollowers } from '../pages/organizer/OrganizerFollowers';
import { Analytics } from '../pages/organizer/Analytics';
import { FinancePayouts } from '../pages/organizer/FinancePayouts';
import { AddBankAccount } from '../pages/organizer/AddBankAccount';
import { CheckInByEvents } from '../pages/organizer/CheckInByEvents';
import { PromoCodes } from '../pages/organizer/PromoCodes';
import { PromoterManagement } from '../pages/organizer/PromoterManagement';
import { EmailCampaigns } from '../pages/organizer/EmailCampaigns';
import { WhatsAppBroadcast } from '../pages/organizer/WhatsAppBroadcast';
import { SMSCampaigns } from '../pages/organizer/SMSCampaigns';
import { KYCVerification } from '../pages/organizer/KYCVerification';
import { OrganizerProfile } from '../pages/organizer/OrganizerProfile';

// Loading component
function OrganizerLoading() {
  return (
    <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#2969FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#0F0F0F]/60">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Protected routes wrapper
function OrganizerRoutesContent() {
  const { organizer, loading } = useOrganizer();

  if (loading) {
    return <OrganizerLoading />;
  }

  if (!organizer) {
    return <Navigate to="/login" replace />;
  }

  return (
    <OrganizerLayout>
      <Routes>
        {/* Dashboard Home */}
        <Route path="/" element={<OrganizerHome />} />
        
        {/* Events */}
        <Route path="/events" element={<EventManagement />} />
        <Route path="/events/create" element={<CreateEvent />} />
        <Route path="/events/:id/edit" element={<CreateEvent />} />
        <Route path="/events/:id/attendees" element={<ManageAttendees />} />
        
        {/* Attendees & Check-in */}
        <Route path="/attendees" element={<ManageAttendees />} />
        <Route path="/check-in" element={<CheckInByEvents />} />
        
        {/* Analytics */}
        <Route path="/analytics" element={<Analytics />} />
        
        {/* Finance */}
        <Route path="/finance" element={<FinancePayouts />} />
        <Route path="/bank-accounts" element={<AddBankAccount />} />
        
        {/* Marketing */}
        <Route path="/promo-codes" element={<PromoCodes />} />
        <Route path="/promoters" element={<PromoterManagement />} />
        <Route path="/email-campaigns" element={<EmailCampaigns />} />
        <Route path="/whatsapp" element={<WhatsAppBroadcast />} />
        <Route path="/sms" element={<SMSCampaigns />} />
        
        {/* Community */}
        <Route path="/followers" element={<OrganizerFollowers />} />
        
        {/* Settings & Profile */}
        <Route path="/profile" element={<OrganizerProfile />} />
        <Route path="/kyc" element={<KYCVerification />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/organizer" replace />} />
      </Routes>
    </OrganizerLayout>
  );
}

export function OrganizerRoutes() {
  return (
    <OrganizerProvider>
      <OrganizerRoutesContent />
    </OrganizerProvider>
  );
}
