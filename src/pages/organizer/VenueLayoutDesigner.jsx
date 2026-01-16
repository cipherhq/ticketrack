/**
 * Venue Layout Designer - Professional Edition v2
 * Optimized for performance with React.memo and useCallback
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Trash2, RotateCw, Plus, Undo, Redo, Grid, Copy,
  ChevronLeft, ChevronRight, ChevronDown, Eye,
  ZoomIn, ZoomOut, Move, MousePointer, Square, Circle,
  Download, HelpCircle, Star, Search, Type, Palette, Users, Music,
  Utensils, Briefcase, Monitor, Armchair, Table2,
  LayoutGrid, PanelLeftClose, PanelRightClose, DoorOpen, Ticket,
  Camera, Sparkles, MapPin, AlertTriangle, ShieldCheck, PartyPopper
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// =============================================================================
// OBJECT LIBRARY - Comprehensive Categories and Items
// =============================================================================

const OBJECT_CATEGORIES = [
  {
    id: 'essentials',
    name: 'Event Essentials',
    icon: Ticket,
    items: [
      { id: 'check-in-desk', name: 'Check-in Desk', type: 'check-in', width: 120, height: 48, color: '#2969FF', label: 'CHECK-IN' },
      { id: 'registration', name: 'Registration', type: 'registration', width: 144, height: 48, color: '#00BCD4', label: 'REGISTRATION' },
      { id: 'exit-door', name: 'Exit', type: 'exit', width: 60, height: 24, color: '#F44336', label: 'EXIT' },
      { id: 'entrance', name: 'Entrance', type: 'entrance', width: 60, height: 24, color: '#4CAF50', label: 'ENTRANCE' },
      { id: 'vip-entrance', name: 'VIP Entrance', type: 'vip-entrance', width: 60, height: 24, color: '#9C27B0', label: 'VIP' },
      { id: 'security', name: 'Security Post', type: 'security', width: 48, height: 48, color: '#455A64', label: '🛡️' },
      { id: 'first-aid', name: 'First Aid', type: 'first-aid', width: 48, height: 48, color: '#F44336', label: '➕' },
      { id: 'info-desk', name: 'Info Desk', type: 'info', width: 72, height: 48, color: '#03A9F4', label: 'INFO' },
    ]
  },
  {
    id: 'tables',
    name: 'Tables & Seating',
    icon: Table2,
    items: [
      { id: 'round-table-10', name: '10-Top Round', type: 'round-table', seats: 10, width: 84, height: 84, color: '#E91E63' },
      { id: 'round-table-8', name: '8-Top Round', type: 'round-table', seats: 8, width: 72, height: 72, color: '#E91E63' },
      { id: 'round-table-6', name: '6-Top Round', type: 'round-table', seats: 6, width: 60, height: 60, color: '#E91E63' },
      { id: 'rect-table-8', name: '8ft Rectangle', type: 'rect-table', seats: 8, width: 120, height: 48, color: '#9C27B0' },
      { id: 'rect-table-6', name: '6ft Rectangle', type: 'rect-table', seats: 6, width: 96, height: 48, color: '#9C27B0' },
      { id: 'cocktail-table', name: 'Cocktail Table', type: 'cocktail', seats: 4, width: 36, height: 36, color: '#673AB7' },
      { id: 'highboy', name: 'Highboy Table', type: 'highboy', seats: 4, width: 30, height: 30, color: '#7B1FA2' },
      { id: 'sweetheart', name: 'Sweetheart Table', type: 'sweetheart', seats: 2, width: 60, height: 36, color: '#EC407A' },
      { id: 'head-table', name: 'Head Table', type: 'head-table', seats: 10, width: 180, height: 36, color: '#AB47BC' },
      { id: 'banquet-chair', name: 'Chair', type: 'chair', seats: 1, width: 20, height: 20, color: '#E91E63' },
      { id: 'chair-row', name: 'Chair Row (10)', type: 'chair-row', seats: 10, width: 200, height: 24, color: '#E91E63' },
    ]
  },
  {
    id: 'stage',
    name: 'Stage & Performance',
    icon: Music,
    items: [
      { id: 'stage-small', name: 'Stage (12x8)', type: 'stage', width: 144, height: 96, color: '#5D4037', label: 'STAGE' },
      { id: 'stage-medium', name: 'Stage (16x10)', type: 'stage', width: 192, height: 120, color: '#5D4037', label: 'STAGE' },
      { id: 'stage-large', name: 'Stage (24x12)', type: 'stage', width: 288, height: 144, color: '#5D4037', label: 'STAGE' },
      { id: 'runway', name: 'Runway/Catwalk', type: 'runway', width: 48, height: 240, color: '#424242', label: 'RUNWAY' },
      { id: 'dj-booth', name: 'DJ Booth', type: 'dj-booth', width: 72, height: 48, color: '#311B92', label: 'DJ' },
      { id: 'dj-setup', name: 'DJ Setup (Large)', type: 'dj-setup', width: 120, height: 60, color: '#4527A0', label: 'DJ' },
      { id: 'band-stage', name: 'Band Area', type: 'band', width: 180, height: 120, color: '#6A1B9A', label: 'BAND' },
      { id: 'dance-floor-s', name: 'Dance Floor (S)', type: 'dance-floor', width: 144, height: 144, color: '#1a1a2e' },
      { id: 'dance-floor-m', name: 'Dance Floor (M)', type: 'dance-floor', width: 192, height: 192, color: '#1a1a2e' },
      { id: 'dance-floor-l', name: 'Dance Floor (L)', type: 'dance-floor', width: 240, height: 240, color: '#1a1a2e' },
    ]
  },
  {
    id: 'food',
    name: 'Food & Beverage',
    icon: Utensils,
    items: [
      { id: 'buffet-line', name: 'Buffet Line', type: 'buffet', width: 180, height: 36, color: '#689F38', label: 'BUFFET' },
      { id: 'food-station', name: 'Food Station', type: 'food-station', width: 72, height: 72, color: '#8BC34A' },
      { id: 'bar-straight', name: 'Bar (Straight)', type: 'bar', width: 144, height: 48, color: '#4E342E', label: 'BAR' },
      { id: 'bar-corner', name: 'Bar (L-Shape)', type: 'bar-l', width: 120, height: 120, color: '#4E342E', label: 'BAR' },
      { id: 'bar-round', name: 'Bar (Round)', type: 'bar-round', width: 96, height: 96, color: '#4E342E', label: 'BAR' },
      { id: 'dessert', name: 'Dessert Table', type: 'dessert', width: 96, height: 48, color: '#F48FB1', label: 'DESSERTS' },
      { id: 'cake-table', name: 'Cake Table', type: 'cake', width: 60, height: 60, color: '#F8BBD9', label: 'CAKE' },
      { id: 'coffee', name: 'Coffee Station', type: 'coffee', width: 60, height: 48, color: '#6D4C41' },
      { id: 'water-station', name: 'Water/Drinks', type: 'drinks', width: 48, height: 36, color: '#29B6F6' },
    ]
  },
  {
    id: 'photo',
    name: 'Photo & Media',
    icon: Camera,
    items: [
      { id: 'photo-booth', name: 'Photo Booth', type: 'photo-booth', width: 96, height: 72, color: '#FF5722', label: 'PHOTO BOOTH' },
      { id: 'backdrop', name: 'Photo Backdrop', type: 'backdrop', width: 144, height: 12, color: '#FF7043' },
      { id: 'step-repeat', name: 'Step & Repeat', type: 'step-repeat', width: 180, height: 12, color: '#E64A19' },
      { id: 'red-carpet', name: 'Red Carpet', type: 'red-carpet', width: 48, height: 180, color: '#C62828' },
      { id: 'camera-platform', name: 'Camera Platform', type: 'camera', width: 48, height: 48, color: '#37474F' },
      { id: 'livestream', name: 'Livestream Setup', type: 'livestream', width: 72, height: 48, color: '#D32F2F', label: 'LIVE' },
    ]
  },
  {
    id: 'av',
    name: 'A/V & Tech',
    icon: Monitor,
    items: [
      { id: 'screen-large', name: 'Screen (Large)', type: 'screen', width: 192, height: 12, color: '#ECEFF1' },
      { id: 'screen-medium', name: 'Screen (Medium)', type: 'screen', width: 144, height: 12, color: '#ECEFF1' },
      { id: 'tv-65', name: 'TV 65"', type: 'display', width: 60, height: 8, color: '#263238' },
      { id: 'led-wall', name: 'LED Wall', type: 'led-wall', width: 240, height: 12, color: '#1A237E' },
      { id: 'speaker-main', name: 'Main Speaker', type: 'speaker', width: 30, height: 30, color: '#37474F' },
      { id: 'speaker-sub', name: 'Subwoofer', type: 'subwoofer', width: 36, height: 36, color: '#263238' },
      { id: 'sound-booth', name: 'Sound Booth', type: 'sound-booth', width: 72, height: 60, color: '#1B5E20', label: 'SOUND' },
      { id: 'lighting-truss', name: 'Lighting Truss', type: 'truss', width: 180, height: 12, color: '#424242' },
      { id: 'podium', name: 'Podium/Lectern', type: 'podium', width: 36, height: 24, color: '#5D4037' },
    ]
  },
  {
    id: 'lounge',
    name: 'Lounge & VIP',
    icon: Armchair,
    items: [
      { id: 'vip-section', name: 'VIP Section', type: 'vip-section', width: 180, height: 120, color: '#7B1FA2', label: 'VIP' },
      { id: 'lounge-area', name: 'Lounge Area', type: 'lounge-area', width: 144, height: 96, color: '#5D4037' },
      { id: 'sofa-3', name: '3-Seat Sofa', type: 'sofa', width: 96, height: 40, color: '#5D4037' },
      { id: 'sofa-2', name: 'Loveseat', type: 'loveseat', width: 60, height: 40, color: '#5D4037' },
      { id: 'armchair', name: 'Armchair', type: 'armchair', width: 36, height: 36, color: '#6D4C41' },
      { id: 'ottoman', name: 'Ottoman', type: 'ottoman', width: 30, height: 30, color: '#8D6E63' },
      { id: 'coffee-table', name: 'Coffee Table', type: 'coffee-table', width: 60, height: 36, color: '#3E2723' },
      { id: 'side-table', name: 'Side Table', type: 'side-table', width: 24, height: 24, color: '#4E342E' },
    ]
  },
  {
    id: 'decor',
    name: 'Decor & Barriers',
    icon: Sparkles,
    items: [
      { id: 'rope-barrier', name: 'Rope Barrier', type: 'barrier', width: 96, height: 8, color: '#FFD700' },
      { id: 'stanchion', name: 'Stanchion Post', type: 'stanchion', width: 12, height: 12, color: '#CFD8DC' },
      { id: 'divider-wall', name: 'Divider Wall', type: 'divider', width: 120, height: 8, color: '#9E9E9E' },
      { id: 'pipe-drape', name: 'Pipe & Drape', type: 'drape', width: 144, height: 8, color: '#78909C' },
      { id: 'plant-large', name: 'Large Plant', type: 'plant', width: 48, height: 48, color: '#2E7D32' },
      { id: 'plant-small', name: 'Small Plant', type: 'plant-sm', width: 24, height: 24, color: '#43A047' },
      { id: 'flowers', name: 'Flower Arrangement', type: 'flowers', width: 30, height: 30, color: '#EC407A' },
      { id: 'balloon-arch', name: 'Balloon Arch', type: 'balloon', width: 144, height: 24, color: '#E040FB' },
      { id: 'centerpiece', name: 'Centerpiece', type: 'centerpiece', width: 24, height: 24, color: '#FFB300' },
    ]
  },
  {
    id: 'outdoor',
    name: 'Outdoor & Tents',
    icon: MapPin,
    items: [
      { id: 'tent-10x10', name: 'Tent 10x10', type: 'tent', width: 120, height: 120, color: '#ECEFF1' },
      { id: 'tent-20x20', name: 'Tent 20x20', type: 'tent', width: 240, height: 240, color: '#ECEFF1' },
      { id: 'canopy', name: 'Canopy', type: 'canopy', width: 144, height: 144, color: '#B0BEC5' },
      { id: 'umbrella', name: 'Market Umbrella', type: 'umbrella', width: 72, height: 72, color: '#FF7043' },
      { id: 'fire-pit', name: 'Fire Pit', type: 'fire-pit', width: 48, height: 48, color: '#FF5722' },
      { id: 'heater', name: 'Patio Heater', type: 'heater', width: 24, height: 24, color: '#FF8A65' },
    ]
  },
]

// =============================================================================
// REALISTIC OBJECT RENDERER
// =============================================================================

const renderRealisticObject = (obj, scale = 1) => {
  const w = obj.width
  const h = obj.height
  const cx = w / 2
  const cy = h / 2
  const strokeColor = obj.color || '#333'
  const fillColor = obj.color || '#666'

  switch (obj.type) {
    // ===== TABLES =====
    case 'round-table':
      return (
        <>
          {/* Table top */}
          <circle cx={cx} cy={cy} r={Math.min(w, h) / 2 - 2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={Math.min(w, h) / 2 - 6} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.3} />
          {/* Table base */}
          <circle cx={cx} cy={cy + Math.min(w, h) / 2 - 8} r={4} fill="#4a4a4a" />
        </>
      )

    case 'rect-table':
    case 'head-table':
      return (
        <>
          {/* Table top */}
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.3} />
          {/* Table legs */}
          <rect x={w * 0.15} y={h - 6} width={3} height={4} fill="#4a4a4a" />
          <rect x={w * 0.85 - 3} y={h - 6} width={3} height={4} fill="#4a4a4a" />
        </>
      )

    case 'cocktail':
    case 'highboy':
      return (
        <>
          <circle cx={cx} cy={cy - 4} r={Math.min(w, h) / 2 - 2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={cx - 2} y={cy - 4} width={4} height={h - Math.min(w, h) / 2 + 4} fill="#4a4a4a" />
          <circle cx={cx} cy={h - 4} r={6} fill="#4a4a4a" />
        </>
      )

    case 'sweetheart':
      return (
        <>
          <ellipse cx={cx} cy={cy} rx={w / 2 - 2} ry={h / 2 - 2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={cx - 2} y={cy} width={4} height={h / 2} fill="#4a4a4a" />
        </>
      )

    // ===== CHAIRS =====
    case 'chair':
    case 'banquet-chair':
    case 'chiavari':
    case 'ghost':
      return (
        <>
          {/* Seat */}
          <rect x={w * 0.2} y={h * 0.3} width={w * 0.6} height={h * 0.3} rx={1} fill={fillColor} stroke="#000" strokeWidth={0.5} />
          {/* Backrest */}
          <rect x={w * 0.2} y={h * 0.1} width={w * 0.6} height={h * 0.2} rx={1} fill={fillColor} stroke="#000" strokeWidth={0.5} />
          {/* Legs */}
          <rect x={w * 0.25} y={h * 0.6} width={1.5} height={h * 0.4} fill="#4a4a4a" />
          <rect x={w * 0.75 - 1.5} y={h * 0.6} width={1.5} height={h * 0.4} fill="#4a4a4a" />
        </>
      )

    case 'chair-row':
      return (
        <>
          {Array.from({ length: 10 }).map((_, i) => {
            const x = (w / 10) * i + (w / 10) * 0.2
            return (
              <g key={i}>
                <rect x={x} y={h * 0.3} width={w / 10 * 0.6} height={h * 0.3} rx={1} fill={fillColor} stroke="#000" strokeWidth={0.5} />
                <rect x={x} y={h * 0.1} width={w / 10 * 0.6} height={h * 0.2} rx={1} fill={fillColor} stroke="#000" strokeWidth={0.5} />
              </g>
            )
          })}
        </>
      )

    // ===== STAGE & ENTERTAINMENT =====
    case 'stage':
      return (
        <>
          {/* Stage platform */}
          <rect x={0} y={h * 0.7} width={w} height={h * 0.3} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Stage front */}
          <rect x={0} y={h * 0.7} width={w} height={4} fill="#5a5a5a" />
          {/* Stage supports */}
          {[w * 0.1, w * 0.5, w * 0.9].map(x => (
            <rect key={x} x={x - 2} y={h * 0.7} width={4} height={h * 0.3} fill="#4a4a4a" />
          ))}
          {/* Stage label */}
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={Math.min(10, w / 15)} fontWeight="bold">STAGE</text>
        </>
      )

    case 'dj-booth':
    case 'dj-setup':
      return (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill="#1a1a2e" stroke="#000" strokeWidth={1} />
          {/* Turntables */}
          <circle cx={w * 0.3} cy={h * 0.5} r={8} fill="#2a2a4a" stroke="#000" />
          <circle cx={w * 0.7} cy={h * 0.5} r={8} fill="#2a2a4a" stroke="#000" />
          <circle cx={w * 0.3} cy={h * 0.5} r={3} fill="#E91E63" />
          <circle cx={w * 0.7} cy={h * 0.5} r={3} fill="#E91E63" />
          {/* Mixer */}
          <rect x={w * 0.4} y={h * 0.4} width={w * 0.2} height={h * 0.2} fill="#4CAF50" rx={1} />
          <text x={cx} y={h * 0.7} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">DJ</text>
        </>
      )

    case 'dance-floor':
      const tileSize = 16
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#1a1a2e" stroke="#000" strokeWidth={1} />
          {Array.from({ length: Math.floor(w / tileSize) }).map((_, i) =>
            Array.from({ length: Math.floor(h / tileSize) }).map((_, j) => (
              <rect
                key={`${i}-${j}`}
                x={i * tileSize}
                y={j * tileSize}
                width={tileSize}
                height={tileSize}
                fill={(i + j) % 2 === 0 ? '#2a2a4a' : '#1a1a2e'}
                stroke="#000"
                strokeWidth={0.5}
              />
            ))
          )}
        </>
      )

    case 'runway':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#424242" stroke="#000" strokeWidth={1} />
          {/* Runway lines */}
          <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#fff" strokeWidth={1} opacity={0.5} />
          {[h * 0.25, h * 0.5, h * 0.75].map(y => (
            <line key={y} x1={0} y1={y} x2={w} y2={y} stroke="#fff" strokeWidth={0.5} opacity={0.3} />
          ))}
        </>
      )

    // ===== FOOD & BEVERAGE =====
    case 'bar':
    case 'bar-straight':
      return (
        <>
          <rect x={0} y={h * 0.6} width={w} height={h * 0.4} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={0} y={h * 0.6} width={w} height={6} fill="#5a4a3a" />
          {/* Bar stools */}
          {[w * 0.15, w * 0.35, w * 0.65, w * 0.85].map(x => (
            <circle key={x} cx={x} cy={h * 0.3} r={4} fill="#8B7355" stroke="#000" />
          ))}
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={Math.min(10, w / 12)} fontWeight="bold">BAR</text>
        </>
      )

    case 'bar-l':
      return (
        <>
          <rect x={0} y={h * 0.6} width={w * 0.6} height={h * 0.4} fill={fillColor} stroke="#000" />
          <rect x={w * 0.4} y={0} width={w * 0.6} height={h * 0.4} fill={fillColor} stroke="#000" />
          <rect x={0} y={h * 0.6} width={w * 0.6} height={6} fill="#5a4a3a" />
          <rect x={w * 0.4} y={0} width={w * 0.6} height={6} fill="#5a4a3a" />
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">BAR</text>
        </>
      )

    case 'buffet':
    case 'buffet-line':
      return (
        <>
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={0} y={h * 0.5} width={w} height={4} fill="#6a5a4a" />
          {/* Serving dishes */}
          {[w * 0.2, w * 0.4, w * 0.6, w * 0.8].map(x => (
            <ellipse key={x} cx={x} cy={h * 0.3} rx={6} ry={4} fill="#fff" stroke="#000" />
          ))}
          <text x={cx} y={h * 0.75} textAnchor="middle" fill="white" fontSize={Math.min(9, w / 15)} fontWeight="bold">BUFFET</text>
        </>
      )

    // ===== ESSENTIALS =====
    case 'check-in':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={w * 0.1} y={h * 0.2} width={w * 0.8} height={h * 0.3} fill="#fff" stroke="#000" strokeWidth={0.5} />
          <rect x={w * 0.1} y={h * 0.6} width={w * 0.8} height={h * 0.2} fill="#fff" stroke="#000" strokeWidth={0.5} />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(8, w / 12)} fontWeight="bold">CHECK-IN</text>
        </>
      )

    case 'registration':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={w * 0.15} y={h * 0.3} width={w * 0.7} height={h * 0.4} fill="#fff" stroke="#000" strokeWidth={0.5} />
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={Math.min(7, w / 15)} fontWeight="bold">REGISTRATION</text>
        </>
      )

    case 'exit':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#F44336" stroke="#000" strokeWidth={1} />
          <path d={`M ${w * 0.2} ${h * 0.3} L ${w * 0.5} ${h * 0.5} L ${w * 0.2} ${h * 0.7} M ${w * 0.5} ${h * 0.5} L ${w * 0.8} ${h * 0.5}`}
                stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(8, w / 8)} fontWeight="bold">EXIT</text>
        </>
      )

    case 'entrance':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#4CAF50" stroke="#000" strokeWidth={1} />
          <path d={`M ${w * 0.8} ${h * 0.3} L ${w * 0.5} ${h * 0.5} L ${w * 0.8} ${h * 0.7} M ${w * 0.5} ${h * 0.5} L ${w * 0.2} ${h * 0.5}`}
                stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(7, w / 9)} fontWeight="bold">ENTRANCE</text>
        </>
      )

    case 'vip-entrance':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#9C27B0" stroke="#000" strokeWidth={1} />
          <path d={`M ${w * 0.8} ${h * 0.3} L ${w * 0.5} ${h * 0.5} L ${w * 0.8} ${h * 0.7} M ${w * 0.5} ${h * 0.5} L ${w * 0.2} ${h * 0.5}`}
                stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(7, w / 9)} fontWeight="bold">VIP</text>
        </>
      )

    case 'security':
      return (
        <>
          {/* Base */}
          <rect x={w * 0.4} y={h * 0.7} width={w * 0.2} height={h * 0.3} fill="#555" stroke="#000" />
          {/* Post */}
          <rect x={w * 0.45} y={h * 0.2} width={w * 0.1} height={h * 0.5} fill="#666" stroke="#000" />
          {/* Top sign */}
          <rect x={w * 0.35} y={h * 0.2} width={w * 0.3} height={h * 0.15} fill="#F44336" stroke="#000" rx={1} />
          <text x={cx} y={h * 0.3} textAnchor="middle" fill="white" fontSize={Math.min(6, w / 8)} fontWeight="bold">SECURITY</text>
          {/* Shield icon */}
          <path d={`M ${cx} ${h * 0.5} L ${cx - 4} ${h * 0.6} L ${cx} ${h * 0.65} L ${cx + 4} ${h * 0.6} Z`}
                fill="#FFD700" stroke="#000" strokeWidth={0.5} />
        </>
      )

    case 'first-aid':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#F44336" stroke="#000" strokeWidth={1} rx={2} />
          <path d={`M ${cx} ${h * 0.3} L ${cx} ${h * 0.7} M ${cx - 6} ${h * 0.5} L ${cx + 6} ${h * 0.5}`}
                stroke="white" strokeWidth={2} strokeLinecap="round" />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(6, w / 8)} fontWeight="bold">FIRST AID</text>
        </>
      )

    case 'info':
    case 'info-desk':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <circle cx={cx} cy={h * 0.4} r={w * 0.15} fill="white" stroke="#000" strokeWidth={1} />
          <text x={cx} y={h * 0.45} textAnchor="middle" fill="#03A9F4" fontSize={Math.min(10, w / 5)} fontWeight="bold">?</text>
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={Math.min(7, w / 10)} fontWeight="bold">INFO</text>
        </>
      )

    // ===== PHOTO & MEDIA =====
    case 'photo-booth':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Camera */}
          <rect x={w * 0.3} y={h * 0.2} width={w * 0.4} height={h * 0.3} fill="#333" stroke="#000" rx={2} />
          <circle cx={cx} cy={h * 0.35} r={w * 0.08} fill="#000" />
          {/* Flash */}
          <rect x={w * 0.45} y={h * 0.15} width={w * 0.1} height={h * 0.08} fill="#fff" rx={1} />
          <text x={cx} y={h * 0.9} textAnchor="middle" fill="white" fontSize={Math.min(7, w / 12)} fontWeight="bold">PHOTO BOOTH</text>
        </>
      )

    case 'backdrop':
    case 'step-repeat':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={w * 0.1} y={h * 0.2} width={w * 0.8} height={h * 0.6} fill="#fff" stroke="#000" strokeWidth={0.5} />
        </>
      )

    case 'red-carpet':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#C62828" stroke="#000" strokeWidth={1} />
          {Array.from({ length: Math.floor(h / 8) }).map((_, i) => (
            <line key={i} x1={0} y1={i * 8} x2={w} y2={i * 8} stroke="#B71C1C" strokeWidth={0.5} />
          ))}
        </>
      )

    // ===== A/V EQUIPMENT =====
    case 'screen':
    case 'screen-large':
    case 'screen-medium':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#263238" stroke="#000" strokeWidth={1} />
          <rect x={2} y={2} width={w - 4} height={h - 4} fill="#1a1a2e" />
          {/* Screen frame */}
          <rect x={0} y={0} width={w} height={2} fill="#555" />
          <rect x={0} y={h - 2} width={w} height={2} fill="#555" />
        </>
      )

    case 'display':
    case 'tv-65':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill="#263238" stroke="#000" strokeWidth={1} rx={1} />
          <rect x={1} y={1} width={w - 2} height={h - 2} fill="#000" />
        </>
      )

    case 'speaker':
    case 'speaker-main':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} rx={2} fill="#37474F" stroke="#000" strokeWidth={1} />
          {/* Speaker grille */}
          {Array.from({ length: 3 }).map((_, i) => (
            <rect key={i} x={w * 0.2} y={h * 0.2 + i * h * 0.2} width={w * 0.6} height={h * 0.1} fill="#263238" />
          ))}
        </>
      )

    case 'podium':
      return (
        <>
          {/* Podium top */}
          <rect x={w * 0.2} y={0} width={w * 0.6} height={h * 0.3} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Podium body */}
          <rect x={w * 0.1} y={h * 0.3} width={w * 0.8} height={h * 0.7} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Microphone */}
          <circle cx={cx} cy={h * 0.15} r={2} fill="#333" />
          <line x1={cx} y1={h * 0.15} x2={cx} y2={h * 0.3} stroke="#333" strokeWidth={1} />
        </>
      )

    // ===== LOUNGE =====
    case 'sofa':
    case 'sofa-3':
      return (
        <>
          {/* Sofa base */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill={fillColor} stroke="#000" strokeWidth={1} rx={2} />
          {/* Backrest */}
          <rect x={0} y={0} width={w} height={h * 0.5} fill={fillColor} stroke="#000" strokeWidth={1} rx={2} />
          {/* Cushions */}
          <rect x={w * 0.1} y={h * 0.1} width={w * 0.25} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
          <rect x={w * 0.4} y={h * 0.1} width={w * 0.25} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
          <rect x={w * 0.7} y={h * 0.1} width={w * 0.2} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
          {/* Arms */}
          <rect x={0} y={h * 0.2} width={w * 0.1} height={h * 0.6} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={w * 0.9} y={h * 0.2} width={w * 0.1} height={h * 0.6} fill={fillColor} stroke="#000" strokeWidth={1} />
        </>
      )

    case 'loveseat':
    case 'sofa-2':
      return (
        <>
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill={fillColor} stroke="#000" rx={2} />
          <rect x={0} y={0} width={w} height={h * 0.5} fill={fillColor} stroke="#000" rx={2} />
          <rect x={w * 0.2} y={h * 0.1} width={w * 0.3} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
          <rect x={w * 0.5} y={h * 0.1} width={w * 0.3} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
        </>
      )

    case 'armchair':
      return (
        <>
          <rect x={w * 0.2} y={h * 0.5} width={w * 0.6} height={h * 0.5} fill={fillColor} stroke="#000" rx={2} />
          <rect x={w * 0.2} y={0} width={w * 0.6} height={h * 0.5} fill={fillColor} stroke="#000" rx={2} />
          <rect x={w * 0.25} y={h * 0.1} width={w * 0.5} height={h * 0.3} fill="#8B7355" stroke="#000" strokeWidth={0.5} />
        </>
      )

    // ===== DECOR =====
    case 'plant':
    case 'plant-large':
      return (
        <>
          {/* Pot */}
          <ellipse cx={cx} cy={h * 0.8} rx={w * 0.4} ry={h * 0.1} fill="#8B4513" stroke="#000" />
          <rect x={w * 0.2} y={h * 0.6} width={w * 0.6} height={h * 0.2} fill="#8B4513" stroke="#000" />
          {/* Plant */}
          <ellipse cx={cx} cy={h * 0.4} rx={w * 0.35} ry={h * 0.3} fill="#2E7D32" stroke="#1B5E20" />
          <ellipse cx={cx - w * 0.15} cy={h * 0.3} rx={w * 0.2} ry={h * 0.25} fill="#43A047" />
          <ellipse cx={cx + w * 0.15} cy={h * 0.3} rx={w * 0.2} ry={h * 0.25} fill="#43A047" />
        </>
      )

    case 'stanchion':
      return (
        <>
          {/* Base */}
          <rect x={w * 0.4} y={h * 0.7} width={w * 0.2} height={h * 0.3} fill="#CFD8DC" stroke="#000" />
          {/* Post */}
          <rect x={w * 0.45} y={0} width={w * 0.1} height={h * 0.7} fill="#CFD8DC" stroke="#000" />
          {/* Top */}
          <circle cx={cx} cy={0} r={w * 0.15} fill="#FFD700" stroke="#000" />
        </>
      )

    case 'barrier':
    case 'rope-barrier':
      return (
        <>
          <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="#FFD700" strokeWidth={2} />
          {[w * 0.1, w * 0.3, w * 0.5, w * 0.7, w * 0.9].map(x => (
            <g key={x}>
              <rect x={x - 2} y={h * 0.3} width={4} height={h * 0.4} fill="#CFD8DC" stroke="#000" />
              <circle cx={x} cy={h * 0.3} r={3} fill="#FFD700" stroke="#000" />
            </g>
          ))}
        </>
      )

    // ===== OUTDOOR =====
    case 'tent':
      return (
        <>
          {/* Tent roof */}
          <path d={`M ${w / 2} 0 L 0 ${h * 0.3} L ${w} ${h * 0.3} Z`} fill="#ECEFF1" stroke="#000" strokeWidth={1} />
          {/* Tent walls */}
          <rect x={0} y={h * 0.3} width={w} height={h * 0.7} fill="#F5F5F5" stroke="#000" strokeWidth={1} />
          {/* Tent entrance */}
          <path d={`M ${w * 0.3} ${h * 0.3} L ${w * 0.5} ${h * 0.5} L ${w * 0.7} ${h * 0.3}`} fill="#E0E0E0" stroke="#000" />
        </>
      )

    case 'umbrella':
      return (
        <>
          {/* Umbrella top */}
          <ellipse cx={cx} cy={h * 0.3} rx={w * 0.4} ry={h * 0.2} fill={fillColor} stroke="#000" />
          {/* Umbrella pole */}
          <rect x={cx - 1} y={h * 0.3} width={2} height={h * 0.7} fill="#8B4513" stroke="#000" />
          {/* Umbrella base */}
          <circle cx={cx} cy={h * 0.95} r={w * 0.15} fill="#666" stroke="#000" />
        </>
      )

    case 'fire-pit':
      return (
        <>
          <circle cx={cx} cy={cy} r={Math.min(w, h) / 2 - 2} fill="#333" stroke="#000" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={Math.min(w, h) / 2 - 6} fill="#1a1a1a" />
          {/* Fire */}
          <ellipse cx={cx} cy={cy - 2} rx={Math.min(w, h) / 4} ry={Math.min(w, h) / 6} fill="#FF5722" opacity={0.8} />
          <ellipse cx={cx} cy={cy - 2} rx={Math.min(w, h) / 6} ry={Math.min(w, h) / 8} fill="#FFD700" />
        </>
      )

    // Default fallback
    default:
      const isRound = obj.type.includes('round') || obj.type === 'cocktail' || obj.type === 'highboy'
      return isRound ? (
        <ellipse cx={cx} cy={cy} rx={w / 2 - 1} ry={h / 2 - 1} fill={fillColor} stroke="#000" strokeWidth={1} />
      ) : (
        <rect x={0} y={0} width={w} height={h} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
      )
  }
}

