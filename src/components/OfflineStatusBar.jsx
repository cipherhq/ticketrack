import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export function OfflineStatusBar({
  isOffline,
  isEventCached,
  lastCachedAt,
  pendingCount,
  isSyncing,
  syncResult,
  onSyncNow,
}) {
  const [showSynced, setShowSynced] = useState(false);

  // Show "All synced" message briefly after successful sync
  useEffect(() => {
    if (syncResult && syncResult.synced > 0 && !syncResult.error) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncResult]);

  // Don't show anything if online, no pending, no recent sync
  if (!isOffline && pendingCount === 0 && !isSyncing && !showSynced) {
    return null;
  }

  // Syncing state
  if (isSyncing) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Syncing check-ins...</span>
        </div>
      </div>
    );
  }

  // Just synced successfully
  if (showSynced && !isOffline) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>All check-ins synced ({syncResult.synced} synced{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''})</span>
        </div>
      </div>
    );
  }

  // Offline state
  if (isOffline) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>
            You are offline
            {isEventCached ? ' — check-ins saved locally' : ' — download event data to check in offline'}
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="font-medium">{pendingCount} pending</span>
        )}
      </div>
    );
  }

  // Online but has pending check-ins
  if (pendingCount > 0) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          <span>{pendingCount} check-in{pendingCount !== 1 ? 's' : ''} pending sync</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onSyncNow}
          className="h-7 text-xs border-orange-300 text-orange-800 hover:bg-orange-100"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Sync Now
        </Button>
      </div>
    );
  }

  return null;
}
