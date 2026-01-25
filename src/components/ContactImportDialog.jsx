import { useState, useCallback } from 'react';
import {
  Upload, FileText, Check, AlertCircle, Loader2, X,
  ChevronRight, ChevronLeft, Download, RefreshCw, Users,
  Mail, Phone, Tag, Calendar, MapPin, DollarSign
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';

// ============================================================================
// IMPORT DATA TYPES
// ============================================================================

const IMPORT_TYPES = [
  { 
    id: 'attendees', 
    name: 'Event Attendees', 
    icon: Users, 
    description: 'People who attended your events',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  { 
    id: 'contacts', 
    name: 'General Contacts', 
    icon: Users, 
    description: 'Newsletter subscribers, leads, or general contacts',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  { 
    id: 'orders', 
    name: 'Order/Sales Data', 
    icon: DollarSign, 
    description: 'Ticket purchases with transaction details',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  { 
    id: 'followers', 
    name: 'Followers/Subscribers', 
    icon: Users, 
    description: 'Social media followers or email subscribers',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
];

// ============================================================================
// PLATFORM CONFIGURATIONS
// ============================================================================

const PLATFORMS = {
  csv: {
    id: 'csv',
    name: 'CSV/Excel File',
    icon: FileText,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: 'Upload a CSV or Excel file with contact data',
    helpText: 'Supports .csv, .xlsx formats',
    sampleUrl: null,
    fieldMapping: null, // Dynamic mapping
    category: 'general',
  },
  eventbrite: {
    id: 'eventbrite',
    name: 'Eventbrite',
    icon: () => <span className="text-lg font-bold text-orange-500">EB</span>,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Import attendees from Eventbrite CSV export',
    helpText: 'Go to Manage Events → Reports → Export Attendees',
    sampleUrl: 'https://www.eventbrite.com/organizations/home',
    category: 'ticketing',
    fieldMapping: {
      'Order #': 'order_id',
      'Order Date': 'order_date',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Attendee #': 'attendee_id',
      'Ticket Type': 'ticket_type',
      'Ticket Quantity': 'quantity',
      'Ticket Price': 'price',
      'Buyer First Name': 'buyer_first_name',
      'Buyer Last Name': 'buyer_last_name',
      'Buyer Email': 'buyer_email',
      'Event Name': 'event_name',
      'Event Date': 'event_date',
      'Cell Phone': 'phone',
      'Home Phone': 'phone_alt',
    },
  },
  tixafrica: {
    id: 'tixafrica',
    name: 'Tix.Africa',
    icon: () => <span className="text-lg font-bold text-purple-500">TX</span>,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Import attendees from Tix.Africa export',
    helpText: 'Go to Dashboard → Orders → Export to CSV',
    sampleUrl: 'https://tix.africa',
    category: 'ticketing',
    fieldMapping: {
      'Name': 'full_name',
      'Full Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'Phone Number': 'phone',
      'Mobile': 'phone',
      'Ticket Type': 'ticket_type',
      'Ticket Name': 'ticket_type',
      'Event': 'event_name',
      'Event Name': 'event_name',
      'Order Date': 'order_date',
      'Purchase Date': 'order_date',
      'Amount': 'amount_paid',
      'Total': 'amount_paid',
    },
  },
  africatickets: {
    id: 'africatickets',
    name: 'AfricaTickets',
    icon: () => <span className="text-lg font-bold text-green-600">AT</span>,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Import attendees from AfricaTickets.com export',
    helpText: 'Go to My Events → Attendees → Export',
    sampleUrl: 'https://africatickets.com',
    category: 'ticketing',
    fieldMapping: {
      'Attendee Name': 'full_name',
      'Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Phone Number': 'phone',
      'Ticket': 'ticket_type',
      'Ticket Type': 'ticket_type',
      'Event': 'event_name',
      'Date': 'order_date',
      'Purchase Date': 'order_date',
    },
  },
  partyvest: {
    id: 'partyvest',
    name: 'PartyVest',
    icon: () => <span className="text-lg font-bold text-indigo-600">PV</span>,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    description: 'Import attendees from PartyVest export',
    helpText: 'Go to Events → Guest List → Download CSV',
    sampleUrl: 'https://partyvest.com',
    category: 'ticketing',
    fieldMapping: {
      'Guest Name': 'full_name',
      'Name': 'full_name',
      'Full Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'Phone Number': 'phone',
      'Mobile': 'phone',
      'WhatsApp': 'phone',
      'Ticket Type': 'ticket_type',
      'Ticket': 'ticket_type',
      'Ticket Name': 'ticket_type',
      'Event': 'event_name',
      'Event Name': 'event_name',
      'Party': 'event_name',
      'Order Date': 'order_date',
      'Purchase Date': 'order_date',
      'Date': 'order_date',
      'Amount': 'amount_paid',
      'Total': 'amount_paid',
      'Price': 'amount_paid',
      'Check-in Status': 'checkin_status',
      'Checked In': 'checkin_status',
    },
  },
  posh: {
    id: 'posh',
    name: 'Posh.vip',
    icon: () => <span className="text-lg font-bold text-violet-600">P</span>,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    description: 'Import guests from Posh.vip export',
    helpText: 'Go to Events → Guest List → Export',
    sampleUrl: 'https://posh.vip',
    category: 'ticketing',
    fieldMapping: {
      'Guest': 'full_name',
      'Name': 'full_name',
      'Full Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'Phone Number': 'phone',
      'Mobile': 'phone',
      'Ticket Type': 'ticket_type',
      'Ticket': 'ticket_type',
      'Tier': 'ticket_type',
      'Event': 'event_name',
      'Event Name': 'event_name',
      'Party': 'event_name',
      'Order Date': 'order_date',
      'Purchase Date': 'order_date',
      'Purchased': 'order_date',
      'Amount': 'amount_paid',
      'Total': 'amount_paid',
      'Spent': 'amount_paid',
      'Instagram': 'instagram',
      'IG': 'instagram',
      'VIP': 'vip_status',
      'Table': 'table_number',
    },
  },
  stubhub: {
    id: 'stubhub',
    name: 'StubHub',
    icon: () => <span className="text-lg font-bold text-blue-600">SH</span>,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Import sales data from StubHub export',
    helpText: 'Go to Selling → Sales History → Download',
    sampleUrl: 'https://www.stubhub.com',
    category: 'ticketing',
    fieldMapping: {
      'Buyer Name': 'full_name',
      'Buyer First Name': 'first_name',
      'Buyer Last Name': 'last_name',
      'Buyer Email': 'email',
      'Email': 'email',
      'Phone': 'phone',
      'Event': 'event_name',
      'Event Name': 'event_name',
      'Event Date': 'event_date',
      'Section': 'section',
      'Row': 'row',
      'Seats': 'seats',
      'Quantity': 'quantity',
      'Sale Price': 'price',
      'Sale Date': 'order_date',
    },
  },
  shoobs: {
    id: 'shoobs',
    name: 'Shoobs',
    icon: () => <span className="text-lg font-bold text-pink-600">SB</span>,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    description: 'Import guests from Shoobs export',
    helpText: 'Go to Event Dashboard → Guest List → Export',
    sampleUrl: 'https://www.shoobs.com',
    category: 'ticketing',
    fieldMapping: {
      'Guest Name': 'full_name',
      'Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'Mobile': 'phone',
      'Ticket Type': 'ticket_type',
      'Event': 'event_name',
      'Date Purchased': 'order_date',
    },
  },
  axs: {
    id: 'axs',
    name: 'AXS',
    icon: () => <span className="text-lg font-bold text-red-600">AXS</span>,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Import ticket holders from AXS export',
    helpText: 'Go to Event Management → Reports → Export Buyers',
    sampleUrl: 'https://www.axs.com',
    category: 'ticketing',
    fieldMapping: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email Address': 'email',
      'Email': 'email',
      'Phone Number': 'phone',
      'Phone': 'phone',
      'Event Name': 'event_name',
      'Event': 'event_name',
      'Event Date': 'event_date',
      'Venue': 'venue',
      'Section': 'section',
      'Row': 'row',
      'Seat': 'seat',
      'Price': 'price',
      'Order Date': 'order_date',
      'Order Number': 'order_id',
    },
  },
  ticketmaster: {
    id: 'ticketmaster',
    name: 'Ticketmaster',
    icon: () => <span className="text-lg font-bold text-blue-800">TM</span>,
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
    description: 'Import from Ticketmaster export',
    helpText: 'Go to Account → Order History → Download',
    sampleUrl: 'https://www.ticketmaster.com',
    category: 'ticketing',
    fieldMapping: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Event Name': 'event_name',
      'Event Date': 'event_date',
      'Venue': 'venue',
      'Section': 'section',
      'Row': 'row',
      'Seat': 'seat',
      'Order Number': 'order_id',
      'Order Date': 'order_date',
    },
  },
  dice: {
    id: 'dice',
    name: 'DICE',
    icon: () => <span className="text-lg font-bold text-black">D</span>,
    color: 'text-gray-900',
    bgColor: 'bg-gray-200',
    description: 'Import from DICE export',
    helpText: 'Go to Events → Guest List → Export',
    sampleUrl: 'https://dice.fm',
    category: 'ticketing',
    fieldMapping: {
      'Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Event': 'event_name',
      'Date': 'event_date',
      'Ticket Type': 'ticket_type',
      'Order Date': 'order_date',
    },
  },
  universe: {
    id: 'universe',
    name: 'Universe',
    icon: () => <span className="text-lg font-bold text-cyan-600">U</span>,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    description: 'Import from Universe.com export',
    helpText: 'Go to Event → Orders → Export',
    sampleUrl: 'https://universe.com',
    category: 'ticketing',
    fieldMapping: {
      'Buyer Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Event': 'event_name',
      'Ticket': 'ticket_type',
      'Order Date': 'order_date',
      'Total': 'amount_paid',
    },
  },
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    icon: () => <span className="text-lg font-bold text-yellow-600">MC</span>,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Import subscribers from Mailchimp export',
    helpText: 'Go to Audience → All Contacts → Export Audience',
    sampleUrl: 'https://mailchimp.com',
    category: 'crm',
    fieldMapping: {
      'Email Address': 'email',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Phone Number': 'phone',
      'Phone': 'phone',
      'Address': 'address',
      'Birthday': 'birthday',
      'MEMBER_RATING': 'engagement_score',
      'OPTIN_TIME': 'consent_timestamp',
      'TAGS': 'tags',
    },
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    icon: () => <span className="text-lg font-bold text-orange-500">HS</span>,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100',
    description: 'Import contacts from HubSpot CRM export',
    helpText: 'Go to Contacts → Export → Select Properties',
    sampleUrl: 'https://hubspot.com',
    category: 'crm',
    fieldMapping: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone Number': 'phone',
      'Mobile Phone Number': 'phone',
      'Company': 'company',
      'Job Title': 'job_title',
      'City': 'city',
      'State/Region': 'state',
      'Country': 'country',
      'Create Date': 'created_at',
      'Last Activity Date': 'last_activity',
    },
  },
  zoho: {
    id: 'zoho',
    name: 'Zoho CRM',
    icon: () => <span className="text-lg font-bold text-red-500">Z</span>,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    description: 'Import contacts from Zoho CRM export',
    helpText: 'Go to Contacts → Actions → Export',
    sampleUrl: 'https://crm.zoho.com',
    category: 'crm',
    fieldMapping: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Mobile': 'phone',
      'Mailing Street': 'address',
      'Mailing City': 'city',
      'Mailing State': 'state',
      'Mailing Country': 'country',
      'Lead Source': 'source',
      'Created Time': 'created_at',
    },
  },
  seetickets: {
    id: 'seetickets',
    name: 'See Tickets',
    icon: () => <span className="text-lg font-bold text-teal-600">ST</span>,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    description: 'Import from See Tickets export',
    helpText: 'Go to Reports → Attendee List → Export',
    sampleUrl: 'https://seetickets.com',
    category: 'ticketing',
    fieldMapping: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Event': 'event_name',
      'Ticket Type': 'ticket_type',
      'Order Date': 'order_date',
      'Order Number': 'order_id',
    },
  },
  skiddle: {
    id: 'skiddle',
    name: 'Skiddle',
    icon: () => <span className="text-lg font-bold text-lime-600">SK</span>,
    color: 'text-lime-600',
    bgColor: 'bg-lime-100',
    description: 'Import from Skiddle export',
    helpText: 'Go to Promoter Dashboard → Exports',
    sampleUrl: 'https://skiddle.com',
    category: 'ticketing',
    fieldMapping: {
      'Customer Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Mobile': 'phone',
      'Event': 'event_name',
      'Ticket': 'ticket_type',
      'Date': 'order_date',
    },
  },
  resident_advisor: {
    id: 'resident_advisor',
    name: 'Resident Advisor',
    icon: () => <span className="text-lg font-bold text-black">RA</span>,
    color: 'text-gray-900',
    bgColor: 'bg-gray-200',
    description: 'Import from Resident Advisor export',
    helpText: 'Go to Promoter Tools → Guest Lists → Export',
    sampleUrl: 'https://ra.co',
    category: 'ticketing',
    fieldMapping: {
      'Name': 'full_name',
      'Email': 'email',
      'Event': 'event_name',
      'Ticket Type': 'ticket_type',
      'Purchase Date': 'order_date',
    },
  },
  afro_nation: {
    id: 'afro_nation',
    name: 'Afro Nation',
    icon: () => <span className="text-lg font-bold text-amber-600">AN</span>,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Import from Afro Nation ticket export',
    helpText: 'Contact Afro Nation for attendee data export',
    sampleUrl: 'https://afronation.com',
    category: 'ticketing',
    fieldMapping: {
      'Name': 'full_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email': 'email',
      'Phone': 'phone',
      'Ticket Type': 'ticket_type',
      'Event': 'event_name',
    },
  },
};

