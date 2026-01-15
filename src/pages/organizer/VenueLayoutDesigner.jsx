/**
 * Venue Layout Designer - Simple Drag & Drop Interface
 * Designed to be as easy as possible - like a drawing app!
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Trash2, RotateCw, Plus, Minus, Undo, Grid,
  Square, Circle, Armchair, Table, Mic, Coffee, Users,
  Monitor, DoorOpen, Music, ClipboardCheck, Star, X,
  Move, ZoomIn, ZoomOut, Copy, ChevronLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  { id: 'screen', name: 'LED Screen', icon: Monitor, color: '#000000', category: 'stage', width: 150, height: 30 },
  
  // Services
  { id: 'bar', name: 'Bar Counter', icon: Coffee, color: '#795548', category: 'services', width: 150, height: 50 },
  { id: 'checkin', name: 'Check-in Desk', icon: ClipboardCheck, color: '#2196F3', category: 'services', width: 120, height: 50 },
  { id: 'entrance', name: 'Entrance', icon: DoorOpen, color: '#4CAF50', category: 'services', width: 80, height: 30 },
  { id: 'exit', name: 'Exit', icon: DoorOpen, color: '#F44336', category: 'services', width: 80, height: 30 },
  
  // Areas (larger zones)
  { id: 'dance-floor', name: 'Dance Floor', icon: Users, color: '#E91E63', category: 'areas', width: 200, height: 200 },
  { id: 'vip-area', name: 'VIP Area', icon: Star, color: '#FFD700', category: 'areas', width: 150, height: 150 },
  { id: 'standing', name: 'Standing Area', icon: Users, color: '#4CAF50', category: 'areas', width: 150, height: 100 },
]

const CATEGORIES = [
  { id: 'all', name: '🎯 All' },
  { id: 'seating', name: '🪑 Seating' },
  { id: 'tables', name: '🍽️ Tables' },
  { id: 'stage', name: '🎤 Stage' },
  { id: 'services', name: '🚪 Services' },
  { id: 'areas', name: '📍 Areas' },
]

export function VenueLayoutDesigner() {
  const { venueId, layoutId } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const canvasRef = useRef(null)
  
  // Layout state
  const [layoutName, setLayoutName] = useState('My Venue Layout')
  const [placedItems, setPlacedItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [draggedLibraryItem, setDraggedLibraryItem] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // UI state
  const [saving, setSaving] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [history, setHistory] = useState([])
  
  // Canvas dimensions
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600

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

  // Handle dropping item from library onto canvas
  const handleCanvasDrop = (e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    if (draggedLibraryItem) {
      saveHistory()
      const newItem = {
        id: `item-${Date.now()}`,
        type: draggedLibraryItem.id,
        name: draggedLibraryItem.name,
        x: x - draggedLibraryItem.width / 2,
        y: y - draggedLibraryItem.height / 2,
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
  }

  // Handle clicking on canvas item
  const handleItemClick = (e, item) => {
    e.stopPropagation()
    setSelectedItem(item)
  }

  // Handle starting to drag a placed item
  const handleItemMouseDown = (e, item) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    setSelectedItem(item)
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - rect.left - item.x * zoom,
      y: e.clientY - rect.top - item.y * zoom
    })
    saveHistory()
  }

  // Handle dragging a placed item
  const handleCanvasMouseMove = (e) => {
    if (isDragging && selectedItem) {
      const rect = canvasRef.current.getBoundingClientRect()
      const newX = (e.clientX - rect.left - dragOffset.x) / zoom
      const newY = (e.clientY - rect.top - dragOffset.y) / zoom
      
      // Keep within canvas bounds
      const boundedX = Math.max(0, Math.min(CANVAS_WIDTH - selectedItem.width, newX))
      const boundedY = Math.max(0, Math.min(CANVAS_HEIGHT - selectedItem.height, newY))
      
      // Snap to grid if enabled
      const finalX = showGrid ? Math.round(boundedX / 20) * 20 : boundedX
      const finalY = showGrid ? Math.round(boundedY / 20) * 20 : boundedY
      
      setPlacedItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, x: finalX, y: finalY }
          : item
      ))
      setSelectedItem(prev => ({ ...prev, x: finalX, y: finalY }))
    }
  }

  // Handle releasing drag
  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  // Handle clicking on empty canvas
  const handleCanvasClick = () => {
    setSelectedItem(null)
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
      const newRotation = (selectedItem.rotation + 90) % 360
      setPlacedItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, rotation: newRotation }
          : item
      ))
      setSelectedItem(prev => ({ ...prev, rotation: newRotation }))
    }
  }

  // Duplicate selected item
  const duplicateSelected = () => {
    if (selectedItem) {
      saveHistory()
      const newItem = {
        ...selectedItem,
        id: `item-${Date.now()}`,
        x: selectedItem.x + 20,
        y: selectedItem.y + 20,
      }
      setPlacedItems(prev => [...prev, newItem])
      setSelectedItem(newItem)
    }
  }

  // Resize selected item
  const resizeSelected = (delta) => {
    if (selectedItem) {
      saveHistory()
      const scale = delta > 0 ? 1.2 : 0.8
      const newWidth = Math.max(30, Math.min(400, selectedItem.width * scale))
      const newHeight = Math.max(30, Math.min(400, selectedItem.height * scale))
      setPlacedItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, width: newWidth, height: newHeight }
          : item
      ))
      setSelectedItem(prev => ({ ...prev, width: newWidth, height: newHeight }))
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

      if (layoutId && layoutId !== 'create') {
        await supabase
          .from('venue_layouts')
          .update(layoutData)
          .eq('id', layoutId)
      } else {
        await supabase
          .from('venue_layouts')
          .insert(layoutData)
      }

      alert('Layout saved successfully! ✅')
    } catch (error) {
      console.error('Failed to save layout:', error)
      alert('Failed to save layout. The database tables may not be set up yet.')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem && document.activeElement.tagName !== 'INPUT') {
          deleteSelected()
        }
      }
      if (e.key === 'r' && selectedItem) {
        rotateSelected()
      }
      if (e.key === 'd' && e.ctrlKey && selectedItem) {
        e.preventDefault()
        duplicateSelected()
      }
      if (e.key === 'z' && e.ctrlKey) {
        e.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, history])

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <Input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="w-64 font-semibold"
            placeholder="Layout Name"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Undo */}
          <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
            <Undo className="w-4 h-4" />
          </Button>
          
          {/* Grid toggle */}
          <Button 
            variant={showGrid ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid className="w-4 h-4" />
          </Button>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-gray-200" />
          
          {/* Save */}
          <Button onClick={saveLayout} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Item Library */}
        <div className="w-72 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <h3 className="font-bold text-lg mb-3">🧩 Drag & Drop Items</h3>
            <p className="text-sm text-gray-500 mb-4">
              Drag items to the canvas to place them
            </p>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1 mb-4">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map(item => {
                const IconComponent = item.icon
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedLibraryItem(item)}
                    onDragEnd={() => setDraggedLibraryItem(null)}
                    className="flex flex-col items-center p-3 bg-gray-50 rounded-lg cursor-grab 
                              active:cursor-grabbing hover:bg-gray-100 hover:shadow-md transition-all
                              border-2 border-transparent hover:border-blue-300"
                  >
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                      style={{ backgroundColor: item.color }}
                    >
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-medium text-center">{item.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas */}
          <div 
            className="flex-1 overflow-auto p-8 flex items-center justify-center"
            style={{ backgroundColor: '#f0f0f0' }}
          >
            <div
              ref={canvasRef}
              className="relative bg-white rounded-lg shadow-xl"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom,
                backgroundImage: showGrid 
                  ? `linear-gradient(to right, #e5e5e5 1px, transparent 1px),
                     linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)`
                  : 'none',
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              }}
              onDrop={handleCanvasDrop}
              onDragOver={(e) => e.preventDefault()}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onClick={handleCanvasClick}
            >
              {/* Placed Items */}
              {placedItems.map(item => {
                const IconComponent = item.icon
                const isSelected = selectedItem?.id === item.id
                
                return (
                  <div
                    key={item.id}
                    className={`absolute flex items-center justify-center cursor-move
                                transition-shadow ${isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-300'}`}
                    style={{
                      left: item.x * zoom,
                      top: item.y * zoom,
                      width: item.width * zoom,
                      height: item.height * zoom,
                      backgroundColor: item.color,
                      borderRadius: item.type.includes('round') || item.type.includes('dance') ? '50%' : '8px',
                      transform: `rotate(${item.rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                    onClick={(e) => handleItemClick(e, item)}
                    onMouseDown={(e) => handleItemMouseDown(e, item)}
                  >
                    <IconComponent 
                      className="text-white pointer-events-none" 
                      style={{ 
                        width: Math.min(item.width * zoom * 0.5, 40),
                        height: Math.min(item.height * zoom * 0.5, 40)
                      }} 
                    />
                    
                    {/* Item label */}
                    {zoom >= 0.8 && (
                      <div 
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white 
                                   text-xs px-2 py-0.5 rounded whitespace-nowrap"
                        style={{ transform: `rotate(-${item.rotation}deg) translateX(-50%)` }}
                      >
                        {item.name}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Empty state */}
              {placedItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-gray-400">
                    <div className="text-8xl mb-4">👆</div>
                    <p className="text-xl font-medium">Drag items here!</p>
                    <p className="text-sm">Pick an item from the left and drop it here</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Bar - Shows when item is selected */}
          {selectedItem && (
            <div className="bg-white border-t px-6 py-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-base px-3 py-1">
                  Selected: <strong className="ml-1">{selectedItem.name}</strong>
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Resize */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                  <Button variant="ghost" size="sm" onClick={() => resizeSelected(-1)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">Size</span>
                  <Button variant="ghost" size="sm" onClick={() => resizeSelected(1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Rotate */}
                <Button variant="outline" size="sm" onClick={rotateSelected}>
                  <RotateCw className="w-4 h-4 mr-1" />
                  Rotate
                </Button>

                {/* Duplicate */}
                <Button variant="outline" size="sm" onClick={duplicateSelected}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>

                {/* Delete */}
                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Quick Tips */}
        <div className="w-56 bg-white border-l p-4">
          <h3 className="font-bold text-lg mb-4">💡 Quick Tips</h3>
          
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-900">🖱️ Drag & Drop</p>
              <p className="text-blue-700">Drag items from left panel to canvas</p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="font-medium text-green-900">✋ Move Items</p>
              <p className="text-green-700">Click and drag items on canvas</p>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="font-medium text-purple-900">🔄 Rotate</p>
              <p className="text-purple-700">Select item, press R or click Rotate</p>
            </div>
            
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="font-medium text-red-900">🗑️ Delete</p>
              <p className="text-red-700">Select item, press Delete key</p>
            </div>
            
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="font-medium text-yellow-900">⌨️ Shortcuts</p>
              <p className="text-yellow-700">
                <span className="font-mono bg-yellow-100 px-1 rounded">Ctrl+Z</span> Undo<br/>
                <span className="font-mono bg-yellow-100 px-1 rounded">Ctrl+D</span> Duplicate<br/>
                <span className="font-mono bg-yellow-100 px-1 rounded">R</span> Rotate<br/>
                <span className="font-mono bg-yellow-100 px-1 rounded">Del</span> Delete
              </p>
            </div>
          </div>

          {/* Item count */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>{placedItems.length}</strong> items placed
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
