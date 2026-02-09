import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, QrCode, UserCheck, Calendar, Users, CheckCircle,
  Loader2, X, Undo2, History, Smartphone, RefreshCw,
  AlertCircle, Clock, ChevronDown, Volume2, VolumeX, HelpCircle,
  Download, WifiOff
} from 'lucide-react';
import jsQR from 'jsqr';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { HelpTip, OnboardingBanner } from '@/components/HelpTip';
import { toast } from 'sonner';
import { useOfflineCheckIn } from '../../hooks/useOfflineCheckIn';
import { OfflineStatusBar } from '../../components/OfflineStatusBar';

// Generate unique device ID for multi-session tracking
const getDeviceId = () => {
  let deviceId = localStorage.getItem('ticketrack_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('ticketrack_device_id', deviceId);
  }
  return deviceId;
};

export function CheckInByEvents() {
  const { organizer } = useOrganizer();
  const deviceId = useRef(getDeviceId());

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [eventStats, setEventStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const [attendees, setAttendees] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Dialogs
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [manualCheckInDialog, setManualCheckInDialog] = useState(false);
  const [ticketCode, setTicketCode] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Offline support
  const offline = useOfflineCheckIn(selectedEvent, organizer?.id);

  // QR Scanner
  const [scanning, setScanning] = useState(false);
  const [scannerProcessing, setScannerProcessing] = useState(false); // Full-screen processing overlay
  const [lastScannedCode, setLastScannedCode] = useState(''); // Prevent duplicate scans
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const scanningRef = useRef(false); // Use ref to track scanning state in animation loop
  const animationFrameRef = useRef(null);
  const processingTimeoutRef = useRef(null);

  // Load events on mount
  useEffect(() => {
    if (organizer?.id) {
      loadEvents();
    }
  }, [organizer?.id]);

  // Load attendees when event changes
  useEffect(() => {
    if (selectedEvent) {
      loadAttendees();
      loadAuditLog();
    }
  }, [selectedEvent]);

  // Auto-refresh every 10 seconds (skip when offline)
  useEffect(() => {
    if (!autoRefresh || !selectedEvent || offline.isOffline) return;

    const interval = setInterval(() => {
      loadAttendees();
      loadAuditLog();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedEvent, offline.isOffline]);

  // Cleanup camera and animation frame on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_date, venue_name')
        .eq('organizer_id', organizer.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      
      // Auto-select today's event or most recent
      const today = new Date().toISOString().split('T')[0];
      const todayEvent = data?.find(e => e.start_date?.split('T')[0] === today);
      if (todayEvent) {
        setSelectedEvent(todayEvent.id);
      } else if (data?.length > 0) {
        setSelectedEvent(data[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendees = async () => {
    if (!selectedEvent) return;

    // Use offline cache when offline and event is cached
    if (offline.isOffline && offline.isEventCached) {
      try {
        const offlineAttendees = await offline.getOfflineAttendees();
        setAttendees(offlineAttendees);

        const total = offlineAttendees.reduce((sum, a) => sum + a.quantity, 0);
        const checkedIn = offlineAttendees.filter(a => a.checkedIn).reduce((sum, a) => sum + a.quantity, 0);
        setEventStats({ total, checkedIn, pending: total - checkedIn });
      } catch (err) {
        console.error('Error loading offline attendees:', err);
      }
      return;
    }

    try {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          id,
          attendee_name,
          attendee_email,
          ticket_code,
          quantity,
          is_checked_in,
          checked_in_at,
          checked_in_by,
          created_at,
          ticket_types (
            id,
            name
          )
        `)
        .eq('event_id', selectedEvent)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']) // Include all valid ticket types
        .order('attendee_name', { ascending: true });

      if (error) throw error;

      const formattedAttendees = tickets?.map(t => ({
        id: t.id,
        name: t.attendee_name,
        email: t.attendee_email,
        ticketCode: t.ticket_code,
        ticketType: t.ticket_types?.name || 'Standard',
        quantity: t.quantity || 1,
        checkedIn: t.is_checked_in || false,
        checkInTime: t.checked_in_at,
        checkedInBy: t.checked_in_by,
        purchaseDate: t.created_at,
      })) || [];

      setAttendees(formattedAttendees);

      // Calculate stats
      const total = formattedAttendees.reduce((sum, a) => sum + a.quantity, 0);
      const checkedIn = formattedAttendees.filter(a => a.checkedIn).reduce((sum, a) => sum + a.quantity, 0);
      setEventStats({
        total,
        checkedIn,
        pending: total - checkedIn,
      });
    } catch (error) {
      console.error('Error loading attendees:', error);
    }
  };

  const loadAuditLog = async () => {
    if (!selectedEvent) return;

    try {
      // Get check-in history from tickets that have been checked in
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          attendee_name,
          ticket_code,
          is_checked_in,
          checked_in_at,
          checked_in_by
        `)
        .eq('event_id', selectedEvent)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']) // Include all valid ticket types
        .not('checked_in_at', 'is', null)
        .order('checked_in_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const log = data?.map(t => ({
        id: t.id,
        action: t.is_checked_in ? 'check_in' : 'check_out',
        attendeeName: t.attendee_name,
        ticketCode: t.ticket_code,
        timestamp: t.checked_in_at,
        deviceId: t.checked_in_by,
      })) || [];

      setAuditLog(log);
    } catch (error) {
      console.error('Error loading audit log:', error);
    }
  };

  const performCheckIn = async (ticketCodeOrId, isUndo = false, fromScanner = false) => {
    setProcessing(true);
    setCheckInResult(null);

    // Show full-screen processing overlay for scanner
    if (fromScanner) {
      setScannerProcessing(true);
    }

    // Clean up the input
    const cleanCode = ticketCodeOrId?.trim()?.toUpperCase();

    if (!cleanCode) {
      playSound('error');
      vibrateDevice('error');
      setCheckInResult({
        success: false,
        message: 'Please enter a valid ticket code.',
      });
      setProcessing(false);
      setScannerProcessing(false);
      return;
    }

    // Prevent duplicate scans within 3 seconds
    if (fromScanner && cleanCode === lastScannedCode) {
      console.log('Duplicate scan ignored:', cleanCode);
      setProcessing(false);
      setScannerProcessing(false);
      // Resume scanning after short delay
      setTimeout(() => {
        if (scanDialogOpen) startQRScanner();
      }, 500);
      return;
    }

    if (fromScanner) {
      setLastScannedCode(cleanCode);
      // Clear last scanned code after 3 seconds
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = setTimeout(() => setLastScannedCode(''), 3000);
    }

    // OFFLINE BRANCH: delegate to offline check-in when offline and event is cached
    if (offline.isOffline && offline.isEventCached) {
      try {
        const result = await offline.performOfflineCheckIn(cleanCode, isUndo);

        if (result.success) {
          playSound(isUndo ? 'undo' : 'success');
          vibrateDevice('success');
        } else if (result.alreadyCheckedIn) {
          playSound('warning');
          vibrateDevice('warning');
        } else {
          playSound('error');
          vibrateDevice('error');
        }

        setCheckInResult(result);

        // Refresh from local cache
        await loadAttendees();
        setTicketCode('');

        if (fromScanner && scanDialogOpen) {
          setTimeout(() => {
            setScannerProcessing(false);
            setCheckInResult(null);
            startQRScanner();
          }, 1500);
        } else {
          setScannerProcessing(false);
        }
      } catch (err) {
        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: 'Offline check-in failed: ' + (err.message || 'Unknown error'),
        });
        setScannerProcessing(false);
      } finally {
        setProcessing(false);
      }
      return;
    }

    console.log('Attempting check-in for:', cleanCode);

    try {
      // Find ticket by code or ID - include all valid ticket payment statuses
      // Check if it looks like a UUID (36 chars with dashes)
      // Ticket codes are now 8 characters, UUIDs are 36 chars with dashes
      const isUUID = cleanCode.length === 36 && cleanCode.split('-').length === 5;

      let query = supabase
        .from('tickets')
        .select('id, attendee_name, attendee_email, ticket_code, is_checked_in, event_id, payment_status');

      if (isUUID) {
        // It's a UUID - search by ID
        query = query.eq('id', cleanCode);
      } else {
        // It's a ticket code - search by ticket_code (supports TKT-XXX and TKTXXX formats)
        query = query.eq('ticket_code', cleanCode);
      }

      const { data: ticket, error: findError } = await query.maybeSingle();

      console.log('Query result:', { ticket, findError });

      if (findError) {
        console.error('Database error:', findError);
        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: 'Database error. Please try again.',
        });
        setScannerProcessing(false);
        return;
      }

      if (!ticket) {
        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: `Ticket "${cleanCode}" not found. Please check the code and try again.`,
        });
        setScannerProcessing(false);
        return;
      }

      // Check payment status
      const validStatuses = ['completed', 'free', 'paid', 'complimentary'];
      if (!validStatuses.includes(ticket.payment_status)) {
        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: `This ticket has status "${ticket.payment_status}" and cannot be checked in.`,
          attendeeName: ticket.attendee_name,
        });
        setScannerProcessing(false);
        return;
      }

      // Verify ticket is for selected event
      if (ticket.event_id !== selectedEvent) {
        // Get the event name for better error message
        const { data: ticketEvent } = await supabase
          .from('events')
          .select('title')
          .eq('id', ticket.event_id)
          .single();

        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: `This ticket is for "${ticketEvent?.title || 'a different event'}". Please select the correct event.`,
          attendeeName: ticket.attendee_name,
        });
        setScannerProcessing(false);
        return;
      }

      // Double-check the event belongs to this organizer (security validation)
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, organizer_id')
        .eq('id', ticket.event_id)
        .eq('organizer_id', organizer.id)
        .single();

      if (eventError || !eventData) {
        playSound('error');
        vibrateDevice('error');
        setCheckInResult({
          success: false,
          message: 'You do not have permission to check in tickets for this event.',
          attendeeName: ticket.attendee_name,
        });
        setScannerProcessing(false);
        return;
      }

      // Check current status
      if (!isUndo && ticket.is_checked_in) {
        playSound('warning');
        vibrateDevice('warning');
        setCheckInResult({
          success: false,
          message: 'This ticket has already been checked in.',
          attendeeName: ticket.attendee_name,
          alreadyCheckedIn: true,
        });
        setScannerProcessing(false);
        return;
      }

      if (isUndo && !ticket.is_checked_in) {
        setCheckInResult({
          success: false,
          message: 'This ticket is not checked in.',
          attendeeName: ticket.attendee_name,
        });
        setScannerProcessing(false);
        return;
      }

      // Get current user ID for tracking
      const { data: { user } } = await supabase.auth.getUser();

      // Perform check-in/out
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          is_checked_in: !isUndo,
          checked_in_at: !isUndo ? new Date().toISOString() : null,
          checked_in_by: !isUndo ? user?.id : null,
        })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      playSound(isUndo ? 'undo' : 'success');
      vibrateDevice('success');
      setCheckInResult({
        success: true,
        message: isUndo ? 'Check-in reversed successfully!' : `${ticket.attendee_name} checked in!`,
        attendeeName: ticket.attendee_name,
        ticketCode: ticket.ticket_code,
      });

      // Refresh data
      await loadAttendees();
      await loadAuditLog();

      // Clear manual input
      setTicketCode('');

      // Auto-resume scanning after 1.5 seconds for continuous check-in
      if (fromScanner && scanDialogOpen) {
        setTimeout(() => {
          setScannerProcessing(false);
          setCheckInResult(null);
          startQRScanner();
        }, 1500);
      } else {
        setScannerProcessing(false);
      }

    } catch (error) {
      console.error('Check-in error:', error);
      playSound('error');
      vibrateDevice('error');

      let errorMessage = 'An error occurred. Please try again.';
      if (error.message?.includes('permission') || error.code === '42501') {
        errorMessage = 'Permission denied. Please contact support.';
      } else if (error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      }

      setCheckInResult({
        success: false,
        message: errorMessage,
      });
      setScannerProcessing(false);
    } finally {
      setProcessing(false);
    }
  };

  // Vibrate device for haptic feedback
  const vibrateDevice = (type) => {
    if (!navigator.vibrate) return;
    try {
      switch (type) {
        case 'success':
          navigator.vibrate([100, 50, 100]); // Double pulse
          break;
        case 'error':
          navigator.vibrate([300]); // Long vibration
          break;
        case 'warning':
          navigator.vibrate([100, 100, 100]); // Triple short
          break;
        default:
          navigator.vibrate(50);
      }
    } catch (e) {
      // Vibration not supported
    }
  };

  const playSound = (type) => {
    if (!soundEnabled) return;
    
    // Create audio context for beep sounds
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch (type) {
        case 'success':
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.3;
          oscillator.start();
          setTimeout(() => oscillator.stop(), 150);
          break;
        case 'error':
          oscillator.frequency.value = 300;
          gainNode.gain.value = 0.3;
          oscillator.start();
          setTimeout(() => oscillator.stop(), 300);
          break;
        case 'warning':
          oscillator.frequency.value = 500;
          gainNode.gain.value = 0.2;
          oscillator.start();
          setTimeout(() => {
            oscillator.frequency.value = 400;
            setTimeout(() => oscillator.stop(), 150);
          }, 150);
          break;
        case 'undo':
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.2;
          oscillator.start();
          setTimeout(() => oscillator.stop(), 100);
          break;
      }
    } catch (e) {
      // Audio not supported
    }
  };

  const startQRScanner = async () => {
    setScanning(true);
    scanningRef.current = true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Create canvas for jsQR if not exists
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        
        // Check if BarcodeDetector is available (Chrome/Edge)
        const hasBarcodeDetector = 'BarcodeDetector' in window;
        let barcodeDetector = null;
        
        if (hasBarcodeDetector) {
          try {
            barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
          } catch (e) {
            console.log('BarcodeDetector failed, falling back to jsQR');
          }
        }
          
          const scanFrame = async () => {
          // Use ref to check scanning state (closure-safe)
          if (!scanningRef.current || !videoRef.current) return;
          
          const video = videoRef.current;
          
          // Wait for video to be ready
          if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          
          let detectedCode = null;
          
          // Try BarcodeDetector first (faster, native)
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes.length > 0) {
                detectedCode = barcodes[0].rawValue;
              }
            } catch (e) {
              // BarcodeDetector failed, will fallback to jsQR
            }
          }
          
          // Fallback to jsQR (works in all browsers including Safari/Firefox)
          if (!detectedCode) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            try {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              
              if (code && code.data) {
                detectedCode = code.data;
              }
            } catch (e) {
              // jsQR failed, continue scanning
            }
          }
          
          // If we found a code, process it
          if (detectedCode) {
            stopQRScanner();
            performCheckIn(detectedCode, false, true); // fromScanner = true
            return;
          }
          
          // Continue scanning
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        };
        
        // Start scanning loop
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setScanning(false);
      scanningRef.current = false;
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopQRScanner = useCallback(() => {
    setScanning(false);
    scanningRef.current = false;
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleManualCheckIn = () => {
    if (ticketCode.trim()) {
      performCheckIn(ticketCode.trim());
    }
  };

  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = 
      attendee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.ticketCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'checkedIn' && attendee.checkedIn) ||
      (filterStatus === 'pending' && !attendee.checkedIn);
    
    return matchesSearch && matchesFilter;
  });

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const currentEvent = events.find(e => e.id === selectedEvent);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offline Status Bar */}
      <OfflineStatusBar
        isOffline={offline.isOffline}
        isEventCached={offline.isEventCached}
        lastCachedAt={offline.lastCachedAt}
        pendingCount={offline.pendingCount}
        isSyncing={offline.isSyncing}
        syncResult={offline.syncResult}
        onSyncNow={offline.syncNow}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Check-In
            <HelpTip>Scan QR codes or enter ticket codes to check in attendees. Works on multiple devices at once - perfect for events with multiple entry points!</HelpTip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage attendee check-ins • Device: {deviceId.current.slice(-8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-xl"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { loadAttendees(); loadAuditLog(); }}
            className="rounded-xl"
            title="Refresh"
            disabled={offline.isOffline}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
          {selectedEvent && (
            <Button
              variant="outline"
              onClick={async () => {
                const result = await offline.cacheCurrentEvent();
                if (result?.success) {
                  toast.success(`Downloaded ${result.ticketCount} tickets for offline use`);
                } else {
                  toast.error('Failed to download: ' + (result?.error || 'Unknown error'));
                }
              }}
              disabled={offline.isCaching || offline.isOffline}
              className="rounded-xl border-border/10"
              title="Download event data for offline check-in"
            >
              {offline.isCaching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {offline.isEventCached ? 'Update Offline' : 'Download for Offline'}
            </Button>
          )}
          <Button
            onClick={() => setScanDialogOpen(true)}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR
          </Button>
          <Button
            onClick={() => setManualCheckInDialog(true)}
            variant="outline"
            className="rounded-xl border-border/10"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Manual
          </Button>
        </div>
      </div>

      {/* Event Selection with Search */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-[#2969FF]" />
            <Select value={selectedEvent} onValueChange={(val) => { setSelectedEvent(val); setEventSearchTerm(''); }}>
              <SelectTrigger className="flex-1 rounded-xl border-border/10 h-12">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-80">
                <div className="p-2 border-b border-border/10 sticky top-0 bg-card z-10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      value={eventSearchTerm}
                      onChange={(e) => setEventSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                {events
                  .filter(event => 
                    event.title?.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                    event.venue_name?.toLowerCase().includes(eventSearchTerm.toLowerCase())
                  )
                  .map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex flex-col">
                      <span>{event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.start_date).toLocaleDateString('en-NG', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {events.filter(event => 
                  event.title?.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                  event.venue_name?.toLowerCase().includes(eventSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No events found</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Total</p>
                    <h3 className="text-2xl font-semibold text-foreground">{eventStats.total}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#2969FF]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10 rounded-2xl border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Checked In</p>
                    <h3 className="text-2xl font-semibold text-green-600">{eventStats.checkedIn}</h3>
                    <p className="text-xs text-green-600">
                      {eventStats.total > 0 ? Math.round((eventStats.checkedIn / eventStats.total) * 100) : 0}%
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Pending</p>
                    <h3 className="text-2xl font-semibold text-foreground">{eventStats.pending}</h3>
                    <p className="text-xs text-muted-foreground">
                      {eventStats.total > 0 ? Math.round((eventStats.pending / eventStats.total) * 100) : 0}%
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div>
                  <p className="text-muted-foreground text-sm">Venue</p>
                  <p className="font-medium text-foreground truncate">{currentEvent?.venue_name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentEvent?.start_date ? new Date(currentEvent.start_date).toLocaleDateString() : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bar */}
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Check-in Progress</span>
                <span className="text-sm font-medium text-foreground">
                  {eventStats.checkedIn} / {eventStats.total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2969FF] to-green-500 transition-all duration-500"
                  style={{ width: `${eventStats.total > 0 ? (eventStats.checkedIn / eventStats.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Attendees & Audit Log */}
          <Tabs defaultValue="attendees" className="space-y-4">
            <TabsList className="bg-card border border-border/10 rounded-xl p-1">
              <TabsTrigger value="attendees" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Attendees
              </TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
                <History className="w-4 h-4 mr-2" />
                Activity Log
              </TabsTrigger>
            </TabsList>

            {/* Attendees Tab */}
            <TabsContent value="attendees" className="space-y-4">
              {/* Search & Filter */}
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, or ticket code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 bg-muted border-0 rounded-xl"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="md:w-40 h-12 rounded-xl border-border/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="checkedIn">Checked In</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Attendees List */}
              <Card className="border-border/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-lg">
                    Attendees ({filteredAttendees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAttendees.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {attendees.length === 0 ? 'No attendees for this event' : 'No attendees match your filters'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAttendees.map((attendee) => (
                        <div
                          key={attendee.id}
                          className={`p-4 rounded-xl flex items-center justify-between ${
                            attendee.checkedIn ? 'bg-green-50 border border-green-200' : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              attendee.checkedIn ? 'bg-green-500 text-white' : 'bg-[#2969FF]/10 text-[#2969FF]'
                            }`}>
                              {attendee.checkedIn ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <span className="font-medium">{attendee.name?.[0]?.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground truncate">{attendee.name}</p>
                                <Badge className="bg-[#0F0F0F]/10 text-foreground text-xs">
                                  {attendee.ticketType}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{attendee.email}</p>
                              <p className="text-xs text-muted-foreground font-mono">{attendee.ticketCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {attendee.checkedIn ? (
                              <>
                                <div className="text-right mr-2 hidden md:block">
                                  <p className="text-xs text-green-600">Checked in</p>
                                  <p className="text-xs text-muted-foreground">{formatTime(attendee.checkInTime)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => performCheckIn(attendee.id, true)}
                                  className="rounded-xl border-border/10"
                                >
                                  <Undo2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => performCheckIn(attendee.id)}
                                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Check In
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audit Log Tab */}
            <TabsContent value="audit">
              <Card className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLog.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground">No check-in activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLog.map((log, index) => (
                        <div
                          key={`${log.id}-${index}`}
                          className="p-3 rounded-xl bg-muted flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              log.action === 'check_in' ? 'bg-green-100' : 'bg-orange-100'
                            }`}>
                              {log.action === 'check_in' ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Undo2 className="w-4 h-4 text-orange-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{log.attendeeName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{log.ticketCode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                            {log.deviceId && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Smartphone className="w-3 h-3" />
                                {log.deviceId.slice(-8)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* QR Scanner Dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={(open) => {
        if (!open) {
          stopQRScanner();
          setScannerProcessing(false);
          setCheckInResult(null);
        }
        setScanDialogOpen(open);
      }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Scan QR Code</DialogTitle>
            <DialogDescription>
              Position the ticket QR code within the frame
            </DialogDescription>
          </DialogHeader>
          
          {/* Processing Overlay - Full screen within dialog */}
          {scannerProcessing && (
            <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-[#2969FF]/20 border-t-[#2969FF] animate-spin" />
                <QrCode className="w-8 h-8 text-[#2969FF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-4 text-lg font-medium text-foreground">Processing...</p>
              <p className="text-sm text-muted-foreground mt-1">Verifying ticket</p>
            </div>
          )}
          
          {/* Check-in Result Banner */}
          {checkInResult && !scannerProcessing && (
            <div className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
              checkInResult.success 
                ? 'bg-green-50 border-2 border-green-400' 
                : checkInResult.alreadyCheckedIn
                  ? 'bg-yellow-50 border-2 border-yellow-400'
                  : 'bg-red-50 border-2 border-red-400'
            }`}>
              {checkInResult.success ? (
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              ) : checkInResult.alreadyCheckedIn ? (
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1">
                <p className={`font-semibold text-lg ${
                  checkInResult.success ? 'text-green-800' : 
                  checkInResult.alreadyCheckedIn ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  {checkInResult.success ? 'Success!' : checkInResult.alreadyCheckedIn ? 'Already Checked In' : 'Error'}
                </p>
                <p className={`text-sm ${
                  checkInResult.success ? 'text-green-700' : 
                  checkInResult.alreadyCheckedIn ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {checkInResult.message}
                </p>
                {checkInResult.success && (
                  <p className="text-xs text-green-600 mt-2">
                    Resuming scanner in a moment...
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="aspect-square bg-[#0F0F0F] rounded-xl overflow-hidden relative">
            {scanning ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-[#2969FF] rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#2969FF] rounded-tl" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#2969FF] rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#2969FF] rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#2969FF] rounded-br" />
                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2969FF] animate-scan" />
                  </div>
                </div>
                {/* Ready to scan indicator */}
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="bg-[#2969FF] text-white text-xs px-3 py-1 rounded-full">
                    📷 Ready to scan
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white">
                <QrCode className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-white/60 mb-4">Camera not active</p>
                <Button 
                  onClick={startQRScanner}
                  className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                >
                  Start Scanner
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {scanning ? (
              <Button
                variant="outline"
                onClick={stopQRScanner}
                className="flex-1 rounded-xl"
              >
                Stop Scanner
              </Button>
            ) : (
              <Button
                onClick={startQRScanner}
                className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Start Scanner
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                stopQRScanner();
                setScanDialogOpen(false);
                setManualCheckInDialog(true);
              }}
              className="rounded-xl"
            >
              Enter Manually
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Check-In Dialog */}
      <Dialog open={manualCheckInDialog} onOpenChange={(open) => {
        if (!open) {
          setTicketCode('');
          setCheckInResult(null);
        }
        setManualCheckInDialog(open);
      }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Manual Check-In</DialogTitle>
            <DialogDescription>
              Enter the ticket code (e.g., TRABCD12) to check in an attendee
            </DialogDescription>
          </DialogHeader>

          {/* Processing Overlay */}
          {processing && (
            <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#2969FF]/20 border-t-[#2969FF] animate-spin" />
                <UserCheck className="w-6 h-6 text-[#2969FF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-4 text-lg font-medium text-foreground">Checking In...</p>
              <p className="text-sm text-muted-foreground mt-1">Verifying ticket code</p>
            </div>
          )}

          {/* Result Banner */}
          {checkInResult && !processing && (
            <div className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
              checkInResult.success 
                ? 'bg-green-50 border-2 border-green-400' 
                : checkInResult.alreadyCheckedIn
                  ? 'bg-yellow-50 border-2 border-yellow-400'
                  : 'bg-red-50 border-2 border-red-400'
            }`}>
              {checkInResult.success ? (
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              ) : checkInResult.alreadyCheckedIn ? (
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  checkInResult.success ? 'text-green-800' : 
                  checkInResult.alreadyCheckedIn ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  {checkInResult.success ? 'Success!' : checkInResult.alreadyCheckedIn ? 'Already Checked In' : 'Error'}
                </p>
                <p className={`text-sm ${
                  checkInResult.success ? 'text-green-700' : 
                  checkInResult.alreadyCheckedIn ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {checkInResult.message}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Input
                placeholder="Enter Ticket Code (e.g., TRABCD12)"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && !processing && handleManualCheckIn()}
                className="rounded-xl border-border/10 h-14 font-mono text-lg text-center tracking-widest"
                autoFocus
                disabled={processing}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Enter the 8-character code from the ticket
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setManualCheckInDialog(false);
                  setTicketCode('');
                  setCheckInResult(null);
                }}
                className="rounded-xl border-border/10 flex-1"
                disabled={processing}
              >
                Close
              </Button>
              <Button
                onClick={handleManualCheckIn}
                disabled={!ticketCode.trim() || processing}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Check In
              </Button>
            </div>
            
            {/* Quick switch to scanner */}
            <div className="text-center">
              <Button
                variant="link"
                onClick={() => {
                  setManualCheckInDialog(false);
                  setTicketCode('');
                  setCheckInResult(null);
                  setScanDialogOpen(true);
                }}
                className="text-[#2969FF] text-sm"
                disabled={processing}
              >
                <QrCode className="w-4 h-4 mr-1" />
                Switch to QR Scanner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSS for scanning animation */}
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
