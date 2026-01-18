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
  Camera, Sparkles, MapPin, AlertTriangle, ShieldCheck, PartyPopper,
  Box, FileText, MessageCircle, Bot, Wand2, Lightbulb, Zap
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
// PDF export
import jsPDF from 'jspdf'

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
      const radius = Math.min(w, h) / 2
      const tablecloth = obj.color === '#E91E63' || obj.color === '#9C27B0' || obj.color === '#EC407A' // Detecting tablecloth color
      
      return (
        <>
          <defs>
            {/* Wood grain pattern - radial gradient */}
            <radialGradient id={`wood-grain-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4A574" stopOpacity="0.9" />
              <stop offset="30%" stopColor="#B8956A" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#9D7A4F" stopOpacity="1" />
              <stop offset="85%" stopColor="#8B6B42" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#6B4F2D" stopOpacity="0.9" />
            </radialGradient>
            
            {/* Tablecloth gradient - if fabric table */}
            <radialGradient id={`tablecloth-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={fillColor} stopOpacity="1" />
              <stop offset="50%" stopColor={fillColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.85" />
            </radialGradient>
            
            {/* Table shadow gradient */}
            <radialGradient id={`table-shadow-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
              <stop offset="40%" stopColor="#000000" stopOpacity="0.2" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            
            {/* Leg gradient for 3D effect */}
            <linearGradient id={`leg-gradient-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5D4037" />
              <stop offset="50%" stopColor="#4E342E" />
              <stop offset="100%" stopColor="#3E2723" />
            </linearGradient>
            
            {/* Table edge highlight */}
            <linearGradient id={`edge-highlight-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Shadow on floor - realistic drop shadow */}
          <ellipse 
            cx={cx} 
            cy={cy + radius * 0.8} 
            rx={radius * 0.95} 
            ry={radius * 0.4} 
            fill={`url(#table-shadow-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`}
          />
          
          {/* Table top - with 3D perspective effect */}
          {tablecloth ? (
            // Tablecloth version - fabric texture
            <>
              <circle cx={cx} cy={cy} r={radius - 1} fill={`url(#tablecloth-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} 
                      stroke="#000" strokeWidth={1.5} />
              {/* Tablecloth fold patterns - subtle radial lines */}
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i / 8) * Math.PI * 2
                const x1 = cx + Math.cos(angle) * radius * 0.1
                const y1 = cy + Math.sin(angle) * radius * 0.1
                const x2 = cx + Math.cos(angle) * radius * 0.85
                const y2 = cy + Math.sin(angle) * radius * 0.85
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} 
                        stroke={fillColor} strokeWidth={0.5} opacity={0.2} strokeLinecap="round" />
                )
              })}
              {/* Edge banding - realistic tablecloth edge */}
              <circle cx={cx} cy={cy} r={radius - 1} fill="none" stroke="#000" strokeWidth={1.5} opacity={0.8} />
              <circle cx={cx} cy={cy} r={radius - 2} fill="none" stroke={fillColor} strokeWidth={0.5} opacity={0.6} />
            </>
          ) : (
            // Wood version - realistic wood grain
            <>
              <circle cx={cx} cy={cy} r={radius - 1} fill={`url(#wood-grain-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} 
                      stroke="#4E342E" strokeWidth={2} />
              
              {/* Wood grain lines - radial pattern from center */}
              {Array.from({ length: 20 }).map((_, i) => {
                const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.1
                const grainLength = radius * (0.3 + Math.random() * 0.5)
                const x1 = cx + Math.cos(angle) * radius * 0.15
                const y1 = cy + Math.sin(angle) * radius * 0.15
                const x2 = cx + Math.cos(angle) * grainLength
                const y2 = cy + Math.sin(angle) * grainLength
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} 
                        stroke="#8B6B42" strokeWidth={0.5} opacity={0.4} strokeLinecap="round" />
                )
              })}
              
              {/* Wood grain rings - growth rings */}
              {[radius * 0.3, radius * 0.5, radius * 0.7, radius * 0.85].map((r, i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none" 
                        stroke="#6B4F2D" strokeWidth={0.5} opacity={0.3 - i * 0.05} />
              ))}
              
              {/* Edge banding - realistic wood edge */}
              <circle cx={cx} cy={cy} r={radius - 1} fill="none" stroke="#3E2723" strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={radius - 2.5} fill="none" stroke="#D4A574" strokeWidth={0.5} opacity={0.3} />
              
              {/* Tabletop highlight - subtle shine */}
              <ellipse cx={cx - radius * 0.15} cy={cy - radius * 0.15} 
                       rx={radius * 0.4} ry={radius * 0.3} 
                       fill="#FFFFFF" opacity={0.15} />
            </>
          )}
          
          {/* Table base removed - no legs */}
          
          {/* Inner detail ring - table edge profile */}
          <circle cx={cx} cy={cy} r={radius * 0.95} fill="none" 
                  stroke="#000" strokeWidth={0.5} opacity={0.2} />
        </>
      )

    case 'rect-table':
    case 'head-table':
      return (
        <>
          {/* Table top */}
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill={fillColor} stroke="#000" strokeWidth={1} />
          <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.3} />
          {/* Table legs removed */}
        </>
      )

    case 'cocktail':
    case 'highboy':
      return (
        <>
          <circle cx={cx} cy={cy - 4} r={Math.min(w, h) / 2 - 2} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Legs removed */}
        </>
      )

    case 'sweetheart':
      return (
        <>
          <ellipse cx={cx} cy={cy} rx={w / 2 - 2} ry={h / 2 - 2} fill={fillColor} stroke="#000" strokeWidth={1} />
          {/* Legs removed */}
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
          {/* Legs removed */}
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
          <defs>
            {/* Stage platform gradient - realistic wood/floor texture */}
            <linearGradient id={`stage-platform-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6D4C41" />
              <stop offset="30%" stopColor="#5D4037" />
              <stop offset="70%" stopColor="#4E342E" />
              <stop offset="100%" stopColor="#3E2723" />
            </linearGradient>
            {/* Stage front edge gradient */}
            <linearGradient id={`stage-front-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8D6E63" />
              <stop offset="50%" stopColor="#6D4C41" />
              <stop offset="100%" stopColor="#5D4037" />
            </linearGradient>
            {/* Stage shadow */}
            <linearGradient id={`stage-shadow-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Stage shadow on floor */}
          <ellipse cx={cx} cy={h * 0.95} rx={w * 0.48} ry={h * 0.1} fill={`url(#stage-shadow-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} />
          
          {/* Stage platform - raised platform with depth */}
          <rect x={0} y={h * 0.65} width={w} height={h * 0.35} fill={`url(#stage-platform-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#000" strokeWidth={1.5} />
          
          {/* Stage front edge - prominent front face */}
          <rect x={0} y={h * 0.65} width={w} height={h * 0.08} fill={`url(#stage-front-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#000" strokeWidth={1.5} />
          
          {/* Stage floor planks - wood grain texture */}
          {Array.from({ length: Math.floor(w / 20) }).map((_, i) => (
            <line 
              key={i} 
              x1={i * 20} 
              y1={h * 0.65} 
              x2={i * 20} 
              y2={h} 
              stroke="#4E342E" 
              strokeWidth={0.5} 
              opacity={0.3} 
            />
          ))}
          
          {/* Stage supports/legs - visible supports */}
          {[w * 0.1, w * 0.3, w * 0.5, w * 0.7, w * 0.9].map(x => (
            <g key={x}>
              {/* Support post */}
              <rect x={x - 3} y={h * 0.65} width={6} height={h * 0.35} fill="#3E2723" stroke="#000" strokeWidth={1} />
              {/* Support base */}
              <rect x={x - 4} y={h * 0.98} width={8} height={h * 0.02} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
            </g>
          ))}
          
          {/* Stage edge highlight - top edge */}
          <line x1={0} y1={h * 0.65} x2={w} y2={h * 0.65} stroke="#8D6E63" strokeWidth={1} opacity={0.5} />
          
          {/* Stage label - centered */}
          <text 
            x={cx} 
            y={h * 0.82} 
            textAnchor="middle" 
            fill="white" 
            fontSize={Math.min(14, w / 12)} 
            fontWeight="bold"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            STAGE
          </text>
          
          {/* Optional: Stage steps/stairs at front */}
          {h > 40 && (
            <>
              {/* Step 1 */}
              <rect x={w * 0.1} y={h * 0.73} width={w * 0.8} height={h * 0.02} fill="#8D6E63" stroke="#000" strokeWidth={0.5} />
              {/* Step 2 */}
              <rect x={w * 0.15} y={h * 0.76} width={w * 0.7} height={h * 0.02} fill="#8D6E63" stroke="#000" strokeWidth={0.5} />
            </>
          )}
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
          {/* Bar counter - realistic wood with 3D effect */}
          <defs>
            <linearGradient id={`bar-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6D4C41" />
              <stop offset="50%" stopColor="#4E342E" />
              <stop offset="100%" stopColor="#3E2723" />
            </linearGradient>
          </defs>
          {/* Bar surface */}
          <rect x={0} y={h * 0.6} width={w} height={h * 0.4} fill={`url(#bar-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#000" strokeWidth={1.5} />
          {/* Bar top edge/rail */}
          <rect x={0} y={h * 0.6} width={w} height={h * 0.12} fill="#8D6E63" stroke="#000" strokeWidth={1} />
          {/* Wood grain texture */}
          {Array.from({ length: Math.floor(w / 15) }).map((_, i) => (
            <line key={i} x1={i * 15} y1={h * 0.62} x2={i * 15 + 8} y2={h * 0.62} 
                  stroke="#5D4037" strokeWidth={0.5} opacity={0.3} />
          ))}
          {/* Bar stools - more realistic */}
          {[w * 0.12, w * 0.32, w * 0.52, w * 0.72, w * 0.92].map((x, i) => (
            <g key={i}>
              {/* Stool seat */}
              <circle cx={x} cy={h * 0.3} r={w * 0.035} fill="#6D4C41" stroke="#3E2723" strokeWidth={1} />
              {/* Stool back */}
              <rect x={x - w * 0.008} y={h * 0.15} width={w * 0.016} height={h * 0.15} fill="#5D4037" stroke="#3E2723" strokeWidth={0.5} rx={1} />
              {/* Stool legs */}
              <line x1={x - w * 0.02} y1={h * 0.3} x2={x - w * 0.03} y2={h * 0.45} stroke="#5D4037" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={x + w * 0.02} y1={h * 0.3} x2={x + w * 0.03} y2={h * 0.45} stroke="#5D4037" strokeWidth={1.5} strokeLinecap="round" />
            </g>
          ))}
          {/* Bar equipment - bottles/glasses */}
          {[w * 0.2, w * 0.5, w * 0.8].map((x, i) => (
            <g key={i}>
              {/* Bottle */}
              <rect x={x - w * 0.015} y={h * 0.45} width={w * 0.03} height={h * 0.12} fill="#1976D2" stroke="#0D47A1" strokeWidth={0.5} rx={1} />
              {/* Glass/cocktail */}
              <ellipse cx={x + w * 0.04} cy={h * 0.55} rx={w * 0.012} ry={h * 0.04} fill="#E3F2FD" stroke="#90CAF9" strokeWidth={0.5} />
              <ellipse cx={x + w * 0.04} cy={h * 0.6} rx={w * 0.01} ry={h * 0.015} fill="#FFF9C4" />
            </g>
          ))}
          <text x={cx} y={h * 0.85} textAnchor="middle" fill="white" fontSize={Math.min(10, w / 12)} fontWeight="bold"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>BAR</text>
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
          {/* Buffet table base - 3D effect */}
          <defs>
            <linearGradient id={`buffet-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8BC34A" />
              <stop offset="50%" stopColor="#689F38" />
              <stop offset="100%" stopColor="#558B2F" />
            </linearGradient>
          </defs>
          {/* Table surface with wood grain effect */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill={`url(#buffet-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#000" strokeWidth={1.5} />
          {/* Table edge/shadow */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.08} fill="#6a5a4a" stroke="#000" strokeWidth={1} />
          {/* Wood grain lines */}
          {Array.from({ length: Math.floor(w / 20) }).map((_, i) => (
            <line key={i} x1={i * 20} y1={h * 0.52} x2={i * 20 + 10} y2={h * 0.52} 
                  stroke="#558B2F" strokeWidth={0.5} opacity={0.3} />
          ))}
          {/* Food serving stations with dishes */}
          {[
            { x: w * 0.15, dishes: 3 },
            { x: w * 0.35, dishes: 2 },
            { x: w * 0.55, dishes: 3 },
            { x: w * 0.75, dishes: 2 },
            { x: w * 0.9, dishes: 1 }
          ].map((station, idx) => (
            <g key={idx}>
              {/* Serving tray/platter base */}
              <ellipse cx={station.x} cy={h * 0.28} rx={w * 0.05} ry={h * 0.06} fill="#fff" stroke="#ddd" strokeWidth={1} />
              {/* Multiple food dishes on tray */}
              {Array.from({ length: station.dishes }).map((_, i) => {
                const angle = (i / station.dishes) * Math.PI * 2
                const dishX = station.x + Math.cos(angle) * w * 0.03
                const dishY = h * 0.28 + Math.sin(angle) * h * 0.03
                return (
                  <g key={i}>
                    {/* Food dish */}
                    <ellipse cx={dishX} cy={dishY} rx={w * 0.025} ry={h * 0.03} fill="#FFEB3B" stroke="#FFC107" strokeWidth={0.5} />
                    {/* Food contents */}
                    <ellipse cx={dishX} cy={dishY - h * 0.01} rx={w * 0.018} ry={h * 0.02} fill="#FF8F00" opacity={0.8} />
                  </g>
                )
              })}
              {/* Heat lamp above station */}
              <ellipse cx={station.x} cy={h * 0.15} rx={w * 0.04} ry={h * 0.03} fill="#FF6F00" opacity={0.6} />
              <ellipse cx={station.x} cy={h * 0.15} rx={w * 0.03} ry={h * 0.02} fill="#FFB300" opacity={0.4} />
            </g>
          ))}
          {/* Serving utensils and tongs */}
          {[w * 0.25, w * 0.65].map(x => (
            <g key={x}>
              <rect x={x} y={h * 0.35} width={w * 0.02} height={h * 0.08} fill="#C0C0C0" stroke="#999" strokeWidth={0.5} rx={1} />
              <rect x={x + w * 0.03} y={h * 0.35} width={w * 0.02} height={h * 0.08} fill="#C0C0C0" stroke="#999" strokeWidth={0.5} rx={1} />
            </g>
          ))}
          {/* Table label */}
          <text x={cx} y={h * 0.8} textAnchor="middle" fill="white" fontSize={Math.min(10, w / 12)} fontWeight="bold" 
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>BUFFET</text>
        </>
      )

    case 'food-station':
      return (
        <>
          {/* Food station table - square/round station */}
          <defs>
            <linearGradient id={`food-station-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9CCC65" />
              <stop offset="100%" stopColor="#689F38" />
            </linearGradient>
          </defs>
          {/* Table surface */}
          <ellipse cx={cx} cy={cy} rx={w * 0.48} ry={h * 0.48} fill={`url(#food-station-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#558B2F" strokeWidth={2} />
          {/* Table edge */}
          <ellipse cx={cx} cy={h * 0.6} rx={w * 0.48} ry={h * 0.15} fill="#6a5a4a" stroke="#000" strokeWidth={1} />
          {/* Central display with food items arranged around */}
          <ellipse cx={cx} cy={cy - h * 0.1} rx={w * 0.15} ry={h * 0.15} fill="#FFEB3B" stroke="#FFC107" strokeWidth={1} />
          {/* Food items around center */}
          {[0, 1, 2, 3].map((i) => {
            const angle = (i / 4) * Math.PI * 2
            const itemX = cx + Math.cos(angle) * w * 0.25
            const itemY = cy + Math.sin(angle) * h * 0.25
            return (
              <ellipse key={i} cx={itemX} cy={itemY} rx={w * 0.12} ry={h * 0.12} 
                      fill="#FF8F00" stroke="#E65100" strokeWidth={0.5} />
            )
          })}
          {/* Serving utensils */}
          <line x1={cx - w * 0.15} y1={cy} x2={cx + w * 0.15} y2={cy} stroke="#C0C0C0" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )

    case 'coffee':
    case 'coffee-station':
      return (
        <>
          {/* Coffee station table */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill="#6D4C41" stroke="#000" strokeWidth={1.5} rx={2} />
          {/* Coffee machine */}
          <rect x={w * 0.15} y={h * 0.15} width={w * 0.3} height={h * 0.35} fill="#3E2723" stroke="#000" strokeWidth={1} rx={2} />
          {/* Coffee machine display */}
          <rect x={w * 0.18} y={h * 0.18} width={w * 0.24} height={h * 0.12} fill="#1B5E20" stroke="#000" />
          <rect x={w * 0.2} y={h * 0.2} width={w * 0.2} height={h * 0.08} fill="#4CAF50" />
          {/* Coffee spout */}
          <rect x={w * 0.28} y={h * 0.45} width={w * 0.04} height={h * 0.08} fill="#3E2723" stroke="#000" />
          {/* Coffee cups on side */}
          {[w * 0.6, w * 0.75].map((x, i) => (
            <g key={i}>
              {/* Cup */}
              <ellipse cx={x} cy={h * 0.35} rx={w * 0.06} ry={h * 0.08} fill="#fff" stroke="#ddd" strokeWidth={0.5} />
              {/* Coffee liquid */}
              <ellipse cx={x} cy={h * 0.38} rx={w * 0.04} ry={h * 0.04} fill="#6D4C41" />
              {/* Steam */}
              <path d={`M ${x} ${h * 0.25} Q ${x - w * 0.02} ${h * 0.22} ${x - w * 0.03} ${h * 0.2} 
                       M ${x} ${h * 0.25} Q ${x} ${h * 0.22} ${x} ${h * 0.2}
                       M ${x} ${h * 0.25} Q ${x + w * 0.02} ${h * 0.22} ${x + w * 0.03} ${h * 0.2}`}
                    stroke="#E0E0E0" strokeWidth={1} fill="none" opacity={0.6} />
            </g>
          ))}
          {/* Cream and sugar containers */}
          <ellipse cx={w * 0.6} cy={h * 0.55} rx={w * 0.05} ry={h * 0.04} fill="#fff" stroke="#ddd" strokeWidth={0.5} />
          <ellipse cx={w * 0.75} cy={h * 0.55} rx={w * 0.05} ry={h * 0.04} fill="#FFF9C4" stroke="#FDD835" strokeWidth={0.5} />
        </>
      )

    case 'dessert':
      return (
        <>
          {/* Dessert table */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill="#F48FB1" stroke="#000" strokeWidth={1.5} rx={3} />
          {/* Table edge */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.08} fill="#C2185B" stroke="#000" strokeWidth={1} />
          {/* Display stand/cake tier */}
          <ellipse cx={cx} cy={h * 0.3} rx={w * 0.25} ry={h * 0.08} fill="#fff" stroke="#F8BBD9" strokeWidth={1} />
          <ellipse cx={cx} cy={h * 0.2} rx={w * 0.15} ry={h * 0.08} fill="#fff" stroke="#F8BBD9" strokeWidth={1} />
          {/* Desserts on display */}
          {[w * 0.2, w * 0.5, w * 0.8].map((x, i) => (
            <g key={i}>
              {/* Cake slice */}
              <path d={`M ${x} ${h * 0.25} L ${x + w * 0.08} ${h * 0.35} L ${x - w * 0.08} ${h * 0.35} Z`}
                    fill="#FFB74D" stroke="#F57C00" strokeWidth={0.5} />
              {/* Frosting */}
              <ellipse cx={x} cy={h * 0.25} rx={w * 0.06} ry={h * 0.02} fill="#FFF9C4" />
              {/* Cupcakes */}
              <ellipse cx={x + w * 0.15} cy={h * 0.35} rx={w * 0.04} ry={h * 0.05} fill="#8BC34A" stroke="#689F38" strokeWidth={0.5} />
              <ellipse cx={x + w * 0.15} cy={h * 0.33} rx={w * 0.05} ry={h * 0.03} fill="#FFF9C4" />
            </g>
          ))}
          <text x={cx} y={h * 0.75} textAnchor="middle" fill="white" fontSize={Math.min(8, w / 10)} fontWeight="bold">DESSERTS</text>
        </>
      )

    case 'drinks':
    case 'water-station':
      return (
        <>
          {/* Drink station table */}
          <rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill="#29B6F6" stroke="#000" strokeWidth={1.5} rx={2} />
          {/* Water dispensers */}
          {[w * 0.3, w * 0.7].map((x, i) => (
            <g key={i}>
              {/* Dispenser base */}
              <rect x={x - w * 0.08} y={h * 0.2} width={w * 0.16} height={h * 0.3} fill="#0288D1" stroke="#000" strokeWidth={1} rx={1} />
              {/* Water container */}
              <rect x={x - w * 0.06} y={h * 0.25} width={w * 0.12} height={h * 0.2} fill="#B3E5FC" stroke="#0288D1" strokeWidth={0.5} />
              {/* Water level */}
              <rect x={x - w * 0.06} y={h * 0.35} width={w * 0.12} height={h * 0.1} fill="#4FC3F7" />
              {/* Spout */}
              <rect x={x - w * 0.02} y={h * 0.42} width={w * 0.04} height={h * 0.05} fill="#0288D1" stroke="#000" />
            </g>
          ))}
          {/* Cups/disposable cups */}
          {[w * 0.2, w * 0.5, w * 0.8].map((x, i) => (
            <ellipse key={i} cx={x} cy={h * 0.6} rx={w * 0.04} ry={h * 0.05} fill="#E3F2FD" stroke="#90CAF9" strokeWidth={0.5} />
          ))}
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
          <defs>
            {/* TV screen gradient - realistic screen glow */}
            <linearGradient id={`tv-screen-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a1a2e" stopOpacity="0.9" />
              <stop offset="30%" stopColor="#000000" stopOpacity="1" />
              <stop offset="70%" stopColor="#000000" stopOpacity="1" />
              <stop offset="100%" stopColor="#1a1a2e" stopOpacity="0.9" />
            </linearGradient>
            {/* TV bezel gradient */}
            <linearGradient id={`tv-bezel-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#424242" />
              <stop offset="50%" stopColor="#263238" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
            {/* Screen reflection */}
            <linearGradient id={`tv-reflection-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* TV outer bezel/frame - realistic TV frame */}
          <rect x={0} y={0} width={w} height={h} rx={h * 0.08} fill={`url(#tv-bezel-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#000" strokeWidth={1.5} />
          
          {/* TV inner bezel - thinner border around screen */}
          <rect x={w * 0.05} y={h * 0.05} width={w * 0.9} height={h * 0.9} rx={h * 0.06} fill="#1a1a1a" stroke="#000" strokeWidth={1} />
          
          {/* TV screen - realistic black screen with slight glow */}
          <rect x={w * 0.08} y={h * 0.08} width={w * 0.84} height={h * 0.84} rx={h * 0.04} fill={`url(#tv-screen-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} />
          
          {/* Screen reflection - realistic light reflection on screen */}
          <rect x={w * 0.08} y={h * 0.08} width={w * 0.84} height={h * 0.84} rx={h * 0.04} fill={`url(#tv-reflection-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} />
          
          {/* TV stand/base - if TV is tall enough */}
          {h > 20 && (
            <>
              <rect x={w * 0.3} y={h * 0.95} width={w * 0.4} height={h * 0.05} rx={1} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
              {/* Stand support */}
              <rect x={w * 0.45} y={h * 0.92} width={w * 0.1} height={h * 0.03} fill="#263238" stroke="#000" strokeWidth={0.5} />
            </>
          )}
          
          {/* TV indicator light (power LED) - small red/green dot */}
          <circle cx={w * 0.92} cy={h * 0.1} r={1.5} fill="#4CAF50" opacity={0.8} />
        </>
      )

    case 'speaker':
    case 'speaker-main':
      return (
        <>
          {/* Speaker cabinet - 3D effect with gradient */}
          <defs>
            <linearGradient id={`speaker-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4a5568" />
              <stop offset="50%" stopColor="#37474F" />
              <stop offset="100%" stopColor="#263238" />
            </linearGradient>
          </defs>
          {/* Main cabinet */}
          <rect x={0} y={0} width={w} height={h} rx={3} fill={`url(#speaker-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#1a1a1a" strokeWidth={1.5} />
          {/* Top shadow */}
          <rect x={1} y={1} width={w - 2} height={h * 0.15} rx={2} fill="#1a1a1a" opacity={0.3} />
          {/* Speaker grille frame */}
          <rect x={w * 0.15} y={h * 0.15} width={w * 0.7} height={h * 0.7} rx={4} fill="#1a1a1a" stroke="#37474F" strokeWidth={1} />
          {/* Speaker grille mesh pattern - circular holes */}
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 3 }).map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={w * 0.2 + col * w * 0.23}
                cy={h * 0.2 + row * h * 0.23}
                r={w * 0.06}
                fill="#263238"
                stroke="#37474F"
                strokeWidth={0.5}
              />
            ))
          )}
          {/* Speaker cone/driver center */}
          <ellipse cx={w * 0.5} cy={h * 0.5} rx={w * 0.15} ry={h * 0.15} fill="#1a1a1a" stroke="#555" strokeWidth={1} />
          <ellipse cx={w * 0.5} cy={h * 0.5} rx={w * 0.08} ry={h * 0.08} fill="#263238" />
          {/* Ventilation slots */}
          <rect x={w * 0.05} y={h * 0.1} width={w * 0.05} height={h * 0.8} rx={1} fill="#1a1a1a" opacity={0.6} />
          <rect x={w * 0.9} y={h * 0.1} width={w * 0.05} height={h * 0.8} rx={1} fill="#1a1a1a" opacity={0.6} />
          {/* Bottom feet/support */}
          <rect x={w * 0.2} y={h * 0.92} width={w * 0.15} height={h * 0.08} rx={1} fill="#1a1a1a" />
          <rect x={w * 0.65} y={h * 0.92} width={w * 0.15} height={h * 0.08} rx={1} fill="#1a1a1a" />
        </>
      )

    case 'subwoofer':
    case 'speaker-sub':
      return (
        <>
          {/* Subwoofer cabinet - large, square, with large driver */}
          <defs>
            <linearGradient id={`sub-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3a3a3a" />
              <stop offset="50%" stopColor="#263238" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
          </defs>
          {/* Main cabinet - square/rectangular for subwoofers */}
          <rect x={0} y={0} width={w} height={h} rx={4} fill={`url(#sub-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke="#1a1a1a" strokeWidth={2} />
          {/* Top shadow */}
          <rect x={1} y={1} width={w - 2} height={h * 0.12} rx={3} fill="#000" opacity={0.4} />
          {/* Large subwoofer grille frame */}
          <rect x={w * 0.1} y={h * 0.1} width={w * 0.8} height={h * 0.8} rx={5} fill="#1a1a1a" stroke="#37474F" strokeWidth={1.5} />
          {/* Large subwoofer driver/cone */}
          <circle cx={w * 0.5} cy={h * 0.5} r={Math.min(w, h) * 0.3} fill="#1a1a1a" stroke="#555" strokeWidth={2} />
          <circle cx={w * 0.5} cy={h * 0.5} r={Math.min(w, h) * 0.22} fill="#263238" stroke="#666" strokeWidth={1} />
          {/* Driver cone center */}
          <ellipse cx={w * 0.5} cy={h * 0.5} rx={Math.min(w, h) * 0.12} ry={Math.min(w, h) * 0.15} fill="#1a1a1a" />
          {/* Speaker grille mesh pattern - denser for subwoofer */}
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 5}).map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={w * 0.15 + col * w * 0.18}
                cy={h * 0.15 + row * h * 0.18}
                r={w * 0.04}
                fill="#263238"
                stroke="#37474F"
                strokeWidth={0.3}
              />
            ))
          )}
          {/* Large ventilation port (bottom) */}
          <rect x={w * 0.15} y={h * 0.85} width={w * 0.7} height={h * 0.08} rx={2} fill="#1a1a1a" opacity={0.7} />
          {/* Bottom support feet */}
          <rect x={w * 0.1} y={h * 0.92} width={w * 0.2} height={h * 0.08} rx={2} fill="#1a1a1a" />
          <rect x={w * 0.7} y={h * 0.92} width={w * 0.2} height={h * 0.08} rx={2} fill="#1a1a1a" />
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

    // ===== CONTAINER AREAS (VIP, LOUNGE) =====
    case 'vip-section':
      return (
        <>
          <defs>
            {/* VIP section gradient - luxurious purple */}
            <linearGradient id={`vip-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9C27B0" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#7B1FA2" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6A1B9A" stopOpacity="0.3" />
            </linearGradient>
            {/* VIP border gradient */}
            <linearGradient id={`vip-border-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E1BEE7" />
              <stop offset="50%" stopColor="#9C27B0" />
              <stop offset="100%" stopColor="#6A1B9A" />
            </linearGradient>
          </defs>
          {/* VIP section area - semi-transparent with border */}
          <rect x={0} y={0} width={w} height={h} rx={4} fill={`url(#vip-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke={`url(#vip-border-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} strokeWidth={3} strokeDasharray="8 4" />
          {/* VIP label - prominent */}
          <text 
            x={cx} 
            y={h * 0.1} 
            textAnchor="middle" 
            fill="#9C27B0" 
            fontSize={Math.min(16, w / 8)} 
            fontWeight="bold"
            style={{ textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }}
          >
            VIP SECTION
          </text>
          {/* Decorative corner accents */}
          <circle cx={w * 0.1} cy={h * 0.1} r={4} fill="#9C27B0" opacity={0.6} />
          <circle cx={w * 0.9} cy={h * 0.1} r={4} fill="#9C27B0" opacity={0.6} />
          <circle cx={w * 0.1} cy={h * 0.9} r={4} fill="#9C27B0" opacity={0.6} />
          <circle cx={w * 0.9} cy={h * 0.9} r={4} fill="#9C27B0" opacity={0.6} />
        </>
      )

    case 'lounge-area':
      return (
        <>
          <defs>
            {/* Lounge area gradient - warm brown */}
            <linearGradient id={`lounge-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5D4037" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#4E342E" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3E2723" stopOpacity="0.3" />
            </linearGradient>
            {/* Lounge border */}
            <linearGradient id={`lounge-border-${obj.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8D6E63" />
              <stop offset="50%" stopColor="#5D4037" />
              <stop offset="100%" stopColor="#3E2723" />
            </linearGradient>
          </defs>
          {/* Lounge area - semi-transparent with border */}
          <rect x={0} y={0} width={w} height={h} rx={4} fill={`url(#lounge-grad-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} stroke={`url(#lounge-border-${obj.id.replace(/[^a-zA-Z0-9]/g, '')})`} strokeWidth={2} strokeDasharray="6 3" />
          {/* Lounge label */}
          <text 
            x={cx} 
            y={h * 0.1} 
            textAnchor="middle" 
            fill="#5D4037" 
            fontSize={Math.min(14, w / 10)} 
            fontWeight="bold"
            style={{ textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }}
          >
            LOUNGE
          </text>
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

const CanvasObject = memo(({ obj, isSelected, onSelect, onDragStart, onResizeStart, canvasWidth = 1200, canvasHeight = 800 }) => {
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

  // Transform for 2D view only
  const getTransform = () => {
    return `translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0}, ${obj.width/2}, ${obj.height/2})`
  }

  return (
    <g
      transform={getTransform()}
      style={{ cursor: obj.locked ? 'not-allowed' : 'move' }}
      onMouseDown={handleMouseDown}
      filter={undefined}
    >
      {/* Render 2D object */}
      {renderRealisticObject(obj)}

      {/* Chairs around tables */}
      {renderChairs()}

      {/* Label - Show name, label, or table number */}
      {(obj.name || obj.label || obj.tableNumber) && (
        <text
          x={obj.width / 2}
          y={obj.height / 2 + 4}
          textAnchor="middle"
          fill="white"
          fontSize={Math.min(10, Math.max(8, obj.width / 10))}
          fontWeight="600"
          style={{ 
            pointerEvents: 'none', 
            userSelect: 'none',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          {obj.tableNumber || obj.label || obj.name}
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
  
  // View Mode - 2D only (3D disabled)
  const viewMode = '2d' // Always 2D
  
  // AI Assistant
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI venue design assistant. I can help you:\n\n• Auto-arrange objects with optimal spacing\n• Suggest layouts based on event type\n• Optimize capacity and flow\n• Answer design questions\n• Generate layouts from a questionnaire\n\nTry asking: 'Arrange tables for 100 guests' or 'Generate layout from questions'!" }
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  
  // Layout Generator Questionnaire
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [questionnaireStep, setQuestionnaireStep] = useState(0)
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState({
    eventType: '',
    guestCount: 50,
    seatingStyle: 'round-tables',
    stageNeeded: true,
    danceFloorNeeded: false,
    barNeeded: true,
    foodStations: 0,
    vipSection: false,
    layoutStyle: 'traditional'
  })

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
  // CONTAINER DETECTION - For nested objects
  // =============================================================================

  // Check if a point is inside a container object
  const isPointInContainer = useCallback((x, y, container) => {
    if (!container) return null
    // Container types that can hold nested objects
    const containerTypes = ['vip-section', 'lounge-area']
    if (!containerTypes.includes(container.type)) return null
    
    // Check if point is within container bounds
    const isInside = x >= container.x && 
                     x <= container.x + container.width &&
                     y >= container.y && 
                     y <= container.y + container.height
    return isInside ? container : null
  }, [])

  // Find container at a given point
  const findContainerAtPoint = useCallback((x, y) => {
    // Check containers in reverse order (top to bottom)
    const containers = objects.filter(obj => 
      ['vip-section', 'lounge-area'].includes(obj.type)
    )
    
    // Sort by z-index (larger objects first, then by creation order)
    const sortedContainers = containers.sort((a, b) => {
      const aArea = a.width * a.height
      const bArea = b.width * b.height
      if (aArea !== bArea) return bArea - aArea
      return 0
    })
    
    // Find the first container that contains this point
    for (const container of sortedContainers) {
      if (isPointInContainer(x, y, container)) {
        return container
      }
    }
    return null
  }, [objects, isPointInContainer])

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
      let newX = snapValue(dragState.current.objectStartX + dx)
      let newY = snapValue(dragState.current.objectStartY + dy)

      const draggedObj = objects.find(o => o.id === dragState.current.draggedId)
      if (!draggedObj) return

      // Check if object is being dragged into/out of a container
      const centerX = newX + draggedObj.width / 2
      const centerY = newY + draggedObj.height / 2
      
      // Use findContainerAtPoint function (defined earlier)
      const containers = objects.filter(obj => 
        ['vip-section', 'lounge-area'].includes(obj.type)
      )
      const sortedContainers = containers.sort((a, b) => {
        const aArea = a.width * a.height
        const bArea = b.width * b.height
        if (aArea !== bArea) return bArea - aArea
        return 0
      })
      let newContainer = null
      for (const container of sortedContainers) {
        const isInside = centerX >= container.x && 
                         centerX <= container.x + container.width &&
                         centerY >= container.y && 
                         centerY <= container.y + container.height
        if (isInside) {
          newContainer = container
          break
        }
      }

      // If object has a parent container, constrain movement
      if (draggedObj.parentId) {
        const parentContainer = objects.find(o => o.id === draggedObj.parentId)
        if (parentContainer) {
          // If still inside parent, constrain to bounds
          if (newContainer?.id === parentContainer.id) {
            const padding = 4
            newX = Math.max(parentContainer.x + padding, 
                     Math.min(newX, parentContainer.x + parentContainer.width - draggedObj.width - padding))
            newY = Math.max(parentContainer.y + padding, 
                     Math.min(newY, parentContainer.y + parentContainer.height - draggedObj.height - padding))
          } else {
            // Moved outside parent - allow free movement but keep parentId for now
            // Will be updated on mouse up
          }
        }
      } else if (newContainer) {
        // Object is being dragged into a container - constrain to container bounds
        const padding = 4
        newX = Math.max(newContainer.x + padding, 
                 Math.min(newX, newContainer.x + newContainer.width - draggedObj.width - padding))
        newY = Math.max(newContainer.y + padding, 
                 Math.min(newY, newContainer.y + newContainer.height - draggedObj.height - padding))
      }

      setObjects(prev => prev.map(obj =>
        obj.id === dragState.current.draggedId
          ? { ...obj, x: newX, y: newY }
          : obj
      ))
    }
  }, [getCanvasCoords, snapValue, snapToGrid, objects])

  const handleCanvasMouseUp = useCallback((e) => {
    // Always clear drag state, even if not currently dragging (prevents stuck state)
    if (dragState.current.isDragging || dragState.current.isResizing) {
      // Get current objects state for parentId update
      setObjects(currentObjects => {
        let updatedObjects = currentObjects
        
        // Update parentId based on final position if dragging
        if (dragState.current.isDragging && dragState.current.draggedId) {
          const draggedObj = currentObjects.find(o => o.id === dragState.current.draggedId)
          if (draggedObj) {
            const centerX = draggedObj.x + draggedObj.width / 2
            const centerY = draggedObj.y + draggedObj.height / 2
            const newContainer = findContainerAtPoint(centerX, centerY)
            
            // Update parentId if container changed
            if (newContainer?.id !== draggedObj.parentId) {
              updatedObjects = currentObjects.map(obj =>
                obj.id === dragState.current.draggedId
                  ? { ...obj, parentId: newContainer?.id || null }
                  : obj
              )
            }
          }
        }
        
        // Save to history
        saveToHistory(updatedObjects)
        
        return updatedObjects
      })
    }
    
    // Always reset drag state, even if not dragging (safety measure)
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
  }, [saveToHistory, findContainerAtPoint])

  // =============================================================================
  // DRAG FROM LIBRARY
  // =============================================================================

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    const item = JSON.parse(data)
    const coords = getCanvasCoords(e)
    
    // Check if dropping inside a container
    const container = findContainerAtPoint(coords.x, coords.y)
    
    // Calculate position relative to container if inside one
    let finalX = snapValue(coords.x - item.width / 2)
    let finalY = snapValue(coords.y - item.height / 2)
    
    // If inside container, ensure object stays within bounds
    if (container) {
      // Constrain to container bounds with padding
      const padding = 4
      finalX = Math.max(container.x + padding, 
               Math.min(finalX, container.x + container.width - item.width - padding))
      finalY = Math.max(container.y + padding, 
               Math.min(finalY, container.y + container.height - item.height - padding))
    }
    
    const newObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: item.type,
      name: item.name,
      x: finalX,
      y: finalY,
      width: item.width,
      height: item.height,
      rotation: 0,
      color: item.color,
      seats: item.seats || 0,
      locked: false,
      visible: true,
      label: item.label || '',
      tableNumber: '',
      parentId: container ? container.id : null, // Track parent container
    }
    
    const newObjects = [...objects, newObject]
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([newObject.id])
  }, [objects, getCanvasCoords, snapValue, saveToHistory, findContainerAtPoint])

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
  // GLOBAL MOUSE UP LISTENER - Ensures drag state is cleared
  // =============================================================================

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      // Clear drag state if mouse is released anywhere
      if (dragState.current.isDragging || dragState.current.isResizing) {
        handleCanvasMouseUp(e)
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [handleCanvasMouseUp])

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
  // PDF EXPORT
  // =============================================================================

  const exportToPDF = useCallback(async () => {
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      // Calculate dimensions in feet (assuming 12 pixels per foot)
      const widthInFeet = canvasWidth / 12
      const heightInFeet = canvasHeight / 12

      // Add title
      pdf.setFontSize(20)
      pdf.text(layoutName || 'Venue Layout', 20, 20)

      // Add metadata
      pdf.setFontSize(12)
      pdf.text(`Canvas: ${widthInFeet.toFixed(1)}ft × ${heightInFeet.toFixed(1)}ft`, 20, 30)
      pdf.text(`Objects: ${objects.length}`, 20, 36)
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 42)

      // Convert SVG to image using html2canvas approach
      const svgElement = canvasRef.current
      if (svgElement) {
        // Create a temporary canvas to render SVG
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.onload = () => {
          const imgWidth = 190 // A4 width minus margins
          const imgHeight = (img.height * imgWidth) / img.width
          
          pdf.addImage(img, 'PNG', 20, 50, imgWidth, imgHeight)
          pdf.save(`${layoutName || 'venue-layout'}.pdf`)
          URL.revokeObjectURL(svgUrl)
        }
        img.src = svgUrl
      } else {
        // Fallback: just save the PDF with metadata
        pdf.save(`${layoutName || 'venue-layout'}.pdf`)
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }, [layoutName, canvasWidth, canvasHeight, objects])

  // =============================================================================
  // AI ASSISTANT
  // =============================================================================

  const handleAiQuery = useCallback(async (query) => {
    if (!query.trim()) return

    const userMessage = { role: 'user', content: query }
    setAiMessages(prev => [...prev, userMessage])
    setAiInput('')
    setAiLoading(true)

    // Simulate AI processing (in production, this would call an AI API)
    setTimeout(() => {
      const lowerQuery = query.toLowerCase()
      let response = ''

      // Auto-arrange commands
      if (lowerQuery.includes('arrange') || lowerQuery.includes('auto') || lowerQuery.includes('layout')) {
        const guestCount = parseInt(query.match(/\d+/)?.[0] || '50')
        response = autoArrangeLayout(guestCount)
      }
      // Event type suggestions
      else if (lowerQuery.includes('wedding') || lowerQuery.includes('marriage')) {
        response = suggestWeddingLayout()
      }
      else if (lowerQuery.includes('conference') || lowerQuery.includes('meeting')) {
        response = suggestConferenceLayout()
      }
      else if (lowerQuery.includes('party') || lowerQuery.includes('celebration')) {
        response = suggestPartyLayout()
      }
      else if (lowerQuery.includes('capacity') || lowerQuery.includes('seating')) {
        response = calculateCapacity()
      }
      else if (lowerQuery.includes('spacing') || lowerQuery.includes('distance')) {
        response = suggestSpacing()
      }
      else if (lowerQuery.includes('flow') || lowerQuery.includes('traffic')) {
        response = suggestFlowOptimization()
      }
      else if (lowerQuery.includes('help') || lowerQuery.includes('what can you')) {
        response = `I can help you with:\n\n• Auto-arranging objects: "Arrange tables for 100 guests"\n• Event layouts: "Suggest a wedding layout"\n• Capacity: "What's my current capacity?"\n• Spacing: "Check spacing between tables"\n• Flow: "Optimize traffic flow"\n• General questions about venue design\n\nJust ask me anything!`
      }
      else {
        response = `I understand you're asking about "${query}". Here are some suggestions:\n\n• Try "Arrange tables for [number] guests" to auto-arrange\n• Ask "Suggest a [event type] layout" for event-specific designs\n• Use "What's my capacity?" to check seating\n• Say "Optimize spacing" for spacing recommendations\n\nNeed more specific help? Describe what you're trying to achieve!`
      }

      setAiMessages(prev => [...prev, { role: 'assistant', content: response }])
      setAiLoading(false)
    }, 800)
  }, [objects, saveToHistory])

  const autoArrangeLayout = (guestCount) => {
    const tables = objects.filter(o => o.type.includes('table') || o.type.includes('chair'))
    if (tables.length === 0) {
      return `I don't see any tables to arrange. Add some tables first, then ask me to arrange them!`
    }

    // Clear existing table positions
    const otherObjects = objects.filter(o => !o.type.includes('table') && !o.type.includes('chair'))
    
    // Calculate grid layout
    const tablesPerRow = Math.ceil(Math.sqrt(tables.length))
    const spacing = 120 // 10 feet spacing
    const startX = 200
    const startY = 200

    const newTablePositions = tables.map((table, index) => {
      const row = Math.floor(index / tablesPerRow)
      const col = index % tablesPerRow
      return {
        ...table,
        x: startX + col * spacing,
        y: startY + row * spacing
      }
    })

    setObjects([...otherObjects, ...newTablePositions])
    saveToHistory([...otherObjects, ...newTablePositions])

    return `✅ Arranged ${tables.length} tables in a grid layout for approximately ${guestCount} guests!\n\n• Spacing: 10ft between tables\n• Layout: ${tablesPerRow} tables per row\n• Total capacity: ~${tables.reduce((sum, t) => sum + (t.seats || 8), 0)} seats\n\nYou can adjust individual table positions as needed.`
  }

  const suggestWeddingLayout = () => {
    return `💒 Wedding Layout Suggestions:\n\n• Head Table: Place at front, elevated if possible\n• Guest Tables: 8-10 person round tables, 10ft spacing\n• Dance Floor: Center or near stage, 20x20ft minimum\n• Bar: 2-3 bars around perimeter for easy access\n• Photo Booth: Near entrance or in corner\n• Sweetheart Table: Optional, near head table\n\nWould you like me to auto-arrange a wedding layout? Say "Arrange wedding layout"!`
  }

  const suggestConferenceLayout = () => {
    return `📊 Conference Layout Suggestions:\n\n• Stage: Front center, elevated\n• Seating: Theater style (chairs in rows) or classroom (tables with chairs)\n• Aisles: 3-4ft wide for easy access\n• Registration: Near entrance\n• Break Area: Separate space with refreshments\n• Networking: Cocktail tables in break area\n\nSay "Arrange conference layout" to auto-arrange!`
  }

  const suggestPartyLayout = () => {
    return `🎉 Party Layout Suggestions:\n\n• Dance Floor: Large central area, 24x24ft minimum\n• Bar: Multiple bars around perimeter\n• Seating: Mix of cocktail tables and lounge areas\n• Stage/DJ: One end of dance floor\n• Food Stations: Around perimeter, not blocking flow\n• VIP Area: Elevated or roped off section\n\nWant me to create this layout? Ask me to "Arrange party layout"!`
  }

  const calculateCapacity = () => {
    const tables = objects.filter(o => o.type.includes('table'))
    const chairs = objects.filter(o => o.type === 'chair' || o.type === 'banquet-chair')
    const chairRows = objects.filter(o => o.type === 'chair-row')
    
    const tableSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0)
    const individualChairs = chairs.length
    const rowSeats = chairRows.reduce((sum, r) => sum + (r.seats || 10), 0)
    const totalCapacity = tableSeats + individualChairs + rowSeats

    return `📊 Current Capacity Analysis:\n\n• Tables: ${tables.length} tables, ${tableSeats} seats\n• Individual Chairs: ${individualChairs} seats\n• Chair Rows: ${chairRows.length} rows, ${rowSeats} seats\n• **Total Capacity: ${totalCapacity} guests**\n\n💡 Tip: Add more tables or chair rows to increase capacity!`
  }

  const suggestSpacing = () => {
    const tables = objects.filter(o => o.type.includes('table'))
    if (tables.length < 2) {
      return `Add at least 2 tables to check spacing recommendations.`
    }

    // Check spacing between tables
    let spacingIssues = []
    tables.forEach((table1, i) => {
      tables.slice(i + 1).forEach((table2, j) => {
        const distance = Math.sqrt(
          Math.pow(table1.x - table2.x, 2) + Math.pow(table1.y - table2.y, 2)
        )
        const minSpacing = 120 // 10 feet minimum
        if (distance < minSpacing) {
          spacingIssues.push(`Tables ${i + 1} and ${i + j + 2} are too close (${Math.round(distance / 12)}ft, need 10ft+)`)
        }
      })
    })

    if (spacingIssues.length === 0) {
      return `✅ Spacing looks good! All tables have adequate spacing (10ft+ between tables).`
    } else {
      return `⚠️ Spacing Recommendations:\n\n${spacingIssues.join('\n')}\n\n💡 Minimum spacing: 10ft (120px) between tables for comfortable movement.`
    }
  }

  const suggestFlowOptimization = () => {
    const entrances = objects.filter(o => o.type === 'entrance' || o.type === 'vip-entrance')
    const exits = objects.filter(o => o.type === 'exit')
    const tables = objects.filter(o => o.type.includes('table'))
    
    let suggestions = []
    
    if (entrances.length === 0) {
      suggestions.push('• Add an entrance near the top of your layout')
    }
    if (exits.length === 0) {
      suggestions.push('• Add exit doors for safety compliance')
    }
    if (tables.length > 0) {
      suggestions.push('• Ensure clear pathways (4ft minimum) between table groups')
      suggestions.push('• Place high-traffic areas (bar, food) near entrance but not blocking it')
    }

    return `🚶 Traffic Flow Optimization:\n\n${suggestions.join('\n')}\n\n💡 Best Practices:\n• Create clear pathways from entrance to seating\n• Place bars/food stations around perimeter\n• Keep dance floor/stage accessible from all areas\n• Ensure exits are clearly marked and accessible`
  }

  // =============================================================================
  // LAYOUT GENERATOR FROM QUESTIONNAIRE
  // =============================================================================

  const generateLayoutFromQuestionnaire = useCallback(() => {
    const answers = questionnaireAnswers
    const generatedObjects = []
    let currentX = 100
    let currentY = 100
    const spacing = 120 // 10ft spacing

    // Add entrance
    generatedObjects.push({
      id: `gen-${Date.now()}-entrance`,
      type: 'entrance',
      name: 'Entrance',
      x: currentX,
      y: 50,
      width: 60,
      height: 24,
      color: '#4CAF50',
      label: 'ENTRANCE'
    })

    // Add check-in
    generatedObjects.push({
      id: `gen-${Date.now()}-checkin`,
      type: 'check-in',
      name: 'Check-in Desk',
      x: currentX + 100,
      y: 50,
      width: 120,
      height: 48,
      color: '#2969FF',
      label: 'CHECK-IN'
    })

    // Add stage if needed
    if (answers.stageNeeded) {
      generatedObjects.push({
        id: `gen-${Date.now()}-stage`,
        type: 'stage',
        name: 'Stage',
        x: 400,
        y: 100,
        width: 288,
        height: 144,
        color: '#5D4037',
        label: 'STAGE'
      })
      currentY = 280
    } else {
      currentY = 150
    }

    // Calculate tables needed
    const guestCount = answers.guestCount || 50
    let tablesNeeded = 0
    let seatsPerTable = 8

    if (answers.seatingStyle === 'round-tables') {
      seatsPerTable = 10
      tablesNeeded = Math.ceil(guestCount / seatsPerTable)
    } else if (answers.seatingStyle === 'rect-tables') {
      seatsPerTable = 8
      tablesNeeded = Math.ceil(guestCount / seatsPerTable)
    } else if (answers.seatingStyle === 'theater') {
      // Theater style - use chair rows
      const chairsPerRow = 20
      const rowsNeeded = Math.ceil(guestCount / chairsPerRow)
      for (let i = 0; i < rowsNeeded; i++) {
        generatedObjects.push({
          id: `gen-${Date.now()}-row-${i}`,
          type: 'chair-row',
          name: `Chair Row ${i + 1}`,
          x: 200,
          y: currentY + (i * 40),
          width: 400,
          height: 24,
          color: '#E91E63',
          seats: Math.min(chairsPerRow, guestCount - (i * chairsPerRow))
        })
      }
    } else if (answers.seatingStyle === 'cocktail') {
      seatsPerTable = 4
      tablesNeeded = Math.ceil(guestCount / seatsPerTable)
    } else {
      // Mixed - use round tables
      seatsPerTable = 10
      tablesNeeded = Math.ceil(guestCount / seatsPerTable)
    }

    // Add tables (if not theater style)
    if (answers.seatingStyle !== 'theater') {
      const tablesPerRow = Math.ceil(Math.sqrt(tablesNeeded))
      for (let i = 0; i < tablesNeeded; i++) {
        const row = Math.floor(i / tablesPerRow)
        const col = i % tablesPerRow
        const tableType = answers.seatingStyle === 'round-tables' ? 'round-table' : 
                         answers.seatingStyle === 'rect-tables' ? 'rect-table' : 'cocktail'
        const tableSize = tableType === 'round-table' ? 84 : tableType === 'rect-table' ? 120 : 36

        const tableName = tableType === 'round-table' ? `${seatsPerTable}-Top Round` :
                          tableType === 'rect-table' ? `${Math.round(tableSize/12)}ft Rectangle` :
                          'Cocktail Table'
        generatedObjects.push({
          id: `gen-${Date.now()}-table-${i}`,
          type: tableType,
          name: tableName,
          x: currentX + (col * spacing),
          y: currentY + (row * spacing),
          width: tableSize,
          height: tableType === 'rect-table' ? 48 : tableSize,
          color: '#E91E63',
          seats: seatsPerTable
        })
      }
    }

    // Add dance floor if needed
    if (answers.danceFloorNeeded) {
      generatedObjects.push({
        id: `gen-${Date.now()}-dance`,
        type: 'dance-floor',
        name: 'Dance Floor',
        x: 300,
        y: 600,
        width: 192,
        height: 192,
        color: '#1a1a2e'
      })
    }

    // Add bar if needed
    if (answers.barNeeded) {
      generatedObjects.push({
        id: `gen-${Date.now()}-bar`,
        type: 'bar',
        name: 'Bar',
        x: 50,
        y: 600,
        width: 180,
        height: 48,
        color: '#FF9800',
        label: 'BAR'
      })
    }

    // Add VIP section if needed
    if (answers.vipSection) {
      generatedObjects.push({
        id: `gen-${Date.now()}-vip`,
        type: 'vip-section',
        name: 'VIP Section',
        x: 700,
        y: 200,
        width: 200,
        height: 300,
        color: '#9C27B0',
        label: 'VIP'
      })
    }

    // Add food stations
    for (let i = 0; i < answers.foodStations; i++) {
      generatedObjects.push({
        id: `gen-${Date.now()}-food-${i}`,
        type: 'food-station',
        name: `Food Station ${i + 1}`,
        x: 50 + (i * 200),
        y: 500,
        width: 72,
        height: 72,
        color: '#8BC34A'
      })
    }

    // Add exits
    generatedObjects.push({
      id: `gen-${Date.now()}-exit1`,
      type: 'exit',
      name: 'Exit',
      x: 50,
      y: 800,
      width: 60,
      height: 24,
      color: '#F44336',
      label: 'EXIT'
    })
    generatedObjects.push({
      id: `gen-${Date.now()}-exit2`,
      type: 'exit',
      name: 'Exit',
      x: 1100,
      y: 800,
      width: 60,
      height: 24,
      color: '#F44336',
      label: 'EXIT'
    })

    // Apply the generated layout
    setObjects(generatedObjects)
    saveToHistory(generatedObjects)
    setShowQuestionnaire(false)
    setQuestionnaireStep(0)
    setLayoutName(`${answers.eventType.charAt(0).toUpperCase() + answers.eventType.slice(1)} Event Layout`)
    
    // Show success message
    alert(`✅ Layout generated successfully!\n\n• ${tablesNeeded || 'Theater'} ${answers.seatingStyle === 'theater' ? 'rows' : 'tables'}\n• ${guestCount} guests capacity\n• All requested features included`)
  }, [questionnaireAnswers, saveToHistory])

  // =============================================================================
  // SAMPLE DESIGN
  // =============================================================================

  const loadSampleDesign = useCallback(() => {
    if (!confirm('Load sample design? This will replace your current layout.')) {
      return
    }

    const sampleObjects = [
      // Entrance
      { id: 'sample-1', type: 'entrance', x: 50, y: 50, width: 60, height: 24, color: '#4CAF50', label: 'ENTRANCE' },
      // Check-in
      { id: 'sample-2', type: 'check-in', x: 150, y: 50, width: 120, height: 48, color: '#2969FF', label: 'CHECK-IN' },
      // Stage
      { id: 'sample-3', type: 'stage', x: 400, y: 100, width: 288, height: 144, color: '#5D4037', label: 'STAGE' },
      // Tables
      { id: 'sample-4', type: 'round-table', x: 200, y: 300, width: 84, height: 84, color: '#E91E63', seats: 10 },
      { id: 'sample-5', type: 'round-table', x: 350, y: 300, width: 84, height: 84, color: '#E91E63', seats: 10 },
      { id: 'sample-6', type: 'round-table', x: 500, y: 300, width: 84, height: 84, color: '#E91E63', seats: 10 },
      { id: 'sample-7', type: 'round-table', x: 200, y: 450, width: 84, height: 84, color: '#E91E63', seats: 10 },
      { id: 'sample-8', type: 'round-table', x: 350, y: 450, width: 84, height: 84, color: '#E91E63', seats: 10 },
      { id: 'sample-9', type: 'round-table', x: 500, y: 450, width: 84, height: 84, color: '#E91E63', seats: 10 },
      // VIP Section
      { id: 'sample-10', type: 'vip-section', x: 700, y: 200, width: 200, height: 300, color: '#9C27B0', label: 'VIP' },
      // Bar
      { id: 'sample-11', type: 'bar', x: 50, y: 600, width: 180, height: 48, color: '#FF9800', label: 'BAR' },
      // Dance floor
      { id: 'sample-12', type: 'dance-floor', x: 300, y: 600, width: 192, height: 192, color: '#1a1a2e' },
    ]

    setObjects(sampleObjects)
    saveToHistory(sampleObjects)
    setLayoutName('Sample Event Layout')
  }, [saveToHistory])

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const selectedObject = useMemo(() => 
    selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null
  , [selectedIds, objects])

  // Sort objects for rendering: containers first (background), then regular objects (foreground)
  const sortedObjects = useMemo(() => {
    const containers = objects.filter(obj => 
      ['vip-section', 'lounge-area'].includes(obj.type)
    )
    const regularObjects = objects.filter(obj => 
      !['vip-section', 'lounge-area'].includes(obj.type)
    )
    return [...containers, ...regularObjects]
  }, [objects])

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

        <div className="w-px h-6 bg-[#3d3d4d]" />

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

        {/* AI Assistant Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
          className={`${aiPanelOpen ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
        >
          <Bot className="w-4 h-4 mr-1" />
          AI Help
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Export PDF */}
        <Button
          variant="ghost"
          size="sm"
          onClick={exportToPDF}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4 mr-1" />
          Export PDF
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Generate Layout from Questionnaire */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQuestionnaire(true)}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Wand2 className="w-4 h-4 mr-1" />
          Generate Layout
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Load Sample Design */}
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSampleDesign}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Star className="w-4 h-4 mr-1" />
          Sample
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
              {/* Shadow Filters - 2D Drop Shadows */}
              <defs>
                {/* Drop Shadow - Standard */}
                <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                  <feOffset dx="2" dy="4" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.4"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Drop Shadow - Soft */}
                <filter id="dropShadowSoft" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
                  <feOffset dx="3" dy="6" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Drop Shadow - Hard */}
                <filter id="dropShadowHard" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
                  <feOffset dx="1" dy="2" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Depth Shadow */}
                <filter id="depthShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
                  <feOffset dx="4" dy="8" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="gamma" exponent="0.5" amplitude="0.6"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Contact Shadow */}
                <filter id="contactShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
                  <feOffset dx="0" dy="0" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.15"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Glow Effect */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
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

              {/* Objects - render containers first (background), then regular objects (foreground) */}
              {sortedObjects.map(obj => (
                <CanvasObject
                  key={obj.id}
                  obj={obj}
                  isSelected={selectedIds.includes(obj.id)}
                  onSelect={handleSelect}
                  onDragStart={handleDragStart}
                  onResizeStart={handleResizeStart}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* ===== AI ASSISTANT PANEL ===== */}
        {aiPanelOpen && (
          <div className="w-80 bg-[#252535] border-l border-[#3d3d4d] flex flex-col transition-all duration-150 flex-shrink-0">
            <div className="flex items-center justify-between p-3 border-b border-[#3d3d4d]">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#2969FF]" />
                <span className="text-sm font-medium text-white">AI Assistant</span>
              </div>
              <button
                onClick={() => setAiPanelOpen(false)}
                className="p-1 text-white/40 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-[#2969FF] text-white'
                        : 'bg-[#1e1e2e] text-white/90 border border-[#3d3d4d]'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <Bot className="w-3 h-3 text-[#2969FF] mb-1" />
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e2e] border border-[#3d3d4d] rounded-lg p-2 text-xs text-white/60">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#2969FF] rounded-full animate-pulse" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-2 border-t border-[#3d3d4d] space-y-1">
              <div className="text-[10px] text-white/50 mb-2 px-2">Quick Actions:</div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAiQuery('What\'s my current capacity?')}
                  className="h-7 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Users className="w-3 h-3 mr-1" />
                  Capacity
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAiQuery('Check spacing between tables')}
                  className="h-7 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Grid className="w-3 h-3 mr-1" />
                  Spacing
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAiQuery('Optimize traffic flow')}
                  className="h-7 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Flow
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAiQuery('Suggest a wedding layout')}
                  className="h-7 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Ideas
                </Button>
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[#3d3d4d]">
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAiQuery(aiInput)
                    }
                  }}
                  placeholder="Ask me anything..."
                  className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => handleAiQuery(aiInput)}
                  disabled={!aiInput.trim() || aiLoading}
                  className="h-8 bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

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

      {/* ===== LAYOUT GENERATOR QUESTIONNAIRE MODAL ===== */}
      {showQuestionnaire && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252535] rounded-xl border border-[#3d3d4d] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#3d3d4d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-[#2969FF]" />
                <h2 className="text-lg font-semibold text-white">Generate Layout</h2>
              </div>
              <button
                onClick={() => {
                  setShowQuestionnaire(false)
                  setQuestionnaireStep(0)
                }}
                className="text-white/60 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Event Type */}
              {questionnaireStep === 0 && (
                <>
                  <div>
                    <Label className="text-white mb-3 block">What type of event is this?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Wedding', 'Conference', 'Party', 'Corporate', 'Concert', 'Other'].map(type => (
                        <Button
                          key={type}
                          variant={questionnaireAnswers.eventType === type.toLowerCase() ? 'default' : 'outline'}
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, eventType: type.toLowerCase()})}
                          className={`h-12 ${questionnaireAnswers.eventType === type.toLowerCase() 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35] hover:text-white'}`}
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowQuestionnaire(false)}
                      className="text-white/60 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setQuestionnaireStep(1)}
                      disabled={!questionnaireAnswers.eventType}
                      className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Guest Count */}
              {questionnaireStep === 1 && (
                <>
                  <div>
                    <Label className="text-white mb-3 block">How many guests are you expecting?</Label>
                    <Input
                      type="number"
                      value={questionnaireAnswers.guestCount}
                      onChange={(e) => setQuestionnaireAnswers({...questionnaireAnswers, guestCount: parseInt(e.target.value) || 50})}
                      className="h-12 bg-[#1e1e2e] border-[#3d3d4d] text-white text-lg"
                      min="10"
                      max="1000"
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setQuestionnaireStep(0)}
                      className="text-white/60 hover:text-white"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setQuestionnaireStep(2)}
                      className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Seating Style */}
              {questionnaireStep === 2 && (
                <>
                  <div>
                    <Label className="text-white mb-3 block">What seating style do you prefer?</Label>
                    <div className="space-y-2">
                      {[
                        { value: 'round-tables', label: 'Round Tables (8-10 per table)' },
                        { value: 'rect-tables', label: 'Rectangular Tables (6-8 per table)' },
                        { value: 'theater', label: 'Theater Style (Chairs in rows)' },
                        { value: 'cocktail', label: 'Cocktail Tables (Standing/Mingling)' },
                        { value: 'mixed', label: 'Mixed Seating' }
                      ].map(option => (
                        <Button
                          key={option.value}
                          variant={questionnaireAnswers.seatingStyle === option.value ? 'default' : 'outline'}
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, seatingStyle: option.value})}
                          className={`w-full h-12 justify-start ${questionnaireAnswers.seatingStyle === option.value 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35] hover:text-white'}`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setQuestionnaireStep(1)}
                      className="text-white/60 hover:text-white"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setQuestionnaireStep(3)}
                      className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}

              {/* Step 4: Features */}
              {questionnaireStep === 3 && (
                <>
                  <div>
                    <Label className="text-white mb-3 block">What features do you need?</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                        <span className="text-white">Stage/Podium</span>
                        <Button
                          variant={questionnaireAnswers.stageNeeded ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, stageNeeded: !questionnaireAnswers.stageNeeded})}
                          className={questionnaireAnswers.stageNeeded 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35]'}
                        >
                          {questionnaireAnswers.stageNeeded ? 'Yes' : 'No'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                        <span className="text-white">Dance Floor</span>
                        <Button
                          variant={questionnaireAnswers.danceFloorNeeded ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, danceFloorNeeded: !questionnaireAnswers.danceFloorNeeded})}
                          className={questionnaireAnswers.danceFloorNeeded 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35]'}
                        >
                          {questionnaireAnswers.danceFloorNeeded ? 'Yes' : 'No'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                        <span className="text-white">Bar</span>
                        <Button
                          variant={questionnaireAnswers.barNeeded ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, barNeeded: !questionnaireAnswers.barNeeded})}
                          className={questionnaireAnswers.barNeeded 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35]'}
                        >
                          {questionnaireAnswers.barNeeded ? 'Yes' : 'No'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                        <span className="text-white">VIP Section</span>
                        <Button
                          variant={questionnaireAnswers.vipSection ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setQuestionnaireAnswers({...questionnaireAnswers, vipSection: !questionnaireAnswers.vipSection})}
                          className={questionnaireAnswers.vipSection 
                            ? 'bg-[#2969FF] text-white hover:bg-[#1e4fd6]' 
                            : 'border-[#3d3d4d] bg-[#1e1e2e] text-white hover:bg-[#2a2a35]'}
                        >
                          {questionnaireAnswers.vipSection ? 'Yes' : 'No'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                        <span className="text-white">Food Stations</span>
                        <Input
                          type="number"
                          value={questionnaireAnswers.foodStations}
                          onChange={(e) => setQuestionnaireAnswers({...questionnaireAnswers, foodStations: parseInt(e.target.value) || 0})}
                          className="w-20 h-8 bg-[#252535] border-[#3d3d4d] text-white text-sm"
                          min="0"
                          max="10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setQuestionnaireStep(2)}
                      className="text-white/60 hover:text-white"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={generateLayoutFromQuestionnaire}
                      className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
                    >
                      Generate Layout
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
