import { useState, useEffect, useRef } from 'react';
import { 
  Search, QrCode, UserCheck, Calendar, Users, CheckCircle, 
  Loader2, X, Undo2, History, Smartphone, RefreshCw,
  AlertCircle, Clock, ChevronDown, Volume2, VolumeX
} from 'lucide-react';
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
  
  // QR Scanner
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh || !selectedEvent) return;
    
    const interval = setInterval(() => {
      loadAttendees();
      loadAuditLog();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedEvent]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
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
        .eq('payment_status', 'completed')
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
        .eq('payment_status', 'completed')
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

  const performCheckIn = async (ticketCodeOrId, isUndo = false) => {
    setProcessing(true);
    setCheckInResult(null);

    try {
      // Find ticket by code or ID
      let query = supabase
        .from('tickets')
        .select('id, attendee_name, ticket_code, is_checked_in, event_id')
        .eq('payment_status', 'completed');

      if (ticketCodeOrId.startsWith('TKT-') || ticketCodeOrId.length < 36) {
        query = query.eq('ticket_code', ticketCodeOrId.toUpperCase());
      } else {
        query = query.eq('id', ticketCodeOrId);
      }

      const { data: tickets, error: findError } = await query.single();

      if (findError || !tickets) {
        playSound('error');
        setCheckInResult({
          success: false,
          message: 'Ticket not found. Please check the code and try again.',
        });
        return;
      }

      // Verify ticket is for selected event
      if (tickets.event_id !== selectedEvent) {
        playSound('error');
        setCheckInResult({
          success: false,
          message: 'This ticket is for a different event.',
          attendeeName: tickets.attendee_name,
        });
        return;
      }

      // Check current status
      if (!isUndo && tickets.is_checked_in) {
        playSound('warning');
        setCheckInResult({
          success: false,
          message: 'This ticket has already been checked in.',
          attendeeName: tickets.attendee_name,
          alreadyCheckedIn: true,
        });
        return;
      }

      if (isUndo && !tickets.is_checked_in) {
        setCheckInResult({
          success: false,
          message: 'This ticket is not checked in.',
          attendeeName: tickets.attendee_name,
        });
        return;
      }

      // Perform check-in/out
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          is_checked_in: !isUndo,
          checked_in_at: !isUndo ? new Date().toISOString() : null,
          checked_in_by: !isUndo ? deviceId.current : null,
        })
        .eq('id', tickets.id);

      if (updateError) throw updateError;

      playSound(isUndo ? 'undo' : 'success');
      setCheckInResult({
        success: true,
        message: isUndo ? 'Check-in reversed successfully!' : 'Check-in successful!',
        attendeeName: tickets.attendee_name,
        ticketCode: tickets.ticket_code,
      });

      // Refresh data
      await loadAttendees();
      await loadAuditLog();

      // Clear manual input
      setTicketCode('');

    } catch (error) {
      console.error('Check-in error:', error);
      playSound('error');
      setCheckInResult({
        success: false,
        message: 'An error occurred. Please try again.',
      });
    } finally {
      setProcessing(false);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning with BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
          
          const scanFrame = async () => {
            if (!scanning || !videoRef.current) return;
            
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                stopQRScanner();
                performCheckIn(code);
                return;
              }
            } catch (e) {
              // Continue scanning
            }
            
            requestAnimationFrame(scanFrame);
          };
          
          scanFrame();
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      setScanning(false);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopQRScanner = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Check-In</h2>
          <p className="text-[#0F0F0F]/60 mt-1">
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
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
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
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Manual
          </Button>
        </div>
      </div>

      {/* Event Selection */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-[#2969FF]" />
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="flex-1 rounded-xl border-[#0F0F0F]/10 h-12">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex flex-col">
                      <span>{event.title}</span>
                      <span className="text-xs text-[#0F0F0F]/60">
                        {new Date(event.start_date).toLocaleDateString('en-NG', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#0F0F0F]/60 text-sm">Total</p>
                    <h3 className="text-2xl font-semibold text-[#0F0F0F]">{eventStats.total}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#2969FF]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#0F0F0F]/10 rounded-2xl border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#0F0F0F]/60 text-sm">Checked In</p>
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

            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#0F0F0F]/60 text-sm">Pending</p>
                    <h3 className="text-2xl font-semibold text-[#0F0F0F]">{eventStats.pending}</h3>
                    <p className="text-xs text-[#0F0F0F]/40">
                      {eventStats.total > 0 ? Math.round((eventStats.pending / eventStats.total) * 100) : 0}%
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-4">
                <div>
                  <p className="text-[#0F0F0F]/60 text-sm">Venue</p>
                  <p className="font-medium text-[#0F0F0F] truncate">{currentEvent?.venue_name || 'N/A'}</p>
                  <p className="text-xs text-[#0F0F0F]/40">
                    {currentEvent?.start_date ? new Date(currentEvent.start_date).toLocaleDateString() : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bar */}
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#0F0F0F]/60">Check-in Progress</span>
                <span className="text-sm font-medium text-[#0F0F0F]">
                  {eventStats.checkedIn} / {eventStats.total}
                </span>
              </div>
              <div className="w-full bg-[#F4F6FA] rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2969FF] to-green-500 transition-all duration-500"
                  style={{ width: `${eventStats.total > 0 ? (eventStats.checkedIn / eventStats.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Attendees & Audit Log */}
          <Tabs defaultValue="attendees" className="space-y-4">
            <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
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
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                      <Input
                        placeholder="Search by name, email, or ticket code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="md:w-40 h-12 rounded-xl border-[#0F0F0F]/10">
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
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[#0F0F0F] text-lg">
                    Attendees ({filteredAttendees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAttendees.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                      <p className="text-[#0F0F0F]/60">
                        {attendees.length === 0 ? 'No attendees for this event' : 'No attendees match your filters'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAttendees.map((attendee) => (
                        <div
                          key={attendee.id}
                          className={`p-4 rounded-xl flex items-center justify-between ${
                            attendee.checkedIn ? 'bg-green-50 border border-green-200' : 'bg-[#F4F6FA]'
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
                                <p className="font-medium text-[#0F0F0F] truncate">{attendee.name}</p>
                                <Badge className="bg-[#0F0F0F]/10 text-[#0F0F0F] text-xs">
                                  {attendee.ticketType}
                                </Badge>
                              </div>
                              <p className="text-sm text-[#0F0F0F]/60 truncate">{attendee.email}</p>
                              <p className="text-xs text-[#0F0F0F]/40 font-mono">{attendee.ticketCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {attendee.checkedIn ? (
                              <>
                                <div className="text-right mr-2 hidden md:block">
                                  <p className="text-xs text-green-600">Checked in</p>
                                  <p className="text-xs text-[#0F0F0F]/40">{formatTime(attendee.checkInTime)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => performCheckIn(attendee.id, true)}
                                  className="rounded-xl border-[#0F0F0F]/10"
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
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLog.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                      <p className="text-[#0F0F0F]/60">No check-in activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLog.map((log, index) => (
                        <div
                          key={`${log.id}-${index}`}
                          className="p-3 rounded-xl bg-[#F4F6FA] flex items-center justify-between"
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
                              <p className="font-medium text-[#0F0F0F] text-sm">{log.attendeeName}</p>
                              <p className="text-xs text-[#0F0F0F]/40 font-mono">{log.ticketCode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#0F0F0F]/60">{formatDateTime(log.timestamp)}</p>
                            {log.deviceId && (
                              <p className="text-xs text-[#0F0F0F]/40 flex items-center gap-1 justify-end">
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
        if (!open) stopQRScanner();
        setScanDialogOpen(open);
      }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0F0F0F]">Scan QR Code</DialogTitle>
            <DialogDescription>
              Position the ticket QR code within the frame
            </DialogDescription>
          </DialogHeader>
          
          {checkInResult && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${
              checkInResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {checkInResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${checkInResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {checkInResult.message}
                </p>
                {checkInResult.attendeeName && (
                  <p className={`text-sm mt-1 ${checkInResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {checkInResult.attendeeName}
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

          {scanning && (
            <Button
              variant="outline"
              onClick={stopQRScanner}
              className="w-full rounded-xl"
            >
              Stop Scanner
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Check-In Dialog */}
      <Dialog open={manualCheckInDialog} onOpenChange={setManualCheckInDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#0F0F0F]">Manual Check-In</DialogTitle>
            <DialogDescription>
              Enter the ticket code to check in an attendee
            </DialogDescription>
          </DialogHeader>

          {checkInResult && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${
              checkInResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {checkInResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${checkInResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {checkInResult.message}
                </p>
                {checkInResult.attendeeName && (
                  <p className={`text-sm mt-1 ${checkInResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {checkInResult.attendeeName}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Input
              placeholder="Enter Ticket Code (e.g., TKT-ABC123)"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleManualCheckIn()}
              className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setManualCheckInDialog(false);
                  setTicketCode('');
                  setCheckInResult(null);
                }}
                className="rounded-xl border-[#0F0F0F]/10 flex-1"
              >
                Close
              </Button>
              <Button
                onClick={handleManualCheckIn}
                disabled={!ticketCode.trim() || processing}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Check In
                  </>
                )}
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
