import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizerProvider } from '@/contexts/OrganizerContext';
import { RackPartyLayout } from '@/layouts/RackPartyLayout';
import { RackPartyList } from '@/pages/rackparty/RackPartyList';
import { RackPartyCreate } from '@/pages/rackparty/RackPartyCreate';
import { RackPartyDetail } from '@/pages/rackparty/RackPartyDetail';
import { RackPartyGuestBook } from '@/pages/rackparty/RackPartyGuestBook';
import { RackPartyResponses } from '@/pages/rackparty/RackPartyResponses';
import { Loader2 } from 'lucide-react';

export function RackPartyRoutes() {
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
      <RackPartyLayout>
        <Routes>
          <Route index element={<RackPartyList />} />
          <Route path="create" element={<RackPartyCreate />} />
          <Route path="guestbook" element={<RackPartyGuestBook />} />
          <Route path="responses" element={<RackPartyResponses />} />
          <Route path=":id" element={<RackPartyDetail />} />
        </Routes>
      </RackPartyLayout>
    </OrganizerProvider>
  );
}
