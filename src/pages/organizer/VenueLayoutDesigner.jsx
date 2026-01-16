/**
 * Venue Layout Designer - Professional Edition
 * Inspired by SocialTables - Full-featured event floor plan designer
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Trash2, RotateCw, Plus, Minus, Undo, Redo, Grid, Copy,
  ChevronLeft, ChevronRight, ChevronDown, Eye, EyeOff, Lock, Unlock,
  ZoomIn, ZoomOut, Move, MousePointer, Square, Circle, Maximize2,
  Download, Upload, Share2, Settings, HelpCircle, Layers, Star,
  FolderOpen, Search, Image, Type, Ruler, Palette, Users, Music,
  Utensils, Coffee, Briefcase, Mic, Monitor, Armchair, Table2,
  LayoutGrid, PanelLeftClose, PanelRightClose
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'

// =============================================================================
// OBJECT LIBRARY - Categories and Items
// =============================================================================

const OBJECT_CATEGORIES = [
  {
    id: 'favorites',
    name: 'Favorites',
    icon: Star,
    items: []
  },
  {
    id: 'tables',
    name: 'Tables & Seating',
    icon: Table2,
    items: [
      { id: 'round-table-8', name: '8-Top Round', type: 'round-table', seats: 8, width: 72, height: 72, color: '#E91E63' },
      { id: 'round-table-10', name: '10-Top Round', type: 'round-table', seats: 10, width: 84, height: 84, color: '#E91E63' },
      { id: 'round-table-6', name: '6-Top Round', type: 'round-table', seats: 6, width: 60, height: 60, color: '#E91E63' },
      { id: 'rect-table-6', name: '6ft Rectangle', type: 'rect-table', seats: 6, width: 96, height: 48, color: '#9C27B0' },
      { id: 'rect-table-8', name: '8ft Rectangle', type: 'rect-table', seats: 8, width: 120, height: 48, color: '#9C27B0' },
      { id: 'cocktail-table', name: 'Cocktail Table', type: 'cocktail', seats: 4, width: 36, height: 36, color: '#673AB7' },
      { id: 'banquet-chair', name: 'Banquet Chair', type: 'chair', seats: 1, width: 24, height: 24, color: '#E91E63' },
      { id: 'chiavari-chair', name: 'Chiavari Chair', type: 'chiavari', seats: 1, width: 24, height: 24, color: '#FFD700' },
      { id: 'ghost-chair', name: 'Ghost Chair', type: 'ghost', seats: 1, width: 24, height: 24, color: '#90CAF9' },
    ]
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: Music,
    items: [
      { id: 'stage-small', name: 'Stage (Small)', type: 'stage', width: 144, height: 96, color: '#795548' },
      { id: 'stage-medium', name: 'Stage (Medium)', type: 'stage', width: 192, height: 120, color: '#795548' },
      { id: 'stage-large', name: 'Stage (Large)', type: 'stage', width: 288, height: 144, color: '#795548' },
      { id: 'dj-booth', name: 'DJ Booth', type: 'dj-booth', width: 72, height: 48, color: '#1a1a2e' },
      { id: 'dance-floor', name: 'Dance Floor', type: 'dance-floor', width: 192, height: 192, color: '#1a1a2e' },
      { id: 'photo-booth', name: 'Photo Booth', type: 'photo-booth', width: 96, height: 72, color: '#FF5722' },
    ]
  },
  {
    id: 'food',
    name: 'Food & Beverage',
    icon: Utensils,
    items: [
      { id: 'buffet-table', name: 'Buffet Table', type: 'buffet', width: 144, height: 36, color: '#8BC34A' },
      { id: 'bar', name: 'Bar', type: 'bar', width: 120, height: 48, color: '#795548' },
      { id: 'dessert-table', name: 'Dessert Table', type: 'dessert', width: 96, height: 36, color: '#FFEB3B' },
      { id: 'coffee-station', name: 'Coffee Station', type: 'coffee', width: 60, height: 36, color: '#795548' },
      { id: 'cake-table', name: 'Cake Table', type: 'cake', width: 48, height: 48, color: '#F8BBD9' },
    ]
  },
  {
    id: 'tradeshow',
    name: 'Trade Show',
    icon: Briefcase,
    items: [
      { id: 'booth-10x10', name: '10x10 Booth', type: 'booth', width: 120, height: 120, color: '#2196F3' },
      { id: 'booth-10x20', name: '10x20 Booth', type: 'booth', width: 240, height: 120, color: '#2196F3' },
      { id: 'registration', name: 'Registration Desk', type: 'registration', width: 144, height: 48, color: '#607D8B' },
      { id: 'kiosk', name: 'Kiosk', type: 'kiosk', width: 48, height: 48, color: '#00BCD4' },
    ]
  },
  {
    id: 'av',
    name: 'A/V Equipment',
    icon: Monitor,
    items: [
      { id: 'projector-screen', name: 'Projector Screen', type: 'screen', width: 144, height: 12, color: '#ECEFF1' },
      { id: 'tv-display', name: 'TV Display', type: 'display', width: 72, height: 12, color: '#263238' },
      { id: 'speaker', name: 'Speaker', type: 'speaker', width: 24, height: 24, color: '#37474F' },
      { id: 'podium', name: 'Podium', type: 'podium', width: 36, height: 24, color: '#795548' },
    ]
  },
  {
    id: 'lounge',
    name: 'Lounge',
    icon: Armchair,
    items: [
      { id: 'sofa', name: 'Sofa', type: 'sofa', width: 96, height: 40, color: '#5D4037' },
      { id: 'loveseat', name: 'Loveseat', type: 'loveseat', width: 60, height: 40, color: '#5D4037' },
      { id: 'ottoman', name: 'Ottoman', type: 'ottoman', width: 36, height: 36, color: '#8D6E63' },
      { id: 'coffee-table-rect', name: 'Coffee Table', type: 'coffee-table', width: 60, height: 36, color: '#3E2723' },
    ]
  },
  {
    id: 'decor',
    name: 'Decor & Other',
    icon: Palette,
    items: [
      { id: 'plant', name: 'Plant/Greenery', type: 'plant', width: 36, height: 36, color: '#4CAF50' },
      { id: 'flowers', name: 'Flower Arrangement', type: 'flowers', width: 24, height: 24, color: '#E91E63' },
      { id: 'carpet', name: 'Area Rug', type: 'carpet', width: 120, height: 96, color: '#9E9E9E' },
      { id: 'rope-barrier', name: 'Rope Barrier', type: 'barrier', width: 72, height: 8, color: '#FFD700' },
      { id: 'check-in', name: 'Check-in Desk', type: 'check-in', width: 96, height: 36, color: '#2969FF' },
    ]
  }
]

// Room/Layout Templates
const LAYOUT_TEMPLATES = [
  { id: 'blank', name: 'Blank Canvas', rooms: [] },
  { id: 'wedding', name: 'Wedding Reception', preview: '🎊' },
  { id: 'conference', name: 'Conference Room', preview: '📊' },
  { id: 'banquet', name: 'Banquet Hall', preview: '🍽️' },
  { id: 'tradeshow', name: 'Trade Show', preview: '🏢' },
  { id: 'concert', name: 'Concert/Show', preview: '🎵' },
]

// =============================================================================
// COMPONENT
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
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // UI state
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(24)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [viewMode, setViewMode] = useState('2d') // '2d' or '3d'
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeCategory, setActiveCategory] = useState('tables')
  const [searchQuery, setSearchQuery] = useState('')
  const [tool, setTool] = useState('select') // 'select', 'pan', 'draw-section'

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Resize/rotate state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [isRotating, setIsRotating] = useState(false)

  // Canvas pan/scroll
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

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
    } catch (error) {
      console.error('Error loading layout:', error)
    }
  }

  // =============================================================================
  // HISTORY (UNDO/REDO)
  // =============================================================================

  const saveToHistory = useCallback((newObjects) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push([...newObjects])
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setObjects([...history[historyIndex - 1]])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setObjects([...history[historyIndex + 1]])
    }
  }

  // =============================================================================
  // OBJECT MANIPULATION
  // =============================================================================

  const addObject = (item) => {
    const newObject = {
      id: `${item.type}-${Date.now()}`,
      type: item.type,
      name: item.name,
      x: canvasWidth / 2 - item.width / 2,
      y: canvasHeight / 2 - item.height / 2,
      width: item.width,
      height: item.height,
      rotation: 0,
      color: item.color,
      seats: item.seats || 0,
      locked: false,
      visible: true,
      label: '',
      tableNumber: '',
    }
    const newObjects = [...objects, newObject]
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([newObject.id])
  }

  const duplicateSelected = () => {
    const newObjects = [...objects]
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id)
      if (obj) {
        newObjects.push({
          ...obj,
          id: `${obj.type}-${Date.now()}-copy`,
          x: obj.x + 30,
          y: obj.y + 30,
        })
      }
    })
    setObjects(newObjects)
    saveToHistory(newObjects)
  }

  const deleteSelected = () => {
    const newObjects = objects.filter(o => !selectedIds.includes(o.id))
    setObjects(newObjects)
    saveToHistory(newObjects)
    setSelectedIds([])
  }

  const updateObject = (id, updates) => {
    const newObjects = objects.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    )
    setObjects(newObjects)
  }

  const snapToGridValue = (value) => {
    if (!snapToGrid) return value
    return Math.round(value / gridSize) * gridSize
  }

  // =============================================================================
  // MOUSE HANDLERS
  // =============================================================================

  const getCanvasCoordinates = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const scale = zoom / 100
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }

  const handleCanvasMouseDown = (e) => {
    const coords = getCanvasCoordinates(e)

    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y })
      return
    }

    // Check if clicking on an object
    const clickedObject = [...objects].reverse().find(obj => {
      if (!obj.visible) return false
      return coords.x >= obj.x && coords.x <= obj.x + obj.width &&
             coords.y >= obj.y && coords.y <= obj.y + obj.height
    })

    if (clickedObject) {
      if (e.shiftKey) {
        // Multi-select
        setSelectedIds(prev => 
          prev.includes(clickedObject.id) 
            ? prev.filter(id => id !== clickedObject.id)
            : [...prev, clickedObject.id]
        )
      } else {
        setSelectedIds([clickedObject.id])
      }

      if (!clickedObject.locked) {
        setIsDragging(true)
        setDragStart(coords)
        setDragOffset({ x: coords.x - clickedObject.x, y: coords.y - clickedObject.y })
      }
    } else {
      setSelectedIds([])
    }
  }

  const handleCanvasMouseMove = (e) => {
    const coords = getCanvasCoordinates(e)

    if (isPanning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
      return
    }

    if (isDragging && selectedIds.length > 0) {
      const dx = coords.x - dragStart.x
      const dy = coords.y - dragStart.y

      const newObjects = objects.map(obj => {
        if (selectedIds.includes(obj.id) && !obj.locked) {
          return {
            ...obj,
            x: snapToGridValue(obj.x + dx),
            y: snapToGridValue(obj.y + dy)
          }
        }
        return obj
      })
      setObjects(newObjects)
      setDragStart(coords)
    }

    if (isResizing && selectedIds.length === 1 && resizeHandle) {
      const obj = objects.find(o => o.id === selectedIds[0])
      if (obj && !obj.locked) {
        let newWidth = obj.width
        let newHeight = obj.height
        let newX = obj.x
        let newY = obj.y

        if (resizeHandle.includes('e')) newWidth = Math.max(24, coords.x - obj.x)
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(24, obj.x + obj.width - coords.x)
          newX = coords.x
        }
        if (resizeHandle.includes('s')) newHeight = Math.max(24, coords.y - obj.y)
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(24, obj.y + obj.height - coords.y)
          newY = coords.y
        }

        updateObject(obj.id, {
          width: snapToGridValue(newWidth),
          height: snapToGridValue(newHeight),
          x: snapToGridValue(newX),
          y: snapToGridValue(newY)
        })
      }
    }
  }

  const handleCanvasMouseUp = () => {
    if (isDragging || isResizing) {
      saveToHistory(objects)
    }
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
    setIsPanning(false)
    setIsRotating(false)
  }

  // =============================================================================
  // DRAG FROM LIBRARY
  // =============================================================================

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (data) {
      const item = JSON.parse(data)
      const coords = getCanvasCoordinates(e)
      const newObject = {
        id: `${item.type}-${Date.now()}`,
        type: item.type,
        name: item.name,
        x: snapToGridValue(coords.x - item.width / 2),
        y: snapToGridValue(coords.y - item.height / 2),
        width: item.width,
        height: item.height,
        rotation: 0,
        color: item.color,
        seats: item.seats || 0,
        locked: false,
        visible: true,
        label: '',
        tableNumber: '',
      }
      const newObjects = [...objects, newObject]
      setObjects(newObjects)
      saveToHistory(newObjects)
      setSelectedIds([newObject.id])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

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
        if (e.shiftKey) redo()
        else undo()
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedIds(objects.map(o => o.id))
      }
      if (e.key === 'Escape') {
        setSelectedIds([])
        setTool('select')
      }
      if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(200, z + 10))
      }
      if (e.key === '-') {
        setZoom(z => Math.max(25, z - 10))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [objects, selectedIds, history, historyIndex])

  // =============================================================================
  // SAVE LAYOUT
  // =============================================================================

  const saveLayout = async () => {
    if (!organizer?.id) return

    setSaving(true)
    try {
      const layoutData = {
        objects,
        gridSize,
        showGrid,
      }

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
        const { data, error } = await supabase
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
      alert('Failed to save layout')
    } finally {
      setSaving(false)
    }
  }

  // =============================================================================
  // RENDER OBJECT ON CANVAS
  // =============================================================================

  const renderObject = (obj) => {
    const isSelected = selectedIds.includes(obj.id)
    if (!obj.visible) return null

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation}, ${obj.width/2}, ${obj.height/2})`}
        style={{ cursor: obj.locked ? 'not-allowed' : 'move' }}
      >
        {/* Main shape */}
        {obj.type === 'round-table' || obj.type === 'cocktail' ? (
          <ellipse
            cx={obj.width / 2}
            cy={obj.height / 2}
            rx={obj.width / 2 - 2}
            ry={obj.height / 2 - 2}
            fill={obj.color}
            stroke={isSelected ? '#2969FF' : 'rgba(0,0,0,0.2)'}
            strokeWidth={isSelected ? 3 : 1}
          />
        ) : (
          <rect
            width={obj.width}
            height={obj.height}
            rx={obj.type === 'stage' ? 4 : obj.type === 'dance-floor' ? 0 : 8}
            fill={obj.color}
            stroke={isSelected ? '#2969FF' : 'rgba(0,0,0,0.2)'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )}

        {/* Chairs around round tables */}
        {obj.type === 'round-table' && obj.seats > 0 && (
          <>
            {Array.from({ length: obj.seats }).map((_, i) => {
              const angle = (i / obj.seats) * Math.PI * 2 - Math.PI / 2
              const chairRadius = Math.max(obj.width, obj.height) / 2 + 14
              const cx = obj.width / 2 + Math.cos(angle) * chairRadius
              const cy = obj.height / 2 + Math.sin(angle) * chairRadius
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={10}
                  fill={obj.color}
                  opacity={0.7}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                />
              )
            })}
          </>
        )}

        {/* Dance floor pattern */}
        {obj.type === 'dance-floor' && (
          <g>
            {Array.from({ length: Math.floor(obj.width / 48) }).map((_, i) =>
              Array.from({ length: Math.floor(obj.height / 48) }).map((_, j) => (
                <rect
                  key={`${i}-${j}`}
                  x={i * 48 + 2}
                  y={j * 48 + 2}
                  width={44}
                  height={44}
                  fill={(i + j) % 2 === 0 ? '#2a2a4a' : '#1a1a2e'}
                  rx={2}
                />
              ))
            )}
          </g>
        )}

        {/* Table number label */}
        {(obj.tableNumber || obj.label) && (
          <text
            x={obj.width / 2}
            y={obj.height / 2 + 5}
            textAnchor="middle"
            fill="white"
            fontSize="14"
            fontWeight="bold"
          >
            {obj.tableNumber || obj.label}
          </text>
        )}

        {/* VIP badge */}
        {obj.type === 'round-table' && obj.label?.toLowerCase().includes('vip') && (
          <g transform={`translate(${obj.width - 20}, -8)`}>
            <rect x={0} y={0} width={40} height={20} rx={4} fill="#E91E63" />
            <text x={20} y={14} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">VIP</text>
          </g>
        )}

        {/* Selection handles */}
        {isSelected && !obj.locked && (
          <>
            {/* Corner resize handles */}
            {['nw', 'ne', 'sw', 'se'].map(handle => {
              const x = handle.includes('w') ? -6 : obj.width - 6
              const y = handle.includes('n') ? -6 : obj.height - 6
              return (
                <rect
                  key={handle}
                  x={x}
                  y={y}
                  width={12}
                  height={12}
                  fill="white"
                  stroke="#2969FF"
                  strokeWidth={2}
                  rx={2}
                  style={{ cursor: `${handle}-resize` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsResizing(true)
                    setResizeHandle(handle)
                  }}
                />
              )
            })}
            {/* Edge resize handles */}
            {['n', 's', 'e', 'w'].map(handle => {
              const x = handle === 'w' ? -6 : handle === 'e' ? obj.width - 6 : obj.width / 2 - 6
              const y = handle === 'n' ? -6 : handle === 's' ? obj.height - 6 : obj.height / 2 - 6
              return (
                <rect
                  key={handle}
                  x={x}
                  y={y}
                  width={12}
                  height={12}
                  fill="white"
                  stroke="#2969FF"
                  strokeWidth={2}
                  rx={2}
                  style={{ cursor: `${handle === 'n' || handle === 's' ? 'ns' : 'ew'}-resize` }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsResizing(true)
                    setResizeHandle(handle)
                  }}
                />
              )
            })}
            {/* Rotation handle */}
            <circle
              cx={obj.width / 2}
              cy={-20}
              r={8}
              fill="#2969FF"
              stroke="white"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setIsRotating(true)
              }}
            />
            <line
              x1={obj.width / 2}
              y1={0}
              x2={obj.width / 2}
              y2={-12}
              stroke="#2969FF"
              strokeWidth={2}
            />
          </>
        )}
      </g>
    )
  }

  // =============================================================================
  // RENDER
  // =============================================================================

  const selectedObject = selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null
  const filteredItems = OBJECT_CATEGORIES.find(c => c.id === activeCategory)?.items.filter(
    item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="h-screen flex flex-col bg-[#1e1e2e] text-white overflow-hidden">
      {/* ===== TOP TOOLBAR ===== */}
      <div className="h-14 bg-[#2d2d3d] border-b border-[#3d3d4d] flex items-center px-2 gap-1">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 border-r border-[#3d3d4d] mr-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Menu Bar */}
        {['File', 'Edit', 'Tools', 'Arrange', 'View', 'Help'].map(menu => (
          <DropdownMenu key={menu}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 px-3">
                {menu}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#2d2d3d] border-[#3d3d4d] text-white">
              {menu === 'File' && (
                <>
                  <DropdownMenuItem onClick={saveLayout}>
                    <Save className="w-4 h-4 mr-2" /> Save <span className="ml-auto text-xs text-white/50">⌘S</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" /> Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" /> Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3d3d4d]" />
                  <DropdownMenuItem onClick={() => navigate(`/organizer/venues/${venueId}/layouts`)}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back to Layouts
                  </DropdownMenuItem>
                </>
              )}
              {menu === 'Edit' && (
                <>
                  <DropdownMenuItem onClick={undo} disabled={historyIndex <= 0}>
                    <Undo className="w-4 h-4 mr-2" /> Undo <span className="ml-auto text-xs text-white/50">⌘Z</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={redo} disabled={historyIndex >= history.length - 1}>
                    <Redo className="w-4 h-4 mr-2" /> Redo <span className="ml-auto text-xs text-white/50">⌘⇧Z</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3d3d4d]" />
                  <DropdownMenuItem onClick={duplicateSelected} disabled={selectedIds.length === 0}>
                    <Copy className="w-4 h-4 mr-2" /> Duplicate <span className="ml-auto text-xs text-white/50">⌘D</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={deleteSelected} disabled={selectedIds.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete <span className="ml-auto text-xs text-white/50">⌫</span>
                  </DropdownMenuItem>
                </>
              )}
              {menu === 'View' && (
                <>
                  <DropdownMenuItem onClick={() => setShowGrid(!showGrid)}>
                    <Grid className="w-4 h-4 mr-2" /> {showGrid ? 'Hide Grid' : 'Show Grid'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSnapToGrid(!snapToGrid)}>
                    {snapToGrid ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                    Snap to Grid: {snapToGrid ? 'On' : 'Off'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3d3d4d]" />
                  <DropdownMenuItem onClick={() => setZoom(100)}>
                    <Maximize2 className="w-4 h-4 mr-2" /> Reset Zoom (100%)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setZoom(z => Math.min(200, z + 25))}>
                    <ZoomIn className="w-4 h-4 mr-2" /> Zoom In
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setZoom(z => Math.max(25, z - 25))}>
                    <ZoomOut className="w-4 h-4 mr-2" /> Zoom Out
                  </DropdownMenuItem>
                </>
              )}
              {menu === 'Tools' && (
                <>
                  <DropdownMenuItem onClick={() => setTool('select')}>
                    <MousePointer className="w-4 h-4 mr-2" /> Select Tool
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTool('pan')}>
                    <Move className="w-4 h-4 mr-2" /> Pan Tool
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3d3d4d]" />
                  <DropdownMenuItem onClick={() => setTool('draw-section')}>
                    <Square className="w-4 h-4 mr-2" /> Draw Section
                  </DropdownMenuItem>
                </>
              )}
              {menu === 'Arrange' && (
                <>
                  <DropdownMenuItem>Bring to Front</DropdownMenuItem>
                  <DropdownMenuItem>Send to Back</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3d3d4d]" />
                  <DropdownMenuItem>Align Left</DropdownMenuItem>
                  <DropdownMenuItem>Align Center</DropdownMenuItem>
                  <DropdownMenuItem>Align Right</DropdownMenuItem>
                </>
              )}
              {menu === 'Help' && (
                <>
                  <DropdownMenuItem>
                    <HelpCircle className="w-4 h-4 mr-2" /> Keyboard Shortcuts
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Tutorial
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}

        <div className="flex-1" />

        {/* Layout Name */}
        <Input
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          className="w-48 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
        />

        <div className="flex-1" />

        {/* Right side tools */}
        <div className="flex items-center gap-1 border-l border-[#3d3d4d] pl-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Switch to {viewMode === '2d' ? '3D' : '2D'} View</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            size="sm"
            onClick={saveLayout}
            disabled={saving}
            className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-[#3d3d4d] text-white hover:bg-white/10">
                Share <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#2d2d3d] border-[#3d3d4d] text-white">
              <DropdownMenuItem>Copy Link</DropdownMenuItem>
              <DropdownMenuItem>Email</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-[#2969FF] flex items-center justify-center ml-2">
            {organizer?.business_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      {/* ===== SECONDARY TOOLBAR ===== */}
      <div className="h-10 bg-[#252535] border-b border-[#3d3d4d] flex items-center px-2 gap-1">
        {/* Drawing tools */}
        <div className="flex items-center gap-0.5 border-r border-[#3d3d4d] pr-2 mr-2">
          <TooltipProvider>
            {[
              { tool: 'select', icon: MousePointer, label: 'Select (V)' },
              { tool: 'pan', icon: Move, label: 'Pan (H)' },
            ].map(({ tool: t, icon: Icon, label }) => (
              <Tooltip key={t}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-8 h-8 ${tool === t ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    onClick={() => setTool(t)}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Shape/drawing tools */}
        <div className="flex items-center gap-0.5 border-r border-[#3d3d4d] pr-2 mr-2">
          <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10">
            <Square className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10">
            <Circle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10">
            <Type className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10">
            <Image className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(z => Math.max(25, z - 10))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-white/70 w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(z => Math.min(200, z + 10))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border-l border-[#3d3d4d] pl-2 ml-2">
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs ${viewMode === '2d' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            onClick={() => setViewMode('2d')}
          >
            2D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs ${viewMode === '3d' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            onClick={() => setViewMode('3d')}
          >
            3D
          </Button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== LEFT PANEL - OBJECT LIBRARY ===== */}
        <div className={`${leftPanelOpen ? 'w-64' : 'w-12'} bg-[#252535] border-r border-[#3d3d4d] flex flex-col transition-all duration-200`}>
          {leftPanelOpen ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-[#3d3d4d]">
                <button className="flex-1 py-2 text-xs font-medium text-white border-b-2 border-[#2969FF]">
                  Objects
                </button>
                <button className="flex-1 py-2 text-xs font-medium text-white/60 hover:text-white">
                  Templates
                </button>
                <button
                  className="p-2 text-white/60 hover:text-white"
                  onClick={() => setLeftPanelOpen(false)}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="flex-1 overflow-y-auto">
                {OBJECT_CATEGORIES.map(category => (
                  <div key={category.id} className="border-b border-[#3d3d4d]">
                    <button
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                        activeCategory === category.id ? 'bg-[#2969FF]/20 text-white' : 'text-white/70 hover:bg-white/5'
                      }`}
                      onClick={() => setActiveCategory(activeCategory === category.id ? '' : category.id)}
                    >
                      <category.icon className="w-4 h-4" />
                      {category.name}
                      <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${activeCategory === category.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeCategory === category.id && (
                      <div className="grid grid-cols-2 gap-1 p-2 bg-[#1e1e2e]">
                        {category.items.map(item => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            onClick={() => addObject(item)}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#252535] hover:bg-[#3d3d4d] cursor-grab border border-transparent hover:border-[#2969FF]/50 transition-all"
                          >
                            <div
                              className="w-10 h-10 rounded flex items-center justify-center"
                              style={{ backgroundColor: item.color + '40' }}
                            >
                              {item.type === 'round-table' || item.type === 'cocktail' ? (
                                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: item.color }} />
                              ) : (
                                <div className="w-8 h-4 rounded" style={{ backgroundColor: item.color }} />
                              )}
                            </div>
                            <span className="text-[10px] text-white/70 text-center leading-tight">
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Rooms section */}
              <div className="border-t border-[#3d3d4d] p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/60">Layouts</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-white/60 hover:text-white">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 p-2 rounded bg-[#2969FF]/20 text-white text-xs">
                    <span className="w-8 text-center font-mono">240</span>
                    <span>[8]</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <button
              className="w-full h-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => setLeftPanelOpen(true)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ===== CANVAS AREA ===== */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#1a1a2a] relative"
          style={{ cursor: tool === 'pan' ? 'grab' : 'default' }}
        >
          <div
            className="relative"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
              width: canvasWidth * (zoom / 100) + 200,
              height: canvasHeight * (zoom / 100) + 200,
              padding: 100
            }}
          >
            <svg
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                background: '#f8f9fa',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                borderRadius: 4
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {/* Grid */}
              {showGrid && (
                <defs>
                  <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                      fill="none"
                      stroke="#e0e0e0"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
              )}
              {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

              {/* Venue boundary */}
              <rect
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fill="none"
                stroke="#ccc"
                strokeWidth="2"
                strokeDasharray="8 4"
              />

              {/* Objects */}
              {objects.map(renderObject)}

              {/* Measurement line example */}
              {selectedIds.length === 1 && selectedObject && (
                <g>
                  <line
                    x1={selectedObject.x}
                    y1={selectedObject.y + selectedObject.height + 20}
                    x2={selectedObject.x + selectedObject.width}
                    y2={selectedObject.y + selectedObject.height + 20}
                    stroke="#2969FF"
                    strokeWidth={1}
                    markerStart="url(#arrow)"
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x={selectedObject.x + selectedObject.width / 2}
                    y={selectedObject.y + selectedObject.height + 35}
                    textAnchor="middle"
                    fill="#2969FF"
                    fontSize={12}
                  >
                    {(selectedObject.width / 12).toFixed(2)} ft
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* ===== RIGHT PANEL - PROPERTIES ===== */}
        <div className={`${rightPanelOpen ? 'w-64' : 'w-12'} bg-[#252535] border-l border-[#3d3d4d] flex flex-col transition-all duration-200`}>
          {rightPanelOpen ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-[#3d3d4d]">
                <span className="text-sm font-medium text-white">Edit Object</span>
                <button
                  className="p-1 text-white/60 hover:text-white"
                  onClick={() => setRightPanelOpen(false)}
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {selectedObject ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {/* Object type */}
                  <div>
                    <Label className="text-xs text-white/60">Type</Label>
                    <p className="text-sm text-white capitalize">{selectedObject.type.replace('-', ' ')}</p>
                  </div>

                  {/* Label */}
                  <div>
                    <Label className="text-xs text-white/60">Label</Label>
                    <Input
                      value={selectedObject.label || ''}
                      onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })}
                      placeholder="VIP"
                      className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm mt-1"
                    />
                  </div>

                  {/* Size & Color */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-white/60">Size</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedObject.width / 12)}
                        onChange={(e) => updateObject(selectedObject.id, { width: parseInt(e.target.value) * 12 })}
                        className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">Color</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="color"
                          value={selectedObject.color}
                          onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={selectedObject.color}
                          onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                          className="flex-1 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table specific */}
                  {selectedObject.type.includes('table') && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-white/60">Table Number</Label>
                          <Input
                            value={selectedObject.tableNumber || ''}
                            onChange={(e) => updateObject(selectedObject.id, { tableNumber: e.target.value })}
                            className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/60">Seats</Label>
                          <Input
                            type="number"
                            value={selectedObject.seats || 0}
                            onChange={(e) => updateObject(selectedObject.id, { seats: parseInt(e.target.value) || 0 })}
                            className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-white/60">Standard Size</Label>
                        <Select
                          value={`${selectedObject.width}x${selectedObject.height}`}
                          onValueChange={(v) => {
                            const [w, h] = v.split('x').map(Number)
                            updateObject(selectedObject.id, { width: w, height: h })
                          }}
                        >
                          <SelectTrigger className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2d2d3d] border-[#3d3d4d] text-white">
                            <SelectItem value="60x60">5ft Round</SelectItem>
                            <SelectItem value="72x72">6ft Round</SelectItem>
                            <SelectItem value="84x84">7ft Round</SelectItem>
                            <SelectItem value="96x48">8ft Rectangle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Chair types */}
                  {selectedObject.type === 'chair' && (
                    <div>
                      <Label className="text-xs text-white/60 mb-2 block">Chair Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Banquet', 'Chiavari', 'Ghost'].map((style) => (
                          <button
                            key={style}
                            className={`p-2 rounded border text-xs ${
                              selectedObject.name?.includes(style)
                                ? 'border-[#2969FF] bg-[#2969FF]/20'
                                : 'border-[#3d3d4d] hover:border-white/30'
                            }`}
                          >
                            <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-white/20" />
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dimensions */}
                  <div>
                    <Label className="text-xs text-white/60 mb-2 block">Dimensions</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-white/40">Width</Label>
                        <Input
                          type="number"
                          value={(selectedObject.width / 12).toFixed(1)}
                          onChange={(e) => updateObject(selectedObject.id, { width: parseFloat(e.target.value) * 12 })}
                          className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">Height</Label>
                        <Input
                          type="number"
                          value={(selectedObject.height / 12).toFixed(1)}
                          onChange={(e) => updateObject(selectedObject.id, { height: parseFloat(e.target.value) * 12 })}
                          className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div>
                    <Label className="text-xs text-white/60">Rotation</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={selectedObject.rotation || 0}
                        onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })}
                        className="flex-1 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                      />
                      <span className="text-xs text-white/60">°</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-white/60 hover:text-white"
                        onClick={() => updateObject(selectedObject.id, { rotation: (selectedObject.rotation + 45) % 360 })}
                      >
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-2 pt-2 border-t border-[#3d3d4d]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[#3d3d4d] text-white hover:bg-white/10"
                      onClick={duplicateSelected}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                      onClick={deleteSelected}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                  <p className="text-sm text-white/40 text-center">
                    Select an object to edit its properties
                  </p>
                </div>
              )}

              {/* Canvas settings */}
              <div className="border-t border-[#3d3d4d] p-3 space-y-3">
                <div>
                  <Label className="text-xs text-white/60">Canvas Size (ft)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input
                      type="number"
                      value={canvasWidth / 12}
                      onChange={(e) => setCanvasWidth(parseInt(e.target.value) * 12 || 1200)}
                      className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                    />
                    <Input
                      type="number"
                      value={canvasHeight / 12}
                      onChange={(e) => setCanvasHeight(parseInt(e.target.value) * 12 || 800)}
                      className="h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-white/60">Grid Size</Label>
                  <Select value={gridSize.toString()} onValueChange={(v) => setGridSize(parseInt(v))}>
                    <SelectTrigger className="w-20 h-7 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d2d3d] border-[#3d3d4d] text-white">
                      <SelectItem value="12">1 ft</SelectItem>
                      <SelectItem value="24">2 ft</SelectItem>
                      <SelectItem value="48">4 ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <button
              className="w-full h-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => setRightPanelOpen(true)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className="h-6 bg-[#2d2d3d] border-t border-[#3d3d4d] flex items-center px-3 text-xs text-white/50">
        <span>{objects.length} objects</span>
        <span className="mx-2">•</span>
        <span>{selectedIds.length} selected</span>
        <span className="mx-2">•</span>
        <span>{canvasWidth / 12} × {canvasHeight / 12} ft</span>
        <div className="flex-1" />
        {lastSaved && (
          <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}

export default VenueLayoutDesigner
