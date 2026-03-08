import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { createPartyInvite } from '@/services/partyInvites';
import {
  StepIndicator,
  Step1_PartyName,
  Step2_DateTime,
  Step3_Location,
  Step4_CoverImage,
  Step5_Options,
} from '@/components/rackparty/shared';

export function RackPartyCreate() {
  const { organizer } = useOrganizer();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/rackparty') ? '/rackparty' : '/organizer/rackparty';

  const [createStep, setCreateStep] = useState(1);
  const [createTitle, setCreateTitle] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createVenueName, setCreateVenueName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createCoverImage, setCreateCoverImage] = useState(null);
  const [createAllowPlusOnes, setCreateAllowPlusOnes] = useState(false);
  const [createMaxPlusOnes, setCreateMaxPlusOnes] = useState(1);
  const [createMessage, setCreateMessage] = useState('');
  const [createRsvpDeadline, setCreateRsvpDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleUploadCoverImage(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `party-invites/${organizer.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
    return publicUrl;
  }

  async function handleCreateCampaign(overrideCoverImage) {
    if (!createTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    setCreating(true);
    try {
      const fileToUpload = overrideCoverImage || createCoverImage;
      let coverImageUrl = null;
      if (fileToUpload) {
        coverImageUrl = await handleUploadCoverImage(fileToUpload);
      }
      const inv = await createPartyInvite(organizer.id, {
        title: createTitle.trim(),
        description: '',
        startDate: createStartDate ? new Date(createStartDate).toISOString() : null,
        endDate: createEndDate ? new Date(createEndDate).toISOString() : null,
        venueName: createVenueName.trim(),
        city: createCity.trim(),
        address: createAddress.trim(),
        coverImageUrl,
        message: createMessage.trim(),
        allowPlusOnes: createAllowPlusOnes,
        maxPlusOnes: createMaxPlusOnes,
        rsvpDeadline: createRsvpDeadline ? new Date(createRsvpDeadline).toISOString() : null,
      });
      toast.success('Party created!');
      navigate(basePath + '/' + inv.id);
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(basePath)} className="gap-1 px-2 sm:px-3">
            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Create a Party</h1>
        </div>
        <span className="text-xs sm:text-sm text-gray-400">Step {createStep}/5</span>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-3 sm:p-6">
          <StepIndicator currentStep={createStep} />

          {createStep === 1 && (
            <Step1_PartyName
              value={createTitle}
              onChange={setCreateTitle}
              onNext={() => setCreateStep(2)}
            />
          )}

          {createStep === 2 && (
            <Step2_DateTime
              startDate={createStartDate}
              endDate={createEndDate}
              onChangeStart={setCreateStartDate}
              onChangeEnd={setCreateEndDate}
              onNext={() => setCreateStep(3)}
              onBack={() => setCreateStep(1)}
            />
          )}

          {createStep === 3 && (
            <Step3_Location
              venueName={createVenueName}
              city={createCity}
              address={createAddress}
              onChangeVenue={setCreateVenueName}
              onChangeCity={setCreateCity}
              onChangeAddress={setCreateAddress}
              onNext={() => setCreateStep(4)}
              onBack={() => setCreateStep(2)}
            />
          )}

          {createStep === 4 && (
            <Step4_CoverImage
              coverImage={createCoverImage}
              onChange={setCreateCoverImage}
              onBack={() => setCreateStep(3)}
              onNext={(file) => { if (file) setCreateCoverImage(file); setCreateStep(5); }}
              creating={false}
              partyName={createTitle}
              startDate={createStartDate}
              venueName={createVenueName}
            />
          )}

          {createStep === 5 && (
            <Step5_Options
              allowPlusOnes={createAllowPlusOnes}
              onChangeAllowPlusOnes={setCreateAllowPlusOnes}
              maxPlusOnes={createMaxPlusOnes}
              onChangeMaxPlusOnes={setCreateMaxPlusOnes}
              message={createMessage}
              onChangeMessage={setCreateMessage}
              rsvpDeadline={createRsvpDeadline}
              onChangeRsvpDeadline={setCreateRsvpDeadline}
              onBack={() => setCreateStep(4)}
              onCreate={() => handleCreateCampaign(createCoverImage)}
              creating={creating}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
