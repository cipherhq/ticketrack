import { currencyOptions, formatPrice } from '@/config/currencies'
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  X, Calendar, Clock, MapPin, Ticket, Image as ImageIcon,
  Plus, Trash2, Upload, Loader2, DollarSign, Info, ExternalLink,
  Users, Pencil,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { createEvent, createTicketTypes, updateEvent } from '../../services/organizerService';
import { supabase } from '@/lib/supabase';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const eventTypes = [
  'Concert', 'Party/Club', 'Wedding', 'Comedy',
  'Conference', 'Church Event', 'Festival', 'Sports',
  'Theater', 'Exhibition', 'Workshop', 'Other',
];

const seatingTypes = ['Standing', 'Seated', 'Mixed'];

const timezones = [
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
];

export function CreateEvent() {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = Boolean(id);
  const templateData = location.state?.template;
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tabErrors, setTabErrors] = useState({});
  const [urlManuallyEdited, setUrlManuallyEdited] = useState(false);
  const [urlStatus, setUrlStatus] = useState({ checking: false, available: null, message: "" });
  const urlCheckTimeout = useRef(null);

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
    timezone: 'Africa/Lagos',
    isMultiDay: false,
    eventDays: [],
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
    isPhotographyAllowed: false,
    isRecordingAllowed: false,
    isParkingAvailable: false,
    isOutsideFoodAllowed: false,
    dressCode: '',
    // Media
    promoVideoUrl: '',
    // Fee Handling
    feeHandling: 'pass_to_attendee',
    // Free Event
    isFree: false,
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
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Load event data for edit mode or template
  useEffect(() => {
    const loadEventData = async () => {
      // Edit mode - load from database
      if (isEditMode && id) {
        setLoadingEvent(true);
        try {
          const { data: event, error } = await supabase
            .from("events")
            .select("*, ticket_types(*)")
            .eq("id", id)
            .single();

          if (error) throw error;
          if (event) {
            setFormData({
              title: event.title || "",
              eventType: event.event_type || "",
              description: event.description || "",
              category: event.category || "",
              startDate: event.start_date ? event.start_date.split("T")[0] : "",
              startTime: event.start_date ? event.start_date.split("T")[1]?.substring(0, 5) : "",
              endDate: event.end_date ? event.end_date.split("T")[0] : "",
              endTime: event.end_date ? event.end_date.split("T")[1]?.substring(0, 5) : "",
              gateOpeningTime: event.gate_opening_time || "",
              timezone: event.timezone || "Africa/Lagos",
              isMultiDay: event.is_multi_day || false,
              isRecurring: event.is_recurring || false,
              recurringPattern: event.recurring_pattern || "",
              venueName: event.venue_name || "",
              venueAddress: event.venue_address || "",
              googleMapLink: event.google_map_link || "",
              venueType: event.venue_type || "indoor",
              venueCapacity: event.total_capacity || "",
              seatingType: event.seating_type || "Standing",
              city: event.city || "",
              country: event.country_code || "",
              currency: event.currency || "",
              venueLat: event.venue_lat || null,
              venueLng: event.venue_lng || null,
              isAdultOnly: event.is_adult_only || false,
              isWheelchairAccessible: event.is_wheelchair_accessible || false,
              isBYOB: event.is_byob || false,
              isPhotographyAllowed: event.is_photography_allowed !== false,
              isRecordingAllowed: event.is_recording_allowed !== false,
              isParkingAvailable: event.is_parking_available || false,
              isOutsideFoodAllowed: event.is_outside_food_allowed || false,
              dressCode: event.dress_code || "",
              promoVideoUrl: event.promo_video_url || "",
              feeHandling: event.fee_handling || "pass_to_attendee",
              isFree: event.is_free || false,
              custom_url: event.custom_url || "",
              agreedToTerms: true,
            });
            if (event.image_url) {
              setBannerPreview(event.image_url);
            }
            if (event.ticket_types && event.ticket_types.length > 0) {
              setTickets(event.ticket_types.map((t, idx) => ({
                dbId: t.id,
                id: idx + 1,
                name: t.name || "",
                price: t.price || "",
                quantity: t.quantity_available || "",
                description: t.description || "",
                isRefundable: t.is_refundable !== false,
              })));

            // Load event days for multi-day events
            if (event.is_multi_day) {
              const { data: eventDays, error: daysError } = await supabase
                .from('event_days')
                .select('*, event_day_activities(*)')
                .eq('event_id', id)
                .order('day_number', { ascending: true });

              if (!daysError && eventDays && eventDays.length > 0) {
                const formattedDays = eventDays.map(day => ({
                  id: day.id,
                  dayNumber: day.day_number,
                  date: day.date,
                  startTime: day.start_time || '',
                  endTime: day.end_time || '',
                  title: day.title || '',
                  description: day.description || '',
                  activities: (day.event_day_activities || [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map(act => ({
                      id: act.id,
                      title: act.title || '',
                      startTime: act.start_time || '',
                      endTime: act.end_time || '',
                      description: act.description || '',
                      location: act.location || '',
                      sortOrder: act.sort_order,
                    }))
                }));
                setFormData(prev => ({ ...prev, eventDays: formattedDays }));
              }
            }

            // Load sponsor logos
            const { data: sponsors, error: sponsorsError } = await supabase
              .from('event_sponsors')
              .select('*')
              .eq('event_id', id)
              .order('sort_order', { ascending: true });

            if (!sponsorsError && sponsors && sponsors.length > 0) {
              setSponsorLogos(sponsors.map(s => ({
                id: s.id,
                preview: s.logo_url,
                file: null // Already uploaded
              })));
            }
            }
          }
        } catch (err) {
          console.error("Error loading event:", err);
          setError("Failed to load event data");
        } finally {
          setLoadingEvent(false);
        }
      }
      // Template mode - load from location state
      else if (templateData) {
        setFormData(prev => ({
          ...prev,
          title: templateData.title ? templateData.title + " (Copy)" : "",
          description: templateData.description || "",
          category: templateData.category || "",
          venueName: templateData.venue_name || "",
          venueAddress: templateData.venue_address || "",
          city: templateData.city || "",
          country: templateData.country_code || "",
          currency: templateData.currency || "",
          timezone: templateData.timezone || "Africa/Lagos",
          isFree: templateData.is_free || false,
        }));
        if (templateData.image_url) {
          setBannerPreview(templateData.image_url);
        }
        if (templateData.ticket_types && templateData.ticket_types.length > 0) {
          setTickets(templateData.ticket_types.map((t, idx) => ({
            id: idx + 1,
            name: t.name || "",
            price: t.price || "",
            quantity: t.quantity_available || "",
            description: t.description || "",
            isRefundable: true,
          })));
        }
      }
    };
    loadEventData();
  }, [id, isEditMode, templateData]);


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

  const goToNextTab = () => {
    if (!isLastTab) {
      setActiveTab(tabs[currentTabIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    if (!isFirstTab) {
      setActiveTab(tabs[currentTabIndex - 1].id);
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
        .neq("id", eventId || "00000000-0000-0000-0000-000000000000")
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setUrlStatus({ checking: false, available: false, message: "URL already taken" });
      } else {
        setUrlStatus({ checking: false, available: true, message: "Available!" });
      }
    } catch (err) {
      setUrlStatus({ checking: false, available: null, message: "" });
    }
  };

  const handleInputChange = (field, value) => {
    // Auto-populate custom_url from title
    if (field === "title" && !urlManuallyEdited) {
      const slug = generateSlug(value);
      setFormData(prev => ({ ...prev, title: value, custom_url: slug }));
      // Debounce URL check
      clearTimeout(urlCheckTimeout.current);
      urlCheckTimeout.current = setTimeout(() => checkUrlAvailability(slug), 500);
      return;
    }
    // Check URL when custom_url changes
    if (field === "custom_url") {
      setUrlManuallyEdited(true);
      clearTimeout(urlCheckTimeout.current);
      urlCheckTimeout.current = setTimeout(() => checkUrlAvailability(value), 500);
    }
    if (field === 'eventType') { setFormData(prev => ({ ...prev, eventType: value, category: value })); } else { setFormData(prev => ({ ...prev, [field]: value })); }
  };


  // =====================================================
  // MULTI-DAY EVENT HELPER FUNCTIONS
  // =====================================================

  // Add a new empty day card
  const addEventDay = () => {
    const lastDay = formData.eventDays[formData.eventDays.length - 1];
    const nextDate = lastDay 
      ? new Date(new Date(lastDay.date).getTime() + 86400000).toISOString().split("T")[0]
      : formData.startDate || new Date().toISOString().split("T")[0];
    
    setFormData(prev => ({
      ...prev,
      eventDays: [...prev.eventDays, {
        id: crypto.randomUUID(),
        dayNumber: prev.eventDays.length + 1,
        date: nextDate,
        startTime: "",
        endTime: "",
        title: "",
        description: "",
        activities: []
      }]
    }));
  };

  // Remove a day card by index
  const removeEventDay = (index) => {
    setFormData(prev => ({
      ...prev,
      eventDays: prev.eventDays
        .filter((_, i) => i !== index)
        .map((day, i) => ({ ...day, dayNumber: i + 1 }))
    }));
  };

  // Update a specific field in a day card
  const updateEventDay = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      eventDays: prev.eventDays.map((day, i) => 
        i === index ? { ...day, [field]: value } : day
      )
    }));
  };

  // Auto-generate consecutive days from start date
  const generateEventDays = (count) => {
    const baseDate = formData.startDate || new Date().toISOString().split("T")[0];
    const days = [];
    for (let i = 0; i < count; i++) {
      const date = new Date(new Date(baseDate).getTime() + (i * 86400000)).toISOString().split("T")[0];
      days.push({
        id: crypto.randomUUID(),
        dayNumber: i + 1,
        date: date,
        startTime: formData.startTime || "",
        endTime: formData.endTime || "",
        title: "",
        description: "",
        activities: []
      });
    }
    setFormData(prev => ({ ...prev, eventDays: days }));
  };

  // Add activity to a specific day
  const addActivity = (dayIndex) => {
    setFormData(prev => ({
      ...prev,
      eventDays: prev.eventDays.map((day, i) => 
        i === dayIndex ? {
          ...day,
          activities: [...day.activities, {
            id: crypto.randomUUID(),
            title: "",
            startTime: "",
            endTime: "",
            description: "",
            location: "",
            sortOrder: day.activities.length
          }]
        } : day
      )
    }));
  };

  // Remove activity from a day
  const removeActivity = (dayIndex, activityIndex) => {
    setFormData(prev => ({
      ...prev,
      eventDays: prev.eventDays.map((day, i) => 
        i === dayIndex ? {
          ...day,
          activities: day.activities.filter((_, ai) => ai !== activityIndex)
        } : day
      )
    }));
  };

  // Update activity field
  const updateActivity = (dayIndex, activityIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      eventDays: prev.eventDays.map((day, i) => 
        i === dayIndex ? {
          ...day,
          activities: day.activities.map((act, ai) => 
            ai === activityIndex ? { ...act, [field]: value } : act
          )
        } : day
      )
    }));
  };

  // =====================================================
  // END MULTI-DAY EVENT HELPER FUNCTIONS
  // =====================================================

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
    // Reset the input so the same file can be selected again
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

  // Ticket Functions
  const addTicket = () => {
    setTickets([...tickets, { 
      id: Date.now(), name: '', price: '', quantity: '', description: '', isRefundable: true 
    }]);
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

  // Submit
  const handleSubmit = async () => {
    if (!organizer?.id) {
      setError('Organizer profile not found');
      return;
    }

    const validTickets = tickets.filter(t => t.name && t.price && t.quantity);
    if (validTickets.length === 0) {
      setError('Please add at least one ticket type');
      setActiveTab('ticketing');
      return;
    }


    // Validate and identify which tabs have errors
    const errors = {};
    if (!formData.title || !formData.eventType || !formData.description) {
      errors.details = "Missing title, event type, or description";
    }
    if (!formData.startDate || !formData.startTime) {
      errors.datetime = "Missing start date or time";
    }
    if (!formData.venueAddress) {
      errors.venue = "Missing venue address";
    }
    if (!formData.currency) {
      errors.ticketing = "Please select a currency for your event";
    }
    
    setTabErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      const firstErrorTab = Object.keys(errors)[0];
      setActiveTab(firstErrorTab);
      setError(Object.values(errors).join(". "));
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Upload banner image if new one selected
      let imageUrl = (bannerPreview && !bannerPreview.startsWith('blob:')) ? bannerPreview : null;
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
        } else {
          console.error("Image upload failed:", uploadError);
        }
      }

      const startDateTime = `${formData.startDate}T${formData.startTime || '00:00'}:00`;
      const endDateTime = formData.endDate 
        ? `${formData.endDate}T${formData.endTime || '23:59'}:00`
        : `${formData.startDate}T${formData.endTime || '23:59'}:00`;

      const totalCapacity = validTickets.reduce((sum, t) => sum + (parseInt(t.quantity) || 0), 0);

      const eventData = {
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
        is_photography_allowed: formData.isPhotographyAllowed,
        is_recording_allowed: formData.isRecordingAllowed,
        is_parking_available: formData.isParkingAvailable,
        is_outside_food_allowed: formData.isOutsideFoodAllowed,
        dress_code: formData.dressCode,
        total_capacity: parseInt(formData.venueCapacity) || totalCapacity,
        image_url: imageUrl,
        promo_video_url: formData.promoVideoUrl,
        fee_handling: formData.feeHandling,
        currency: formData.currency,
        status: 'published',
      };

      let savedEvent;

      if (isEditMode && id) {
        // EDIT MODE: Update existing event
        
        // Fetch current event data for audit history
        const { data: currentEvent } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        // Update the event
        savedEvent = await updateEvent(id, eventData);

        // Determine which fields changed
        const changedFields = [];
        Object.keys(eventData).forEach(key => {
          if (JSON.stringify(currentEvent[key]) !== JSON.stringify(eventData[key])) {
            changedFields.push(key);
          }
        });

        // Log to event_history for audit trail
        if (changedFields.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('event_history').insert({
            event_id: id,
            changed_by: user?.id,
            change_type: 'updated',
            previous_data: currentEvent,
            new_data: savedEvent,
            changed_fields: changedFields,
          });
        }

        // Update existing ticket types
        for (const ticket of validTickets) {
          if (ticket.dbId) {
            // Update existing ticket type
            await supabase
              .from('ticket_types')
              .update({
                name: ticket.name,
                price: parseFloat(ticket.price) || 0,
                quantity_available: parseInt(ticket.quantity) || 0,
                description: ticket.description || '',
                is_refundable: ticket.isRefundable !== false,
                currency: formData.currency,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ticket.dbId);
          } else {
            // Create new ticket type
            await supabase
              .from('ticket_types')
              .insert({
                event_id: id,
                name: ticket.name,
                price: parseFloat(ticket.price) || 0,
                quantity_available: parseInt(ticket.quantity) || 0,
                description: ticket.description || '',
                is_refundable: ticket.isRefundable !== false,
                currency: formData.currency,
                is_active: true,
              });
          }
        }

      } else {
        // CREATE MODE: Create new event
        savedEvent = await createEvent(organizer.id, eventData);

        // Log creation to event_history
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('event_history').insert({
          event_id: savedEvent.id,
          changed_by: user?.id,
          change_type: 'created',
          previous_data: null,
          new_data: savedEvent,
          changed_fields: Object.keys(eventData),
        });

        // Create regular ticket types
        await createTicketTypes(savedEvent.id, validTickets);

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
          await createTicketTypes(savedEvent.id, tableTicketsFormatted);
        }
      }


      // =====================================================
      // SAVE MULTI-DAY EVENT SCHEDULE
      // =====================================================
      if (formData.isMultiDay && formData.eventDays.length > 0) {
        const eventId = savedEvent.id;
        
        // In edit mode, delete existing days first (cascade deletes activities)
        if (isEditMode && id) {
          await supabase
            .from('event_days')
            .delete()
            .eq('event_id', id);
        }

        // Insert each day
        for (const day of formData.eventDays) {
          const { data: savedDay, error: dayError } = await supabase
            .from('event_days')
            .insert({
              event_id: eventId,
              day_number: day.dayNumber,
              date: day.date,
              start_time: day.startTime || null,
              end_time: day.endTime || null,
              title: day.title || null,
              description: day.description || null,
            })
            .select()
            .single();

          if (dayError) {
            console.error('Error saving event day:', dayError);
            continue;
          }

          // Insert activities for this day
          if (day.activities && day.activities.length > 0) {
            const activitiesData = day.activities.map((act, index) => ({
              event_day_id: savedDay.id,
              title: act.title,
              start_time: act.startTime || null,
              end_time: act.endTime || null,
              description: act.description || null,
              location: act.location || null,
              sort_order: index,
            }));

            const { error: actError } = await supabase
              .from('event_day_activities')
              .insert(activitiesData);

            if (actError) {
              console.error('Error saving activities:', actError);
            }
          }
        }
      }
      // =====================================================
      // END MULTI-DAY SAVE
      // =====================================================

      // =====================================================
      // SAVE SPONSOR LOGOS
      // =====================================================
      if (sponsorLogos.length > 0) {
        const eventId = savedEvent.id;
        
        // In edit mode, delete existing sponsors first
        if (isEditMode && id) {
          await supabase
            .from('event_sponsors')
            .delete()
            .eq('event_id', id);
        }

        // Upload and save each sponsor logo
        for (let i = 0; i < sponsorLogos.length; i++) {
          const logo = sponsorLogos[i];
          let logoUrl = logo.preview;
          
          // If it's a new file (blob URL), upload to storage
          if (logo.file && logo.preview.startsWith('blob:')) {
            const fileExt = logo.file.name.split('.').pop();
            const fileName = `${eventId}/sponsor_${i}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('event-images')
              .upload(fileName, logo.file);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('event-images')
                .getPublicUrl(fileName);
              logoUrl = publicUrl;
            } else {
              console.error('Sponsor logo upload failed:', uploadError);
              continue;
            }
          }

          // Save to database
          await supabase
            .from('event_sponsors')
            .insert({
              event_id: eventId,
              logo_url: logoUrl,
              sort_order: i,
            });
        }
      }
      // =====================================================
      // END SPONSOR SAVE
      // =====================================================

      navigate('/organizer/events');
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#0F0F0F]/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#0F0F0F]">Create Event — Full Details</h2>
              <p className="text-[#0F0F0F]/60">Fill in all event information to get started</p>
            </div>
            <button onClick={() => navigate('/organizer/events')} className="p-2 hover:bg-[#F4F6FA] rounded-xl">
              <X className="w-6 h-6 text-[#0F0F0F]/60" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#0F0F0F]/10">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <Info className="w-5 h-5" />{error}
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
                    placeholder="my-awesome-event"
                    value={formData.custom_url}
                    onChange={(e) => handleInputChange("custom_url", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"))}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {urlStatus.checking && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {urlStatus.available === true && <span className="text-xs text-green-600">✓ {urlStatus.message}</span>}
                  {urlStatus.available === false && <span className="text-xs text-red-600">✗ {urlStatus.message}</span>}
                  {!urlStatus.checking && urlStatus.available === null && <span className="text-xs text-[#0F0F0F]/40">Leave blank to auto-generate from title</span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Category <span className="text-red-500">*</span></Label>
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
                <div className="rounded-xl overflow-hidden border border-[#E5E7EB] bg-white">
                  <ReactQuill
                    theme="snow"
                    value={formData.description}
                    onChange={(value) => handleInputChange('description', value)}
                    placeholder="Describe your event in detail..."
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                      ]
                    }}
                    formats={['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link']}
                    className="bg-[#F4F6FA] [&_.ql-editor]:min-h-[150px] [&_.ql-toolbar]:bg-white [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-[#E5E7EB] [&_.ql-container]:border-0"
                  />
                </div>
              </div>


              {/* Event Banner Image - FIXED */}
              <div className="space-y-2">
                <Label>Event Banner Image</Label>
                
                {/* Hidden file input */}
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
                      {/* Edit and Remove buttons */}
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
                  <Label>Gate Opening Time <span className="text-red-500">*</span></Label>
                  <Input
                    type="time"
                    value={formData.gateOpeningTime}
                    onChange={(e) => handleInputChange('gateOpeningTime', e.target.value)}
                    className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone <span className="text-red-500">*</span></Label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
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
                {/* Multi-Day Event UI - Shows when checkbox is checked */}
                {formData.isMultiDay && (
                  <div className="mt-4 p-5 bg-gradient-to-r from-[#2969FF]/10 to-[#2969FF]/5 rounded-xl border-2 border-[#2969FF]/30 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[#0F0F0F] text-lg flex items-center gap-2">
                        📅 Multi-Day Schedule
                      </h3>
                    </div>

                    {/* Quick Start Buttons - Only show if no days exist */}
                    {formData.eventDays.length === 0 && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">How would you like to set up your event days?</p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => generateEventDays(2)}
                            className="px-4 py-2 bg-[#2969FF] text-white rounded-xl hover:bg-[#2969FF]/90 transition-colors text-sm font-medium"
                          >
                            📅 Generate 2 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => generateEventDays(3)}
                            className="px-4 py-2 bg-[#2969FF] text-white rounded-xl hover:bg-[#2969FF]/90 transition-colors text-sm font-medium"
                          >
                            📅 Generate 3 Days
                          </button>
                          <button
                            type="button"
                            onClick={addEventDay}
                            className="px-4 py-2 bg-white border-2 border-[#2969FF] text-[#2969FF] rounded-xl hover:bg-[#2969FF]/5 transition-colors text-sm font-medium"
                          >
                            ✋ Add Manually
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Day Cards */}
                    {formData.eventDays.length > 0 && (
                      <div className="space-y-4">
                        {formData.eventDays.map((day, dayIndex) => (
                          <div key={day.id} className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
                            {/* Day Header */}
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-[#2969FF]">Day {day.dayNumber}</h4>
                              <button
                                type="button"
                                onClick={() => removeEventDay(dayIndex)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove day"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Day Details Grid */}
                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-sm">Date <span className="text-red-500">*</span></Label>
                                <Input
                                  type="date"
                                  value={day.date}
                                  onChange={(e) => updateEventDay(dayIndex, 'date', e.target.value)}
                                  className="h-10 rounded-lg bg-[#F4F6FA] border-0"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-sm">Day Title (optional)</Label>
                                <Input
                                  placeholder="e.g., Opening Day"
                                  value={day.title}
                                  onChange={(e) => updateEventDay(dayIndex, 'title', e.target.value)}
                                  className="h-10 rounded-lg bg-[#F4F6FA] border-0"
                                />
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-sm">Start Time</Label>
                                <Input
                                  type="time"
                                  value={day.startTime}
                                  onChange={(e) => updateEventDay(dayIndex, 'startTime', e.target.value)}
                                  className="h-10 rounded-lg bg-[#F4F6FA] border-0"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-sm">End Time</Label>
                                <Input
                                  type="time"
                                  value={day.endTime}
                                  onChange={(e) => updateEventDay(dayIndex, 'endTime', e.target.value)}
                                  className="h-10 rounded-lg bg-[#F4F6FA] border-0"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-sm">Day Description</Label>
                              <textarea
                                placeholder="What's happening on this day?"
                                value={day.description}
                                onChange={(e) => updateEventDay(dayIndex, 'description', e.target.value)}
                                className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-[#F4F6FA] border-0 resize-none text-sm"
                              />
                            </div>

                            {/* Activities Section */}
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-gray-700">Activities / Schedule (optional)</Label>
                              </div>
                              
                              {day.activities.length > 0 && (
                                <div className="space-y-2">
                                  {day.activities.map((activity, actIndex) => (
                                    <div key={activity.id} className="flex items-start gap-2 p-2 bg-[#F4F6FA] rounded-lg">
                                      <div className="flex-1 grid grid-cols-3 gap-2">
                                        <Input
                                          type="time"
                                          value={activity.startTime}
                                          onChange={(e) => updateActivity(dayIndex, actIndex, 'startTime', e.target.value)}
                                          className="h-8 rounded-md bg-white border-0 text-sm"
                                          placeholder="Time"
                                        />
                                        <Input
                                          placeholder="Activity title"
                                          value={activity.title}
                                          onChange={(e) => updateActivity(dayIndex, actIndex, 'title', e.target.value)}
                                          className="h-8 rounded-md bg-white border-0 text-sm col-span-2"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeActivity(dayIndex, actIndex)}
                                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => addActivity(dayIndex)}
                                className="text-sm text-[#2969FF] hover:text-[#2969FF]/80 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add activity
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Add Another Day Button */}
                        <button
                          type="button"
                          onClick={addEventDay}
                          className="w-full py-3 border-2 border-dashed border-[#2969FF]/30 rounded-xl text-[#2969FF] hover:bg-[#2969FF]/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Add another day
                        </button>
                      </div>
                    )}
                  </div>
                )}

                
                {/* Multi-Day Event UI - Shows when checkbox is checked */}
                {formData.isMultiDay && (
                  <div className="mt-4 p-5 bg-gradient-to-r from-[#2969FF]/10 to-[#2969FF]/5 rounded-xl border-2 border-[#2969FF]/30 space-y-5">
                    
                  </div>
                )}
                
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
                <Label>Venue Name (optional)</Label>
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

              {/* Venue Layout Map - FIXED */}
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
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="photography"
                      checked={formData.isPhotographyAllowed}
                      onCheckedChange={(checked) => handleInputChange('isPhotographyAllowed', checked)}
                    />
                    <Label htmlFor="photography" className="cursor-pointer">Photography allowed</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="recording"
                      checked={formData.isRecordingAllowed}
                      onCheckedChange={(checked) => handleInputChange('isRecordingAllowed', checked)}
                    />
                    <Label htmlFor="recording" className="cursor-pointer">Video recording allowed</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="parking"
                      checked={formData.isParkingAvailable}
                      onCheckedChange={(checked) => handleInputChange('isParkingAvailable', checked)}
                    />
                    <Label htmlFor="parking" className="cursor-pointer">Parking available</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="outsidefood"
                      checked={formData.isOutsideFoodAllowed}
                      onCheckedChange={(checked) => handleInputChange('isOutsideFoodAllowed', checked)}
                    />
                    <Label htmlFor="outsidefood" className="cursor-pointer">Outside food allowed</Label>
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
            <div className="space-y-6">
              {/* Currency Selection - REQUIRED FIRST */}
              <div className="p-5 bg-gradient-to-r from-[#2969FF]/10 to-[#2969FF]/5 rounded-xl border-2 border-[#2969FF]/30">
                <Label className="font-semibold text-[#0F0F0F] text-lg flex items-center gap-2 mb-3">
                  <span className="text-xl">💰</span> Event Currency <span className="text-red-500">*</span>
                </Label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className={`w-full sm:w-auto px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2969FF] text-base font-medium ${
                    !formData.currency ? 'border-amber-300' : 'border-[#2969FF]/30'
                  }`}
                >
                  <option value="">-- Select Currency --</option>
                  {currencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {!formData.currency && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <span>⚠️</span> Please select the currency for ticket prices
                  </p>
                )}
              </div>

              {/* Show message if no currency selected */}
              {!formData.currency ? (
                <div className="text-center py-12 bg-[#F4F6FA] rounded-xl border-2 border-dashed border-[#0F0F0F]/20">
                  <p className="text-[#0F0F0F]/50 text-lg">Select a currency above to add tickets</p>
                </div>
              ) : (
                <>
                  {/* Regular Tickets */}
                  <div>
                    <h3 className="font-semibold text-[#0F0F0F]">Ticket Categories</h3>
                    <p className="text-sm text-[#0F0F0F]/60">Create unlimited ticket types for your event</p>
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
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={ticket.price}
                          onChange={(e) => updateTicket(ticket.id, 'price', e.target.value)}
                          className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                        />
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

                  {/* Add Ticket Button */}
                  <button
                    type="button"
                    onClick={addTicket}
                    className="w-full py-3 border-2 border-dashed border-[#2969FF]/30 rounded-xl text-[#2969FF] hover:bg-[#2969FF]/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add another ticket type
                  </button>

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
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={table.price}
                            onChange={(e) => updateTableTicket(table.id, 'price', e.target.value)}
                            className="h-12 rounded-xl bg-[#F4F6FA] border-0"
                          />
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
            onClick={isFirstTab ? () => navigate('/organizer/events') : goToPrevTab}
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
  );
}