// =============================================================================
// OPTIMIZED CANVAS OBJECT COMPONENT
// =============================================================================

const CanvasObject = memo(({ obj, isSelected, onSelect, onDragStart, onResizeStart }) => {
  const handleMouseDown = (e) => {
    e.stopPropagation()
    onSelect(obj.id, e.shiftKey)
    if (!obj.locked) {
      onDragStart(obj.id, e)
    }
  }

  const handleResizeHandleMouseDown = (e, handle) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(obj.id, false)
    if (!obj.locked && onResizeStart) {
      onResizeStart(obj.id, handle, e)
    }
  }

  const RESIZE_HANDLE_SIZE = 8
  const HANDLE_OFFSET = -4

  // Render resize handles
  const renderResizeHandles = () => {
    if (!isSelected || obj.locked) return null

    const handles = [
      { pos: 'nw', x: HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'nw-resize' },
      { pos: 'ne', x: obj.width + HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'ne-resize' },
      { pos: 'sw', x: HANDLE_OFFSET, y: obj.height + HANDLE_OFFSET, cursor: 'sw-resize' },
      { pos: 'se', x: obj.width + HANDLE_OFFSET, y: obj.height + HANDLE_OFFSET, cursor: 'se-resize' },
      { pos: 'n', x: obj.width / 2 + HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'n-resize' },
      { pos: 's', x: obj.width / 2 + HANDLE_OFFSET, y: obj.height + HANDLE_OFFSET, cursor: 's-resize' },
      { pos: 'w', x: HANDLE_OFFSET, y: obj.height / 2 + HANDLE_OFFSET, cursor: 'w-resize' },
      { pos: 'e', x: obj.width + HANDLE_OFFSET, y: obj.height / 2 + HANDLE_OFFSET, cursor: 'e-resize' }
    ]

    return handles.map(handle => (
      <rect
        key={handle.pos}
        x={handle.x}
        y={handle.y}
        width={RESIZE_HANDLE_SIZE}
        height={RESIZE_HANDLE_SIZE}
        fill="#2969FF"
        stroke="#ffffff"
        strokeWidth={1.5}
        rx={1}
        style={{ cursor: handle.cursor }}
        onMouseDown={(e) => handleResizeHandleMouseDown(e, handle.pos)}
      />
    ))
  }

  // Render chairs around round tables
  const renderChairs = () => {
    if (!obj.type.includes('round-table') || !obj.seats) return null
    return Array.from({ length: obj.seats }).map((_, i) => {
      const angle = (i / obj.seats) * Math.PI * 2 - Math.PI / 2
      const chairRadius = Math.max(obj.width, obj.height) / 2 + 14
      const cx = obj.width / 2 + Math.cos(angle) * chairRadius
      const cy = obj.height / 2 + Math.sin(angle) * chairRadius
      return (
        <g key={i} transform={`translate(${cx}, ${cy})`}>
          {/* Chair seat */}
          <rect x={-6} y={-2} width={12} height={8} rx={1} fill={obj.color} stroke="#000" strokeWidth={0.5} />
          {/* Chair back */}
          <rect x={-6} y={-6} width={12} height={4} rx={1} fill={obj.color} stroke="#000" strokeWidth={0.5} />
          {/* Chair legs */}
          <rect x={-5} y={6} width={1.5} height={4} fill="#4a4a4a" />
          <rect x={3.5} y={6} width={1.5} height={4} fill="#4a4a4a" />
        </g>
      )
    })
  }

  return (
    <g
      transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0}, ${obj.width/2}, ${obj.height/2})`}
      style={{ cursor: obj.locked ? 'not-allowed' : 'move' }}
      onMouseDown={handleMouseDown}
    >
      {/* Render realistic object */}
      {renderRealisticObject(obj)}

      {/* Chairs around tables */}
      {renderChairs()}

      {/* Label */}
      {(obj.label || obj.tableNumber) && !obj.type.includes('stage') && !obj.type.includes('bar') && 
       !obj.type.includes('buffet') && !obj.type.includes('check-in') && !obj.type.includes('registration') &&
       !obj.type.includes('exit') && !obj.type.includes('entrance') && !obj.type.includes('security') &&
       !obj.type.includes('first-aid') && !obj.type.includes('info') && !obj.type.includes('photo-booth') && (
        <text
          x={obj.width / 2}
          y={obj.height / 2 + 4}
          textAnchor="middle"
          fill="white"
          fontSize={Math.min(12, obj.width / 6)}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {obj.tableNumber || obj.label}
        </text>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <rect
          x={-2}
          y={-2}
          width={obj.width + 4}
          height={obj.height + 4}
          fill="none"
          stroke="#2969FF"
          strokeWidth={2}
          strokeDasharray="4 2"
          rx={obj.type.includes('round') ? obj.width / 2 : 6}
          ry={obj.type.includes('round') ? obj.height / 2 : 6}
        />
      )}

      {/* Resize handles */}
      {renderResizeHandles()}
    </g>
  )
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VenueLayoutDesigner() {
  const { venueId, layoutId } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Layout state
  const [layoutName, setLayoutName] = useState('Untitled Layout')
  const [canvasWidth, setCanvasWidth] = useState(1200)
  const [canvasHeight, setCanvasHeight] = useState(800)
  const [objects, setObjects] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [history, setHistory] = useState([[]])
  const [historyIndex, setHistoryIndex] = useState(0)

  // UI state
  const [zoom, setZoom] = useState(80)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(24)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeCategory, setActiveCategory] = useState('essentials')
  const [searchQuery, setSearchQuery] = useState('')
  const [tool, setTool] = useState('select')

  // Drag state - using refs to avoid re-renders
  const dragState = useRef({
    isDragging: false,
    isResizing: false,
    resizeHandle: null, // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    draggedId: null,
    startX: 0,
    startY: 0,
    objectStartX: 0,
    objectStartY: 0,
    objectStartWidth: 0,
    objectStartHeight: 0
  })

  const [, forceUpdate] = useState(0)

  // Saving
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null) // 'success' | 'error' | null

  // =============================================================================
  // LOAD LAYOUT
  // =============================================================================

  useEffect(() => {
    if (layoutId && layoutId !== 'create') {
      loadLayout()
    }
  }, [layoutId])

  const loadLayout = async () => {
    try {
      const { data, error } = await supabase
        .from('venue_layouts')
        .select('*')
        .eq('id', layoutId)
        .single()

      if (error) {
        console.error('Error loading layout:', error)
        alert(`Failed to load layout: ${error.message}`)
        navigate(`/organizer/venues/${venueId}/layouts`)
        return
      }

      if (!data) {
        alert('Layout not found')
        navigate(`/organizer/venues/${venueId}/layouts`)
        return
      }

      // Convert feet to pixels (assuming 1 foot = 12 pixels)
      const widthInPixels = (data.total_width || 100) * 12
      const heightInPixels = (data.total_height || 67) * 12
      const gridSizeInPixels = (data.grid_size || 2) * 12

      setLayoutName(data.name || 'Untitled Layout')
      setCanvasWidth(widthInPixels)
      setCanvasHeight(heightInPixels)
      setGridSize(gridSizeInPixels)
      
      // Load objects from metadata
      const layoutData = data.metadata || {}
      setObjects(layoutData.objects || [])
      setShowGrid(layoutData.showGrid !== false)
      setSnapToGrid(layoutData.snapToGrid !== false)
      if (layoutData.zoom) setZoom(layoutData.zoom)
      
      // Initialize history with loaded objects
      setHistory([layoutData.objects || []])
      setHistoryIndex(0)
    } catch (error) {
      console.error('Error loading layout:', error)
      alert(`An error occurred while loading the layout: ${error.message || 'Unknown error'}`)
    }
  }

  // =============================================================================
  // HISTORY (UNDO/REDO)
  // =============================================================================

  const saveToHistory = useCallback((newObjects) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push([...newObjects])
      return newHistory
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1)
      setObjects([...history[historyIndex - 1]])
    }
  }, [historyIndex, history])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1)
      setObjects([...history[historyIndex + 1]])
    }
  }, [historyIndex, history])

  // =============================================================================
  // OBJECT MANIPULATION
  // =============================================================================

  const snapValue = useCallback((value) => {
    if (!snapToGrid) return value
    return Math.round(value / gridSize) * gridSize
  }, [snapToGrid, gridSize])

  const addObject = useCallback((item) => {
    const newObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: item.type,
      name: item.name,
      x: snapValue(canvasWidth / 2 - item.width / 2),
      y: snapValue(canvasHeight / 2 - item.height / 2),
      width: item.width,
      height: item.height,
      rotation: 0,
      color: item.color,
      seats: item.seats || 0,
      locked: false,
      visible: true,
      label: item.label || '',
      tableNumber: '',
    }
    const newObjects = [...objects, newObject]
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([newObject.id])
  }, [objects, canvasWidth, canvasHeight, snapValue, saveToHistory])

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const newObjects = [...objects]
    const newIds = []
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id)
      if (obj) {
        const newId = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        newObjects.push({
          ...obj,
          id: newId,
          x: obj.x + 24,
          y: obj.y + 24,
        })
        newIds.push(newId)
      }
    })
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds(newIds)
  }, [objects, selectedIds, saveToHistory])

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const newObjects = objects.filter(o => !selectedIds.includes(o.id))
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([])
  }, [objects, selectedIds, saveToHistory])

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    ))
  }, [])

  // =============================================================================
  // MOUSE HANDLERS - Optimized
  // =============================================================================

  const getCanvasCoords = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const scale = zoom / 100
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }, [zoom])

  const handleSelect = useCallback((id, shiftKey) => {
    if (shiftKey) {
      setSelectedIds(prev => 
        prev.includes(id) 
          ? prev.filter(i => i !== id)
          : [...prev, id]
      )
    } else {
      setSelectedIds([id])
    }
  }, [])

  const handleDragStart = useCallback((id, e) => {
    const coords = getCanvasCoords(e)
    const obj = objects.find(o => o.id === id)
    if (!obj) return

    dragState.current = {
      isDragging: true,
      isResizing: false,
      resizeHandle: null,
      draggedId: id,
      startX: coords.x,
      startY: coords.y,
      objectStartX: obj.x,
      objectStartY: obj.y,
      objectStartWidth: obj.width,
      objectStartHeight: obj.height
    }
  }, [objects, getCanvasCoords])

  const handleResizeStart = useCallback((id, handle, e) => {
    const coords = getCanvasCoords(e)
    const obj = objects.find(o => o.id === id)
    if (!obj) return

    dragState.current = {
      isDragging: false,
      isResizing: true,
      resizeHandle: handle,
      draggedId: id,
      startX: coords.x,
      startY: coords.y,
      objectStartX: obj.x,
      objectStartY: obj.y,
      objectStartWidth: obj.width,
      objectStartHeight: obj.height
    }
  }, [objects, getCanvasCoords])

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current) {
      setSelectedIds([])
    }
  }, [])

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragState.current.isDragging && !dragState.current.isResizing) return

    const coords = getCanvasCoords(e)
    const dx = coords.x - dragState.current.startX
    const dy = coords.y - dragState.current.startY

    if (dragState.current.isResizing) {
      // Handle resizing
      const { resizeHandle, objectStartX, objectStartY, objectStartWidth, objectStartHeight } = dragState.current
      let newX = objectStartX
      let newY = objectStartY
      let newWidth = objectStartWidth
      let newHeight = objectStartHeight

      const MIN_SIZE = 20 // Minimum size in pixels

      if (resizeHandle.includes('n')) {
        const newHeight2 = Math.max(MIN_SIZE, objectStartHeight - dy)
        newY = objectStartY + (objectStartHeight - newHeight2)
        newHeight = newHeight2
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(MIN_SIZE, objectStartHeight + dy)
      }
      if (resizeHandle.includes('w')) {
        const newWidth2 = Math.max(MIN_SIZE, objectStartWidth - dx)
        newX = objectStartX + (objectStartWidth - newWidth2)
        newWidth = newWidth2
      }
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(MIN_SIZE, objectStartWidth + dx)
      }

      // Apply snapping if enabled
      if (snapToGrid) {
        newX = snapValue(newX)
        newY = snapValue(newY)
        newWidth = snapValue(newWidth)
        newHeight = snapValue(newHeight)
      }

      setObjects(prev => prev.map(obj =>
        obj.id === dragState.current.draggedId
          ? { ...obj, x: newX, y: newY, width: newWidth, height: newHeight }
          : obj
      ))
    } else if (dragState.current.isDragging) {
      // Handle dragging
      const newX = snapValue(dragState.current.objectStartX + dx)
      const newY = snapValue(dragState.current.objectStartY + dy)

      setObjects(prev => prev.map(obj =>
        obj.id === dragState.current.draggedId
          ? { ...obj, x: newX, y: newY }
          : obj
      ))
    }
  }, [getCanvasCoords, snapValue, snapToGrid])

  const handleCanvasMouseUp = useCallback(() => {
    if (dragState.current.isDragging || dragState.current.isResizing) {
      saveToHistory(objects)
      dragState.current = {
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        draggedId: null,
        startX: 0,
        startY: 0,
        objectStartX: 0,
        objectStartY: 0,
        objectStartWidth: 0,
        objectStartHeight: 0
      }
    }
  }, [objects, saveToHistory])

  // =============================================================================
  // DRAG FROM LIBRARY
  // =============================================================================

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    const item = JSON.parse(data)
    const coords = getCanvasCoords(e)
    
    const newObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: item.type,
      name: item.name,
      x: snapValue(coords.x - item.width / 2),
      y: snapValue(coords.y - item.height / 2),
      width: item.width,
      height: item.height,
      rotation: 0,
      color: item.color,
      seats: item.seats || 0,
      locked: false,
      visible: true,
      label: item.label || '',
      tableNumber: '',
    }
    
    const newObjects = [...objects, newObject]
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([newObject.id])
  }, [objects, getCanvasCoords, snapValue, saveToHistory])

  // =============================================================================
  // SAVE LAYOUT
  // =============================================================================

  const saveLayout = useCallback(async () => {
    // Get the current user's ID (from profiles table)
    // Use organizer.user_id if available, otherwise get from auth
    let currentUserId = organizer?.user_id || user?.id
    
    if (!currentUserId) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      currentUserId = authUser?.id
    }

    if (!currentUserId) {
      alert('User authentication required. Please log in again.')
      return
    }

    if (!organizer?.id) {
      alert('Organizer information not available. Please refresh the page.')
      return
    }

    if (!venueId) {
      alert('Venue ID is missing. Please go back and try again.')
      return
    }

    setSaving(true)

    try {
      // Prepare layout data to match database schema
      const layoutData = {
        objects,
        gridSize,
        showGrid,
        zoom,
        snapToGrid
      }

      // Convert pixels to feet (assuming 1 unit = 1 inch, so divide by 12)
      const widthInFeet = canvasWidth / 12
      const heightInFeet = canvasHeight / 12
      const gridSizeInFeet = gridSize / 12

      if (layoutId && layoutId !== 'create') {
        // Update existing layout
        const { data, error } = await supabase
          .from('venue_layouts')
          .update({
            name: layoutName,
            total_width: widthInFeet,
            total_height: heightInFeet,
            grid_size: gridSizeInFeet,
            metadata: layoutData,
            updated_at: new Date().toISOString()
          })
          .eq('id', layoutId)
          .select()
          .single()

        if (error) {
          console.error('Error updating layout:', error)
          setSaveStatus('error')
          setTimeout(() => setSaveStatus(null), 3000)
          alert(`Failed to save layout: ${error.message}`)
          return
        }

        if (data) {
          setLastSaved(new Date())
          setSaveStatus('success')
          setTimeout(() => setSaveStatus(null), 2000)
        }
      } else {
        // Create new layout
        // Use currentUserId (from profiles table) instead of organizer.id
        const { data, error } = await supabase
          .from('venue_layouts')
          .insert({
            venue_id: venueId,
            created_by: currentUserId, // This must reference profiles(id)
            name: layoutName,
            total_width: widthInFeet,
            total_height: heightInFeet,
            grid_size: gridSizeInFeet,
            metadata: layoutData,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating layout:', error)
          setSaveStatus('error')
          setTimeout(() => setSaveStatus(null), 3000)
          alert(`Failed to create layout: ${error.message}`)
          return
        }

        if (data) {
          setLastSaved(new Date())
          setSaveStatus('success')
          // Navigate to the new layout's edit page
          navigate(`/organizer/venues/${venueId}/layouts/${data.id}`, { replace: true })
        }
      }
    } catch (error) {
      console.error('Error saving layout:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
      alert(`An unexpected error occurred: ${error.message || 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }, [organizer?.id, organizer?.user_id, user?.id, venueId, layoutId, layoutName, canvasWidth, canvasHeight, objects, gridSize, showGrid, zoom, snapToGrid, navigate])

  // =============================================================================
  // KEYBOARD SHORTCUTS
  // =============================================================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        duplicateSelected()
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedIds(objects.map(o => o.id))
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        saveLayout()
      }
      if (e.key === 'Escape') {
        setSelectedIds([])
      }
      if (e.key === '=' || e.key === '+') setZoom(z => Math.min(150, z + 10))
      if (e.key === '-') setZoom(z => Math.max(25, z - 10))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [objects, deleteSelected, duplicateSelected, undo, redo, saveLayout])

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const selectedObject = useMemo(() => 
    selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null
  , [selectedIds, objects])

  const filteredItems = useMemo(() => {
    const category = OBJECT_CATEGORIES.find(c => c.id === activeCategory)
    if (!category) return []
    if (!searchQuery) return category.items
    return category.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [activeCategory, searchQuery])

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-screen flex flex-col bg-[#1e1e2e] text-white overflow-hidden">
      {/* ===== TOP TOOLBAR ===== */}
      <div className="h-12 bg-[#2d2d3d] border-b border-[#3d3d4d] flex items-center px-3 gap-2 flex-shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/organizer/venues`)}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Layout Name */}
        <Input
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          className="w-48 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
        />

        <div className="flex-1" />

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={historyIndex <= 0}
          className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <Redo className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Zoom controls */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(z => Math.max(25, z - 10))}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-white/70 w-10 text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(z => Math.min(150, z + 10))}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Grid toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowGrid(!showGrid)}
          className={`${showGrid ? 'text-[#2969FF]' : 'text-white/60'} hover:text-white hover:bg-white/10`}
        >
          <Grid className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Save button */}
        <Button
          size="sm"
          onClick={saveLayout}
          disabled={saving}
          data-save-button
          className={`${
            saveStatus === 'success' 
              ? 'bg-green-600 hover:bg-green-700' 
              : saveStatus === 'error'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#2969FF] hover:bg-[#1e4fd6]'
          } text-white`}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Saving...' : saveStatus === 'success' ? '✓ Saved!' : saveStatus === 'error' ? 'Error' : 'Save'}
        </Button>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== LEFT PANEL ===== */}
        <div className={`${leftPanelOpen ? 'w-56' : 'w-10'} bg-[#252535] border-r border-[#3d3d4d] flex flex-col transition-all duration-150 flex-shrink-0`}>
          {leftPanelOpen ? (
            <>
              <div className="flex items-center justify-between p-2 border-b border-[#3d3d4d]">
                <span className="text-xs font-medium text-white/80">Objects</span>
                <button
                  onClick={() => setLeftPanelOpen(false)}
                  className="p-1 text-white/40 hover:text-white"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="p-2 border-b border-[#3d3d4d]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="flex-1 overflow-y-auto">
                {OBJECT_CATEGORIES.map(category => (
                  <div key={category.id}>
                    <button
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs ${
                        activeCategory === category.id ? 'bg-[#2969FF]/20 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                      onClick={() => setActiveCategory(activeCategory === category.id ? '' : category.id)}
                    >
                      <category.icon className="w-3.5 h-3.5" />
                      <span className="flex-1 text-left">{category.name}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${activeCategory === category.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeCategory === category.id && (
                      <div className="grid grid-cols-2 gap-1 p-2 bg-[#1e1e2e]">
                        {category.items.map(item => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify(item))
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            onClick={() => addObject(item)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded bg-[#252535] hover:bg-[#3d3d4d] cursor-grab border border-transparent hover:border-[#2969FF]/50 transition-colors"
                          >
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center"
                              style={{ backgroundColor: item.color + '30' }}
                            >
                              <div 
                                className={`${item.type.includes('round') || item.type === 'cocktail' ? 'rounded-full' : 'rounded'}`}
                                style={{ 
                                  backgroundColor: item.color,
                                  width: item.type.includes('round') || item.type === 'cocktail' ? 16 : 20,
                                  height: item.type.includes('round') || item.type === 'cocktail' ? 16 : 10
                                }}
                              />
                            </div>
                            <span className="text-[9px] text-white/60 text-center leading-tight line-clamp-2">
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ===== CANVAS ===== */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#1a1a2a]"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <div className="p-8 min-w-max min-h-max">
            <svg
              ref={canvasRef}
              width={canvasWidth * (zoom / 100)}
              height={canvasHeight * (zoom / 100)}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="bg-white rounded shadow-xl"
              onMouseDown={handleCanvasMouseDown}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Grid */}
              {showGrid && (
                <>
                  <defs>
                    <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                      <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </>
              )}

              {/* Objects */}
              {objects.map(obj => (
                <CanvasObject
                  key={obj.id}
                  obj={obj}
                  isSelected={selectedIds.includes(obj.id)}
                  onSelect={handleSelect}
                  onDragStart={handleDragStart}
                  onResizeStart={handleResizeStart}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className={`${rightPanelOpen ? 'w-56' : 'w-10'} bg-[#252535] border-l border-[#3d3d4d] flex flex-col transition-all duration-150 flex-shrink-0`}>
          {rightPanelOpen ? (
            <>
              <div className="flex items-center justify-between p-2 border-b border-[#3d3d4d]">
                <span className="text-xs font-medium text-white/80">Properties</span>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="p-1 text-white/40 hover:text-white"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {selectedObject ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div>
                    <Label className="text-[10px] text-white/50">Type</Label>
                    <p className="text-xs text-white capitalize">{selectedObject.name}</p>
                  </div>

                  <div>
                    <Label className="text-[10px] text-white/50">Label</Label>
                    <Input
                      value={selectedObject.label || ''}
                      onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })}
                      className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                    />
                  </div>

                  {selectedObject.type.includes('table') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-white/50">Table #</Label>
                        <Input
                          value={selectedObject.tableNumber || ''}
                          onChange={(e) => updateObject(selectedObject.id, { tableNumber: e.target.value })}
                          className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/50">Seats</Label>
                        <Input
                          type="number"
                          value={selectedObject.seats || 0}
                          onChange={(e) => updateObject(selectedObject.id, { seats: parseInt(e.target.value) || 0 })}
                          className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-[10px] text-white/50">Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={selectedObject.color}
                        onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={selectedObject.color}
                        onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                        className="flex-1 h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-white/50">Width (ft)</Label>
                      <Input
                        type="number"
                        value={(selectedObject.width / 12).toFixed(1)}
                        onChange={(e) => updateObject(selectedObject.id, { width: parseFloat(e.target.value) * 12 })}
                        className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/50">Depth (ft)</Label>
                      <Input
                        type="number"
                        value={(selectedObject.height / 12).toFixed(1)}
                        onChange={(e) => updateObject(selectedObject.id, { height: parseFloat(e.target.value) * 12 })}
                        className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-white/50">Rotation</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={selectedObject.rotation || 0}
                        onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })}
                        className="flex-1 h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateObject(selectedObject.id, { rotation: ((selectedObject.rotation || 0) + 45) % 360 })}
                        className="w-7 h-7 text-white/60 hover:text-white hover:bg-white/10"
                      >
                        <RotateCw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#3d3d4d]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={duplicateSelected}
                      className="flex-1 h-7 text-xs border-[#3d3d4d] bg-[#2a2a35] text-[#E0E0E0] hover:bg-[#3a3a45] hover:text-white"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteSelected}
                      className="flex-1 h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                  <p className="text-xs text-white/40 text-center">
                    Select an object to edit
                  </p>
                </div>
              )}

              {/* Canvas Settings */}
              <div className="border-t border-[#3d3d4d] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-white/50">Canvas W</Label>
                    <Input
                      type="number"
                      value={canvasWidth / 12}
                      onChange={(e) => setCanvasWidth(parseInt(e.target.value) * 12 || 1200)}
                      className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/50">Canvas H</Label>
                    <Input
                      type="number"
                      value={canvasHeight / 12}
                      onChange={(e) => setCanvasHeight(parseInt(e.target.value) * 12 || 800)}
                      className="h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className="h-6 bg-[#2d2d3d] border-t border-[#3d3d4d] flex items-center px-3 text-[10px] text-white/50 flex-shrink-0">
        <span>{objects.length} objects</span>
        <span className="mx-2">•</span>
        <span>{selectedIds.length} selected</span>
        <span className="mx-2">•</span>
        <span>{canvasWidth / 12}×{canvasHeight / 12} ft</span>
        <div className="flex-1" />
        <span>Snap: {snapToGrid ? 'On' : 'Off'}</span>
        {lastSaved && (
          <>
            <span className="mx-2">•</span>
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          </>
        )}
      </div>
    </div>
  )
}

export default VenueLayoutDesigner
