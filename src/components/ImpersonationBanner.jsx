import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { AlertTriangle, X, User, Building, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const { isImpersonating, impersonationType, impersonationTarget, adminInfo, endImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  const handleExit = async () => {
    await endImpersonation();
    navigate('/admin');
  };

  const getIcon = () => {
    switch (impersonationType) {
      case 'organizer':
        return <Building className="w-4 h-4" />;
      case 'attendee':
        return <User className="w-4 h-4" />;
      case 'affiliate':
        return <Users className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (impersonationType) {
      case 'organizer':
        return 'Organizer';
      case 'attendee':
        return 'Attendee';
      case 'affiliate':
        return 'Affiliate/Promoter';
      default:
        return 'User';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Support Mode Active</span>
          <span className="text-orange-100">|</span>
          <div className="flex items-center gap-2">
            {getIcon()}
            <span>Viewing as {getTypeLabel()}: <strong>{impersonationTarget?.name}</strong></span>
          </div>
          <span className="text-orange-100">|</span>
          <span className="text-sm text-orange-100">
            Admin: {adminInfo?.email}
          </span>
        </div>
        <Button
          onClick={handleExit}
          size="sm"
          variant="outline"
          className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-lg"
        >
          <X className="w-4 h-4 mr-1" />
          Exit Support Mode
        </Button>
      </div>
    </div>
  );
}
