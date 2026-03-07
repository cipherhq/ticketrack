import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  PartyPopper, Users, Plus, Search, Send, Clock, Copy, Loader2, Trash2,
  CheckCircle, HelpCircle, X, Mail, RefreshCw, Link2, ChevronDown, ChevronLeft,
  Calendar, UserPlus, ClipboardList, Settings2, Bell, MapPin, Image,
  Phone, MessageCircle, CreditCard, AlertCircle, ArrowRight, Check, Upload, Sparkles,
  Download, Heart
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import {
  createPartyInvite,
  getOrganizerInvites,
  addGuestsToInvite,
  getInviteGuests,
  getInviteStats,
  updateInviteSettings,
  removeGuest,
  markEmailsSent,
  markReminded,
  markSmsSent,
  getFreeEmailUsage,
  incrementFreeEmailUsage,
} from '@/services/partyInvites';
import { sendPartyInviteEmail, sendPartyInviteReminderEmail } from '@/lib/emailService';
import { Calendar as CalendarWidget } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, set as setDate } from 'date-fns';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';

const APP_URL = window.location.origin;

const WIZARD_STEPS = [
  { number: 1, label: 'Name' },
  { number: 2, label: 'Date' },
  { number: 3, label: 'Location' },
  { number: 4, label: 'Image' },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto">
      {WIZARD_STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step.number < currentStep
                  ? 'bg-primary text-white'
                  : step.number === currentStep
                  ? 'border-2 border-primary text-primary bg-white'
                  : 'border-2 border-gray-300 text-gray-400 bg-white'
              }`}
            >
              {step.number < currentStep ? <Check className="w-4 h-4" /> : step.number}
            </div>
            <span className={`text-xs mt-1 ${
              step.number <= currentStep ? 'text-primary font-medium' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div
              className={`w-12 sm:w-16 h-0.5 mb-5 mx-1 transition-colors ${
                step.number < currentStep ? 'bg-primary' : 'bg-gray-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Step1_PartyName({ value, onChange, onNext }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        What is the name of your party?
      </h2>
      <p className="text-gray-500 mb-8 text-center">Give your party a name that guests will remember</p>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. Sarah's Birthday Bash"
        className="rounded-xl text-center text-lg h-14 max-w-md w-full"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onNext(); }}
      />
      <Button
        onClick={onNext}
        disabled={!value.trim()}
        className="mt-6 rounded-xl gap-2 h-12 px-8"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function DateTimePicker({ label, value, onChange }) {
  // value is a datetime-local string like "2026-03-04T18:00" or ""
  const dateObj = useMemo(() => value ? new Date(value) : null, [value]);
  const hour = dateObj ? String(dateObj.getHours()).padStart(2, '0') : '';
  const minute = dateObj ? String(dateObj.getMinutes()).padStart(2, '0') : '';

  const handleDaySelect = (day) => {
    if (!day) return;
    const base = dateObj || new Date();
    const merged = setDate(day, { hours: base.getHours(), minutes: base.getMinutes() });
    onChange(format(merged, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (type, val) => {
    const base = dateObj || new Date();
    const h = type === 'hour' ? parseInt(val, 10) : base.getHours();
    const m = type === 'minute' ? parseInt(val, 10) : base.getMinutes();
    const merged = setDate(dateObj || new Date(), { hours: h, minutes: m });
    if (!dateObj) {
      // If no date selected yet, set to today
      onChange(format(merged, "yyyy-MM-dd'T'HH:mm"));
    } else {
      onChange(format(setDate(dateObj, { hours: h, minutes: m }), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-left hover:border-primary/40 transition-colors bg-white">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className={dateObj ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
              {dateObj ? format(dateObj, 'EEE, MMM d, yyyy') : 'Pick a date'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <CalendarWidget
            mode="single"
            selected={dateObj}
            onSelect={handleDaySelect}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {/* Time selectors */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
        <Select value={hour} onValueChange={v => handleTimeChange('hour', v)}>
          <SelectTrigger className="w-20 rounded-lg h-10 text-sm">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {hours.map(h => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-gray-500 font-medium">:</span>
        <Select value={minute} onValueChange={v => handleTimeChange('minute', v)}>
          <SelectTrigger className="w-20 rounded-lg h-10 text-sm">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {minutes.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Step2_DateTime({ startDate, endDate, onChangeStart, onChangeEnd, onNext, onBack }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        When is your party?
      </h2>
      <p className="text-gray-500 mb-8 text-center">You can always add or change this later</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
        <DateTimePicker label="Start" value={startDate} onChange={onChangeStart} />
        <DateTimePicker label="End" value={endDate} onChange={onChangeEnd} />
      </div>
      <div className="flex items-center gap-3 mt-8">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-12 px-6">
          Back
        </Button>
        <Button onClick={onNext} className="rounded-xl gap-2 h-12 px-8">
          {startDate || endDate ? 'Continue' : 'Skip for now'} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Step3_Location({ venueName, city, address, onChangeVenue, onChangeCity, onChangeAddress, onNext, onBack }) {
  const handlePlaceSelect = (placeData) => {
    if (placeData.name) onChangeVenue(placeData.name);
    if (placeData.city) onChangeCity(placeData.city);
    if (placeData.address) onChangeAddress(placeData.address);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        Where is your party taking place?
      </h2>
      <p className="text-gray-500 mb-8 text-center">Search for a venue or enter the details manually</p>
      <div className="space-y-4 w-full max-w-md">
        <div>
          <Label className="text-sm font-medium">Search Venue</Label>
          <AddressAutocomplete
            value={address}
            onChange={onChangeAddress}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Search for a venue or address..."
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Venue Name</Label>
          <Input
            value={venueName}
            onChange={e => onChangeVenue(e.target.value)}
            placeholder="e.g. The Grand Hall"
            className="rounded-xl mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">City</Label>
          <Input
            value={city}
            onChange={e => onChangeCity(e.target.value)}
            placeholder="e.g. Lagos"
            className="rounded-xl mt-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-8">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-12 px-6">
          Back
        </Button>
        <Button onClick={onNext} className="rounded-xl gap-2 h-12 px-8">
          {venueName || city || address ? 'Continue' : 'Skip for now'} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const PARTY_TEMPLATES = [
  {
    id: 'birthday', name: 'Birthday Bash', emoji: '🎂', premium: false,
    gradient: 'linear-gradient(135deg, #ec4899, #f43f5e, #f59e0b)',
    textColor: '#ffffff', decorEmojis: ['🎈', '🎉', '🎊', '✨'],
    overlayPattern: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)',
  },
  {
    id: 'elegant', name: 'Elegant Night', emoji: '🥂', premium: false,
    gradient: 'linear-gradient(135deg, #1e3a5f, #1e293b)',
    textColor: '#fbbf24', decorEmojis: ['✨', '🌟', '💫'],
    overlayPattern: 'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 60%)',
  },
  {
    id: 'garden', name: 'Garden Party', emoji: '🌿', premium: false,
    gradient: 'linear-gradient(135deg, #16a34a, #84cc16, #fef9c3)',
    textColor: '#14532d', decorEmojis: ['🌸', '🌺', '🍃', '🦋'],
    overlayPattern: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.12) 0%, transparent 50%)',
  },
  {
    id: 'club', name: 'Club Night', emoji: '🎵', premium: false,
    gradient: 'linear-gradient(135deg, #312e81, #7c3aed)',
    textColor: '#ffffff', decorEmojis: ['🔥', '💜', '🎶', '⚡'],
    overlayPattern: 'radial-gradient(circle at 70% 30%, rgba(124,58,237,0.2) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(99,102,241,0.15) 0%, transparent 50%)',
  },
  {
    id: 'dinner', name: 'Dinner Party', emoji: '🍷', premium: false,
    gradient: 'linear-gradient(135deg, #881337, #1c1917, #fef3c7)',
    textColor: '#fef3c7', decorEmojis: ['🕯️', '🍽️', '🌹'],
    overlayPattern: 'radial-gradient(circle at 50% 50%, rgba(254,243,199,0.05) 0%, transparent 60%)',
  },
  {
    id: 'beach', name: 'Beach Vibes', emoji: '🏖️', premium: false,
    gradient: 'linear-gradient(135deg, #3b82f6, #14b8a6, #fde68a)',
    textColor: '#ffffff', decorEmojis: ['🌊', '🐚', '🌴', '☀️'],
    overlayPattern: 'radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 40%)',
  },
  {
    id: 'bridal', name: 'Bridal Shower', emoji: '💐', premium: false,
    gradient: 'linear-gradient(135deg, #f9a8d4, #c4b5fd)',
    textColor: '#581c87', decorEmojis: ['💕', '🌸', '💍', '✨'],
    overlayPattern: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.15) 0%, transparent 50%)',
  },
  {
    id: 'casual', name: 'Casual Hangout', emoji: '😎', premium: false,
    gradient: 'linear-gradient(135deg, #ef4444, #f97316, #22c55e, #3b82f6)',
    textColor: '#ffffff', decorEmojis: ['🎮', '🍕', '🎪', '🤘'],
    overlayPattern: 'radial-gradient(circle at 40% 60%, rgba(255,255,255,0.08) 0%, transparent 50%)',
  },
  {
    id: 'gold-foil', name: 'Gold Foil', emoji: '👑', premium: true,
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    textColor: '#ffd700', decorEmojis: ['👑', '✨', '💎', '⭐'],
    overlayPattern: 'radial-gradient(circle at 30% 20%, rgba(255,215,0,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,215,0,0.06) 0%, transparent 50%)',
  },
  {
    id: 'holographic', name: 'Holographic', emoji: '🌈', premium: true,
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899, #06b6d4, #a855f7)',
    textColor: '#ffffff', decorEmojis: ['💠', '🔮', '🌟', '💜'],
    overlayPattern: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 40%), radial-gradient(circle at 20% 20%, rgba(168,85,247,0.15) 0%, transparent 50%)',
  },
  {
    id: 'midnight-gala', name: 'Midnight Gala', emoji: '🌙', premium: true,
    gradient: 'linear-gradient(135deg, #0c0a1d, #1a1145, #2d1b69)',
    textColor: '#e2d9f3', decorEmojis: ['🌙', '⭐', '✨', '🌌'],
    overlayPattern: 'radial-gradient(circle at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 50%), radial-gradient(circle at 20% 70%, rgba(99,102,241,0.08) 0%, transparent 50%)',
  },
  {
    id: 'rose-luxe', name: 'Rose Luxe', emoji: '🌹', premium: true,
    gradient: 'linear-gradient(135deg, #4a0e2e, #831843, #be185d)',
    textColor: '#fecdd3', decorEmojis: ['🌹', '💕', '🥀', '✨'],
    overlayPattern: 'radial-gradient(circle at 60% 30%, rgba(254,205,211,0.1) 0%, transparent 50%), radial-gradient(circle at 30% 80%, rgba(190,24,93,0.15) 0%, transparent 50%)',
  },
];

const ACCENT_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gold', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Orange', value: '#f97316' },
];

const FONT_OPTIONS = [
  { id: 'bold-modern', label: 'Bold Modern', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', weight: 900, google: null },
  { id: 'elegant-script', label: 'Elegant Script', family: '"Playfair Display", serif', weight: 700, google: 'Playfair+Display:wght@700' },
  { id: 'playful', label: 'Playful', family: '"Pacifico", cursive', weight: 400, google: 'Pacifico' },
  { id: 'minimal', label: 'Minimal', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', weight: 300, google: null },
  { id: 'luxury', label: 'Luxury', family: '"Cormorant Garamond", serif', weight: 700, google: 'Cormorant+Garamond:wght@700' },
];

function loadGoogleFont(fontUrl) {
  if (!fontUrl) return;
  const id = `gf-${fontUrl.replace(/[^a-zA-Z0-9]/g, '')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`;
  document.head.appendChild(link);
}

const BACKGROUND_PATTERNS = [
  { id: 'none', label: 'None', svg: null },
  { id: 'confetti', label: 'Confetti', svg: "data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='10' y='5' width='4' height='4' rx='1' fill='%23fff' fill-opacity='0.12' transform='rotate(30 12 7)'/%3E%3Crect x='40' y='15' width='5' height='3' rx='1' fill='%23fff' fill-opacity='0.1' transform='rotate(-20 42 16)'/%3E%3Crect x='25' y='35' width='3' height='5' rx='1' fill='%23fff' fill-opacity='0.08' transform='rotate(45 26 37)'/%3E%3Crect x='5' y='45' width='4' height='3' rx='1' fill='%23fff' fill-opacity='0.1' transform='rotate(-15 7 46)'/%3E%3Crect x='50' y='45' width='3' height='4' rx='1' fill='%23fff' fill-opacity='0.12' transform='rotate(60 51 47)'/%3E%3C/svg%3E" },
  { id: 'geometric', label: 'Geometric', svg: "data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23fff' stroke-opacity='0.06' stroke-width='1'/%3E%3C/svg%3E" },
  { id: 'stars', label: 'Stars', svg: "data:image/svg+xml,%3Csvg width='50' height='50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='25,2 31,18 48,18 34,28 39,45 25,35 11,45 16,28 2,18 19,18' fill='%23fff' fill-opacity='0.06'/%3E%3C/svg%3E" },
  { id: 'floral', label: 'Floral', svg: "data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='8' fill='none' stroke='%23fff' stroke-opacity='0.06'/%3E%3Ccircle cx='30' cy='20' r='4' fill='%23fff' fill-opacity='0.04'/%3E%3Ccircle cx='38' cy='26' r='4' fill='%23fff' fill-opacity='0.04'/%3E%3Ccircle cx='36' cy='36' r='4' fill='%23fff' fill-opacity='0.04'/%3E%3Ccircle cx='24' cy='36' r='4' fill='%23fff' fill-opacity='0.04'/%3E%3Ccircle cx='22' cy='26' r='4' fill='%23fff' fill-opacity='0.04'/%3E%3C/svg%3E" },
];

const EXPORT_SIZES = [
  { label: 'Story (1080×1920)', w: 1080, h: 1920 },
  { label: 'Square (1080×1080)', w: 1080, h: 1080 },
  { label: 'Landscape (1920×1080)', w: 1920, h: 1080 },
];

const FAVORITES_KEY = 'rackparty_template_favorites';
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
}
function toggleFavorite(templateId, accentColor) {
  const favs = getFavorites();
  const key = `${templateId}__${accentColor}`;
  const idx = favs.findIndex(f => f.key === key);
  if (idx >= 0) { favs.splice(idx, 1); } else { favs.push({ key, templateId, accentColor }); }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return favs;
}
function isFavorited(templateId, accentColor) {
  return getFavorites().some(f => f.key === `${templateId}__${accentColor}`);
}

const isPremiumOrganizer = true;

function TemplatePreview({
  template, accentColor, partyName, startDate, venueName, forCapture,
  captureWidth, captureHeight,
  textColorOverride, fontFamily, fontWeight,
  tagline, backgroundPattern, backgroundImage,
}) {
  const baseW = captureWidth || (forCapture ? 600 : 280);
  const baseH = captureHeight || (forCapture ? 800 : 380);
  const scaleFactor = baseW / 600;
  const titleSize = Math.round(56 * scaleFactor * (forCapture ? 1 : 0.47));
  const labelSize = Math.round(20 * scaleFactor * (forCapture ? 1 : 0.47));
  const dateSize = Math.round(22 * scaleFactor * (forCapture ? 1 : 0.47));
  const venueSize = Math.round(20 * scaleFactor * (forCapture ? 1 : 0.47));
  const taglineSize = Math.round(18 * scaleFactor * (forCapture ? 1 : 0.47));
  const emojiSize = Math.round(56 * scaleFactor * (forCapture ? 1 : 0.47));
  const stripeHeight = Math.round(8 * scaleFactor * (forCapture ? 1 : 0.47));

  const effectiveTextColor = textColorOverride === 'light' ? '#ffffff' : textColorOverride === 'dark' ? '#1a1a1a' : template.textColor;
  const effectiveFont = fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const effectiveWeight = fontWeight || 900;

  const formattedDate = startDate
    ? format(new Date(startDate), 'EEE, MMM d, yyyy · h:mm a')
    : null;

  const emojiPositions = [
    { top: '8%', left: '5%', rotate: '-15deg' },
    { top: '12%', right: '8%', rotate: '20deg' },
    { bottom: '18%', left: '10%', rotate: '10deg' },
    { bottom: '12%', right: '5%', rotate: '-10deg' },
    { top: '40%', left: '3%', rotate: '25deg' },
    { top: '35%', right: '4%', rotate: '-20deg' },
  ];

  const patternObj = BACKGROUND_PATTERNS.find(p => p.id === backgroundPattern);

  return (
    <div
      style={{
        width: baseW,
        height: baseH,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: forCapture ? 0 : 16,
        background: template.gradient,
        fontFamily: effectiveFont,
      }}
    >
      {/* Background image for blend mode */}
      {backgroundImage && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      {backgroundImage && (
        <div style={{ position: 'absolute', inset: 0, background: template.gradient, opacity: 0.7 }} />
      )}

      {/* Overlay pattern */}
      <div style={{ position: 'absolute', inset: 0, background: template.overlayPattern }} />

      {/* Background pattern overlay */}
      {patternObj?.svg && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${patternObj.svg}")`, backgroundRepeat: 'repeat', pointerEvents: 'none' }} />
      )}

      {/* Accent stripe top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: stripeHeight, background: accentColor }} />

      {/* Scattered emojis */}
      {template.decorEmojis.map((emoji, i) => {
        const pos = emojiPositions[i % emojiPositions.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              fontSize: emojiSize,
              opacity: 0.2,
              transform: `rotate(${pos.rotate})`,
              top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom,
              pointerEvents: 'none',
            }}
          >
            {emoji}
          </span>
        );
      })}

      {/* Content */}
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: Math.round(48 * scaleFactor * (forCapture ? 1 : 0.47)),
          textAlign: 'center',
        }}
      >
        <div style={{
          fontSize: labelSize, fontWeight: 900, letterSpacing: Math.round(6 * scaleFactor * (forCapture ? 1 : 0.47)),
          textTransform: 'uppercase', color: accentColor,
          marginBottom: Math.round(28 * scaleFactor * (forCapture ? 1 : 0.47)),
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          YOU&apos;RE INVITED
        </div>

        <div style={{
          fontSize: titleSize, fontWeight: effectiveWeight, color: effectiveTextColor,
          lineHeight: 1.15, maxWidth: '90%', wordBreak: 'break-word',
          marginBottom: Math.round((tagline ? 12 : 36) * scaleFactor * (forCapture ? 1 : 0.47)),
          textShadow: '0 3px 12px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)',
          letterSpacing: forCapture ? -1 : -0.5,
          fontFamily: effectiveFont,
        }}>
          {partyName || 'Your Party Name'}
        </div>

        {/* Tagline */}
        {tagline && (
          <div style={{
            fontSize: taglineSize, fontStyle: 'italic', color: effectiveTextColor, opacity: 0.85,
            marginBottom: Math.round(24 * scaleFactor * (forCapture ? 1 : 0.47)),
            textShadow: '0 1px 4px rgba(0,0,0,0.3)', maxWidth: '85%',
          }}>
            {tagline}
          </div>
        )}

        {formattedDate && (
          <div style={{
            fontSize: dateSize, fontWeight: 700, color: effectiveTextColor,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            borderRadius: 999,
            padding: `${Math.round(12 * scaleFactor * (forCapture ? 1 : 0.47))}px ${Math.round(28 * scaleFactor * (forCapture ? 1 : 0.47))}px`,
            marginBottom: Math.round(16 * scaleFactor * (forCapture ? 1 : 0.47)),
            textShadow: '0 1px 4px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            {formattedDate}
          </div>
        )}

        {venueName && (
          <div style={{
            fontSize: venueSize, fontWeight: 700, color: effectiveTextColor, opacity: 0.9,
            marginTop: Math.round(8 * scaleFactor * (forCapture ? 1 : 0.47)),
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}>
            📍 {venueName}
          </div>
        )}
      </div>

      {/* Accent stripe bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: stripeHeight, background: accentColor }} />
    </div>
  );
}

function TemplateControls({ activeTemplate, selectedColor, setSelectedColor, textOverride, setTextOverride, selectedFont, setSelectedFont, tagline, setTagline, selectedPattern, setSelectedPattern, favorites, setFavorites, setSelectedTemplate }) {
  return (
    <>
      {/* Favorites row */}
      {favorites.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Favorites</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {favorites.map(f => {
              const t = PARTY_TEMPLATES.find(tp => tp.id === f.templateId);
              if (!t) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => { setSelectedTemplate(t.id); setSelectedColor(f.accentColor); }}
                  className="shrink-0 rounded-lg p-2 border border-gray-200 hover:border-primary/40 transition-colors flex items-center gap-2"
                  style={{ background: t.gradient }}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <div className="w-4 h-4 rounded-full border border-white/40" style={{ background: f.accentColor }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {PARTY_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTemplate(t.id)}
            className={`relative rounded-xl p-3 text-left transition-all border-2 ${
              activeTemplate?.id === t.id
                ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
                : 'border-transparent hover:border-gray-200'
            }`}
            style={{ background: t.gradient }}
          >
            <span className="text-2xl block mb-1">{t.emoji}</span>
            <span className="text-xs font-semibold block" style={{ color: t.textColor }}>
              {t.name}
            </span>
            {t.premium && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-400 text-yellow-900">PRO</span>
            )}
            {activeTemplate?.id === t.id && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            {/* Heart favorite button */}
            <button
              onClick={e => { e.stopPropagation(); setFavorites(toggleFavorite(t.id, selectedColor)); }}
              className="absolute bottom-1.5 right-1.5 p-0.5"
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorited(t.id, selectedColor) ? 'fill-red-500 text-red-500' : 'text-white/50 hover:text-white/80'}`} />
            </button>
          </button>
        ))}
      </div>

      {/* Controls shown when template selected */}
      {activeTemplate && (
        <div className="space-y-5">
          {/* Accent colors */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Accent Color</p>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  title={c.name}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Text color toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Text Color</p>
            <div className="flex gap-2">
              {[
                { val: null, label: 'Auto' },
                { val: 'light', label: 'Light' },
                { val: 'dark', label: 'Dark' },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setTextOverride(opt.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    textOverride === opt.val ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font picker */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Font Style</p>
            <div className="flex flex-wrap gap-2">
              {FONT_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFont(f.id); if (f.google) loadGoogleFont(f.google); }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedFont === f.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{ fontFamily: f.family, fontWeight: f.weight }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom tagline */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Custom Tagline</p>
            <Input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Dress Code: All White"
              className="rounded-lg text-sm"
            />
          </div>

          {/* Background patterns */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Background Pattern</p>
            <div className="flex gap-2 flex-wrap">
              {BACKGROUND_PATTERNS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPattern(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedPattern === p.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step4_CoverImage({ coverImage, onChange, onBack, onCreate, creating, partyName, startDate, venueName }) {
  const [mode, setMode] = useState('template');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedColor, setSelectedColor] = useState(ACCENT_COLORS[0].value);
  const [textOverride, setTextOverride] = useState(null);
  const [selectedFont, setSelectedFont] = useState('bold-modern');
  const [tagline, setTagline] = useState('');
  const [selectedPattern, setSelectedPattern] = useState('none');
  const [blendPhoto, setBlendPhoto] = useState(null);
  const [blendPhotoUrl, setBlendPhotoUrl] = useState(null);
  const [favorites, setFavorites] = useState(getFavorites());
  const [generatingImage, setGeneratingImage] = useState(false);
  const previewRef = useRef(null);
  const exportRef = useRef(null);

  const activeTemplate = PARTY_TEMPLATES.find(t => t.id === selectedTemplate);
  const activeFontObj = FONT_OPTIONS.find(f => f.id === selectedFont) || FONT_OPTIONS[0];

  function handleBlendPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBlendPhoto(file);
    setBlendPhotoUrl(URL.createObjectURL(file));
  }

  const templatePreviewProps = {
    template: activeTemplate,
    accentColor: selectedColor,
    partyName,
    startDate,
    venueName,
    textColorOverride: textOverride,
    fontFamily: activeFontObj.family,
    fontWeight: activeFontObj.weight,
    tagline,
    backgroundPattern: selectedPattern,
    backgroundImage: mode === 'blend' ? blendPhotoUrl : undefined,
  };

  async function handleCreateWithTemplate() {
    if (!activeTemplate) return;
    setGeneratingImage(true);
    try {
      if (activeFontObj.google) { loadGoogleFont(activeFontObj.google); }
      await document.fonts.ready;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, useCORS: true, backgroundColor: null, width: 600, height: 800,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'party-cover.png', { type: 'image/png' });
      onCreate(file);
    } catch (err) {
      console.error('Error generating cover image:', err);
      toast.error('Failed to generate cover image');
      setGeneratingImage(false);
    }
  }

  async function handleExportSize(size) {
    if (!activeTemplate) return;
    setGeneratingImage(true);
    try {
      if (activeFontObj.google) { loadGoogleFont(activeFontObj.google); }
      await document.fonts.ready;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
        scale: 1, useCORS: true, backgroundColor: null, width: size.w, height: size.h,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `party-${size.w}x${size.h}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export image');
    } finally {
      setGeneratingImage(false);
    }
  }

  const [exportSize, setExportSize] = useState(EXPORT_SIZES[0]);

  const isCreating = creating || generatingImage;
  const hasSelection = (mode === 'template' || mode === 'blend') ? !!activeTemplate : !!coverImage;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        Add a cover image
      </h2>
      <p className="text-gray-500 mb-8 text-center">Pick a themed template or upload your own</p>

      <div className="w-full max-w-2xl">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="template" className="gap-2">
              <Sparkles className="w-4 h-4" /> Theme
            </TabsTrigger>
            <TabsTrigger value="blend" className="gap-2">
              <Image className="w-4 h-4" /> Photo + Theme
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="w-4 h-4" /> Upload
            </TabsTrigger>
          </TabsList>

          {/* Template tab */}
          <TabsContent value="template">
            <TemplateControls
              activeTemplate={activeTemplate}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              textOverride={textOverride}
              setTextOverride={setTextOverride}
              selectedFont={selectedFont}
              setSelectedFont={setSelectedFont}
              tagline={tagline}
              setTagline={setTagline}
              selectedPattern={selectedPattern}
              setSelectedPattern={setSelectedPattern}
              favorites={favorites}
              setFavorites={setFavorites}
              setSelectedTemplate={setSelectedTemplate}
            />

            {/* Live preview */}
            {activeTemplate && (
              <div className="flex justify-center mb-4 mt-6">
                <div className="shadow-xl rounded-2xl overflow-hidden">
                  <TemplatePreview {...templatePreviewProps} />
                </div>
              </div>
            )}

            {/* Social export buttons */}
            {activeTemplate && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Download for Social Media</p>
                <div className="flex flex-wrap gap-2">
                  {EXPORT_SIZES.map(size => (
                    <Button
                      key={size.label}
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportSize(size); setTimeout(() => handleExportSize(size), 100); }}
                      disabled={generatingImage}
                      className="rounded-lg gap-1.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> {size.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Photo + Theme blend tab */}
          <TabsContent value="blend">
            {/* Photo upload */}
            <div className="mb-5">
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                {blendPhotoUrl ? (
                  <img src={blendPhotoUrl} alt="Blend" className="w-full max-h-32 object-cover rounded-xl" />
                ) : (
                  <>
                    <Image className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-500">Upload a photo as background</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleBlendPhotoUpload} />
              </label>
            </div>

            <TemplateControls
              activeTemplate={activeTemplate}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              textOverride={textOverride}
              setTextOverride={setTextOverride}
              selectedFont={selectedFont}
              setSelectedFont={setSelectedFont}
              tagline={tagline}
              setTagline={setTagline}
              selectedPattern={selectedPattern}
              setSelectedPattern={setSelectedPattern}
              favorites={favorites}
              setFavorites={setFavorites}
              setSelectedTemplate={setSelectedTemplate}
            />

            {activeTemplate && (
              <div className="flex justify-center mb-4 mt-6">
                <div className="shadow-xl rounded-2xl overflow-hidden">
                  <TemplatePreview {...templatePreviewProps} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Upload tab */}
          <TabsContent value="upload">
            <label className="flex flex-col items-center justify-center gap-3 px-4 py-12 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
              {coverImage ? (
                <>
                  <img src={URL.createObjectURL(coverImage)} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
                  <span className="text-sm text-gray-600">{coverImage.name}</span>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400" />
                  <span className="text-sm text-gray-500">Click to upload cover image</span>
                  <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => onChange(e.target.files[0] || null)} />
            </label>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden capture target for html2canvas */}
      {activeTemplate && (
        <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
          <div ref={previewRef}>
            <TemplatePreview {...templatePreviewProps} forCapture />
          </div>
          <div ref={exportRef}>
            <TemplatePreview {...templatePreviewProps} forCapture captureWidth={exportSize.w} captureHeight={exportSize.h} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-8">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-12 px-6">
          Back
        </Button>
        <Button
          onClick={(mode === 'template' || mode === 'blend') && activeTemplate ? handleCreateWithTemplate : () => onCreate()}
          disabled={isCreating}
          className="rounded-xl gap-2 h-12 px-8"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PartyPopper className="w-4 h-4" />}
          {hasSelection ? 'Create Party' : 'Skip & Create'}
        </Button>
      </div>
    </div>
  );
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PartyInvites() {
  const { organizer } = useOrganizer();

  // View state: 'list' | 'create' | 'detail'
  const [view, setView] = useState('list');

  // Campaign list
  const [campaigns, setCampaigns] = useState([]);
  const [campaignStats, setCampaignStats] = useState({});
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Selected campaign (detail view)
  const [invite, setInvite] = useState(null);
  const [guests, setGuests] = useState([]);
  const [stats, setStats] = useState({ total: 0, going: 0, maybe: 0, pending: 0, declined: 0 });
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Create form (wizard)
  const [createStep, setCreateStep] = useState(1);
  const [createTitle, setCreateTitle] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createVenueName, setCreateVenueName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createCoverImage, setCreateCoverImage] = useState(null);
  const [creating, setCreating] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('guests');

  // Add guest form
  const [addMode, setAddMode] = useState('manual');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [addingGuests, setAddingGuests] = useState(false);

  // Settings (detail view)
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsStartDate, setSettingsStartDate] = useState('');
  const [settingsEndDate, setSettingsEndDate] = useState('');
  const [settingsVenueName, setSettingsVenueName] = useState('');
  const [settingsCity, setSettingsCity] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsCoverImage, setSettingsCoverImage] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [allowPlusOnes, setAllowPlusOnes] = useState(false);
  const [maxPlusOnes, setMaxPlusOnes] = useState(1);
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Sending
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  // Credits & free emails
  const [creditBalance, setCreditBalance] = useState(0);
  const [freeEmailsUsed, setFreeEmailsUsed] = useState(0);
  const FREE_EMAIL_LIMIT = 10;

  // Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // ============================================================================
  // LOAD CAMPAIGNS
  // ============================================================================

  useEffect(() => {
    if (!organizer?.id) return;
    loadCampaigns();
    loadCreditAndFreeEmailData();
  }, [organizer?.id]);

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try {
      const data = await getOrganizerInvites(organizer.id);
      setCampaigns(data);
      // Load stats for each campaign
      const statsMap = {};
      await Promise.all(data.map(async (inv) => {
        try {
          const s = await getInviteStats(inv.id);
          statsMap[inv.id] = s;
        } catch {}
      }));
      setCampaignStats(statsMap);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function loadCreditAndFreeEmailData() {
    if (!organizer?.id) return;
    try {
      const { data: bal } = await supabase
        .from('communication_credit_balances')
        .select('balance, bonus_balance')
        .eq('organizer_id', organizer.id)
        .maybeSingle();
      setCreditBalance((bal?.balance || 0) + (bal?.bonus_balance || 0));
    } catch (err) {
      console.warn('Could not load credit balance:', err.message);
    }
    try {
      const usage = await getFreeEmailUsage(organizer.id);
      setFreeEmailsUsed(usage);
    } catch (err) {
      console.warn('Could not load free email usage:', err.message);
    }
  }

  // ============================================================================
  // CREATE CAMPAIGN
  // ============================================================================

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
        message: '',
        allowPlusOnes: false,
        maxPlusOnes: 1,
        rsvpDeadline: null,
      });
      toast.success('Party created!');
      // Reset form
      setCreateStep(1);
      setCreateTitle('');
      setCreateStartDate('');
      setCreateEndDate('');
      setCreateVenueName('');
      setCreateCity('');
      setCreateAddress('');
      setCreateCoverImage(null);
      // Open the new campaign
      openCampaign(inv);
      await loadCampaigns();
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  // ============================================================================
  // OPEN CAMPAIGN DETAIL
  // ============================================================================

  async function openCampaign(inv) {
    setInvite(inv);
    setView('detail');
    setActiveTab('guests');
    setStatusFilter('all');
    // Populate settings fields
    setSettingsTitle(inv.title || '');
    setSettingsDescription(inv.description || '');
    setSettingsStartDate(inv.start_date ? inv.start_date.slice(0, 16) : '');
    setSettingsEndDate(inv.end_date ? inv.end_date.slice(0, 16) : '');
    setSettingsVenueName(inv.venue_name || '');
    setSettingsCity(inv.city || '');
    setSettingsAddress(inv.address || '');
    setSettingsCoverImage(null);
    setInviteMessage(inv.message || '');
    setAllowPlusOnes(inv.allow_plus_ones);
    setMaxPlusOnes(inv.max_plus_ones);
    setRsvpDeadline(inv.rsvp_deadline ? inv.rsvp_deadline.slice(0, 16) : '');
    // Load guests
    setLoadingInvite(true);
    try {
      await loadGuestsAndStats(inv.id);
    } finally {
      setLoadingInvite(false);
    }
  }

  async function loadGuestsAndStats(inviteId) {
    try {
      const [guestList, invStats] = await Promise.all([
        getInviteGuests(inviteId),
        getInviteStats(inviteId),
      ]);
      setGuests(guestList);
      setStats(invStats);
    } catch (err) {
      console.error('Error loading guests:', err);
    }
  }

  // ============================================================================
  // ADD GUESTS
  // ============================================================================

  async function handleAddManual() {
    if (!manualName.trim()) return;
    setAddingGuests(true);
    try {
      await addGuestsToInvite(invite.id, organizer.id, [{
        name: manualName.trim(),
        email: manualEmail.trim() || null,
        phone: manualPhone.trim() || null,
        source: 'manual',
      }]);
      setManualName('');
      setManualEmail('');
      setManualPhone('');
      await loadGuestsAndStats(invite.id);
      toast.success('Guest added');
    } catch (err) {
      toast.error('Failed to add guest');
    } finally {
      setAddingGuests(false);
    }
  }

  async function handleAddPaste() {
    if (!pasteText.trim()) return;
    setAddingGuests(true);
    try {
      const lines = pasteText.split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        const angleMatch = line.match(/^(.+?)\s*<(.+?)>$/);
        if (angleMatch) return { name: angleMatch[1].trim(), email: angleMatch[2].trim(), source: 'paste' };
        const commaMatch = line.match(/^(.+?),\s*(.+@.+)$/);
        if (commaMatch) return { name: commaMatch[1].trim(), email: commaMatch[2].trim(), source: 'paste' };
        const emailOnly = line.trim();
        if (emailOnly.includes('@')) return { name: emailOnly.split('@')[0], email: emailOnly, source: 'paste' };
        return { name: emailOnly, email: null, source: 'paste' };
      }).filter(g => g.name);

      if (parsed.length === 0) {
        toast.error('No valid entries found');
        return;
      }

      await addGuestsToInvite(invite.id, organizer.id, parsed);
      setPasteText('');
      await loadGuestsAndStats(invite.id);
      toast.success(`${parsed.length} guest${parsed.length > 1 ? 's' : ''} added`);
    } catch (err) {
      toast.error('Failed to add guests');
    } finally {
      setAddingGuests(false);
    }
  }

  async function loadContacts() {
    try {
      let query = supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('organizer_id', organizer.id)
        .order('name')
        .limit(100);
      if (contactSearch) {
        query = query.or(`name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`);
      }
      const { data } = await query;
      setContacts(data || []);
    } catch {}
  }

  useEffect(() => {
    if (addMode === 'contacts' && organizer?.id) loadContacts();
  }, [addMode, contactSearch, organizer?.id]);

  async function handleAddContacts() {
    if (selectedContacts.length === 0) return;
    setAddingGuests(true);
    try {
      const toAdd = selectedContacts.map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        source: 'contacts',
      }));
      await addGuestsToInvite(invite.id, organizer.id, toAdd);
      setSelectedContacts([]);
      await loadGuestsAndStats(invite.id);
      toast.success(`${toAdd.length} guest${toAdd.length > 1 ? 's' : ''} added`);
    } catch (err) {
      toast.error('Failed to add guests');
    } finally {
      setAddingGuests(false);
    }
  }

  async function handleRemoveGuest(guestId) {
    try {
      await removeGuest(guestId);
      await loadGuestsAndStats(invite.id);
      toast.success('Guest removed');
    } catch {
      toast.error('Failed to remove guest');
    }
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      let coverImageUrl = invite.cover_image_url;
      if (settingsCoverImage) {
        coverImageUrl = await handleUploadCoverImage(settingsCoverImage);
      }
      const updated = await updateInviteSettings(invite.id, {
        title: settingsTitle,
        description: settingsDescription,
        startDate: settingsStartDate ? new Date(settingsStartDate).toISOString() : null,
        endDate: settingsEndDate ? new Date(settingsEndDate).toISOString() : null,
        venueName: settingsVenueName,
        city: settingsCity,
        address: settingsAddress,
        coverImageUrl,
        message: inviteMessage,
        allowPlusOnes,
        maxPlusOnes,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toISOString() : null,
      });
      setInvite(updated);
      setSettingsCoverImage(null);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  // ============================================================================
  // SENDING
  // ============================================================================

  const freeEmailsRemaining = Math.max(0, FREE_EMAIL_LIMIT - freeEmailsUsed);
  const unsentEmailGuests = guests.filter(g => g.email && !g.email_sent_at);
  const unsentSmsGuests = guests.filter(g => g.phone && !g.sms_sent_at);
  const freeEmailsToUse = Math.min(freeEmailsRemaining, unsentEmailGuests.length);
  const paidEmailCount = Math.max(0, unsentEmailGuests.length - freeEmailsToUse);
  const emailCreditsNeeded = paidEmailCount;
  const smsCreditsNeeded = unsentSmsGuests.length * 5;

  async function handleSendInvites() {
    if (unsentEmailGuests.length === 0) {
      toast.info('No unsent guests with email addresses');
      return;
    }
    if (paidEmailCount > 0 && creditBalance < emailCreditsNeeded) {
      toast.error(`Insufficient credits. You need ${emailCreditsNeeded} credits for ${paidEmailCount} paid email${paidEmailCount > 1 ? 's' : ''}.`);
      return;
    }
    setSendingInvites(true);
    try {
      let sent = 0;
      let freeUsed = 0;
      const sentIds = [];

      for (const g of unsentEmailGuests) {
        const isFree = freeUsed < freeEmailsToUse;

        if (!isFree) {
          const { error: deductError } = await supabase.rpc('deduct_communication_credits', {
            p_organizer_id: organizer.id,
            p_amount: 1,
            p_description: `Party invite email to ${g.email}`,
          });
          if (deductError) {
            console.error('Credit deduction failed:', deductError);
            if (sent > 0) {
              toast.warning(`Sent ${sent} invites but ran out of credits.`);
            } else {
              toast.error('Failed to deduct credits');
            }
            break;
          }
        }

        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        await sendPartyInviteEmail(g.email, {
          eventTitle: invite.title,
          eventDate: invite.start_date,
          venueName: invite.venue_name,
          city: invite.city,
          eventImage: invite.cover_image_url,
          organizerName: organizer?.business_name,
          message: invite.message,
          rsvpUrl,
        }, organizer.id);

        sentIds.push(g.id);
        sent++;
        if (isFree) freeUsed++;
      }

      if (sentIds.length > 0) {
        await markEmailsSent(sentIds);
        if (freeUsed > 0) {
          await incrementFreeEmailUsage(organizer.id, freeUsed);
        }
        await loadGuestsAndStats(invite.id);
        await loadCreditAndFreeEmailData();
        const freeNote = freeUsed > 0 ? ` (${freeUsed} free)` : '';
        toast.success(`${sent} invite${sent > 1 ? 's' : ''} sent!${freeNote}`);
      }
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Error sending invites');
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleSendReminders() {
    const pending = guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at);
    if (pending.length === 0) {
      toast.info('No pending guests to remind');
      return;
    }
    setSendingReminders(true);
    try {
      for (const g of pending) {
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        await sendPartyInviteReminderEmail(g.email, {
          eventTitle: invite.title,
          eventDate: invite.start_date,
          venueName: invite.venue_name,
          city: invite.city,
          rsvpUrl,
          goingCount: stats.going,
        }, organizer.id);
      }
      await markReminded(pending.map(g => g.id));
      await loadGuestsAndStats(invite.id);
      toast.success(`${pending.length} reminder${pending.length > 1 ? 's' : ''} sent!`);
    } catch (err) {
      console.error('Reminder error:', err);
      toast.error('Error sending reminders');
    } finally {
      setSendingReminders(false);
    }
  }

  async function handleSendSmsInvites() {
    if (unsentSmsGuests.length === 0) {
      toast.info('No unsent guests with phone numbers');
      return;
    }
    if (creditBalance < smsCreditsNeeded) {
      toast.error(`Insufficient credits. You need ${smsCreditsNeeded} credits for ${unsentSmsGuests.length} SMS (5 credits each).`);
      return;
    }
    setSendingSms(true);
    try {
      let sent = 0;
      const sentIds = [];

      for (const g of unsentSmsGuests) {
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        const message = `You're invited to ${invite.title}! RSVP here: ${rsvpUrl}${invite.message ? `\n\n${invite.message}` : ''}\n\n- ${organizer?.business_name}`;

        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            organizer_id: organizer.id,
            phone: g.phone,
            message,
          },
        });

        if (smsError) {
          console.error('SMS send failed:', smsError);
          if (sent > 0) {
            toast.warning(`Sent ${sent} SMS but encountered an error.`);
          } else {
            toast.error('Failed to send SMS');
          }
          break;
        }

        sentIds.push(g.id);
        sent++;
      }

      if (sentIds.length > 0) {
        await markSmsSent(sentIds);
        await loadGuestsAndStats(invite.id);
        await loadCreditAndFreeEmailData();
        toast.success(`${sent} SMS invite${sent > 1 ? 's' : ''} sent!`);
      }
    } catch (err) {
      console.error('SMS error:', err);
      toast.error('Error sending SMS invites');
    } finally {
      setSendingSms(false);
    }
  }

  function copyShareLink() {
    const url = `${APP_URL}/invite/${invite.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  }

  const flyerRef = useRef(null);
  async function handleDownloadFlyerWithQR() {
    if (!flyerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 600, height: 900,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(invite.title || 'party').replace(/\s+/g, '-')}-flyer.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Flyer downloaded!');
    } catch (err) {
      console.error('Flyer error:', err);
      toast.error('Failed to generate flyer');
    }
  }

  const filteredGuests = statusFilter === 'all' ? guests : guests.filter(g => g.rsvp_status === statusFilter);

  const statusBadge = (status) => {
    const map = {
      going: 'bg-emerald-100 text-emerald-700',
      maybe: 'bg-amber-100 text-amber-700',
      pending: 'bg-blue-100 text-blue-700',
      declined: 'bg-gray-100 text-gray-500',
    };
    const labels = { going: 'Going', maybe: 'Maybe', pending: 'Pending', declined: 'Declined' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>{labels[status] || status}</span>;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loadingCampaigns) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ============================================================================
  // VIEW: CREATE CAMPAIGN (Multi-Step Wizard)
  // ============================================================================
  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setView('list'); setCreateStep(1); }} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Create a Party</h1>
          </div>
          <span className="text-sm text-gray-400">Step {createStep} of 4</span>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-6">
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
                onCreate={handleCreateCampaign}
                creating={creating}
                partyName={createTitle}
                startDate={createStartDate}
                venueName={createVenueName}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // VIEW: CAMPAIGN DETAIL
  // ============================================================================
  if (view === 'detail' && invite) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setView('list'); loadCampaigns(); }} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{invite.title || 'Untitled Invite'}</h1>
              {invite.start_date && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateShort(invite.start_date)}
                  {invite.venue_name && <><span className="mx-1">·</span><MapPin className="w-3.5 h-3.5" />{invite.venue_name}</>}
                </p>
              )}
            </div>
          </div>
        </div>

        {loadingInvite ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Going', count: stats.going, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
                { label: 'Maybe', count: stats.maybe, color: 'text-amber-600', bg: 'bg-amber-50', icon: HelpCircle },
                { label: 'Pending', count: stats.pending, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
                { label: 'Declined', count: stats.declined, color: 'text-gray-500', bg: 'bg-gray-50', icon: X },
              ].map(s => (
                <Card key={s.label} className="rounded-2xl">
                  <CardContent className="p-4 text-center">
                    <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Credit Info Banner */}
            <Card className="rounded-2xl border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Free Emails: <span className="font-bold">{freeEmailsRemaining} / {FREE_EMAIL_LIMIT}</span> remaining
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Credits: <span className="font-bold">{creditBalance}</span>
                    </span>
                  </div>
                </div>
                {paidEmailCount > 0 && (
                  <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {paidEmailCount} email{paidEmailCount > 1 ? 's' : ''} will use {emailCreditsNeeded} credit{emailCreditsNeeded > 1 ? 's' : ''} (1 per email)
                  </p>
                )}
                {unsentSmsGuests.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    SMS sending costs 5 credits each ({smsCreditsNeeded} credits for {unsentSmsGuests.length} SMS)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSendInvites}
                disabled={sendingInvites || unsentEmailGuests.length === 0 || (paidEmailCount > 0 && creditBalance < emailCreditsNeeded)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
              >
                {sendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Email Invites ({unsentEmailGuests.length})
              </Button>
              <Button
                onClick={handleSendSmsInvites}
                disabled={sendingSms || unsentSmsGuests.length === 0 || creditBalance < smsCreditsNeeded}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2"
              >
                {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Send SMS Invites ({unsentSmsGuests.length})
              </Button>
              <Button
                onClick={handleSendReminders}
                disabled={sendingReminders || guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at).length === 0}
                variant="outline"
                className="rounded-xl gap-2"
              >
                {sendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Send Reminders ({guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at).length})
              </Button>
              <Button variant="outline" onClick={copyShareLink} className="rounded-xl gap-2">
                <Copy className="w-4 h-4" /> Copy Share Link
              </Button>
              <Button variant="outline" onClick={handleDownloadFlyerWithQR} className="rounded-xl gap-2">
                <Download className="w-4 h-4" /> Flyer with QR
              </Button>
            </div>

            {/* Hidden QR flyer for capture */}
            <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
              <div ref={flyerRef} style={{ width: 600, height: 900, background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden' }}>
                {/* Top half: cover or gradient */}
                <div style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
                  {invite.cover_image_url ? (
                    <img src={invite.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6))' }} />
                  <div style={{ position: 'absolute', bottom: 24, left: 32, right: 32, color: '#fff' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                      {invite.title}
                    </div>
                  </div>
                </div>
                {/* Bottom half: info + QR */}
                <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {invite.start_date && (
                    <div style={{ fontSize: 18, color: '#374151', fontWeight: 600 }}>
                      {format(new Date(invite.start_date), 'EEE, MMM d, yyyy · h:mm a')}
                    </div>
                  )}
                  {invite.venue_name && (
                    <div style={{ fontSize: 16, color: '#6b7280' }}>
                      📍 {invite.venue_name}{invite.city ? `, ${invite.city}` : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>Scan to RSVP</div>
                      <div style={{ fontSize: 12, color: '#d1d5db', wordBreak: 'break-all' }}>
                        {`${APP_URL}/invite/${invite.share_token}`}
                      </div>
                    </div>
                    <QRCodeSVG value={`${APP_URL}/invite/${invite.share_token}`} size={120} level="M" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 gap-1">
              {[
                { id: 'guests', label: 'Guest List', icon: Users },
                { id: 'add', label: 'Add Guests', icon: UserPlus },
                { id: 'settings', label: 'Settings', icon: Settings2 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Guest List */}
            {activeTab === 'guests' && (
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px] rounded-lg h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All ({stats.total})</SelectItem>
                        <SelectItem value="going">Going ({stats.going})</SelectItem>
                        <SelectItem value="maybe">Maybe ({stats.maybe})</SelectItem>
                        <SelectItem value="pending">Pending ({stats.pending})</SelectItem>
                        <SelectItem value="declined">Declined ({stats.declined})</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => loadGuestsAndStats(invite.id)} className="gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>

                  {filteredGuests.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-400">No guests yet. Add some in the "Add Guests" tab.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2 font-medium hidden sm:table-cell">Email</th>
                            <th className="pb-2 font-medium hidden md:table-cell">Phone</th>
                            <th className="pb-2 font-medium">RSVP</th>
                            <th className="pb-2 font-medium hidden md:table-cell">Sent</th>
                            <th className="pb-2 font-medium w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredGuests.map(g => (
                            <tr key={g.id} className="hover:bg-gray-50">
                              <td className="py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{g.name}</p>
                                  <p className="text-xs text-gray-400 sm:hidden">{g.email || '\u2014'}</p>
                                </div>
                              </td>
                              <td className="py-3 hidden sm:table-cell text-gray-600">{g.email || '\u2014'}</td>
                              <td className="py-3 hidden md:table-cell text-gray-600">{g.phone || '\u2014'}</td>
                              <td className="py-3">
                                {statusBadge(g.rsvp_status)}
                                {g.plus_ones > 0 && (
                                  <span className="ml-1 text-xs text-gray-400">+{g.plus_ones}</span>
                                )}
                              </td>
                              <td className="py-3 hidden md:table-cell">
                                <div className="flex items-center gap-2">
                                  {g.email_sent_at ? (
                                    <span className="text-xs text-blue-600 flex items-center gap-1" title="Email sent">
                                      <Mail className="w-3 h-3" /> <CheckCircle className="w-3 h-3" />
                                    </span>
                                  ) : g.email ? (
                                    <span className="text-xs text-gray-400 flex items-center gap-1" title="Email not sent">
                                      <Mail className="w-3 h-3" />
                                    </span>
                                  ) : null}
                                  {g.sms_sent_at ? (
                                    <span className="text-xs text-emerald-600 flex items-center gap-1" title="SMS sent">
                                      <Phone className="w-3 h-3" /> <CheckCircle className="w-3 h-3" />
                                    </span>
                                  ) : g.phone ? (
                                    <span className="text-xs text-gray-400 flex items-center gap-1" title="SMS not sent">
                                      <Phone className="w-3 h-3" />
                                    </span>
                                  ) : null}
                                  {!g.email && !g.phone && (
                                    <span className="text-xs text-gray-400">No contact</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <button
                                  onClick={() => handleRemoveGuest(g.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove guest"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab: Add Guests */}
            {activeTab === 'add' && (
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-4">
                  <div className="flex gap-2">
                    {[
                      { id: 'manual', label: 'Manual Entry' },
                      { id: 'paste', label: 'Paste List' },
                      { id: 'contacts', label: 'From Contacts' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setAddMode(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          addMode === m.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {addMode === 'manual' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Name *</Label>
                          <Input
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            placeholder="Jane Doe"
                            className="rounded-lg mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={manualEmail}
                            onChange={e => setManualEmail(e.target.value)}
                            placeholder="jane@email.com"
                            className="rounded-lg mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Phone</Label>
                          <Input
                            value={manualPhone}
                            onChange={e => setManualPhone(e.target.value)}
                            placeholder="+234..."
                            className="rounded-lg mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddManual}
                        disabled={!manualName.trim() || addingGuests}
                        className="rounded-xl gap-2"
                      >
                        {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add Guest
                      </Button>
                    </div>
                  )}

                  {addMode === 'paste' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">
                        One guest per line. Formats: "Name &lt;email&gt;", "Name, email", or just "email"
                      </p>
                      <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        placeholder={"Jane Doe <jane@email.com>\nJohn Smith, john@email.com\nfriend@email.com"}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <Button
                        onClick={handleAddPaste}
                        disabled={!pasteText.trim() || addingGuests}
                        className="rounded-xl gap-2"
                      >
                        {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                        Add Guests
                      </Button>
                    </div>
                  )}

                  {addMode === 'contacts' && (
                    <div className="space-y-3">
                      <Input
                        value={contactSearch}
                        onChange={e => setContactSearch(e.target.value)}
                        placeholder="Search contacts..."
                        className="rounded-lg"
                      />
                      <div className="max-h-60 overflow-y-auto space-y-1 border rounded-xl p-2">
                        {contacts.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">No contacts found</p>
                        ) : contacts.map(c => {
                          const isSelected = selectedContacts.some(sc => sc.id === c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedContacts(prev =>
                                  isSelected ? prev.filter(sc => sc.id !== c.id) : [...prev, c]
                                );
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                              }`}>
                                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                                <p className="text-xs text-gray-400 truncate">{c.email || c.phone || '\u2014'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        onClick={handleAddContacts}
                        disabled={selectedContacts.length === 0 || addingGuests}
                        className="rounded-xl gap-2"
                      >
                        {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Add {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-5">
                  {/* Title */}
                  <div>
                    <Label className="text-sm font-medium">Title</Label>
                    <Input
                      value={settingsTitle}
                      onChange={e => setSettingsTitle(e.target.value)}
                      placeholder="Invite title"
                      className="rounded-xl mt-1"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <textarea
                      value={settingsDescription}
                      onChange={e => setSettingsDescription(e.target.value)}
                      placeholder="Describe your event..."
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={settingsStartDate}
                        onChange={e => setSettingsStartDate(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={settingsEndDate}
                        onChange={e => setSettingsEndDate(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                  </div>

                  {/* Venue */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Venue Name</Label>
                      <Input
                        value={settingsVenueName}
                        onChange={e => setSettingsVenueName(e.target.value)}
                        placeholder="Venue name"
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">City</Label>
                      <Input
                        value={settingsCity}
                        onChange={e => setSettingsCity(e.target.value)}
                        placeholder="City"
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Address</Label>
                      <Input
                        value={settingsAddress}
                        onChange={e => setSettingsAddress(e.target.value)}
                        placeholder="Address"
                        className="rounded-xl mt-1"
                      />
                    </div>
                  </div>

                  {/* Cover Image */}
                  <div>
                    <Label className="text-sm font-medium">Cover Image</Label>
                    {invite.cover_image_url && !settingsCoverImage && (
                      <div className="mt-1 mb-2">
                        <img src={invite.cover_image_url} alt="" className="w-32 h-20 object-cover rounded-lg" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary/40 transition-colors mt-1">
                      <Image className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {settingsCoverImage ? settingsCoverImage.name : 'Upload new image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => setSettingsCoverImage(e.target.files[0] || null)}
                      />
                    </label>
                  </div>

                  {/* Invite Message */}
                  <div>
                    <Label className="text-sm font-medium">Custom Invite Message</Label>
                    <textarea
                      value={inviteMessage}
                      onChange={e => setInviteMessage(e.target.value)}
                      placeholder="Add a personal message to your invite..."
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* Plus Ones */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Allow Plus-Ones</Label>
                      <p className="text-xs text-gray-400">Let guests bring additional people</p>
                    </div>
                    <button
                      onClick={() => setAllowPlusOnes(!allowPlusOnes)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${allowPlusOnes ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${allowPlusOnes ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  {allowPlusOnes && (
                    <div>
                      <Label className="text-xs text-gray-500">Max plus-ones per guest</Label>
                      <Select value={String(maxPlusOnes)} onValueChange={v => setMaxPlusOnes(Number(v))}>
                        <SelectTrigger className="w-24 rounded-lg h-9 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* RSVP Deadline */}
                  <div>
                    <Label className="text-sm font-medium">RSVP Deadline</Label>
                    <p className="text-xs text-gray-400 mb-1">After this date, guests can no longer respond</p>
                    <Input
                      type="datetime-local"
                      value={rsvpDeadline}
                      onChange={e => setRsvpDeadline(e.target.value)}
                      className="rounded-lg w-full sm:w-64"
                    />
                  </div>

                  {/* Shareable Link */}
                  <div>
                    <Label className="text-sm font-medium">Shareable Invite Link</Label>
                    <p className="text-xs text-gray-400 mb-2">Anyone with this link can RSVP (they'll enter their name)</p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`${APP_URL}/invite/${invite.share_token}`}
                        className="rounded-lg text-sm bg-gray-50 flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={copyShareLink} className="rounded-lg gap-1 shrink-0">
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="rounded-xl gap-2"
                  >
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW: CAMPAIGN LIST (default)
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-primary" />
            RackParty
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create beautiful party invites and track RSVPs</p>
        </div>
        <Button onClick={() => setView('create')} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Create a Party
        </Button>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-20">
          <PartyPopper className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No parties yet</h2>
          <p className="text-gray-400 mb-6">Create your first party to get started</p>
          <Button onClick={() => setView('create')} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Create a Party
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => {
            const s = campaignStats[c.id] || { total: 0, going: 0, maybe: 0, pending: 0, declined: 0 };
            return (
              <Card
                key={c.id}
                className="rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openCampaign(c)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Cover thumbnail */}
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shrink-0">
                        <PartyPopper className="w-7 h-7 text-purple-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{c.title || 'Untitled Invite'}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {c.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateShort(c.start_date)}
                          </span>
                        )}
                        {c.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {c.venue_name}
                          </span>
                        )}
                      </div>
                      {/* RSVP mini badges */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5" /> {s.total} guest{s.total !== 1 ? 's' : ''}
                        </span>
                        {s.going > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            {s.going} going
                          </span>
                        )}
                        {s.maybe > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {s.maybe} maybe
                          </span>
                        )}
                        {s.pending > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {s.pending} pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