// Standard field types we map to
const STANDARD_FIELDS = {
  first_name: { label: 'First Name', icon: Users },
  last_name: { label: 'Last Name', icon: Users },
  full_name: { label: 'Full Name', icon: Users },
  email: { label: 'Email', icon: Mail, required: true },
  phone: { label: 'Phone', icon: Phone },
  ticket_type: { label: 'Ticket Type', icon: Tag },
  event_name: { label: 'Event Name', icon: Calendar },
  order_date: { label: 'Order Date', icon: Calendar },
  amount_paid: { label: 'Amount Paid', icon: DollarSign },
  tags: { label: 'Tags', icon: Tag },
  company: { label: 'Company', icon: Users },
  city: { label: 'City', icon: MapPin },
  country: { label: 'Country', icon: MapPin },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContactImportDialog({ open, onOpenChange, organizerId, onImportComplete }) {
  // Steps: datatype -> platform -> upload -> mapping -> preview -> importing -> done
  const [step, setStep] = useState('datatype');
  const [importType, setImportType] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [searchPlatform, setSearchPlatform] = useState('');
  
  // File handling
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  
  // Import settings
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [setEmailOptIn, setSetEmailOptIn] = useState(true);
  const [setSmsOptIn, setSetSmsOptIn] = useState(true);
  const [setWhatsappOptIn, setSetWhatsappOptIn] = useState(true);
  const [importTags, setImportTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  
  // Import progress
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [errors, setErrors] = useState([]);

  // Filter platforms by search
  const filteredPlatforms = Object.values(PLATFORMS).filter(p => 
    p.name.toLowerCase().includes(searchPlatform.toLowerCase()) ||
    p.description.toLowerCase().includes(searchPlatform.toLowerCase())
  );

  // ============================================================================
  // FILE PARSING
  // ============================================================================

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    // Parse headers
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v)); // Filter empty rows

    return { headers, data };
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    try {
      const text = await selectedFile.text();
      const { headers: csvHeaders, data } = parseCSV(text);
      
      setHeaders(csvHeaders);
      setParsedData(data);
      
      // Auto-map fields based on platform
      const mapping = {};
      const platformConfig = PLATFORMS[selectedPlatform];
      
      csvHeaders.forEach(header => {
        const normalizedHeader = header.toLowerCase().trim();
        
        // Check platform-specific mapping first
        if (platformConfig?.fieldMapping) {
          const platformField = Object.entries(platformConfig.fieldMapping).find(
            ([key]) => key.toLowerCase() === normalizedHeader
          );
          if (platformField) {
            mapping[header] = platformField[1];
            return;
          }
        }
        
        // Fall back to common patterns
        if (normalizedHeader.includes('email')) {
          mapping[header] = 'email';
        } else if (normalizedHeader.includes('first') && normalizedHeader.includes('name')) {
          mapping[header] = 'first_name';
        } else if (normalizedHeader.includes('last') && normalizedHeader.includes('name')) {
          mapping[header] = 'last_name';
        } else if (normalizedHeader === 'name' || normalizedHeader === 'full name' || normalizedHeader === 'fullname') {
          mapping[header] = 'full_name';
        } else if (normalizedHeader.includes('phone') || normalizedHeader.includes('mobile') || normalizedHeader.includes('cell')) {
          mapping[header] = 'phone';
        } else if (normalizedHeader.includes('ticket') && normalizedHeader.includes('type')) {
          mapping[header] = 'ticket_type';
        } else if (normalizedHeader.includes('event')) {
          mapping[header] = 'event_name';
        } else if (normalizedHeader.includes('tag')) {
          mapping[header] = 'tags';
        }
      });
      
      setFieldMapping(mapping);
      setStep('mapping');
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please ensure it\'s a valid CSV file.');
    }
  };

  // ============================================================================
  // IMPORT EXECUTION
  // ============================================================================

  const executeImport = async () => {
    if (!consentConfirmed) {
      alert('Please confirm that you have consent to contact these people.');
      return;
    }

    setImporting(true);
    setProgress(0);
    setErrors([]);
    
    const results = {
      total: parsedData.length,
      imported: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      // Process in batches
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < parsedData.length; i += batchSize) {
        batches.push(parsedData.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const contactsToInsert = [];
        
        for (const row of batch) {
          try {
            // Build contact from mapping
            const contact = {
              organizer_id: organizerId,
              source_type: 'imported',
              import_source: selectedPlatform,
              email_opt_in: setEmailOptIn,
              sms_opt_in: setSmsOptIn,
              whatsapp_opt_in: setWhatsappOptIn,
              tags: [...importTags],
              is_active: true,
              first_contact_at: new Date().toISOString(),
              last_contact_at: new Date().toISOString(),
              consent_source: 'import',
              consent_timestamp: new Date().toISOString(),
            };

            // Map fields from row
            let firstName = '';
            let lastName = '';
            
            Object.entries(fieldMapping).forEach(([csvHeader, fieldName]) => {
              const value = row[csvHeader]?.toString().trim();
              if (!value) return;
              
              switch (fieldName) {
                case 'first_name':
                  firstName = value;
                  break;
                case 'last_name':
                  lastName = value;
                  break;
                case 'full_name':
                  contact.full_name = value;
                  break;
                case 'email':
                  contact.email = value.toLowerCase();
                  break;
                case 'phone':
                  // Normalize phone number
                  let phone = value.replace(/[^0-9+]/g, '');
                  if (phone && !phone.startsWith('+')) {
                    // Assume Nigerian number if starts with 0
                    if (phone.startsWith('0')) {
                      phone = '+234' + phone.substring(1);
                    } else if (!phone.startsWith('234')) {
                      phone = '+234' + phone;
                    } else {
                      phone = '+' + phone;
                    }
                  }
                  contact.phone = phone;
                  break;
                case 'tags':
                  const rowTags = value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
                  contact.tags = [...contact.tags, ...rowTags];
                  break;
                case 'amount_paid':
                  contact.total_spent = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
                  break;
                case 'event_name':
                  // Add as a tag
                  contact.tags.push(`Event: ${value}`);
                  contact.total_events_attended = 1;
                  break;
                case 'ticket_type':
                  contact.tags.push(`Ticket: ${value}`);
                  break;
                default:
                  // Store in custom_fields
                  if (!contact.custom_fields) contact.custom_fields = {};
                  contact.custom_fields[fieldName] = value;
              }
            });

            // Build full name from first/last if not already set
            if (!contact.full_name && (firstName || lastName)) {
              contact.full_name = `${firstName} ${lastName}`.trim();
            }

            // Skip if no email or phone
            if (!contact.email && !contact.phone) {
              results.skipped++;
              setErrors(prev => [...prev, { row: row, reason: 'No email or phone' }]);
              continue;
            }

            // Validate email format
            if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
              results.skipped++;
              setErrors(prev => [...prev, { row: row, reason: 'Invalid email format' }]);
              continue;
            }

            contactsToInsert.push(contact);
          } catch (err) {
            results.errors++;
            setErrors(prev => [...prev, { row: row, reason: err.message }]);
          }
        }

        // Insert batch
        if (contactsToInsert.length > 0) {
          if (skipDuplicates) {
            // Insert with conflict handling
            for (const contact of contactsToInsert) {
              const { error } = await supabase
                .from('contacts')
                .upsert(contact, {
                  onConflict: contact.email ? 'organizer_id,email' : 'organizer_id,phone',
                  ignoreDuplicates: true,
                });
              
              if (error) {
                if (error.code === '23505') {
                  results.skipped++;
                } else {
                  results.errors++;
                  setErrors(prev => [...prev, { row: contact, reason: error.message }]);
                }
              } else {
                results.imported++;
              }
            }
          } else {
            // Try insert, may fail on duplicates
            const { data, error } = await supabase
              .from('contacts')
              .insert(contactsToInsert)
              .select();
            
            if (error) {
              results.errors += contactsToInsert.length;
            } else {
              results.imported += data?.length || 0;
            }
          }
        }

        // Update progress
        setProgress(Math.round(((batchIndex + 1) / batches.length) * 100));
      }

      setImportResult(results);
      setStep('done');
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // ============================================================================
  // PREVIEW DATA
  // ============================================================================

  const getPreviewData = () => {
    return parsedData.slice(0, 5).map(row => {
      const contact = { email: '', phone: '', full_name: '' };
      Object.entries(fieldMapping).forEach(([csvHeader, fieldName]) => {
        if (fieldName === 'email') contact.email = row[csvHeader] || '';
        if (fieldName === 'phone') contact.phone = row[csvHeader] || '';
        if (fieldName === 'full_name') contact.full_name = row[csvHeader] || '';
        if (fieldName === 'first_name') {
          contact.full_name = (row[csvHeader] || '') + ' ' + (contact.full_name || '');
        }
        if (fieldName === 'last_name') {
          contact.full_name = (contact.full_name || '') + ' ' + (row[csvHeader] || '');
        }
      });
      contact.full_name = contact.full_name.trim();
      return contact;
    });
  };

  const getMappedFieldCount = () => {
    const mappedFields = new Set(Object.values(fieldMapping));
    const hasEmail = mappedFields.has('email');
    const hasPhone = mappedFields.has('phone');
    const hasName = mappedFields.has('full_name') || mappedFields.has('first_name');
    return { hasEmail, hasPhone, hasName, total: mappedFields.size };
  };

  // ============================================================================
  // RESET
  // ============================================================================

  const reset = () => {
    setStep('datatype');
    setImportType(null);
    setSelectedPlatform(null);
    setSearchPlatform('');
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setFieldMapping({});
    setImportTags([]);
    setConsentConfirmed(false);
    setProgress(0);
    setImportResult(null);
    setErrors([]);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
    if (importResult?.imported > 0) {
      onImportComplete?.();
    }
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderDataTypeStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-[#0F0F0F]/60 mb-4">
        What type of data are you importing? This helps us set up the right fields.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {IMPORT_TYPES.map((type) => {
          const IconComponent = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => {
                setImportType(type.id);
                setStep('platform');
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:border-[#2969FF] hover:bg-[#2969FF]/5 ${
                importType === type.id
                  ? 'border-[#2969FF] bg-[#2969FF]/5'
                  : 'border-[#0F0F0F]/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${type.bgColor} flex items-center justify-center mb-2`}>
                <IconComponent className={`w-5 h-5 ${type.color}`} />
              </div>
              <p className="font-medium text-sm">{type.name}</p>
              <p className="text-xs text-[#0F0F0F]/50 mt-1">{type.description}</p>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-[#0F0F0F]/10">
        <button
          onClick={() => {
            setImportType('general');
            setStep('platform');
          }}
          className="text-sm text-[#2969FF] hover:underline"
        >
          Skip this step - I just want to import a file
        </button>
      </div>
    </div>
  );

  const renderPlatformStep = () => {
    // Group platforms by category
    const ticketingPlatforms = filteredPlatforms.filter(p => p.category === 'ticketing');
    const crmPlatforms = filteredPlatforms.filter(p => p.category === 'crm' || p.id === 'mailchimp' || p.id === 'hubspot' || p.id === 'zoho');
    const generalPlatforms = filteredPlatforms.filter(p => p.category === 'general' || p.id === 'csv');
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          {importType && (
            <Badge variant="secondary" className="capitalize">
              {IMPORT_TYPES.find(t => t.id === importType)?.name || importType}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchPlatform}
            onChange={(e) => setSearchPlatform(e.target.value)}
            placeholder="Search platforms (e.g., Eventbrite, Tix.Africa, PartyVest...)"
            className="w-full px-4 py-2 border border-[#0F0F0F]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2969FF]/50"
          />
          {searchPlatform && (
            <button
              onClick={() => setSearchPlatform('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick access - CSV */}
        {!searchPlatform && (
          <button
            onClick={() => {
              setSelectedPlatform('csv');
              setStep('upload');
            }}
            className="w-full p-3 rounded-xl border-2 border-dashed border-[#0F0F0F]/20 text-left transition-all hover:border-[#2969FF] hover:bg-[#2969FF]/5 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Upload CSV/Excel File</p>
              <p className="text-xs text-[#0F0F0F]/50">Any format - we'll help you map the fields</p>
            </div>
          </button>
        )}

        {/* Ticketing Platforms */}
        {ticketingPlatforms.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[#0F0F0F]/60 uppercase tracking-wider mb-2">
              Event & Ticketing Platforms
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ticketingPlatforms.map((platform) => {
                const IconComponent = platform.icon;
                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      setSelectedPlatform(platform.id);
                      setStep('upload');
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all hover:border-[#2969FF] hover:bg-[#2969FF]/5 ${
                      selectedPlatform === platform.id
                        ? 'border-[#2969FF] bg-[#2969FF]/5'
                        : 'border-[#0F0F0F]/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${platform.bgColor} flex items-center justify-center flex-shrink-0`}>
                        {typeof IconComponent === 'function' ? (
                          <IconComponent className={`w-4 h-4 ${platform.color}`} />
                        ) : (
                          <IconComponent />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{platform.name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CRM & Marketing */}
        {crmPlatforms.length > 0 && !searchPlatform && (
          <div>
            <h4 className="text-xs font-medium text-[#0F0F0F]/60 uppercase tracking-wider mb-2">
              CRM & Marketing Tools
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {crmPlatforms.map((platform) => {
                const IconComponent = platform.icon;
                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      setSelectedPlatform(platform.id);
                      setStep('upload');
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all hover:border-[#2969FF] hover:bg-[#2969FF]/5 ${
                      selectedPlatform === platform.id
                        ? 'border-[#2969FF] bg-[#2969FF]/5'
                        : 'border-[#0F0F0F]/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${platform.bgColor} flex items-center justify-center flex-shrink-0`}>
                        {typeof IconComponent === 'function' ? (
                          <IconComponent className={`w-4 h-4 ${platform.color}`} />
                        ) : (
                          <IconComponent />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{platform.name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No results */}
        {searchPlatform && filteredPlatforms.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[#0F0F0F]/60 mb-2">No platforms found for "{searchPlatform}"</p>
            <button
              onClick={() => {
                setSearchPlatform('');
                setSelectedPlatform('csv');
                setStep('upload');
              }}
              className="text-[#2969FF] hover:underline text-sm"
            >
              Upload as generic CSV instead
            </button>
          </div>
        )}

        {/* Can't find your platform? */}
        {!searchPlatform && (
          <p className="text-xs text-center text-[#0F0F0F]/50 pt-2">
            Don't see your platform? Export your data as CSV and use the generic upload option.
          </p>
        )}
      </div>
    );
  };

  const renderUploadStep = () => {
    const platform = PLATFORMS[selectedPlatform];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-[#F4F6FA] rounded-lg">
          <div className={`w-10 h-10 rounded-lg ${platform?.bgColor} flex items-center justify-center`}>
            {platform?.icon && (
              typeof platform.icon === 'function' 
                ? <platform.icon className={`w-5 h-5 ${platform.color}`} />
                : <platform.icon />
            )}
          </div>
          <div>
            <p className="font-medium">{platform?.name}</p>
            <p className="text-sm text-[#0F0F0F]/60">{platform?.helpText}</p>
          </div>
        </div>

        <div className="border-2 border-dashed border-[#0F0F0F]/20 rounded-xl p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          
          {!file ? (
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-[#0F0F0F]/30 mx-auto mb-4" />
              <p className="font-medium mb-1">Drop your file here or click to browse</p>
              <p className="text-sm text-[#0F0F0F]/50">Supports CSV and Excel files</p>
            </label>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-[#2969FF]" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-[#0F0F0F]/60">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {platform?.sampleUrl && (
          <p className="text-sm text-[#0F0F0F]/50">
            Not sure how to export? <a href={platform.sampleUrl} target="_blank" rel="noopener noreferrer" className="text-[#2969FF] hover:underline">See instructions</a>
          </p>
        )}
      </div>
    );
  };

  const renderMappingStep = () => {
    const { hasEmail, hasPhone, hasName } = getMappedFieldCount();
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={hasEmail || hasPhone ? 'default' : 'destructive'} className={hasEmail || hasPhone ? 'bg-green-500' : ''}>
            {hasEmail || hasPhone ? <Check className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
            {hasEmail ? 'Email mapped' : hasPhone ? 'Phone mapped' : 'Need email or phone'}
          </Badge>
          {hasName && (
            <Badge variant="default" className="bg-green-500">
              <Check className="w-3 h-3 mr-1" /> Name mapped
            </Badge>
          )}
          <Badge variant="secondary">{parsedData.length} contacts</Badge>
        </div>

        <p className="text-sm text-[#0F0F0F]/60">
          Map your CSV columns to contact fields. We've auto-detected common fields.
        </p>

        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {headers.map((header) => (
            <div key={header} className="flex items-center gap-3 p-2 rounded-lg bg-[#F4F6FA]">
              <div className="flex-1 font-mono text-sm">{header}</div>
              <ChevronRight className="w-4 h-4 text-[#0F0F0F]/40" />
              <Select
                value={fieldMapping[header] || 'skip'}
                onValueChange={(value) => setFieldMapping(prev => ({
                  ...prev,
                  [header]: value === 'skip' ? undefined : value,
                }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Skip this field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip this field</SelectItem>
                  {Object.entries(STANDARD_FIELDS).map(([key, field]) => (
                    <SelectItem key={key} value={key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Import Settings */}
        <Card className="mt-4">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium text-sm">Import Settings</h4>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="skip-duplicates"
                checked={skipDuplicates}
                onCheckedChange={setSkipDuplicates}
              />
              <Label htmlFor="skip-duplicates" className="text-sm">Skip duplicate contacts (by email/phone)</Label>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-[#0F0F0F]/60">Communication Opt-in (for imported contacts)</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="email-opt" checked={setEmailOptIn} onCheckedChange={setSetEmailOptIn} />
                  <Label htmlFor="email-opt" className="text-sm">Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="sms-opt" checked={setSmsOptIn} onCheckedChange={setSetSmsOptIn} />
                  <Label htmlFor="sms-opt" className="text-sm">SMS</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="wa-opt" checked={setWhatsappOptIn} onCheckedChange={setSetWhatsappOptIn} />
                  <Label htmlFor="wa-opt" className="text-sm">WhatsApp</Label>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-[#0F0F0F]/60 mb-2">Add tags to all imported contacts</p>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Enter tag name..."
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      setImportTags(prev => [...prev, newTag.trim()]);
                      setNewTag('');
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (newTag.trim()) {
                      setImportTags(prev => [...prev, newTag.trim()]);
                      setNewTag('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              {importTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {importTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="pr-1">
                      {tag}
                      <button
                        onClick={() => setImportTags(prev => prev.filter((_, j) => j !== i))}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPreviewStep = () => {
    const preview = getPreviewData();
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Preview (first 5 contacts)</h4>
          <Badge variant="secondary">{parsedData.length} total</Badge>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F6FA]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.map((contact, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{contact.full_name || '-'}</td>
                  <td className="px-3 py-2">{contact.email || '-'}</td>
                  <td className="px-3 py-2">{contact.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Consent Confirmation */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-800">Consent Confirmation Required</h4>
                <p className="text-sm text-amber-700 mt-1 mb-3">
                  Before importing, you must confirm that you have valid consent to contact these people 
                  for marketing purposes, as required by NDPR and other data protection laws.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent-confirm"
                    checked={consentConfirmed}
                    onCheckedChange={setConsentConfirmed}
                  />
                  <Label htmlFor="consent-confirm" className="text-sm text-amber-800">
                    I confirm that all contacts being imported have given valid consent to receive 
                    marketing communications from my organization. I understand that I am responsible 
                    for compliance with NDPR, GDPR, and other applicable data protection laws.
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="py-8 text-center">
      <Loader2 className="w-12 h-12 text-[#2969FF] animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Importing Contacts...</h3>
      <p className="text-[#0F0F0F]/60 mb-4">Please wait while we import your contacts</p>
      <Progress value={progress} className="max-w-xs mx-auto" />
      <p className="text-sm text-[#0F0F0F]/60 mt-2">{progress}% complete</p>
    </div>
  );

  const renderDoneStep = () => (
    <div className="py-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
      
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto my-6">
        <div className="p-3 bg-[#F4F6FA] rounded-lg">
          <p className="text-2xl font-bold text-green-600">{importResult?.imported || 0}</p>
          <p className="text-xs text-[#0F0F0F]/60">Imported</p>
        </div>
        <div className="p-3 bg-[#F4F6FA] rounded-lg">
          <p className="text-2xl font-bold text-amber-600">{importResult?.skipped || 0}</p>
          <p className="text-xs text-[#0F0F0F]/60">Skipped</p>
        </div>
        <div className="p-3 bg-[#F4F6FA] rounded-lg">
          <p className="text-2xl font-bold text-red-600">{importResult?.errors || 0}</p>
          <p className="text-xs text-[#0F0F0F]/60">Errors</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="text-left max-h-32 overflow-y-auto border rounded-lg p-3 mt-4">
          <p className="text-sm font-medium mb-2">Errors:</p>
          {errors.slice(0, 5).map((err, i) => (
            <p key={i} className="text-xs text-red-600">{err.reason}</p>
          ))}
          {errors.length > 5 && (
            <p className="text-xs text-[#0F0F0F]/60">...and {errors.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const canProceed = () => {
    switch (step) {
      case 'platform':
        return !!selectedPlatform;
      case 'upload':
        return !!file && parsedData.length > 0;
      case 'mapping':
        const { hasEmail, hasPhone } = getMappedFieldCount();
        return hasEmail || hasPhone;
      case 'preview':
        return consentConfirmed;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (step) {
      case 'platform':
        setStep('upload');
        break;
      case 'upload':
        // Already handled in file upload
        break;
      case 'mapping':
        setStep('preview');
        break;
      case 'preview':
        setStep('importing');
        executeImport();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'platform':
        setStep('datatype');
        setImportType(null);
        break;
      case 'upload':
        setStep('platform');
        setSelectedPlatform(null);
        setSearchPlatform('');
        break;
      case 'mapping':
        setStep('upload');
        break;
      case 'preview':
        setStep('mapping');
        break;
    }
  };

  const stepTitle = {
    datatype: 'What are you importing?',
    platform: 'Select Import Source',
    upload: 'Upload File',
    mapping: 'Map Fields',
    preview: 'Review & Import',
    importing: 'Importing...',
    done: 'Import Complete',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Contacts
          </DialogTitle>
          <DialogDescription>
            {stepTitle[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'datatype' && renderDataTypeStep()}
          {step === 'platform' && renderPlatformStep()}
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'done' && renderDoneStep()}
        </div>

        <DialogFooter className="gap-2">
          {step !== 'datatype' && step !== 'importing' && step !== 'done' && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          
          {step === 'done' ? (
            <Button onClick={handleClose} className="bg-[#2969FF] text-white">
              Done
            </Button>
          ) : step !== 'importing' && step !== 'upload' ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-[#2969FF] text-white"
            >
              {step === 'preview' ? (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  Import {parsedData.length} Contacts
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactImportDialog;
