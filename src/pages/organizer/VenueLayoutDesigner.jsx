/**
 * Venue Layout Designer
 * Visual drag-and-drop interface for creating event layouts
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, Undo, Redo, ZoomIn, ZoomOut, Grid, Move, RotateCw,
  Square, Circle, Plus, Trash2, Settings, Eye, EyeOff,
  Palette, Ruler, Download, Upload, Copy, Scissors, Library
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FurnitureLibrary, FurnitureDragOverlay } from '@/components/FurnitureLibrary'
import { SectionManager } from '@/components/SectionManager'
import { supabase } from '@/lib/supabase'

export function VenueLayoutDesigner() {
  const { venueId, layoutId } = useParams()
  const navigate = useNavigate()

  // Canvas state
  const canvasRef = useRef(null)
  const [canvas, setCanvas] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [gridSize, setGridSize] = useState(20)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)

  // Layout state
  const [layout, setLayout] = useState(null)
  const [sections, setSections] = useState([])
  const [furniture, setFurniture] = useState([])
  const [furnitureTypes, setFurnitureTypes] = useState([])
  const [selectedTool, setSelectedTool] = useState('select')
  const [selectedItem, setSelectedItem] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentSection, setCurrentSection] = useState(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [layoutWidth, setLayoutWidth] = useState(20)
  const [layoutHeight, setLayoutHeight] = useState(15)
  const [draggedFurniture, setDraggedFurniture] = useState(null)
  const [selectedFurnitureType, setSelectedFurnitureType] = useState(null)

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current && !canvas) {
      initializeCanvas()
    }
  }, [canvasRef])

  // Load layout data
  useEffect(() => {
    if (venueId) {
      loadFurnitureTypes()
      if (layoutId) {
        loadLayout(layoutId)
      } else {
        createNewLayout()
      }
    }
  }, [venueId, layoutId])

  const initializeCanvas = useCallback(() => {
    const canvasElement = canvasRef.current
    const ctx = canvasElement.getContext('2d')

    // Set canvas size
    canvasElement.width = 1200
    canvasElement.height = 800

    // Set up canvas state
    const canvasState = {
      ctx,
      width: canvasElement.width,
      height: canvasElement.height,
      offsetX: 0,
      offsetY: 0,
      scale: zoom,
      items: [],
      sections: [],
      selectedItem: null,
      isDragging: false,
      dragStart: null
    }

    setCanvas(canvasState)
    drawCanvas(canvasState)
  }, [zoom])

  const drawCanvas = (canvasState) => {
    const { ctx, width, height, offsetX, offsetY, scale } = canvasState

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, width, height, gridSize * scale, offsetX, offsetY)
    }

    // Draw sections
    sections.forEach(section => drawSection(ctx, section, scale, offsetX, offsetY))

    // Draw furniture
    furniture.forEach(item => drawFurnitureItem(ctx, item, scale, offsetX, offsetY))

    // Draw current drawing if active
    if (isDrawing && currentSection) {
      drawSectionOutline(ctx, currentSection, scale, offsetX, offsetY)
    }
  }

  const drawGrid = (ctx, width, height, gridSize, offsetX, offsetY) => {
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1

    const startX = offsetX % gridSize
    const startY = offsetY % gridSize

    for (let x = startX; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawSection = (ctx, section, scale, offsetX, offsetY) => {
    if (!section.coordinates || section.coordinates.length < 3) return

    ctx.fillStyle = section.display_color || '#CCCCCC'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2

    ctx.beginPath()
    section.coordinates.forEach((point, index) => {
      const x = (point.x * scale) + offsetX
      const y = (point.y * scale) + offsetY
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Draw section label
    const centerX = section.coordinates.reduce((sum, p) => sum + p.x, 0) / section.coordinates.length
    const centerY = section.coordinates.reduce((sum, p) => sum + p.y, 0) / section.coordinates.length

    ctx.fillStyle = '#000000'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(section.name, (centerX * scale) + offsetX, (centerY * scale) + offsetY)
  }

  const drawSectionOutline = (ctx, section, scale, offsetX, offsetY) => {
    if (!section.coordinates || section.coordinates.length === 0) return

    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    ctx.beginPath()
    section.coordinates.forEach((point, index) => {
      const x = (point.x * scale) + offsetX
      const y = (point.y * scale) + offsetY
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    if (section.coordinates.length > 2) {
      ctx.closePath()
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  const drawFurnitureItem = (ctx, item, scale, offsetX, offsetY) => {
    const furnitureType = furnitureTypes.find(type => type.id === item.furniture_type_id)
    if (!furnitureType) return

    const x = (item.x_position * scale) + offsetX
    const y = (item.y_position * scale) + offsetY
    const width = ((item.width || furnitureType.default_width) * scale)
    const height = ((item.height || furnitureType.default_height) * scale)

    // Draw based on category
    switch (furnitureType.category) {
      case 'chair':
        drawChair(ctx, x, y, width, height, item.rotation || 0)
        break
      case 'table':
        drawTable(ctx, x, y, width, height, item.rotation || 0)
        break
      case 'stage':
        drawStage(ctx, x, y, width, height, item.rotation || 0)
        break
      case 'bar':
        drawBar(ctx, x, y, width, height, item.rotation || 0)
        break
      default:
        drawRectangle(ctx, x, y, width, height, '#666666', item.rotation || 0)
    }

    // Highlight if selected
    if (selectedItem && selectedItem.id === item.id) {
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.strokeRect(x - 2, y - 2, width + 4, height + 4)
    }
  }

  const drawChair = (ctx, x, y, width, height, rotation) => {
    ctx.save()
    ctx.translate(x + width/2, y + height/2)
    ctx.rotate((rotation * Math.PI) / 180)

    // Chair seat
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-width/2, -height/2, width, height)

    // Chair back
    ctx.fillRect(-width/2, -height/2 - height/3, width/3, height/3)

    ctx.restore()
  }

  const drawTable = (ctx, x, y, width, height, rotation) => {
    ctx.save()
    ctx.translate(x + width/2, y + height/2)
    ctx.rotate((rotation * Math.PI) / 180)

    // Table surface
    ctx.fillStyle = '#654321'
    ctx.fillRect(-width/2, -height/2, width, height)

    // Table legs
    ctx.fillStyle = '#8B4513'
    const legSize = Math.min(width, height) * 0.1
    ctx.fillRect(-width/2 + legSize, -height/2 + legSize, legSize, legSize)
    ctx.fillRect(width/2 - legSize*2, -height/2 + legSize, legSize, legSize)
    ctx.fillRect(-width/2 + legSize, height/2 - legSize*2, legSize, legSize)
    ctx.fillRect(width/2 - legSize*2, height/2 - legSize*2, legSize, legSize)

    ctx.restore()
  }

  const drawStage = (ctx, x, y, width, height, rotation) => {
    ctx.save()
    ctx.translate(x + width/2, y + height/2)
    ctx.rotate((rotation * Math.PI) / 180)

    // Stage platform
    ctx.fillStyle = '#2C2C2C'
    ctx.fillRect(-width/2, -height/2, width, height)

    // Stage border
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 3
    ctx.strokeRect(-width/2, -height/2, width, height)

    ctx.restore()
  }

  const drawBar = (ctx, x, y, width, height, rotation) => {
    ctx.save()
    ctx.translate(x + width/2, y + height/2)
    ctx.rotate((rotation * Math.PI) / 180)

    // Bar counter
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-width/2, -height/2, width, height)

    // Bar surface
    ctx.fillStyle = '#654321'
    ctx.fillRect(-width/2, -height/2 + height/3, width, height/3)

    ctx.restore()
  }

  const drawRectangle = (ctx, x, y, width, height, color, rotation) => {
    ctx.save()
    ctx.translate(x + width/2, y + height/2)
    ctx.rotate((rotation * Math.PI) / 180)

    ctx.fillStyle = color
    ctx.fillRect(-width/2, -height/2, width, height)

    ctx.restore()
  }

  // Canvas event handlers
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvas.offsetX) / canvas.scale
    const y = (e.clientY - rect.top - canvas.offsetY) / canvas.scale

    if (selectedTool === 'section') {
      handleSectionDrawing(x, y)
    } else if (selectedTool === 'furniture' && selectedFurnitureType) {
      handleFurniturePlacement(x, y, selectedFurnitureType)
    } else {
      handleItemSelection(x, y)
    }
  }

  // Handle drag and drop from furniture library
  const handleCanvasDrop = (e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvas.offsetX) / canvas.scale
    const y = (e.clientY - rect.top - canvas.offsetY) / canvas.scale

    try {
      const furnitureData = JSON.parse(e.dataTransfer.getData('application/json'))
      handleFurniturePlacement(x, y, furnitureData)
    } catch (error) {
      console.error('Failed to parse dropped furniture data:', error)
    }

    setDraggedFurniture(null)
  }

  const handleCanvasDragOver = (e) => {
    e.preventDefault()
  }

  const handleSectionDrawing = (x, y) => {
    if (!isDrawing) {
      // Start new section
      setCurrentSection({
        name: `Section ${sections.length + 1}`,
        coordinates: [{ x, y }],
        display_color: '#CCCCCC',
        section_type: 'seating'
      })
      setIsDrawing(true)
    } else {
      // Add point to current section
      setCurrentSection(prev => ({
        ...prev,
        coordinates: [...prev.coordinates, { x, y }]
      }))
    }
  }

  const handleFurniturePlacement = (x, y, furnitureType) => {
    if (!furnitureType) return

    // Snap to grid if enabled
    let finalX = x
    let finalY = y

    if (snapToGrid) {
      finalX = Math.round(x / gridSize) * gridSize
      finalY = Math.round(y / gridSize) * gridSize
    }

    const newFurniture = {
      id: `furniture-${Date.now()}`,
      furniture_type_id: furnitureType.id,
      name: furnitureType.name,
      x_position: finalX,
      y_position: finalY,
      width: furnitureType.default_width,
      height: furnitureType.default_height,
      capacity: furnitureType.default_capacity,
      rotation: 0,
      properties: furnitureType.properties || {}
    }

    setFurniture(prev => [...prev, newFurniture])
    setSelectedItem(newFurniture)
    setSelectedTool('select')
    setSelectedFurnitureType(null)
  }

  const handleItemSelection = (x, y) => {
    // Find clicked item
    const clickedItem = findItemAtPosition(x, y)
    setSelectedItem(clickedItem)
  }

  const findItemAtPosition = (x, y) => {
    // Check furniture first
    for (const item of furniture) {
      const furnitureType = furnitureTypes.find(type => type.id === item.furniture_type_id)
      if (!furnitureType) continue

      const itemX = item.x_position
      const itemY = item.y_position
      const width = item.width || furnitureType.default_width
      const height = item.height || furnitureType.default_height

      if (x >= itemX && x <= itemX + width && y >= itemY && y <= itemY + height) {
        return { type: 'furniture', ...item }
      }
    }

    // Check sections
    for (const section of sections) {
      if (isPointInPolygon({ x, y }, section.coordinates)) {
        return { type: 'section', ...section }
      }
    }

    return null
  }

  const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false

    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside
      }
    }
    return inside
  }

  // Default furniture types when database table doesn't exist
  const DEFAULT_FURNITURE_TYPES = [
    { id: 'chair-1', name: 'Standard Chair', category: 'chair', description: 'Basic seating chair', default_width: 0.5, default_height: 0.5, default_capacity: 1, is_active: true },
    { id: 'chair-2', name: 'VIP Chair', category: 'chair', description: 'Premium leather chair', default_width: 0.6, default_height: 0.6, default_capacity: 1, is_active: true },
    { id: 'table-1', name: 'Round Table', category: 'table', description: 'Round dining table', default_width: 1.5, default_height: 1.5, default_capacity: 8, is_active: true },
    { id: 'table-2', name: 'Rectangular Table', category: 'table', description: 'Long rectangular table', default_width: 2.0, default_height: 0.8, default_capacity: 6, is_active: true },
    { id: 'stage-1', name: 'Main Stage', category: 'stage', description: 'Large performance stage', default_width: 8.0, default_height: 5.0, default_capacity: 0, is_active: true },
    { id: 'bar-1', name: 'Bar Counter', category: 'bar', description: 'Full bar counter', default_width: 4.0, default_height: 1.0, default_capacity: 0, is_active: true },
    { id: 'dj-1', name: 'DJ Booth', category: 'dj', description: 'DJ performance area', default_width: 3.0, default_height: 2.0, default_capacity: 2, is_active: true },
    { id: 'checkin-1', name: 'Check-in Desk', category: 'checkin', description: 'Registration counter', default_width: 3.0, default_height: 1.0, default_capacity: 0, is_active: true },
  ]

  // Data loading functions
  const loadFurnitureTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('furniture_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('Using default furniture types')
          setFurnitureTypes(DEFAULT_FURNITURE_TYPES)
          return
        }
        throw error
      }
      setFurnitureTypes(data && data.length > 0 ? data : DEFAULT_FURNITURE_TYPES)
    } catch (error) {
      console.error('Failed to load furniture types:', error)
      setFurnitureTypes(DEFAULT_FURNITURE_TYPES)
    }
  }

  const loadLayout = async (id) => {
    try {
      setLoading(true)

      // Load layout
      const { data: layoutData, error: layoutError } = await supabase
        .from('venue_layouts')
        .select('*')
        .eq('id', id)
        .single()

      if (layoutError) {
        if (layoutError.code === '42P01' || layoutError.message?.includes('does not exist')) {
          console.log('Layout tables not found, creating new layout')
          createNewLayout()
          return
        }
        throw layoutError
      }
      
      setLayout(layoutData)
      setLayoutName(layoutData.name)
      setLayoutWidth(layoutData.total_width)
      setLayoutHeight(layoutData.total_height)

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('layout_sections')
        .select('*')
        .eq('layout_id', id)
        .order('sort_order', { ascending: true })

      if (!sectionsError) {
        setSections(sectionsData || [])
      }

      // Load furniture
      const { data: furnitureData, error: furnitureError } = await supabase
        .from('layout_furniture')
        .select('*')
        .eq('layout_id', id)

      if (!furnitureError) {
        setFurniture(furnitureData || [])
      }

    } catch (error) {
      console.error('Failed to load layout:', error)
      createNewLayout() // Fallback to new layout on error
    } finally {
      setLoading(false)
    }
  }

  const createNewLayout = () => {
    setLayout({
      id: 'new',
      name: 'New Layout',
      total_width: layoutWidth,
      total_height: layoutHeight,
      venue_id: venueId
    })
    setLayoutName('New Layout')
    setSections([])
    setFurniture([])
    setLoading(false)
  }

  const saveLayout = async () => {
    try {
      setSaving(true)

      const layoutData = {
        venue_id: venueId,
        name: layoutName,
        total_width: layoutWidth,
        total_height: layoutHeight,
        version: layout ? layout.version + 1 : 1,
        is_active: true
      }

      let layoutId
      if (layout && layout.id !== 'new') {
        // Update existing
        const { error } = await supabase
          .from('venue_layouts')
          .update(layoutData)
          .eq('id', layout.id)

        if (error) throw error
        layoutId = layout.id
      } else {
        // Create new
        const { data, error } = await supabase
          .from('venue_layouts')
          .insert(layoutData)
          .select()
          .single()

        if (error) throw error
        layoutId = data.id
      }

      // Save sections
      await saveSections(layoutId)

      // Save furniture
      await saveFurniture(layoutId)

      // Navigate to the saved layout
      navigate(`/organizer/venues/${venueId}/layouts/${layoutId}`)

    } catch (error) {
      console.error('Failed to save layout:', error)
      alert('Failed to save layout: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const saveSections = async (layoutId) => {
    // Delete existing sections
    await supabase
      .from('layout_sections')
      .delete()
      .eq('layout_id', layoutId)

    // Insert new sections
    if (sections.length > 0) {
      const { error } = await supabase
        .from('layout_sections')
        .insert(sections.map(section => ({
          layout_id: layoutId,
          ...section
        })))

      if (error) throw error
    }
  }

  const saveFurniture = async (layoutId) => {
    // Delete existing furniture
    await supabase
      .from('layout_furniture')
      .delete()
      .eq('layout_id', layoutId)

    // Insert new furniture
    if (furniture.length > 0) {
      const { error } = await supabase
        .from('layout_furniture')
        .insert(furniture.map(item => ({
          layout_id: layoutId,
          ...item
        })))

      if (error) throw error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2969FF]"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F0F0F]">
            {layoutId ? 'Edit Layout' : 'Create Layout'}
          </h1>
          <p className="text-[#0F0F0F]/60 mt-1">
            Design your venue layout with sections and furniture
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={saveLayout} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Layout Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="layoutName">Layout Name</Label>
              <Input
                id="layoutName"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Enter layout name"
              />
            </div>
            <div>
              <Label htmlFor="layoutWidth">Width (meters)</Label>
              <Input
                id="layoutWidth"
                type="number"
                value={layoutWidth}
                onChange={(e) => setLayoutWidth(Number(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            <div>
              <Label htmlFor="layoutHeight">Height (meters)</Label>
              <Input
                id="layoutHeight"
                type="number"
                value={layoutHeight}
                onChange={(e) => setLayoutHeight(Number(e.target.value))}
                min="1"
                max="100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="design" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="furniture">Furniture</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Tools Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drawing Tools */}
                <div>
                  <Label className="text-sm font-medium">Drawing Tools</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant={selectedTool === 'select' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTool('select')}
                    >
                      <Move className="w-4 h-4 mr-1" />
                      Select
                    </Button>
                    <Button
                      variant={selectedTool === 'section' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTool('section')}
                    >
                      <Square className="w-4 h-4 mr-1" />
                      Section
                    </Button>
                  </div>
                </div>

            {/* View Controls */}
            <div>
              <Label className="text-sm font-medium">View</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Zoom</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                    >
                      <ZoomOut className="w-3 h-3" />
                    </Button>
                    <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                    >
                      <ZoomIn className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Grid</span>
                  <Button
                    variant={showGrid ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid className="w-3 h-3 mr-1" />
                    {showGrid ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Snap</span>
                  <Button
                    variant={snapToGrid ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSnapToGrid(!snapToGrid)}
                  >
                    <Grid className="w-3 h-3 mr-1" />
                    {snapToGrid ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Section Management */}
            <div>
              <Label className="text-sm font-medium">Sections ({sections.length})</Label>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                {sections.map((section, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: section.display_color }}
                      />
                      <span className="text-sm">{section.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSections(sections.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {isDrawing && (
                <Button
                  className="w-full mt-2"
                  variant="outline"
                  onClick={() => {
                    if (currentSection && currentSection.coordinates.length >= 3) {
                      setSections([...sections, currentSection])
                    }
                    setCurrentSection(null)
                    setIsDrawing(false)
                  }}
                >
                  Finish Section
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Layout Canvas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className={`w-full h-auto ${selectedTool === 'furniture' ? 'cursor-copy' : 'cursor-crosshair'}`}
                style={{ maxHeight: '600px' }}
                onClick={handleCanvasClick}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              />
            </div>

            {selectedItem && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Selected Item</h4>
                <p className="text-sm text-blue-700">
                  {selectedItem.type === 'section' ? 'Section' : 'Furniture'}: {selectedItem.name}
                </p>
                {selectedItem.type === 'section' && (
                  <div className="mt-2 space-y-2">
                    <Input
                      value={selectedItem.name}
                      onChange={(e) => {
                        const updatedSections = sections.map(s =>
                          s.id === selectedItem.id ? { ...s, name: e.target.value } : s
                        )
                        setSections(updatedSections)
                      }}
                      placeholder="Section name"
                    />
                    <Select
                      value={selectedItem.section_type}
                      onValueChange={(value) => {
                        const updatedSections = sections.map(s =>
                          s.id === selectedItem.id ? { ...s, section_type: value } : s
                        )
                        setSections(updatedSections)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seating">Seating</SelectItem>
                        <SelectItem value="standing">Standing</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="stage">Stage</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </TabsContent>

      {/* Furniture Tab */}
      <TabsContent value="furniture" className="space-y-6">
        <FurnitureLibrary
          onItemSelect={(item) => {
            setSelectedFurnitureType(item)
            setSelectedTool('furniture')
          }}
          onItemDragStart={setDraggedFurniture}
        />
      </TabsContent>

      {/* Sections Tab */}
      <TabsContent value="sections" className="space-y-6">
        <SectionManager
          sections={sections}
          onSectionsChange={setSections}
          eventId={null} // Will be set when used with events
        />
      </TabsContent>
    </Tabs>

    {/* Drag Overlay */}
    {draggedFurniture && (
      <FurnitureDragOverlay item={draggedFurniture} />
    )}
    </div>
  )
}