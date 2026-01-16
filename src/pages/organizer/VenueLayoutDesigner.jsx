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
// OPTIMIZED CANVAS OBJECT COMPONENT
// =============================================================================

const CanvasObject = memo(({ obj, isSelected, onSelect, onDragStart }) => {
  const handleMouseDown = (e) => {
    e.stopPropagation()
    onSelect(obj.id, e.shiftKey)
    if (!obj.locked) {
      onDragStart(obj.id, e)
    }
  }

  // Render chairs around round tables
  const renderChairs = () => {
    if (!obj.type.includes('round-table') || !obj.seats) return null
    return Array.from({ length: obj.seats }).map((_, i) => {
      const angle = (i / obj.seats) * Math.PI * 2 - Math.PI / 2
      const chairRadius = Math.max(obj.width, obj.height) / 2 + 12
      const cx = obj.width / 2 + Math.cos(angle) * chairRadius
      const cy = obj.height / 2 + Math.sin(angle) * chairRadius
      return (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={8}
          fill={obj.color}
          opacity={0.7}
        />
      )
    })
  }

  // Dance floor pattern
  const renderDanceFloor = () => {
    if (obj.type !== 'dance-floor') return null
    const tiles = []
    const tileSize = 24
    for (let i = 0; i < Math.floor(obj.width / tileSize); i++) {
      for (let j = 0; j < Math.floor(obj.height / tileSize); j++) {
        tiles.push(
          <rect
            key={`${i}-${j}`}
            x={i * tileSize + 1}
            y={j * tileSize + 1}
            width={tileSize - 2}
            height={tileSize - 2}
            fill={(i + j) % 2 === 0 ? '#2a2a4a' : '#1a1a2e'}
          />
        )
      }
    }
    return tiles
  }

  const isRound = obj.type === 'round-table' || obj.type === 'cocktail' || 
                  obj.type === 'highboy' || obj.type === 'bar-round' ||
                  obj.type === 'fire-pit' || obj.type === 'umbrella'

  return (
    <g
      transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0}, ${obj.width/2}, ${obj.height/2})`}
      style={{ cursor: obj.locked ? 'not-allowed' : 'move' }}
      onMouseDown={handleMouseDown}
    >
      {/* Main shape */}
      {isRound ? (
        <ellipse
          cx={obj.width / 2}
          cy={obj.height / 2}
          rx={obj.width / 2 - 1}
          ry={obj.height / 2 - 1}
          fill={obj.color}
          stroke={isSelected ? '#2969FF' : 'rgba(0,0,0,0.15)'}
          strokeWidth={isSelected ? 2 : 1}
        />
      ) : (
        <rect
          width={obj.width}
          height={obj.height}
          rx={obj.type === 'dance-floor' ? 0 : 4}
          fill={obj.color}
          stroke={isSelected ? '#2969FF' : 'rgba(0,0,0,0.15)'}
          strokeWidth={isSelected ? 2 : 1}
        />
      )}

      {/* Chairs around tables */}
      {renderChairs()}

      {/* Dance floor tiles */}
      {renderDanceFloor()}

      {/* Label */}
      {(obj.label || obj.tableNumber) && (
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
          rx={isRound ? obj.width / 2 : 6}
          ry={isRound ? obj.height / 2 : 6}
        />
      )}
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
    draggedId: null,
    startX: 0,
    startY: 0,
    objectStartX: 0,
    objectStartY: 0
  })

  const [, forceUpdate] = useState(0)

  // Saving
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

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

      if (error) throw error

      setLayoutName(data.name || 'Untitled Layout')
      setCanvasWidth(data.width || 1200)
      setCanvasHeight(data.height || 800)
      setObjects(data.layout_data?.objects || [])
      setHistory([data.layout_data?.objects || []])
    } catch (error) {
      console.error('Error loading layout:', error)
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
      draggedId: id,
      startX: coords.x,
      startY: coords.y,
      objectStartX: obj.x,
      objectStartY: obj.y
    }
  }, [objects, getCanvasCoords])

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current) {
      setSelectedIds([])
    }
  }, [])

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragState.current.isDragging) return

    const coords = getCanvasCoords(e)
    const dx = coords.x - dragState.current.startX
    const dy = coords.y - dragState.current.startY

    const newX = snapValue(dragState.current.objectStartX + dx)
    const newY = snapValue(dragState.current.objectStartY + dy)

    // Update object position directly
    setObjects(prev => prev.map(obj =>
      obj.id === dragState.current.draggedId
        ? { ...obj, x: newX, y: newY }
        : obj
    ))
  }, [getCanvasCoords, snapValue])

  const handleCanvasMouseUp = useCallback(() => {
    if (dragState.current.isDragging) {
      saveToHistory(objects)
      dragState.current.isDragging = false
      dragState.current.draggedId = null
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
      if (e.key === 'Escape') {
        setSelectedIds([])
      }
      if (e.key === '=' || e.key === '+') setZoom(z => Math.min(150, z + 10))
      if (e.key === '-') setZoom(z => Math.max(25, z - 10))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [objects, deleteSelected, duplicateSelected, undo, redo])

  // =============================================================================
  // SAVE LAYOUT
  // =============================================================================

  const saveLayout = async () => {
    if (!organizer?.id) return
    setSaving(true)

    try {
      const layoutData = { objects, gridSize, showGrid }

      if (layoutId && layoutId !== 'create') {
        await supabase
          .from('venue_layouts')
          .update({
            name: layoutName,
            width: canvasWidth,
            height: canvasHeight,
            layout_data: layoutData,
            updated_at: new Date().toISOString()
          })
          .eq('id', layoutId)
      } else {
        const { data } = await supabase
          .from('venue_layouts')
          .insert({
            venue_id: venueId,
            organizer_id: organizer.id,
            name: layoutName,
            width: canvasWidth,
            height: canvasHeight,
            layout_data: layoutData
          })
          .select()
          .single()

        if (data) {
          navigate(`/organizer/venues/${venueId}/layouts/${data.id}`, { replace: true })
        }
      }

      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving layout:', error)
    } finally {
      setSaving(false)
    }
  }

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
          className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Saving...' : 'Save'}
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
                      className="flex-1 h-7 text-xs border-[#3d3d4d] text-white hover:bg-white/10"
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
