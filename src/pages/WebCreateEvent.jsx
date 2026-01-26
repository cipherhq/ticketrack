import { currencyOptions, formatPrice, getCurrencyFromCountryCode } from '@/config/currencies'
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Calendar, Clock, MapPin, Ticket, Image as ImageIcon,
  Plus, Trash2, Upload, Loader2, DollarSign, Info, ExternalLink,
  Users, Pencil, ArrowLeft, CheckCircle, XCircle,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const eventTypes = [
  'Concert', 'Party/Club', 'Wedding', 'Comedy',
  'Conference', 'Church Event', 'Festival', 'Sports',
  'Theater', 'Exhibition', 'Workshop', 'Other',
];

const seatingTypes = ['Standing', 'Seated', 'Mixed'];

import { timezones, getUserTimezone, getTimezonesByRegion } from '@/utils/timezones';

export function WebCreateEvent() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [urlManuallyEdited, setUrlManuallyEdited] = useState(false);
  const [tabErrors, setTabErrors] = useState({});
  const errorRef = useRef(null);
  
  // Helper function to set error and scroll to show it
  const showError = (message) => {
    setError(message);
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };
  const [urlStatus, setUrlStatus] = useState({ checking: false, available: null, message: "" });
  const urlCheckTimeout = useRef(null);
  const ticketingSectionRef = useRef(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?redirect=/create-event');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Set default currency from user profile country
  useEffect(() => {
    const setDefaultCurrency = async () => {
      if (!user?.id || formData.currency) return;
      try {
        // Get user country from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("country_code")
          .eq("id", user.id)
          .single();
        if (profile?.country_code) {
          const currency = await getCurrencyFromCountryCode(supabase, profile.country_code);
          if (currency) {
            setFormData(prev => ({ ...prev, currency }));
          }
        }
      } catch (err) {
        console.error("Error getting default currency:", err);
      }
    };
    setDefaultCurrency();
  }, [user?.id]);

  // Refs for file inputs
  const bannerInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const sponsorInputRef = useRef(null);
  const venueLayoutInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    // Event Details
    title: '',
    custom_url: '',
    eventType: '',
    description: '',
    category: '',
    // Date & Time
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    gateOpeningTime: '',
    timezone: getUserTimezone(),
    isMultiDay: false,
    isRecurring: false,
    recurringPattern: '',
    // Venue Details
    venueName: '',
    venueAddress: '',
    googleMapLink: '',
    venueType: 'indoor',
    venueCapacity: '',
    seatingType: 'Standing',
    city: '',
    country: '',
    currency: '',
    venueLat: null,
    venueLng: null,
    isAdultOnly: false,
    isWheelchairAccessible: false,
    isBYOB: false,
    dressCode: '',
    // Media
    promoVideoUrl: '',
    // Fee Handling
    feeHandling: 'pass_to_attendee',
    // Free Event
    isFreeEvent: false,
    freeEventCapacity: '',
    // Terms
    agreedToTerms: false,
  });

  // Tickets State
  const [tickets, setTickets] = useState([
    { id: 1, name: '', price: '', quantity: '', description: '', isRefundable: true },
  ]);

  // Table Tickets State
  const [tableTickets, setTableTickets] = useState([]);

  // Event Banner Image State
  const [bannerImage, setBannerImage] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');

  // Venue Layout Image State
  const [venueLayoutImage, setVenueLayoutImage] = useState(null);
  const [venueLayoutPreview, setVenueLayoutPreview] = useState('');

  // Images State (for gallery)
  const [eventImages, setEventImages] = useState([]);
  const [sponsorLogos, setSponsorLogos] = useState([]);

  const tabs = [
    { id: 'details', label: 'Event Details', icon: Calendar },
    { id: 'datetime', label: 'Date & Time', icon: Clock },
    { id: 'venue', label: 'Venue Details', icon: MapPin },
    { id: 'ticketing', label: 'Ticketing', icon: Ticket },
    { id: 'media', label: 'Media & Sponsors', icon: ImageIcon },
  ];

  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
  const isLastTab = currentTabIndex === tabs.length - 1;
  const isFirstTab = currentTabIndex === 0;

  // Validate current tab before proceeding
  const validateCurrentTab = () => {
    const errors = [];
    
    if (activeTab === 'details') {
      if (!formData.title?.trim()) errors.push("Event title is required");
      if (!formData.eventType) errors.push("Event type is required");
      if (!formData.description?.trim()) {
        errors.push("Description is required");
      } else if (formData.description.trim().length < 25) {
        errors.push("Description must be at least 25 characters");
      }
      if (formData.custom_url && urlStatus.available === false) {
        errors.push("Custom event URL is already taken");
      }
    }
    
    if (activeTab === 'datetime') {
      if (!formData.startDate) errors.push("Start date is required");
      if (!formData.startTime) errors.push("Start time is required");
      if (!formData.endTime) errors.push("End time is required");
    }
    
    if (activeTab === 'venue') {
      if (!formData.venueName?.trim()) errors.push("Venue name is required");
      if (!formData.venueAddress?.trim()) errors.push("Venue address is required");
    }
    
    if (activeTab === 'ticketing') {
      const validTickets = tickets.filter(t => t.name?.trim() && parseInt(t.quantity) > 0);
      if (!formData.isFreeEvent && validTickets.length === 0) {
        errors.push("At least one ticket type is required");
      }
    }
    
    return errors;
  };

  const goToNextTab = () => {
    const errors = validateCurrentTab();
    if (errors.length > 0) {
      setError(errors.join(". "));
      setTabErrors({ [activeTab]: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError("");
    setTabErrors({});
    if (!isLastTab) {
      setActiveTab(tabs[currentTabIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevTab = () => {
    if (!isFirstTab) {
      setActiveTab(tabs[currentTabIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  // Generate slug from title
  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  };

  // Check URL availability
  const checkUrlAvailability = async (url) => {
    if (!url || url.length < 3) {
      setUrlStatus({ checking: false, available: null, message: "" });
      return;
    }
    setUrlStatus({ checking: true, available: null, message: "Checking..." });
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .or(`slug.eq.${url},custom_url.eq.${url}`)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setUrlStatus({ checking: false, available: false, message: "URL already taken" });
      } else {
        setUrlStatus({ checking: false, available: true, message: "Available!" });
      }
    } catch (err) {
      console.error("Error checking URL availability:", err);
      setUrlStatus({ checking: false, available: null, message: "Error checking availability" });
    }
  };

  const handleInputChange = (field, value) => {
    // Auto-populate custom_url from title
    if (field === "title") {
      // Remove special characters from title (only allow letters, numbers, spaces, hyphens, apostrophes)
      const sanitizedTitle = value.replace(/[^a-zA-Z0-9\s\-']/g, '');
      
      if (!urlManuallyEdited) {
        const slug = generateSlug(sanitizedTitle);
        setFormData(prev => ({ ...prev, title: sanitizedTitle, custom_url: slug }));
        clearTimeout(urlCheckTimeout.current);
        urlCheckTimeout.current = setTimeout(() => checkUrlAvailability(slug), 500);
      } else {
        setFormData(prev => ({ ...prev, title: sanitizedTitle }));
      }
      return;
    }
    if (field === "custom_url") {
      setUrlManuallyEdited(true);
      clearTimeout(urlCheckTimeout.current);
      urlCheckTimeout.current = setTimeout(() => checkUrlAvailability(value), 500);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle place selection from Google Maps autocomplete
  const handlePlaceSelect = (place) => {
    setFormData(prev => ({
      ...prev,
      venueAddress: place.address,
      venueName: place.name || prev.venueName,
      googleMapLink: place.googleMapLink || '',
      city: place.city || prev.city,
      country: place.country || prev.country,
      venueLat: place.lat || null,
      venueLng: place.lng || null,
    }));
  };

  // Banner Image Functions
  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setBannerImage(file);
      setBannerPreview(URL.createObjectURL(file));
    }
    if (e.target) e.target.value = '';
  };

  const removeBanner = () => {
    setBannerImage(null);
    setBannerPreview('');
  };

  const triggerBannerUpload = () => {
    bannerInputRef.current?.click();
  };

  // Venue Layout Image Functions
  const handleVenueLayoutChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setVenueLayoutImage(file);
      setVenueLayoutPreview(URL.createObjectURL(file));
    }
    if (e.target) e.target.value = '';
  };

  const removeVenueLayout = () => {
    setVenueLayoutImage(null);
    setVenueLayoutPreview('');
  };

  // Scroll ticketing section to top when tab becomes active
  useEffect(() => {
    if (activeTab === 'ticketing' && ticketingSectionRef.current) {
      // Use setTimeout to ensure DOM is rendered
      setTimeout(() => {
        ticketingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [activeTab]);

  // Ticket Functions
  const addTicket = () => {
    setTickets([...tickets, { 
      id: Date.now(), name: '', price: '', quantity: '', description: '', isRefundable: true 
    }]);
    // Don't auto-scroll when adding ticket - keep current scroll position
  };

  const removeTicket = (id) => {
    if (tickets.length > 1) {
      setTickets(tickets.filter(t => t.id !== id));
    }
  };

  const updateTicket = (id, field, value) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Table Ticket Functions
  const addTableTicket = () => {
    setTableTickets([...tableTickets, { 
      id: Date.now(), 
      name: '', 
      price: '', 
      seatsPerTable: '', 
      quantity: '', 
      description: '' 
    }]);
  };

  const removeTableTicket = (id) => {
    setTableTickets(tableTickets.filter(t => t.id !== id));
  };

  const updateTableTicket = (id, field, value) => {
    setTableTickets(tableTickets.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Image Upload for Gallery
  const handleEventImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (eventImages.length + files.length > 10) {
      alert('Maximum 10 images allowed');
      return;
    }
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setEventImages([...eventImages, ...newImages]);
    if (e.target) e.target.value = '';
  };

  const removeEventImage = (index) => {
    setEventImages(eventImages.filter((_, i) => i !== index));
  };

  const handleSponsorLogoChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (sponsorLogos.length + files.length > 5) {
      alert('Maximum 5 sponsor logos allowed');
      return;
    }
    const newLogos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setSponsorLogos([...sponsorLogos, ...newLogos]);
    if (e.target) e.target.value = '';
  };

  const removeSponsorLogo = (index) => {
    setSponsorLogos(sponsorLogos.filter((_, i) => i !== index));
  };

  // Get or create organizer
  const getOrCreateOrganizer = async () => {
    const { data: existingOrg } = await supabase
      .from('organizers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingOrg) return existingOrg;

    const { data: newOrg, error } = await supabase
      .from('organizers')
      .insert({
        user_id: user.id,
        business_name: user.user_metadata?.full_name || 'My Organization',
        business_email: user.email,
        business_phone: user.user_metadata?.phone || '',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return newOrg;
  };

  // Create event helper
  const createEventRecord = async (organizerId, eventData) => {
    const slug = eventData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    const { data, error } = await supabase
      .from('events')
      .insert({ organizer_id: organizerId, slug, status: 'draft', ...eventData })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  // Create ticket types helper
  const createTicketTypes = async (eventId, ticketTypes) => {
    const tickets = ticketTypes.map((t, i) => ({
      event_id: eventId,
      name: t.name,
      description: t.description || '',
      price: parseFloat(t.price) || 0,
      quantity_available: parseInt(t.quantity) || 0,
      quantity_sold: 0,
      is_active: true,
      sort_order: i,
    }));
    const { data, error } = await supabase.from('ticket_types').insert(tickets).select();
    if (error) throw error;
    return data;
  };

  // Submit
  const handleSubmit = async () => {
    if (!user?.id) {
      showError('Please log in to create an event');
      return;
    }

    const validTickets = formData.isFreeEvent ? [] : tickets.filter(t => t.name && t.price && t.quantity);
    if (!formData.isFreeEvent && validTickets.length === 0) {
      showError('Please add at least one ticket type');
      setActiveTab('ticketing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }


    // Validate and identify which tabs have errors
    const errors = {};
    if (!formData.title || !formData.eventType || !formData.description) {
      errors.details = "Missing title, event type, or description";
    }
    if (formData.custom_url && urlStatus.available === false) {
      errors.details = "Custom event URL is already taken - please choose a different one";
    }
    if (!formData.startDate || !formData.startTime) {
      errors.datetime = "Missing start date or time";
    }
    if (!formData.venueName || !formData.venueAddress) {
      errors.venue = "Missing venue name or address";
    }
    
    setTabErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      const firstErrorTab = Object.keys(errors)[0];
      setActiveTab(firstErrorTab);
      showError(Object.values(errors).join(". "));
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Get or create organizer record
      const organizer = await getOrCreateOrganizer();

      // Upload banner image
      let imageUrl = null;
      if (bannerImage) {
        const fileExt = bannerImage.name.split('.').pop();
        const fileName = `${organizer.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(fileName, bannerImage);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      const startDateTime = `${formData.startDate}T${formData.startTime || '00:00'}:00`;
      const endDateTime = formData.endDate 
        ? `${formData.endDate}T${formData.endTime || '23:59'}:00`
        : `${formData.startDate}T${formData.endTime || '23:59'}:00`;

      const totalCapacity = validTickets.reduce((sum, t) => sum + (parseInt(t.quantity) || 0), 0);

      const event = await createEventRecord(organizer.id, {
        title: formData.title,
        custom_url: formData.custom_url || null,
        description: formData.description,
        event_type: formData.eventType,
        category: formData.category,
        start_date: startDateTime,
        end_date: endDateTime,
        gate_opening_time: formData.gateOpeningTime || null,
        timezone: formData.timezone,
        is_multi_day: formData.isMultiDay,
        is_recurring: formData.isRecurring,
        recurring_pattern: formData.recurringPattern,
        venue_name: formData.venueName,
        venue_address: formData.venueAddress,
        google_map_link: formData.googleMapLink,
        venue_type: formData.venueType,
        seating_type: formData.seatingType,
        venue_lat: formData.venueLat,
        venue_lng: formData.venueLng,
        city: formData.city,
        is_adult_only: formData.isAdultOnly,
        is_wheelchair_accessible: formData.isWheelchairAccessible,
        is_byob: formData.isBYOB,
        dress_code: formData.dressCode,
        total_capacity: parseInt(formData.venueCapacity) || totalCapacity,
        image_url: imageUrl,
        promo_video_url: formData.promoVideoUrl,
        fee_handling: formData.feeHandling,
        is_free: formData.isFreeEvent,
      });

      // Create ticket types
      if (formData.isFreeEvent) {
        // Create single free registration ticket
        await createTicketTypes(event.id, [{
          name: 'Free Registration',
          price: '0',
          quantity: formData.freeEventCapacity || '9999',
          description: 'Free event registration'
        }]);
      } else {
        await createTicketTypes(event.id, validTickets);
      }

      // Create table tickets as ticket types
      const validTableTickets = tableTickets.filter(t => t.name && t.price && t.quantity);
      if (validTableTickets.length > 0) {
        const tableTicketsFormatted = validTableTickets.map(t => ({
          name: t.name,
          price: t.price,
          quantity: t.quantity,
          description: t.description || `Table with ${t.seatsPerTable} seats`,
          isTableTicket: true,
          seatsPerTable: t.seatsPerTable,
        }));
        await createTicketTypes(event.id, tableTicketsFormatted);
      }

      // Redirect to organizer dashboard
      navigate('/organizer/events');
    } catch (err) {
      console.error('Error creating event:', err);
      showError(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <h1 className="text-xl font-semibold text-[#0F0F0F]">Create Event</h1>
          <div className="w-24" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-[#0F0F0F]/10">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tabErrors[tab.id] ? "border-red-500 text-red-500" : ""} ${
                    activeTab === tab.id
                      ? 'border-[#2969FF] text-[#2969FF]'
                      : 'border-transparent text-[#0F0F0F]/60 hover:text-[#0F0F0F]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div ref={errorRef} className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Event Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Event Title <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter event title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Custom Event URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0F0F0F]/60 whitespace-nowrap">ticketrack.com/e/</span>
                    <Input
                      placeholder={formData.title?.trim() ? "my-awesome-event" : "Enter event title first"}
                      value={formData.custom_url}
                      onChange={(e) => handleInputChange("custom_url", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"))}
                      disabled={!formData.title?.trim()}
                      className={`h-12 rounded-xl bg-[#F4F6FA] flex-1 ${!formData.title?.trim() ? 'opacity-50 cursor-not-allowed' : ''} ${urlStatus.available === false ? 'border-2 border-red-500' : urlStatus.available === true ? 'border-2 border-green-500' : 'border-0'}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => checkUrlAvailability(formData.custom_url)}
                      disabled={urlStatus.checking || !formData.custom_url || formData.custom_url.length < 3 || !formData.title?.trim()}
                      className="h-12 px-4 rounded-xl whitespace-nowrap"
                    >
                      {urlStatus.checking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Check'
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {!formData.title?.trim() && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Please enter an event title first - the URL will be auto-generated
                      </span>
                    )}
                    {formData.title?.trim() && urlStatus.available === true && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {urlStatus.message}
                      </span>
                    )}
                    {formData.title?.trim() && urlStatus.available === false && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {urlStatus.message} - please choose a different URL
                      </span>
                    )}
                    {formData.title?.trim() && !urlStatus.checking && urlStatus.available === null && (
                      <span className="text-xs text-[#0F0F0F]/40">Leave blank to auto-generate from title</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Event Type <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {eventTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange('eventType', type)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          formData.eventType === type
                            ? 'border-[#2969FF] bg-[#2969FF]/5 text-[#2969FF]'
                            : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Event Description <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder="Describe your event in detail..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="min-h-[150px] rounded-xl bg-[#F4F6FA] border-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Event Category <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g., Music, Business, Entertainment"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                  />
                </div>

                {/* Event Banner Image */}
                <div className="space-y-2">
                  <Label>Event Banner Image</Label>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBannerChange}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-[#0F0F0F]/10 rounded-xl p-6">
                    {bannerPreview ? (
                      <div className="relative">
                        <img 
                          src={bannerPreview} 
                          alt="Event banner preview" 
                          className="w-full h-48 object-cover rounded-xl"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button
                            type="button"
                            onClick={triggerBannerUpload}
                            className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center hover:bg-[#2969FF]/90"
                            title="Change image"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={removeBanner}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ImageIcon className="w-12 h-12 text-[#0F0F0F]/30 mx-auto mb-3" />
                        <p className="text-[#0F0F0F]/60 mb-1">Upload event banner image</p>
                        <p className="text-[#0F0F0F]/40 text-sm mb-4">Recommended: 1920x1080px (16:9), Max 5MB</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={triggerBannerUpload}
                          className="rounded-xl"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Choose Image
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time Tab */}
            {activeTab === 'datetime' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time <span className="text-red-500">*</span></Label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time <span className="text-red-500">*</span></Label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gate Opening Time</Label>
                    <Input
                      type="time"
                      value={formData.gateOpeningTime}
                      onChange={(e) => handleInputChange('gateOpeningTime', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                      placeholder="Optional"
                    />
                    <p className="text-xs text-[#0F0F0F]/40">Optional - when gates open for attendees</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone <span className="text-red-500">*</span></Label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0"
                    >
                      {Object.entries(getTimezonesByRegion()).map(([region, tzList]) => (
                        <optgroup key={region} label={region}>
                          {tzList.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="multiday"
                      checked={formData.isMultiDay}
                      onCheckedChange={(checked) => handleInputChange('isMultiDay', checked)}
                    />
                    <Label htmlFor="multiday" className="cursor-pointer">Multi-day event</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="recurring"
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => handleInputChange('isRecurring', checked)}
                      />
                      <Label htmlFor="recurring" className="cursor-pointer">Recurring event (weekly parties, services, etc.)</Label>
                    </div>
                    
                    {formData.isRecurring && (
                      <div className="ml-7 space-y-2">
                        <Label>Recurring Pattern</Label>
                        <Input
                          placeholder="e.g., Every Friday at 8 PM"
                          value={formData.recurringPattern}
                          onChange={(e) => handleInputChange('recurringPattern', e.target.value)}
                          className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Venue Details Tab */}
            {activeTab === 'venue' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Venue Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter venue name"
                    value={formData.venueName}
                    onChange={(e) => handleInputChange('venueName', e.target.value)}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Full Address <span className="text-red-500">*</span></Label>
                  <AddressAutocomplete
                    value={formData.venueAddress}
                    onChange={(address) => handleInputChange('venueAddress', address)}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Search for venue address..."
                  />
                  <p className="text-xs text-[#0F0F0F]/50">Start typing to search for venues and addresses</p>
                </div>

                <div className="space-y-2">
                  <Label>Venue Type <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-2 gap-3">
                    {['indoor', 'outdoor'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange('venueType', type)}
                        className={`p-4 rounded-xl border text-center capitalize transition-all ${
                          formData.venueType === type
                            ? 'border-[#2969FF] bg-[#2969FF]/5 text-[#2969FF]'
                            : 'border-[#0F0F0F]/10'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Venue Capacity <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="Maximum attendees"
                      value={formData.venueCapacity}
                      onChange={(e) => handleInputChange('venueCapacity', e.target.value)}
                      className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seating Type <span className="text-red-500">*</span></Label>
                    <select
                      value={formData.seatingType}
                      onChange={(e) => handleInputChange('seatingType', e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0"
                    >
                      {seatingTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Venue Layout Map */}
                <div className="space-y-2">
                  <Label>Upload Venue Layout Map (Optional)</Label>
                  <input
                    ref={venueLayoutInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleVenueLayoutChange}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-[#0F0F0F]/10 rounded-xl p-6">
                    {venueLayoutPreview ? (
                      <div className="relative">
                        <img 
                          src={venueLayoutPreview} 
                          alt="Venue layout preview" 
                          className="w-full h-40 object-contain rounded-xl bg-[#F4F6FA]"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => venueLayoutInputRef.current?.click()}
                            className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center hover:bg-[#2969FF]/90"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={removeVenueLayout}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Upload className="w-8 h-8 text-[#0F0F0F]/30 mx-auto mb-2" />
                        <p className="text-[#0F0F0F]/60 text-sm mb-3">Upload venue seating layout or floor plan</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => venueLayoutInputRef.current?.click()}
                          className="rounded-xl"
                        >
                          Choose File
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-medium text-[#0F0F0F]">Additional Options</p>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="adult"
                        checked={formData.isAdultOnly}
                        onCheckedChange={(checked) => handleInputChange('isAdultOnly', checked)}
                      />
                      <Label htmlFor="adult" className="cursor-pointer">Adult only event (18+/21+)</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="wheelchair"
                        checked={formData.isWheelchairAccessible}
                        onCheckedChange={(checked) => handleInputChange('isWheelchairAccessible', checked)}
                      />
                      <Label htmlFor="wheelchair" className="cursor-pointer">Wheelchair accessible</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="byob"
                        checked={formData.isBYOB}
                        onCheckedChange={(checked) => handleInputChange('isBYOB', checked)}
                      />
                      <Label htmlFor="byob" className="cursor-pointer">BYOB (Bring Your Own Bottle/Beverage)</Label>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>Dress Code</Label>
                      <Input
                        placeholder="e.g., Smart Casual, Black Tie, Traditional"
                        value={formData.dressCode}
                        onChange={(e) => handleInputChange('dressCode', e.target.value)}
                        className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Ticketing Tab */}
            {activeTab === 'ticketing' && (
              <div ref={ticketingSectionRef} className="space-y-6">
                {/* Free Event Toggle */}
                <Card className="border-[#0F0F0F]/10 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#0F0F0F]">This is a Free Event</h3>
                          <p className="text-sm text-[#0F0F0F]/60">No tickets required - attendees register for free</p>
                        </div>
                      </div>
                      <Checkbox
                        id="freeEvent"
                        checked={formData.isFreeEvent}
                        onCheckedChange={(checked) => handleInputChange('isFreeEvent', checked)}
                        className="h-6 w-6"
                      />
                    </div>
                    
                    {formData.isFreeEvent && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <div className="space-y-2">
                          <Label>Maximum Registrations (Optional)</Label>
                          <Input
                            type="number"
                            placeholder="Leave empty for unlimited"
                            value={formData.freeEventCapacity}
                            onChange={(e) => handleInputChange('freeEventCapacity', e.target.value)}
                            className="h-12 rounded-xl bg-white border-green-200"
                          />
                          <p className="text-xs text-[#0F0F0F]/50">Set a limit or leave empty for unlimited registrations</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                {!formData.isFreeEvent && (
                  <>

                {/* Currency Selection */}
                <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl mb-6">
                  <Label className="font-medium text-[#0F0F0F]">Currency</Label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="px-4 py-2 rounded-lg border border-[#0F0F0F]/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                  >
                    {currencyOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Regular Tickets */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0F0F0F]">Ticket Categories</h3>
                    <p className="text-sm text-[#0F0F0F]/60">Create unlimited ticket types for your event</p>
                  </div>
                  <Button onClick={addTicket} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />Add Ticket
                  </Button>
                </div>

                {tickets.map((ticket, index) => (
                  <Card key={ticket.id} className="border-[#0F0F0F]/10 rounded-xl">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#2969FF]">Ticket {index + 1}</span>
                        {tickets.length > 1 && (
                          <button onClick={() => removeTicket(ticket.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ticket Name <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g., GA, VIP, VVIP, Early Bird"
                            value={ticket.name}
                            onChange={(e) => updateTicket(ticket.id, 'name', e.target.value)}
                            className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Price <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0F0F0F]/60">
                              {currencyOptions.find(c => c.value === formData.currency)?.symbol || "₦"}
                            </span>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={ticket.price}
                              onChange={(e) => updateTicket(ticket.id, "price", e.target.value)}
                              className="h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantity Available <span className="text-red-500">*</span></Label>
                          <Input
                            type="number"
                            placeholder="Number of tickets"
                            value={ticket.quantity}
                            onChange={(e) => updateTicket(ticket.id, 'quantity', e.target.value)}
                            className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Refundable</Label>
                          <div className="flex items-center gap-4 h-12">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`refund-${ticket.id}`}
                                checked={ticket.isRefundable}
                                onChange={() => updateTicket(ticket.id, 'isRefundable', true)}
                                className="text-[#2969FF]"
                              />
                              Yes
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`refund-${ticket.id}`}
                                checked={!ticket.isRefundable}
                                onChange={() => updateTicket(ticket.id, 'isRefundable', false)}
                                className="text-[#2969FF]"
                              />
                              No
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Ticket Description</Label>
                        <Textarea
                          placeholder="Describe what's included in this ticket..."
                          value={ticket.description}
                          onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)}
                          className="rounded-xl bg-[#F4F6FA] border-0"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <hr className="border-[#0F0F0F]/10" />

                {/* Table Tickets */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0F0F0F]">Table Tickets</h3>
                    <p className="text-sm text-[#0F0F0F]/60">Add VIP tables or group seating options</p>
                  </div>
                  <Button onClick={addTableTicket} variant="outline" className="rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />Add Table
                  </Button>
                </div>

                {tableTickets.length === 0 ? (
                  <p className="text-center text-[#0F0F0F]/40 py-4">
                    No table tickets added yet. Click "Add Table" to create one.
                  </p>
                ) : (
                  tableTickets.map((table, index) => (
                    <Card key={table.id} className="border-[#0F0F0F]/10 rounded-xl">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#2969FF] flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Table {index + 1}
                          </span>
                          <button onClick={() => removeTableTicket(table.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Table Name <span className="text-red-500">*</span></Label>
                            <Input
                              placeholder="e.g., VIP Table, VVIP Table"
                              value={table.name}
                              onChange={(e) => updateTableTicket(table.id, 'name', e.target.value)}
                              className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Price per Table <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0F0F0F]/60">
                                {currencyOptions.find(c => c.value === formData.currency)?.symbol || "₦"}
                              </span>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={table.price}
                                onChange={(e) => updateTableTicket(table.id, "price", e.target.value)}
                                className="h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Seats per Table <span className="text-red-500">*</span></Label>
                            <Input
                              type="number"
                              placeholder="e.g., 6, 8, 10"
                              value={table.seatsPerTable}
                              onChange={(e) => updateTableTicket(table.id, 'seatsPerTable', e.target.value)}
                              className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Number of Tables <span className="text-red-500">*</span></Label>
                            <Input
                              type="number"
                              placeholder="Available tables"
                              value={table.quantity}
                              onChange={(e) => updateTableTicket(table.id, 'quantity', e.target.value)}
                              className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Table Description</Label>
                          <Textarea
                            placeholder="Describe what's included (e.g., bottles, mixers, server)..."
                            value={table.description}
                            onChange={(e) => updateTableTicket(table.id, 'description', e.target.value)}
                            className="rounded-xl bg-[#F4F6FA] border-0"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                <hr className="border-[#0F0F0F]/10" />

                {/* Fee Handling */}
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-[#0F0F0F]/60" />
                      <div>
                        <h3 className="font-semibold text-[#0F0F0F]">Transaction Fee Handling</h3>
                        <p className="text-sm text-[#0F0F0F]/60">Choose who pays the Ticketrack platform fees</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.feeHandling === 'pass_to_attendee'
                            ? 'border-[#2969FF] bg-[#2969FF]/5'
                            : 'border-[#0F0F0F]/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="feeHandling"
                          value="pass_to_attendee"
                          checked={formData.feeHandling === 'pass_to_attendee'}
                          onChange={(e) => handleInputChange('feeHandling', e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium">Pass fees to attendees</span>
                          <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Recommended</span>
                          <p className="text-sm text-[#0F0F0F]/60 mt-1">
                            Attendees pay a small service fee on top of the ticket price. You receive the full ticket amount.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.feeHandling === 'absorb'
                            ? 'border-[#2969FF] bg-[#2969FF]/5'
                            : 'border-[#0F0F0F]/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="feeHandling"
                          value="absorb"
                          checked={formData.feeHandling === 'absorb'}
                          onChange={(e) => handleInputChange('feeHandling', e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium">Absorb fees (Organizer pays)</span>
                          <p className="text-sm text-[#0F0F0F]/60 mt-1">
                            You cover the platform fees. Attendees pay exactly the ticket price with no additional charges.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-[#2969FF]/5 rounded-xl text-sm text-[#2969FF]">
                      <Info className="w-4 h-4" />
                      Platform fees are typically 2.5% + processing charges. You can view the exact breakdown in your payout reports.
                    </div>
                  </CardContent>
                </Card>
                  </>
                )}
              </div>
            )}

            {/* Media & Sponsors Tab */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-[#0F0F0F] mb-1">Photo Gallery</h3>
                  <p className="text-sm text-[#0F0F0F]/60 mb-4">Upload 3–10 images for your event</p>
                  
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEventImagesChange}
                    className="hidden"
                  />
                  
                  <div className="border-2 border-dashed border-[#0F0F0F]/10 rounded-xl p-8">
                    {eventImages.length > 0 ? (
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                        {eventImages.map((img, index) => (
                          <div key={index} className="relative aspect-square">
                            <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                            <button
                              onClick={() => removeEventImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-10 h-10 text-[#0F0F0F]/30 mx-auto mb-2" />
                        <p className="text-[#0F0F0F]/60 text-sm mb-3">Upload event photos (JPG, PNG)</p>
                      </div>
                    )}
                    <div className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => galleryInputRef.current?.click()}
                        className="rounded-xl"
                      >
                        {eventImages.length > 0 ? 'Add More Photos' : 'Choose Photos'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Promo Video URL (Optional)</Label>
                  <Input
                    placeholder="YouTube, Instagram Reel, or TikTok URL"
                    value={formData.promoVideoUrl}
                    onChange={(e) => handleInputChange('promoVideoUrl', e.target.value)}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                  />
                  <p className="text-sm text-[#0F0F0F]/60">Paste a link to your event promo video from YouTube, Instagram, or TikTok</p>
                </div>

                <hr className="border-[#0F0F0F]/10" />

                <div>
                  <h3 className="font-semibold text-[#0F0F0F] mb-1">Sponsor Logos</h3>
                  <p className="text-sm text-[#0F0F0F]/60 mb-4">Add up to 5 sponsor logos • These logos will appear on event tickets</p>
                  
                  <input
                    ref={sponsorInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSponsorLogoChange}
                    className="hidden"
                  />
                  
                  <div className="border-2 border-dashed border-[#0F0F0F]/10 rounded-xl p-8">
                    {sponsorLogos.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-4">
                        {sponsorLogos.map((logo, index) => (
                          <div key={index} className="relative w-20 h-20">
                            <img src={logo.preview} alt="" className="w-full h-full object-contain rounded-lg bg-white border" />
                            <button
                              onClick={() => removeSponsorLogo(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-[#0F0F0F]/30 mx-auto mb-2" />
                      <p className="text-[#0F0F0F]/60 text-sm mb-1">Add Sponsor Logo</p>
                      <p className="text-[#0F0F0F]/40 text-xs mb-3">PNG format recommended for best quality on tickets</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => sponsorInputRef.current?.click()}
                        className="rounded-xl text-[#2969FF] border-[#2969FF]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Upload Sponsor Logo
                      </Button>
                    </div>
                  </div>

                  {sponsorLogos.length === 0 && (
                    <p className="text-center text-[#0F0F0F]/40 text-sm mt-4">No sponsor logos added yet</p>
                  )}

                  <div className="flex items-center gap-2 p-3 bg-[#2969FF]/5 rounded-xl text-sm text-[#2969FF] mt-4">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    Sponsor logos will be displayed on digital event tickets that attendees receive via email and can download. Upload high-quality logos for best results.
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="mt-8 p-4 bg-[#F4F6FA] rounded-xl">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={formData.agreedToTerms}
                      onCheckedChange={(checked) => handleInputChange('agreedToTerms', checked)}
                      className="mt-1"
                    />
                    <label htmlFor="terms" className="text-sm text-[#0F0F0F]/80 cursor-pointer">
                      I agree to the{' '}
                      <a href="/terms" target="_blank" className="text-[#2969FF] hover:underline">
                        Terms and Conditions
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" target="_blank" className="text-[#2969FF] hover:underline">
                        Privacy Policy
                      </a>
                      . I confirm that I have the right to organize this event and all information provided is accurate.
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#0F0F0F]/10 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={isFirstTab ? () => navigate('/') : goToPrevTab}
              className="rounded-xl px-6"
            >
              {isFirstTab ? 'Cancel' : 'Back'}
            </Button>
            {isLastTab ? (
              <Button
                onClick={handleSubmit}
                disabled={saving || !formData.agreedToTerms}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  'Create Event'
                )}
              </Button>
            ) : (
              <Button
                onClick={goToNextTab}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
