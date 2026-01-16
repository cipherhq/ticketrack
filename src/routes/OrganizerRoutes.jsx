import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizerProvider } from '@/contexts/OrganizerContext';
import { OrganizerLayout } from '@/layouts/OrganizerLayout';
import { OrganizerDashboard } from '@/pages/organizer/OrganizerDashboard';
import { OrganizerHome } from '@/pages/organizer/OrganizerHome';
import { EventManagement } from '@/pages/organizer/EventManagement';
import { CreateEvent } from '@/pages/organizer/CreateEvent';
import { FinancePayouts } from '@/pages/organizer/FinancePayouts';
import BuyWhatsAppCredits from "../pages/organizer/BuyWhatsAppCredits";
import { OrganizerProfile } from '@/pages/organizer/OrganizerProfile';
import { OrganizerCommunications } from '@/pages/organizer/OrganizerCommunications';
import { ManageAttendees } from '@/pages/organizer/ManageAttendees';
import { CheckInByEvents } from '@/pages/organizer/CheckInByEvents';
import { Analytics } from '@/pages/organizer/Analytics';
import { KYCVerification } from '@/pages/organizer/KYCVerification';
import { PromoCodes } from '@/pages/organizer/PromoCodes';
import { PromoterManagement } from '@/pages/organizer/PromoterManagement';
import { OrganizerFollowers } from '@/pages/organizer/OrganizerFollowers';
import { AddBankAccount } from '@/pages/organizer/AddBankAccount';
import { EmailCampaigns } from '@/pages/organizer/EmailCampaigns';
import { WhatsAppBroadcast } from '@/pages/organizer/WhatsAppBroadcast';
import { WhatsAppSettings } from '@/pages/organizer/WhatsAppSettings';
import { SMSCredits } from '@/pages/organizer/SMSCredits';
import { SMSCampaigns } from '@/pages/organizer/SMSCampaigns';
import { OrganizerOrders } from "@/pages/organizer/OrganizerOrders";
import { OrganizerRefunds } from '@/pages/organizer/OrganizerRefunds';
import { OrganizerTransfers } from '@/pages/organizer/OrganizerTransfers';
import { StripeConnect } from '@/pages/organizer/StripeConnect';
import { OrganizerSupport } from '@/pages/organizer/OrganizerSupport';
import { TeamManagement } from "@/pages/organizer/TeamManagement";
import { ProjectManager } from "@/pages/organizer/ProjectManager";
import { TaxDocuments } from '@/pages/organizer/TaxDocuments';
import { PostEventDashboard } from '@/pages/organizer/PostEventDashboard';
import { VenueLayoutDesigner } from '@/pages/organizer/VenueLayoutDesigner';
import { VenueManagement } from '@/pages/organizer/VenueManagement';
import { EventPlaceDesigner } from '@/pages/organizer/EventPlaceDesigner';
import { Loader2 } from 'lucide-react';

export function OrganizerRoutes() {
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
    <OrganizerProvider>
      <OrganizerLayout>
        <Routes>
          <Route path="/" element={<OrganizerHome />} />
          <Route path="/dashboard" element={<OrganizerDashboard />} />
          <Route path="/events" element={<EventManagement />} />
          <Route path="/events/create" element={<CreateEvent />} />
          <Route path="/create-event" element={<CreateEvent />} />
          <Route path="/events/:id/edit" element={<CreateEvent />} />
          <Route path="/events/:id/attendees" element={<ManageAttendees />} />
          <Route path="/events/:id/post-event" element={<PostEventDashboard />} />
          <Route path="/payouts" element={<FinancePayouts />} />
          <Route path="/profile" element={<OrganizerProfile />} />
          <Route path="/communications" element={<OrganizerCommunications />} />
          <Route path="/attendees" element={<ManageAttendees />} />
          <Route path="/check-in" element={<CheckInByEvents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/kyc" element={<KYCVerification />} />
          <Route path="/tax-documents" element={<TaxDocuments />} />
          <Route path="/promo-codes" element={<PromoCodes />} />
          <Route path="/promoters" element={<PromoterManagement />} />
          <Route path="/followers" element={<OrganizerFollowers />} />
          <Route path="/bank-account" element={<AddBankAccount />} />
          <Route path="/email" element={<EmailCampaigns />} />
          <Route path="/whatsapp" element={<WhatsAppBroadcast />} />
          <Route path="/whatsapp-settings" element={<WhatsAppSettings />} />
          <Route path="/sms-credits" element={<SMSCredits />} />
          <Route path="/orders" element={<OrganizerOrders />} />
          <Route path="/whatsapp-credits" element={<BuyWhatsAppCredits />} />
          <Route path="/sms" element={<SMSCampaigns />} />
          <Route path="/refunds" element={<OrganizerRefunds />} />
          <Route path="/transfers" element={<OrganizerTransfers />} />
          <Route path="/stripe-connect" element={<StripeConnect />} />
          <Route path="/support" element={<OrganizerSupport />} />
          <Route path="/team" element={<TeamManagement />} />
          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/venues" element={<VenueManagement />} />
          <Route path="/venues/:venueId/layouts" element={<VenueLayoutDesigner />} />
          <Route path="/venues/:venueId/layouts/create" element={<VenueLayoutDesigner />} />
          <Route path="/venues/:venueId/layouts/:layoutId" element={<VenueLayoutDesigner />} />
          <Route path="/venues/:venueId/layouts/:layoutId/edit" element={<VenueLayoutDesigner />} />
          <Route path="/event-place" element={<EventPlaceDesigner />} />
        </Routes>
      </OrganizerLayout>
    </OrganizerProvider>
  );
}
