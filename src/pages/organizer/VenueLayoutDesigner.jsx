/**
 * Venue Layout Designer - Premium Edition
 * Mouse-based resize, rotate, and beautiful graphics
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Trash2, RotateCw, Plus, Minus, Undo, Grid,
  ChevronLeft, GripVertical, Check, Layers, Eye, EyeOff,
  Lock, Unlock, Maximize2, Copy, ZoomIn, ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'

// Premium SVG Icons for each item type
const ITEM_ICONS = {
  'chair': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="12" y="35" width="40" height="8" rx="2" fill="currentColor"/>
      <rect x="14" y="43" width="6" height="16" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="44" y="43" width="6" height="16" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="12" y="10" width="8" height="25" rx="2" fill="currentColor" opacity="0.9"/>
      <rect x="12" y="8" width="40" height="6" rx="2" fill="currentColor"/>
    </svg>
  ),
  'vip-chair': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="8" y="30" width="48" height="12" rx="3" fill="currentColor"/>
      <rect x="10" y="42" width="8" height="14" rx="2" fill="currentColor" opacity="0.8"/>
      <rect x="46" y="42" width="8" height="14" rx="2" fill="currentColor" opacity="0.8"/>
      <rect x="8" y="8" width="12" height="22" rx="3" fill="currentColor" opacity="0.9"/>
      <rect x="8" y="4" width="48" height="8" rx="3" fill="currentColor"/>
      <circle cx="32" cy="8" r="3" fill="#FFD700"/>
    </svg>
  ),
  'sofa': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="24" width="56" height="20" rx="4" fill="currentColor"/>
      <rect x="4" y="10" width="12" height="34" rx="4" fill="currentColor" opacity="0.9"/>
      <rect x="48" y="10" width="12" height="34" rx="4" fill="currentColor" opacity="0.9"/>
      <rect x="8" y="44" width="8" height="10" rx="2" fill="currentColor" opacity="0.7"/>
      <rect x="48" y="44" width="8" height="10" rx="2" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  'round-table': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <ellipse cx="32" cy="20" rx="28" ry="12" fill="currentColor"/>
      <ellipse cx="32" cy="20" rx="22" ry="8" fill="currentColor" opacity="0.7"/>
      <rect x="28" y="20" width="8" height="30" fill="currentColor" opacity="0.8"/>
      <ellipse cx="32" cy="52" rx="12" ry="4" fill="currentColor" opacity="0.6"/>
    </svg>
  ),
  'rect-table': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="12" width="56" height="24" rx="3" fill="currentColor"/>
      <rect x="8" y="36" width="6" height="18" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="50" y="36" width="6" height="18" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  'cocktail': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <circle cx="32" cy="16" r="14" fill="currentColor"/>
      <rect x="29" y="16" width="6" height="32" fill="currentColor" opacity="0.8"/>
      <ellipse cx="32" cy="52" rx="14" ry="5" fill="currentColor" opacity="0.6"/>
    </svg>
  ),
  'stage': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="2" y="28" width="60" height="24" rx="2" fill="currentColor"/>
      <rect x="2" y="24" width="60" height="8" rx="2" fill="currentColor" opacity="0.9"/>
      <rect x="6" y="52" width="8" height="8" fill="currentColor" opacity="0.6"/>
      <rect x="50" y="52" width="8" height="8" fill="currentColor" opacity="0.6"/>
      <circle cx="16" cy="20" r="4" fill="#FFD700" opacity="0.8"/>
      <circle cx="32" cy="18" r="5" fill="#FFD700"/>
      <circle cx="48" cy="20" r="4" fill="#FFD700" opacity="0.8"/>
    </svg>
  ),
  'dj-booth': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="20" width="56" height="32" rx="4" fill="currentColor"/>
      <circle cx="20" cy="36" r="10" fill="currentColor" opacity="0.6"/>
      <circle cx="44" cy="36" r="10" fill="currentColor" opacity="0.6"/>
      <circle cx="20" cy="36" r="4" fill="#E91E63"/>
      <circle cx="44" cy="36" r="4" fill="#E91E63"/>
      <rect x="28" y="24" width="8" height="16" rx="2" fill="#4CAF50" opacity="0.8"/>
      <rect x="16" y="12" width="4" height="8" fill="currentColor" opacity="0.7"/>
      <rect x="44" y="12" width="4" height="8" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  'screen': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="2" y="8" width="60" height="36" rx="3" fill="currentColor"/>
      <rect x="6" y="12" width="52" height="28" rx="2" fill="#1a1a2e"/>
      <rect x="26" y="44" width="12" height="6" fill="currentColor" opacity="0.8"/>
      <rect x="18" y="50" width="28" height="4" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="10" y="16" width="44" height="2" fill="#4CAF50" opacity="0.5"/>
      <rect x="10" y="22" width="30" height="2" fill="#2196F3" opacity="0.5"/>
    </svg>
  ),
  'bar': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="2" y="24" width="60" height="28" rx="3" fill="currentColor"/>
      <rect x="2" y="20" width="60" height="8" rx="2" fill="currentColor" opacity="0.9"/>
      <rect x="8" y="28" width="4" height="20" fill="currentColor" opacity="0.5"/>
      <rect x="52" y="28" width="4" height="20" fill="currentColor" opacity="0.5"/>
      <circle cx="20" cy="16" r="4" fill="#4CAF50" opacity="0.8"/>
      <circle cx="32" cy="14" r="5" fill="#FF9800" opacity="0.8"/>
      <circle cx="44" cy="16" r="4" fill="#E91E63" opacity="0.8"/>
    </svg>
  ),
  'checkin': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="24" width="56" height="28" rx="3" fill="currentColor"/>
      <rect x="8" y="16" width="20" height="12" rx="2" fill="currentColor" opacity="0.8"/>
      <rect x="12" y="20" width="12" height="6" fill="#4CAF50" opacity="0.6"/>
      <rect x="36" y="28" width="16" height="10" rx="1" fill="currentColor" opacity="0.5"/>
      <circle cx="44" cy="40" r="6" fill="#2196F3" opacity="0.6"/>
      <path d="M41 40 L43 42 L47 38" stroke="white" strokeWidth="2" fill="none"/>
    </svg>
  ),
  'entrance': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="8" y="4" width="48" height="56" rx="4" fill="currentColor" opacity="0.3"/>
      <rect x="12" y="8" width="40" height="48" rx="2" fill="currentColor"/>
      <rect x="16" y="12" width="32" height="40" fill="currentColor" opacity="0.4"/>
      <circle cx="42" cy="32" r="4" fill="#FFD700"/>
      <path d="M26 32 L34 26 L34 38 Z" fill="white" opacity="0.8"/>
    </svg>
  ),
  'exit': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="8" y="4" width="48" height="56" rx="4" fill="currentColor" opacity="0.3"/>
      <rect x="12" y="8" width="40" height="48" rx="2" fill="currentColor"/>
      <rect x="16" y="12" width="32" height="40" fill="currentColor" opacity="0.4"/>
      <circle cx="22" cy="32" r="4" fill="#FFD700"/>
      <path d="M38 32 L30 26 L30 38 Z" fill="white" opacity="0.8"/>
      <text x="32" y="56" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">EXIT</text>
    </svg>
  ),
  'dance-floor': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="4" width="56" height="56" rx="4" fill="currentColor" opacity="0.3"/>
      <rect x="4" y="4" width="14" height="14" fill="currentColor" opacity="0.6"/>
      <rect x="25" y="4" width="14" height="14" fill="currentColor" opacity="0.8"/>
      <rect x="46" y="4" width="14" height="14" fill="currentColor" opacity="0.6"/>
      <rect x="4" y="25" width="14" height="14" fill="currentColor" opacity="0.8"/>
      <rect x="25" y="25" width="14" height="14" fill="currentColor"/>
      <rect x="46" y="25" width="14" height="14" fill="currentColor" opacity="0.8"/>
      <rect x="4" y="46" width="14" height="14" fill="currentColor" opacity="0.6"/>
      <rect x="25" y="46" width="14" height="14" fill="currentColor" opacity="0.8"/>
      <rect x="46" y="46" width="14" height="14" fill="currentColor" opacity="0.6"/>
      <circle cx="32" cy="32" r="8" fill="#E91E63" opacity="0.6"/>
    </svg>
  ),
  'vip-area': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="4" width="56" height="56" rx="6" fill="currentColor" opacity="0.2"/>
      <rect x="8" y="8" width="48" height="48" rx="4" fill="currentColor" opacity="0.4"/>
      <path d="M32 16 L36 28 L48 28 L38 36 L42 48 L32 40 L22 48 L26 36 L16 28 L28 28 Z" fill="#FFD700"/>
      <text x="32" y="58" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="bold">VIP</text>
    </svg>
  ),
  'standing': (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <rect x="4" y="4" width="56" height="56" rx="4" fill="currentColor" opacity="0.3"/>
      <circle cx="20" cy="20" r="6" fill="currentColor"/>
      <rect x="17" y="26" width="6" height="14" fill="currentColor" opacity="0.8"/>
      <circle cx="44" cy="24" r="6" fill="currentColor"/>
      <rect x="41" y="30" width="6" height="14" fill="currentColor" opacity="0.8"/>
      <circle cx="32" cy="36" r="6" fill="currentColor"/>
      <rect x="29" y="42" width="6" height="14" fill="currentColor" opacity="0.8"/>
    </svg>
  ),
}

// Item library with premium colors
const ITEMS_LIBRARY = [
  { id: 'chair', name: 'Chair', color: '#6D4C41', category: 'seating', width: 50, height: 50 },
  { id: 'vip-chair', name: 'VIP Chair', color: '#FFB300', category: 'seating', width: 60, height: 60 },
  { id: 'sofa', name: 'Sofa', color: '#7B1FA2', category: 'seating', width: 120, height: 60 },
  { id: 'round-table', name: 'Round Table', color: '#5D4037', category: 'tables', width: 100, height: 100 },
  { id: 'rect-table', name: 'Long Table', color: '#4E342E', category: 'tables', width: 140, height: 70 },
  { id: 'cocktail', name: 'Cocktail Table', color: '#6D4C41', category: 'tables', width: 60, height: 60 },
  { id: 'stage', name: 'Stage', color: '#37474F', category: 'stage', width: 250, height: 120 },
  { id: 'dj-booth', name: 'DJ Booth', color: '#880E4F', category: 'stage', width: 140, height: 100 },
  { id: 'screen', name: 'LED Screen', color: '#263238', category: 'stage', width: 180, height: 40 },
  { id: 'bar', name: 'Bar Counter', color: '#4E342E', category: 'services', width: 180, height: 60 },
  { id: 'checkin', name: 'Check-in', color: '#1565C0', category: 'services', width: 140, height: 60 },
  { id: 'entrance', name: 'Entrance', color: '#2E7D32', category: 'services', width: 80, height: 100 },
  { id: 'exit', name: 'Exit', color: '#C62828', category: 'services', width: 80, height: 100 },
  { id: 'dance-floor', name: 'Dance Floor', color: '#AD1457', category: 'areas', width: 200, height: 200 },
  { id: 'vip-area', name: 'VIP Area', color: '#FF8F00', category: 'areas', width: 180, height: 180 },
  { id: 'standing', name: 'Standing Area', color: '#388E3C', category: 'areas', width: 160, height: 120 },
]

const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '✨' },
  { id: 'seating', name: 'Seats', emoji: '🪑' },
  { id: 'tables', name: 'Tables', emoji: '🍽️' },
  { id: 'stage', name: 'Stage', emoji: '🎤' },
  { id: 'services', name: 'Services', emoji: '🚪' },
  { id: 'areas', name: 'Areas', emoji: '📍' },
]

// Handle types for resize/rotate
const HANDLE_SIZE = 12
const ROTATION_HANDLE_OFFSET = 30

export function VenueLayoutDesigner() {
  const { venueId, layoutId } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const canvasRef = useRef(null)
  
  const [layoutName, setLayoutName] = useState('My Venue Layout')
  const [placedItems, setPlacedItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [draggedLibraryItem, setDraggedLibraryItem] = useState(null)
  const [isOverCanvas, setIsOverCanvas] = useState(false)
  
  // Interaction states
  const [interactionMode, setInteractionMode] = useState(null) // 'move', 'resize-nw', 'resize-ne', 'resize-sw', 'resize-se', 'rotate'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [itemStart, setItemStart] = useState({ x: 0, y: 0, width: 0, height: 0, rotation: 0 })
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [history, setHistory] = useState([])
  
  const CANVAS_WIDTH = 1000
  const CANVAS_HEIGHT = 700
  const GRID_SIZE = 25

  const filteredItems = selectedCategory === 'all' 
    ? ITEMS_LIBRARY 
    : ITEMS_LIBRARY.filter(item => item.category === selectedCategory)

  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-30), JSON.stringify(placedItems)])
  }, [placedItems])

  const undo = () => {
    if (history.length > 0) {
      const lastState = history[history.length - 1]
      setPlacedItems(JSON.parse(lastState))
      setHistory(prev => prev.slice(0, -1))
      setSelectedItem(null)
    }
  }

  const snapToGrid = (value) => showGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : value

  // Mouse down on canvas item
  const handleItemMouseDown = (e, item, mode = 'move') => {
    e.stopPropagation()
    e.preventDefault()
    
    setSelectedItem(item)
    setInteractionMode(mode)
    setDragStart({ x: e.clientX, y: e.clientY })
    setItemStart({ 
      x: item.x, 
      y: item.y, 
      width: item.width, 
      height: item.height,
      rotation: item.rotation || 0
    })
    saveHistory()
  }

  // Global mouse move
  const handleMouseMove = useCallback((e) => {
    if (!interactionMode || !selectedItem) return
    
    const dx = (e.clientX - dragStart.x) / zoom
    const dy = (e.clientY - dragStart.y) / zoom
    
    let updates = {}
    
    if (interactionMode === 'move') {
      updates = {
        x: Math.max(0, Math.min(CANVAS_WIDTH - selectedItem.width, snapToGrid(itemStart.x + dx))),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - selectedItem.height, snapToGrid(itemStart.y + dy)))
      }
    } else if (interactionMode === 'rotate') {
      // Calculate rotation based on mouse position relative to item center
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const centerX = rect.left + (selectedItem.x + selectedItem.width / 2) * zoom
        const centerY = rect.top + (selectedItem.y + selectedItem.height / 2) * zoom
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) + 90
        updates = { rotation: Math.round(angle / 15) * 15 } // Snap to 15 degree increments
      }
    } else if (interactionMode.startsWith('resize')) {
      const minSize = 40
      const maxSize = 500
      
      let newWidth = itemStart.width
      let newHeight = itemStart.height
      let newX = itemStart.x
      let newY = itemStart.y
      
      // Calculate new dimensions based on which handle is being dragged
      if (interactionMode.includes('e')) {
        newWidth = Math.max(minSize, Math.min(maxSize, itemStart.width + dx))
      }
      if (interactionMode.includes('w')) {
        const widthChange = Math.max(minSize, Math.min(maxSize, itemStart.width - dx)) - itemStart.width
        newWidth = itemStart.width + widthChange
        newX = itemStart.x - widthChange
      }
      if (interactionMode.includes('s')) {
        newHeight = Math.max(minSize, Math.min(maxSize, itemStart.height + dy))
      }
      if (interactionMode.includes('n')) {
        const heightChange = Math.max(minSize, Math.min(maxSize, itemStart.height - dy)) - itemStart.height
        newHeight = itemStart.height + heightChange
        newY = itemStart.y - heightChange
      }
      
      updates = {
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        width: snapToGrid(newWidth),
        height: snapToGrid(newHeight)
      }
    }
    
    setPlacedItems(prev => prev.map(item => 
      item.id === selectedItem.id ? { ...item, ...updates } : item
    ))
    setSelectedItem(prev => prev ? { ...prev, ...updates } : null)
  }, [interactionMode, selectedItem, dragStart, itemStart, zoom, showGrid])

  const handleMouseUp = useCallback(() => {
    setInteractionMode(null)
  }, [])

  // Register global mouse events
  useEffect(() => {
    if (interactionMode) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [interactionMode, handleMouseMove, handleMouseUp])

  // Drop from library
  const handleCanvasDrop = (e) => {
    e.preventDefault()
    setIsOverCanvas(false)
    
    if (!draggedLibraryItem) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom - draggedLibraryItem.width / 2
    const y = (e.clientY - rect.top) / zoom - draggedLibraryItem.height / 2

    saveHistory()
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: draggedLibraryItem.id,
      name: draggedLibraryItem.name,
      x: snapToGrid(Math.max(0, Math.min(CANVAS_WIDTH - draggedLibraryItem.width, x))),
      y: snapToGrid(Math.max(0, Math.min(CANVAS_HEIGHT - draggedLibraryItem.height, y))),
      width: draggedLibraryItem.width,
      height: draggedLibraryItem.height,
      color: draggedLibraryItem.color,
      rotation: 0,
    }
    setPlacedItems(prev => [...prev, newItem])
    setSelectedItem(newItem)
    setDraggedLibraryItem(null)
  }

  const deleteSelected = () => {
    if (selectedItem) {
      saveHistory()
      setPlacedItems(prev => prev.filter(item => item.id !== selectedItem.id))
      setSelectedItem(null)
    }
  }

  const duplicateSelected = () => {
    if (selectedItem) {
      saveHistory()
      const newItem = {
        ...selectedItem,
        id: `item-${Date.now()}`,
        x: Math.min(selectedItem.x + 40, CANVAS_WIDTH - selectedItem.width),
        y: Math.min(selectedItem.y + 40, CANVAS_HEIGHT - selectedItem.height),
      }
      setPlacedItems(prev => [...prev, newItem])
      setSelectedItem(newItem)
    }
  }

  const saveLayout = async () => {
    if (!organizer?.id) {
      alert('Please log in to save')
      return
    }
    setSaving(true)
    try {
      const data = {
        venue_id: venueId || null,
        name: layoutName,
        total_width: CANVAS_WIDTH,
        total_height: CANVAS_HEIGHT,
        is_active: true,
        metadata: { items: placedItems, version: 2 }
      }
      if (layoutId && !['create', 'layouts'].includes(layoutId)) {
        await supabase.from('venue_layouts').update(data).eq('id', layoutId)
      } else {
        await supabase.from('venue_layouts').insert(data)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (document.activeElement.tagName === 'INPUT') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem) { e.preventDefault(); deleteSelected() }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedItem) { e.preventDefault(); duplicateSelected() }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo() }
      if (e.key === 'Escape') setSelectedItem(null)
      if (e.key === 'g') setShowGrid(p => !p)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedItem, history])

  // Render item with handles
  const renderItem = (item) => {
    const isSelected = selectedItem?.id === item.id
    const Icon = ITEM_ICONS[item.type]
    
    return (
      <div
        key={item.id}
        className={`absolute transition-shadow duration-150 ${
          interactionMode && isSelected ? '' : 'hover:shadow-2xl'
        }`}
        style={{
          left: item.x * zoom,
          top: item.y * zoom,
          width: item.width * zoom,
          height: item.height * zoom,
          transform: `rotate(${item.rotation || 0}deg)`,
          transformOrigin: 'center center',
          cursor: interactionMode === 'move' ? 'grabbing' : 'grab',
        }}
      >
        {/* Item body */}
        <div
          className={`w-full h-full rounded-xl flex items-center justify-center overflow-hidden
                      ${isSelected ? 'ring-4 ring-white shadow-2xl' : 'shadow-lg'}`}
          style={{ 
            backgroundColor: item.color,
            boxShadow: isSelected ? `0 0 30px ${item.color}80` : undefined
          }}
          onMouseDown={(e) => handleItemMouseDown(e, item, 'move')}
          onClick={(e) => { e.stopPropagation(); setSelectedItem(item) }}
        >
          <div 
            className="text-white/90 pointer-events-none"
            style={{ 
              width: Math.min(item.width * zoom * 0.6, 80),
              height: Math.min(item.height * zoom * 0.6, 80)
            }}
          >
            {Icon}
          </div>
        </div>
        
        {/* Selection UI */}
        {isSelected && !interactionMode && (
          <>
            {/* Quick action buttons */}
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex gap-1 bg-black/80 rounded-lg p-1 shadow-xl backdrop-blur-sm">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateSelected() }}
                className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSelected() }}
                className="p-1.5 hover:bg-red-500/50 rounded text-red-400 hover:text-red-300 transition-colors"
                title="Delete (Del)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Resize handles */}
            {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(pos => {
              const style = {
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: '#fff',
                border: '2px solid #2196F3',
                borderRadius: pos.length === 2 ? '50%' : '2px',
                cursor: `${pos}-resize`,
                zIndex: 10,
              }
              
              if (pos.includes('n')) style.top = -HANDLE_SIZE / 2
              if (pos.includes('s')) style.bottom = -HANDLE_SIZE / 2
              if (pos.includes('w')) style.left = -HANDLE_SIZE / 2
              if (pos.includes('e')) style.right = -HANDLE_SIZE / 2
              if (pos === 'n' || pos === 's') { style.left = '50%'; style.marginLeft = -HANDLE_SIZE / 2 }
              if (pos === 'e' || pos === 'w') { style.top = '50%'; style.marginTop = -HANDLE_SIZE / 2 }
              
              return (
                <div
                  key={pos}
                  style={style}
                  onMouseDown={(e) => handleItemMouseDown(e, item, `resize-${pos}`)}
                />
              )
            })}
            
            {/* Rotation handle */}
            <div
              className="absolute flex flex-col items-center"
              style={{ 
                top: -ROTATION_HANDLE_OFFSET - HANDLE_SIZE,
                left: '50%',
                marginLeft: -HANDLE_SIZE / 2
              }}
            >
              <div 
                className="w-3 h-3 bg-green-500 rounded-full border-2 border-white cursor-grab shadow-lg"
                onMouseDown={(e) => handleItemMouseDown(e, item, 'rotate')}
              />
              <div className="w-0.5 h-5 bg-green-500" />
            </div>
            
            {/* Item name tooltip */}
            <div 
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white 
                         text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium shadow-lg"
            >
              {item.name} • {Math.round(item.rotation || 0)}°
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      {/* Toolbar */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/organizer/venues')} className="text-white/70 hover:text-white hover:bg-white/10">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="h-6 w-px bg-white/20" />
          <Input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="w-72 bg-white/10 border-white/20 text-white font-semibold placeholder:text-white/40"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length} className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30">
            <Undo className="w-4 h-4" />
          </Button>
          
          <Button variant={showGrid ? 'default' : 'ghost'} size="sm" onClick={() => setShowGrid(!showGrid)}
            className={showGrid ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}>
            <Grid className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="text-white/70 hover:text-white h-7 w-7 p-0">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-14 text-center text-white/80">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="text-white/70 hover:text-white h-7 w-7 p-0">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {selectedItem && (
            <>
              <div className="h-6 w-px bg-white/20" />
              <Button variant="ghost" size="sm" onClick={duplicateSelected} className="text-white/70 hover:text-white hover:bg-white/10">
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={deleteSelected} className="text-red-400 hover:text-red-300 hover:bg-red-500/20">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}

          <div className="h-6 w-px bg-white/20" />
          
          <Button onClick={saveLayout} disabled={saving}
            className={`min-w-[130px] ${saved ? 'bg-green-500 hover:bg-green-600' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700'} shadow-lg`}>
            {saved ? <><Check className="w-4 h-4 mr-2" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save</>}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Library */}
        <div className="w-72 bg-black/20 backdrop-blur-xl border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" /> Items
            </h3>
            <p className="text-sm text-white/50 mt-1">Drag onto canvas</p>
          </div>

          <div className="p-3 border-b border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-all ${
                    selectedCategory === cat.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedLibraryItem(item)}
                  onDragEnd={() => setDraggedLibraryItem(null)}
                  className="group flex flex-col items-center p-4 bg-white/5 rounded-2xl cursor-grab 
                            active:cursor-grabbing hover:bg-white/10 transition-all duration-200
                            border border-transparent hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10
                            hover:scale-105 active:scale-95"
                >
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-2 shadow-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: item.color }}>
                    <div className="w-10 h-10 text-white/90">{ITEM_ICONS[item.id]}</div>
                  </div>
                  <span className="text-xs font-medium text-white/70 group-hover:text-white text-center">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Items:</span>
              <Badge className="bg-violet-600/80">{placedItems.length}</Badge>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
          <div
            ref={canvasRef}
            className={`relative rounded-2xl shadow-2xl transition-all duration-300 ${isOverCanvas ? 'ring-4 ring-violet-500 ring-offset-4 ring-offset-transparent' : ''}`}
            style={{
              width: CANVAS_WIDTH * zoom,
              height: CANVAS_HEIGHT * zoom,
              background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
              backgroundImage: showGrid ? `
                linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
              ` : 'none',
              backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            }}
            onDrop={handleCanvasDrop}
            onDragOver={(e) => { e.preventDefault(); setIsOverCanvas(true) }}
            onDragLeave={() => setIsOverCanvas(false)}
            onClick={() => setSelectedItem(null)}
          >
            {placedItems.map(renderItem)}
            
            {placedItems.length === 0 && !isOverCanvas && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-8xl mb-6 animate-bounce">🎨</div>
                  <p className="text-2xl font-bold text-white/40 mb-2">Drop items here</p>
                  <p className="text-white/30">Drag from the left panel</p>
                </div>
              </div>
            )}
            
            {isOverCanvas && draggedLibraryItem && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-violet-500/10 rounded-2xl backdrop-blur-sm">
                <div className="text-center animate-pulse">
                  <div className="text-6xl mb-4">✨</div>
                  <p className="text-xl font-bold text-violet-300">Release to place {draggedLibraryItem.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - contextual help */}
        <div className="w-64 bg-black/20 backdrop-blur-xl border-l border-white/10 p-4">
          {selectedItem ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white mb-1">Selected</h3>
                <p className="text-violet-400 font-medium text-lg">{selectedItem.name}</p>
              </div>
              
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex justify-between"><span>Position:</span><span className="text-white/80">{Math.round(selectedItem.x)}, {Math.round(selectedItem.y)}</span></div>
                <div className="flex justify-between"><span>Size:</span><span className="text-white/80">{Math.round(selectedItem.width)} × {Math.round(selectedItem.height)}</span></div>
                <div className="flex justify-between"><span>Rotation:</span><span className="text-white/80">{Math.round(selectedItem.rotation || 0)}°</span></div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2">
                <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Mouse Controls</p>
                <p className="text-sm text-white/60">• Drag center to <span className="text-white">move</span></p>
                <p className="text-sm text-white/60">• Drag corners to <span className="text-white">resize</span></p>
                <p className="text-sm text-white/60">• Drag green dot to <span className="text-white">rotate</span></p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-white">✨ Controls</h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="font-medium text-violet-400 mb-1">🖱️ Mouse</p>
                  <p className="text-white/50">Drag corners to resize</p>
                  <p className="text-white/50">Drag green dot to rotate</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="font-medium text-violet-400 mb-1">⌨️ Keyboard</p>
                  <p className="text-white/50"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Del</kbd> Delete</p>
                  <p className="text-white/50"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+D</kbd> Duplicate</p>
                  <p className="text-white/50"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+Z</kbd> Undo</p>
                  <p className="text-white/50"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">G</kbd> Grid</p>
                  <p className="text-white/50"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Esc</kbd> Deselect</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
