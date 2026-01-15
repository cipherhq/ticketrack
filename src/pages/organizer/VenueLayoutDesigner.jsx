/**
 * Venue Layout Designer - Premium Drag & Drop Interface
 * Polished, smooth, and delightful to use!
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Trash2, RotateCw, Plus, Minus, Undo, Grid,
  Square, Circle, Armchair, Table, Mic, Coffee, Users,
  Monitor, DoorOpen, Music, ClipboardCheck, Star, X,
  Move, ZoomIn, ZoomOut, Copy, ChevronLeft, GripVertical,
  Sparkles, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'

// Simple furniture/item library with icons and colors
const ITEMS_LIBRARY = [
  // Seating
  { id: 'chair', name: 'Chair', icon: Armchair, color: '#8B4513', category: 'seating', width: 40, height: 40 },
  { id: 'vip-chair', name: 'VIP Chair', icon: Star, color: '#FFD700', category: 'seating', width: 50, height: 50 },
  { id: 'sofa', name: 'Sofa', icon: Users, color: '#9C27B0', category: 'seating', width: 100, height: 50 },
  
  // Tables
  { id: 'round-table', name: 'Round Table', icon: Circle, color: '#654321', category: 'tables', width: 80, height: 80 },
  { id: 'rect-table', name: 'Long Table', icon: Square, color: '#654321', category: 'tables', width: 120, height: 60 },
  { id: 'cocktail', name: 'Cocktail Table', icon: Coffee, color: '#8B4513', category: 'tables', width: 50, height: 50 },
  
  // Stage & Entertainment
  { id: 'stage', name: 'Stage', icon: Mic, color: '#2C2C2C', category: 'stage', width: 200, height: 100 },
  { id: 'dj-booth', name: 'DJ Booth', icon: Music, color: '#9C27B0', category: 'stage', width: 120, height: 80 },
  { id: 'screen', name: 'LED Screen', icon: Monitor, color: '#1a1a2e', category: 'stage', width: 150, height: 30 },
  
  // Services
  { id: 'bar', name: 'Bar Counter', icon: Coffee, color: '#795548', category: 'services', width: 150, height: 50 },
  { id: 'checkin', name: 'Check-in Desk', icon: ClipboardCheck, color: '#2196F3', category: 'services', width: 120, height: 50 },
  { id: 'entrance', name: 'Entrance', icon: DoorOpen, color: '#4CAF50', category: 'services', width: 80, height: 30 },
  { id: 'exit', name: 'Exit', icon: DoorOpen, color: '#F44336', category: 'services', width: 80, height: 30 },
  
  // Areas (larger zones)
  { id: 'dance-floor', name: 'Dance Floor', icon: Sparkles, color: '#E91E63', category: 'areas', width: 200, height: 200 },
  { id: 'vip-area', name: 'VIP Area', icon: Star, color: '#FFD700', category: 'areas', width: 150, height: 150 },
  { id: 'standing', name: 'Standing Area', icon: Users, color: '#4CAF50', category: 'areas', width: 150, height: 100 },
]

const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🎯' },
  { id: 'seating', name: 'Seating', emoji: '🪑' },
  { id: 'tables', name: 'Tables', emoji: '🍽️' },
  { id: 'stage', name: 'Stage', emoji: '🎤' },
  { id: 'services', name: 'Services', emoji: '🚪' },
  { id: 'areas', name: 'Areas', emoji: '📍' },
]

export function VenueLayoutDesigner() {
  const { venueId, layoutId } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const canvasRef = useRef(null)
  const dragPreviewRef = useRef(null)
  
  // Layout state
  const [layoutName, setLayoutName] = useState('My Venue Layout')
  const [placedItems, setPlacedItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [draggedLibraryItem, setDraggedLibraryItem] = useState(null)
  const [isDraggingPlaced, setIsDraggingPlaced] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [isOverCanvas, setIsOverCanvas] = useState(false)
  
  // UI state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [history, setHistory] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  
  // Canvas dimensions
  const CANVAS_WIDTH = 900
  const CANVAS_HEIGHT = 600
  const GRID_SIZE = 20

  // Filter items by category
  const filteredItems = selectedCategory === 'all' 
    ? ITEMS_LIBRARY 
    : ITEMS_LIBRARY.filter(item => item.category === selectedCategory)

  // Save to history for undo
  const saveHistory = () => {
    setHistory(prev => [...prev.slice(-20), JSON.stringify(placedItems)])
  }

  // Undo last action
  const undo = () => {
    if (history.length > 0) {
      const lastState = history[history.length - 1]
      setPlacedItems(JSON.parse(lastState))
      setHistory(prev => prev.slice(0, -1))
      setSelectedItem(null)
    }
  }

  // Snap to grid
  const snapToGrid = (value) => {
    return showGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : value
  }

  // Handle library item drag start
  const handleLibraryDragStart = (e, item) => {
    setDraggedLibraryItem(item)
    
    // Create custom drag image
    const dragImage = document.createElement('div')
    dragImage.style.width = `${item.width}px`
    dragImage.style.height = `${item.height}px`
    dragImage.style.backgroundColor = item.color
    dragImage.style.borderRadius = '8px'
    dragImage.style.opacity = '0.8'
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, item.width / 2, item.height / 2)
    setTimeout(() => document.body.removeChild(dragImage), 0)
    
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Handle dropping item from library onto canvas
  const handleCanvasDrop = (e) => {
    e.preventDefault()
    setIsOverCanvas(false)
    
    if (!draggedLibraryItem) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom - draggedLibraryItem.width / 2
    const y = (e.clientY - rect.top) / zoom - draggedLibraryItem.height / 2

    // Snap to grid and keep within bounds
    const snappedX = Math.max(0, Math.min(CANVAS_WIDTH - draggedLibraryItem.width, snapToGrid(x)))
    const snappedY = Math.max(0, Math.min(CANVAS_HEIGHT - draggedLibraryItem.height, snapToGrid(y)))

    saveHistory()
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: draggedLibraryItem.id,
      name: draggedLibraryItem.name,
      x: snappedX,
      y: snappedY,
      width: draggedLibraryItem.width,
      height: draggedLibraryItem.height,
      color: draggedLibraryItem.color,
      rotation: 0,
      icon: draggedLibraryItem.icon,
    }
    setPlacedItems(prev => [...prev, newItem])
    setSelectedItem(newItem)
    setDraggedLibraryItem(null)
  }

  // Handle drag over canvas
  const handleCanvasDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsOverCanvas(true)
  }

  // Handle drag leave canvas
  const handleCanvasDragLeave = () => {
    setIsOverCanvas(false)
  }

  // Handle clicking on canvas item
  const handleItemClick = (e, item) => {
    e.stopPropagation()
    setSelectedItem(item)
  }

  // Handle starting to drag a placed item
  const handleItemMouseDown = (e, item) => {
    e.stopPropagation()
    e.preventDefault()
    
    const rect = canvasRef.current.getBoundingClientRect()
    setSelectedItem(item)
    setIsDraggingPlaced(true)
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - item.x,
      y: (e.clientY - rect.top) / zoom - item.y
    })
    saveHistory()
  }

  // Handle dragging a placed item
  const handleMouseMove = (e) => {
    if (!isDraggingPlaced || !selectedItem || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) / zoom - dragOffset.x
    const rawY = (e.clientY - rect.top) / zoom - dragOffset.y
    
    // Keep within canvas bounds
    const boundedX = Math.max(0, Math.min(CANVAS_WIDTH - selectedItem.width, rawX))
    const boundedY = Math.max(0, Math.min(CANVAS_HEIGHT - selectedItem.height, rawY))
    
    // Snap to grid
    const finalX = snapToGrid(boundedX)
    const finalY = snapToGrid(boundedY)
    
    setPlacedItems(prev => prev.map(item => 
      item.id === selectedItem.id 
        ? { ...item, x: finalX, y: finalY }
        : item
    ))
    setSelectedItem(prev => prev ? { ...prev, x: finalX, y: finalY } : null)
  }

  // Handle releasing drag
  const handleMouseUp = () => {
    setIsDraggingPlaced(false)
  }

  // Handle clicking on empty canvas
  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current) {
      setSelectedItem(null)
    }
  }

  // Delete selected item
  const deleteSelected = () => {
    if (selectedItem) {
      saveHistory()
      setPlacedItems(prev => prev.filter(item => item.id !== selectedItem.id))
      setSelectedItem(null)
    }
  }

  // Rotate selected item
  const rotateSelected = () => {
    if (selectedItem) {
      saveHistory()
      const newRotation = (selectedItem.rotation + 45) % 360
      setPlacedItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, rotation: newRotation }
          : item
      ))
      setSelectedItem(prev => prev ? { ...prev, rotation: newRotation } : null)
    }
  }

  // Duplicate selected item
  const duplicateSelected = () => {
    if (selectedItem) {
      saveHistory()
      const newItem = {
        ...selectedItem,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: Math.min(selectedItem.x + 30, CANVAS_WIDTH - selectedItem.width),
        y: Math.min(selectedItem.y + 30, CANVAS_HEIGHT - selectedItem.height),
      }
      setPlacedItems(prev => [...prev, newItem])
      setSelectedItem(newItem)
    }
  }

  // Resize selected item
  const resizeSelected = (delta) => {
    if (selectedItem) {
      saveHistory()
      const scale = delta > 0 ? 1.15 : 0.85
      const newWidth = Math.max(30, Math.min(400, selectedItem.width * scale))
      const newHeight = Math.max(30, Math.min(400, selectedItem.height * scale))
      setPlacedItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, width: newWidth, height: newHeight }
          : item
      ))
      setSelectedItem(prev => prev ? { ...prev, width: newWidth, height: newHeight } : null)
    }
  }

  // Clear all items
  const clearAll = () => {
    if (placedItems.length > 0) {
      saveHistory()
      setPlacedItems([])
      setSelectedItem(null)
    }
  }

  // Save layout
  const saveLayout = async () => {
    if (!organizer?.id) {
      alert('Please log in to save your layout')
      return
    }

    setSaving(true)
    try {
      const layoutData = {
        venue_id: venueId || null,
        name: layoutName,
        total_width: CANVAS_WIDTH,
        total_height: CANVAS_HEIGHT,
        is_active: true,
        metadata: {
          items: placedItems,
          version: 1,
          created_by: organizer.id,
        }
      }

      if (layoutId && layoutId !== 'create' && layoutId !== 'layouts') {
        await supabase
          .from('venue_layouts')
          .update(layoutData)
          .eq('id', layoutId)
      } else {
        await supabase
          .from('venue_layouts')
          .insert(layoutData)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save layout:', error)
      alert('Failed to save. Database tables may not be set up yet.')
    } finally {
      setSaving(false)
    }
  }

  // Global mouse events for dragging
  useEffect(() => {
    if (isDraggingPlaced) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingPlaced, selectedItem, dragOffset])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem) {
          e.preventDefault()
          deleteSelected()
        }
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedItem) rotateSelected()
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        if (selectedItem) {
          e.preventDefault()
          duplicateSelected()
        }
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        undo()
      }
      if (e.key === 'Escape') {
        setSelectedItem(null)
      }
      if (e.key === 'g') {
        setShowGrid(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, history, placedItems])

  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e] overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-[#16213e] border-b border-[#0f3460] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/organizer/venues')}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-600" />
          <Input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="w-64 bg-[#0f3460] border-[#0f3460] text-white font-semibold focus:ring-blue-500"
            placeholder="Layout Name"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Undo */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={undo} 
            disabled={history.length === 0}
            className="text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </Button>
          
          {/* Grid toggle */}
          <Button 
            variant={showGrid ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setShowGrid(!showGrid)}
            className={showGrid ? 'bg-blue-600 hover:bg-blue-700' : 'text-gray-300 hover:text-white hover:bg-white/10'}
            title="Toggle Grid (G)"
          >
            <Grid className="w-4 h-4" />
          </Button>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-[#0f3460] rounded-lg px-2 py-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="text-gray-300 hover:text-white h-7 w-7 p-0"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-14 text-center text-gray-300">{Math.round(zoom * 100)}%</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="text-gray-300 hover:text-white h-7 w-7 p-0"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Clear All */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAll}
            disabled={placedItems.length === 0}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30"
            title="Clear All"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <div className="h-6 w-px bg-gray-600" />
          
          {/* Save */}
          <Button 
            onClick={saveLayout} 
            disabled={saving}
            className={`min-w-[120px] transition-all ${
              saved 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Item Library */}
        <div className="w-72 bg-[#16213e] border-r border-[#0f3460] flex flex-col">
          <div className="p-4 border-b border-[#0f3460]">
            <h3 className="font-bold text-lg text-white mb-1 flex items-center gap-2">
              <GripVertical className="w-5 h-5 text-blue-400" />
              Drag & Drop
            </h3>
            <p className="text-sm text-gray-400">
              Drag items onto the canvas
            </p>
          </div>

          {/* Category Filter */}
          <div className="p-3 border-b border-[#0f3460]">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-[#0f3460] text-gray-300 hover:bg-[#1a4a7a] hover:text-white'
                  }`}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map(item => {
                const IconComponent = item.icon
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleLibraryDragStart(e, item)}
                    onDragEnd={() => setDraggedLibraryItem(null)}
                    className="group flex flex-col items-center p-3 bg-[#0f3460] rounded-xl cursor-grab 
                              active:cursor-grabbing hover:bg-[#1a4a7a] transition-all duration-200
                              border-2 border-transparent hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20
                              hover:scale-105 active:scale-95"
                  >
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-2 shadow-lg
                                 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: item.color }}
                    >
                      <IconComponent className="w-7 h-7 text-white drop-shadow" />
                    </div>
                    <span className="text-xs font-medium text-center text-gray-300 group-hover:text-white">
                      {item.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Item count */}
          <div className="p-3 border-t border-[#0f3460]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Items placed:</span>
              <Badge className="bg-blue-600">{placedItems.length}</Badge>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#0d1b2a]">
          <div
            ref={canvasRef}
            className={`relative rounded-xl shadow-2xl transition-all duration-300 ${
              isOverCanvas ? 'ring-4 ring-blue-500 ring-offset-4 ring-offset-[#0d1b2a]' : ''
            }`}
            style={{
              width: CANVAS_WIDTH * zoom,
              height: CANVAS_HEIGHT * zoom,
              backgroundColor: '#1e1e2e',
              backgroundImage: showGrid 
                ? `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`
                : 'none',
              backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            }}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onClick={handleCanvasClick}
          >
            {/* Placed Items */}
            {placedItems.map(item => {
              const IconComponent = item.icon
              const isSelected = selectedItem?.id === item.id
              
              return (
                <div
                  key={item.id}
                  className={`absolute flex items-center justify-center transition-shadow duration-200
                              ${isDraggingPlaced && isSelected ? 'cursor-grabbing' : 'cursor-grab'}
                              ${isSelected 
                                ? 'ring-3 ring-blue-500 shadow-xl shadow-blue-500/30' 
                                : 'hover:ring-2 hover:ring-blue-400/50 hover:shadow-lg'
                              }`}
                  style={{
                    left: item.x * zoom,
                    top: item.y * zoom,
                    width: item.width * zoom,
                    height: item.height * zoom,
                    backgroundColor: item.color,
                    borderRadius: item.type.includes('round') || item.type.includes('dance') ? '50%' : '12px',
                    transform: `rotate(${item.rotation}deg)`,
                    transformOrigin: 'center center',
                    boxShadow: isSelected ? undefined : '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                  onClick={(e) => handleItemClick(e, item)}
                  onMouseDown={(e) => handleItemMouseDown(e, item)}
                >
                  <IconComponent 
                    className="text-white pointer-events-none drop-shadow-lg" 
                    style={{ 
                      width: Math.min(item.width * zoom * 0.5, 48),
                      height: Math.min(item.height * zoom * 0.5, 48)
                    }} 
                  />
                  
                  {/* Selection handles */}
                  {isSelected && !isDraggingPlaced && (
                    <>
                      {/* Corner handles */}
                      <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                      <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                      <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                    </>
                  )}
                  
                  {/* Item label */}
                  {zoom >= 0.7 && (
                    <div 
                      className="absolute -bottom-7 left-1/2 bg-black/80 text-white 
                                 text-xs px-2 py-1 rounded-lg whitespace-nowrap backdrop-blur-sm"
                      style={{ transform: `rotate(-${item.rotation}deg) translateX(-50%)` }}
                    >
                      {item.name}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Empty state */}
            {placedItems.length === 0 && !isOverCanvas && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-8xl mb-6 animate-bounce">👆</div>
                  <p className="text-2xl font-bold text-gray-400 mb-2">Drop items here!</p>
                  <p className="text-gray-500">Drag from the left panel and drop onto this canvas</p>
                </div>
              </div>
            )}

            {/* Drop indicator */}
            {isOverCanvas && draggedLibraryItem && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-blue-500/10 rounded-xl">
                <div className="text-center animate-pulse">
                  <div className="text-6xl mb-4">✨</div>
                  <p className="text-xl font-bold text-blue-400">Release to place {draggedLibraryItem.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Actions Panel */}
        <div className="w-64 bg-[#16213e] border-l border-[#0f3460] flex flex-col">
          {selectedItem ? (
            <>
              <div className="p-4 border-b border-[#0f3460]">
                <h3 className="font-bold text-white mb-1">Selected Item</h3>
                <p className="text-blue-400 font-medium">{selectedItem.name}</p>
              </div>
              
              <div className="flex-1 p-4 space-y-3">
                {/* Rotate */}
                <Button 
                  onClick={rotateSelected} 
                  className="w-full bg-[#0f3460] hover:bg-[#1a4a7a] text-white justify-start"
                >
                  <RotateCw className="w-4 h-4 mr-3" />
                  Rotate 45°
                  <span className="ml-auto text-xs text-gray-400">R</span>
                </Button>

                {/* Resize */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => resizeSelected(-1)} 
                    className="flex-1 bg-[#0f3460] hover:bg-[#1a4a7a] text-white"
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    Smaller
                  </Button>
                  <Button 
                    onClick={() => resizeSelected(1)} 
                    className="flex-1 bg-[#0f3460] hover:bg-[#1a4a7a] text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Bigger
                  </Button>
                </div>

                {/* Duplicate */}
                <Button 
                  onClick={duplicateSelected} 
                  className="w-full bg-[#0f3460] hover:bg-[#1a4a7a] text-white justify-start"
                >
                  <Copy className="w-4 h-4 mr-3" />
                  Duplicate
                  <span className="ml-auto text-xs text-gray-400">Ctrl+D</span>
                </Button>

                <div className="h-px bg-[#0f3460] my-4" />

                {/* Delete */}
                <Button 
                  onClick={deleteSelected} 
                  variant="destructive"
                  className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white justify-start"
                >
                  <Trash2 className="w-4 h-4 mr-3" />
                  Delete Item
                  <span className="ml-auto text-xs opacity-60">Del</span>
                </Button>
              </div>

              <div className="p-4 border-t border-[#0f3460]">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Position:</span>
                    <span>{Math.round(selectedItem.x)}, {Math.round(selectedItem.y)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span>{Math.round(selectedItem.width)} × {Math.round(selectedItem.height)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rotation:</span>
                    <span>{selectedItem.rotation}°</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4">
              <h3 className="font-bold text-white mb-4">💡 Quick Tips</h3>
              
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="font-medium text-blue-400 mb-1">🖱️ Drag & Drop</p>
                  <p className="text-gray-400">Drag items from left to canvas</p>
                </div>
                
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="font-medium text-green-400 mb-1">✋ Move Items</p>
                  <p className="text-gray-400">Click and drag items around</p>
                </div>
                
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="font-medium text-purple-400 mb-1">⌨️ Shortcuts</p>
                  <p className="text-gray-400">
                    <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-xs">R</kbd> Rotate<br/>
                    <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-xs">Del</kbd> Delete<br/>
                    <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-xs">Ctrl+D</kbd> Duplicate<br/>
                    <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-xs">Ctrl+Z</kbd> Undo<br/>
                    <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-xs">G</kbd> Toggle Grid
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
