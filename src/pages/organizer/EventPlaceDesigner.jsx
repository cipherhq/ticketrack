/**
 * Event Place Designer - 3D Floor Plan Designer
 * State-of-the-art event center/event location 3D floor plan design tool
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, Trash2, Undo, Redo, Grid, ZoomIn, ZoomOut, Eye, EyeOff,
  Home, Layers, DoorOpen, Square, Ruler, Copy, Move, RotateCw,
  ChevronLeft, ChevronRight, ChevronDown, Search,
  Plus, Minus, X, Download, Upload, Settings, Camera
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
import { useOrganizer } from '@/contexts/OrganizerContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
// 3D System imports
import { toIsometric, toPerspective, getObjectHeight } from '@/utils/3dTransform'
import { getMaterialForObjectType } from '@/utils/materials'
import { getShadowFilter } from '@/utils/shadowFilters'

// =============================================================================
// FLOOR PLAN ELEMENTS
// =============================================================================

const WALL_TYPES = [
  { id: 'wall-straight', name: 'Straight Wall', type: 'wall', thickness: 6 },
  { id: 'wall-exterior', name: 'Exterior Wall', type: 'wall-exterior', thickness: 12 },
  { id: 'wall-glass', name: 'Glass Wall', type: 'wall-glass', thickness: 4 },
]

const ROOM_ELEMENTS = [
  { id: 'door-single', name: 'Single Door', type: 'door-single', width: 36, height: 84 },
  { id: 'door-double', name: 'Double Door', type: 'door-double', width: 72, height: 84 },
  { id: 'door-sliding', name: 'Sliding Door', type: 'door-sliding', width: 120, height: 84 },
  { id: 'window-single', name: 'Single Window', type: 'window-single', width: 36, height: 48 },
  { id: 'window-large', name: 'Large Window', type: 'window-large', width: 72, height: 48 },
  { id: 'window-bay', name: 'Bay Window', type: 'window-bay', width: 96, height: 48 },
]

const STRUCTURAL_ELEMENTS = [
  { id: 'column', name: 'Column', type: 'column', width: 24, height: 24 },
  { id: 'staircase-straight', name: 'Straight Stairs', type: 'staircase', width: 60, height: 120 },
  { id: 'staircase-spiral', name: 'Spiral Stairs', type: 'staircase-spiral', width: 60, height: 60 },
  { id: 'elevator', name: 'Elevator', type: 'elevator', width: 72, height: 72 },
]

const ROOM_TYPES = [
  { id: 'ballroom', name: 'Ballroom', color: '#E91E63' },
  { id: 'conference', name: 'Conference Room', color: '#9C27B0' },
  { id: 'reception', name: 'Reception Area', color: '#00BCD4' },
  { id: 'kitchen', name: 'Kitchen', color: '#FF5722' },
  { id: 'restroom', name: 'Restroom', color: '#607D8B' },
  { id: 'lobby', name: 'Lobby', color: '#FFC107' },
  { id: 'storage', name: 'Storage', color: '#795548' },
  { id: 'office', name: 'Office', color: '#3F51B5' },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EventPlaceDesigner() {
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Floor plan state
  const [floorPlanName, setFloorPlanName] = useState('Untitled Floor Plan')
  const [canvasWidth, setCanvasWidth] = useState(2000)
  const [canvasHeight, setCanvasHeight] = useState(1500)
  const [currentFloor, setCurrentFloor] = useState(0)
  const [floors, setFloors] = useState([{ name: 'Ground Floor', level: 0 }])
  
  // Elements state
  const [walls, setWalls] = useState([])
  const [rooms, setRooms] = useState([])
  const [doors, setDoors] = useState([])
  const [windows, setWindows] = useState([])
  const [structuralElements, setStructuralElements] = useState([])
  
  // UI state
  const [zoom, setZoom] = useState(60)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(48) // 4 feet in pixels (1 pixel = 1 inch at 48px = 4ft)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [viewMode, setViewMode] = useState('2d') // '2d', 'isometric', 'perspective'
  const [tool, setTool] = useState('select') // 'select', 'wall', 'door', 'window', 'room', 'measure'
  const [selectedIds, setSelectedIds] = useState([])
  const [drawingWall, setDrawingWall] = useState(false)
  const [wallStartPoint, setWallStartPoint] = useState(null)
  
  // History for undo/redo
  const [history, setHistory] = useState([[]])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Drag state
  const dragState = useRef({
    isDragging: false,
    draggedId: null,
    startX: 0,
    startY: 0,
    objectStartX: 0,
    objectStartY: 0
  })

  // =============================================================================
  // UTILITIES
  // =============================================================================

  const snapValue = useCallback((value) => {
    if (!snapToGrid) return value
    return Math.round(value / gridSize) * gridSize
  }, [snapToGrid, gridSize])

  const pixelsToFeet = useCallback((pixels) => {
    return (pixels / gridSize) * 4 // 4 feet per grid unit
  }, [gridSize])

  const feetToPixels = useCallback((feet) => {
    return (feet / 4) * gridSize
  }, [gridSize])

  const getCanvasCoords = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const scale = zoom / 100
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }, [zoom])

  const saveToHistory = useCallback((state) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(state)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      // Restore state from history
      const previousState = history[historyIndex - 1]
      // TODO: Restore walls, rooms, etc. from history
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      // Restore state from history
      const nextState = history[historyIndex + 1]
      // TODO: Restore walls, rooms, etc. from history
    }
  }, [history, historyIndex])

  // =============================================================================
  // WALL DRAWING
  // =============================================================================

  const [tempWallEnd, setTempWallEnd] = useState(null)

  const handleCanvasMouseDown = useCallback((e) => {
    if (tool === 'wall') {
      const coords = getCanvasCoords(e)
      const snappedCoords = {
        x: snapValue(coords.x),
        y: snapValue(coords.y)
      }
      
      if (!drawingWall) {
        // Start drawing wall
        setDrawingWall(true)
        setWallStartPoint(snappedCoords)
      } else {
        // Finish drawing wall
        const newWall = {
          id: `wall-${Date.now()}`,
          type: 'wall',
          x1: wallStartPoint.x,
          y1: wallStartPoint.y,
          x2: snappedCoords.x,
          y2: snappedCoords.y,
          thickness: 6,
          floor: currentFloor,
        }
        setWalls(prev => {
          const updated = [...prev, newWall]
          saveToHistory(updated)
          return updated
        })
        setDrawingWall(false)
        setWallStartPoint(null)
        setTempWallEnd(null)
      }
    } else {
      setSelectedIds([])
    }
  }, [tool, drawingWall, wallStartPoint, getCanvasCoords, snapValue, currentFloor, saveToHistory])

  const handleCanvasMouseMove = useCallback((e) => {
    if (drawingWall && wallStartPoint && tool === 'wall') {
      const coords = getCanvasCoords(e)
      const snappedCoords = {
        x: snapValue(coords.x),
        y: snapValue(coords.y)
      }
      setTempWallEnd(snappedCoords)
    }
  }, [drawingWall, wallStartPoint, tool, getCanvasCoords, snapValue])

  // =============================================================================
  // RENDERING FUNCTIONS
  // =============================================================================

  const renderWall = useCallback((wall) => {
    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    return (
      <g key={wall.id}>
        {/* Wall line */}
        <line
          x1={wall.x1}
          y1={wall.y1}
          x2={wall.x2}
          y2={wall.y2}
          stroke="#333"
          strokeWidth={wall.thickness}
          strokeLinecap="round"
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedIds([wall.id])}
        />
        {/* Wall fill */}
        <line
          x1={wall.x1}
          y1={wall.y1}
          x2={wall.x2}
          y2={wall.y2}
          stroke="#fff"
          strokeWidth={wall.thickness - 2}
          strokeLinecap="round"
          opacity={0.8}
        />
        {/* Dimensions */}
        {showDimensions && (
          <g transform={`translate(${(wall.x1 + wall.x2) / 2}, ${(wall.y1 + wall.y2) / 2}) rotate(${angle})`}>
            <text
              x={0}
              y={-10}
              textAnchor="middle"
              fontSize="10"
              fill="#666"
              style={{ pointerEvents: 'none' }}
            >
              {pixelsToFeet(length).toFixed(1)} ft
            </text>
          </g>
        )}
        {/* Selection indicator */}
        {selectedIds.includes(wall.id) && (
          <circle
            cx={wall.x1}
            cy={wall.y1}
            r={6}
            fill="#2969FF"
            stroke="#fff"
            strokeWidth={2}
          />
        )}
        {selectedIds.includes(wall.id) && (
          <circle
            cx={wall.x2}
            cy={wall.y2}
            r={6}
            fill="#2969FF"
            stroke="#fff"
            strokeWidth={2}
          />
        )}
      </g>
    )
  }, [showDimensions, pixelsToFeet, selectedIds])

  const renderGrid = useMemo(() => {
    if (!showGrid) return null
    
    const lines = []
    for (let x = 0; x <= canvasWidth; x += gridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasHeight}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
      )
    }
    for (let y = 0; y <= canvasHeight; y += gridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={canvasWidth}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
      )
    }
    return <g>{lines}</g>
  }, [showGrid, canvasWidth, canvasHeight, gridSize])

  // =============================================================================
  // SAVE/LOAD
  // =============================================================================

  const saveFloorPlan = useCallback(async () => {
    if (!organizer?.id || !user?.id) {
      alert('Organizer or user information not available.')
      return
    }

    try {
      const floorPlanData = {
        name: floorPlanName,
        organizer_id: organizer.id,
        created_by: organizer.user_id || user.id,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        grid_size: gridSize,
        floors: floors,
        walls: walls,
        rooms: rooms,
        doors: doors,
        windows: windows,
        structural_elements: structuralElements,
        metadata: {
          viewMode,
          zoom,
          showGrid,
          showDimensions
        }
      }

      // TODO: Save to Supabase `event_floor_plans` table
      alert('Floor plan saved! (Database integration coming soon)')
    } catch (error) {
      console.error('Error saving floor plan:', error)
      alert('Failed to save floor plan: ' + error.message)
    }
  }, [organizer, user, floorPlanName, canvasWidth, canvasHeight, gridSize, floors, walls, rooms, doors, windows, structuralElements, viewMode, zoom, showGrid, showDimensions])

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-screen flex flex-col bg-[#1e1e2e] text-white overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 bg-[#2d2d3d] border-b border-[#3d3d4d] flex items-center px-4 gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/organizer')}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        <Input
          value={floorPlanName}
          onChange={(e) => setFloorPlanName(e.target.value)}
          className="w-56 h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-sm"
        />

        <div className="flex-1" />

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#1e1e2e] rounded-lg p-0.5 border border-[#3d3d4d]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('2d')}
            className={`h-7 px-3 text-xs ${viewMode === '2d' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            2D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('isometric')}
            className={`h-7 px-3 text-xs ${viewMode === 'isometric' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            3D ISO
          </Button>
        </div>

        <div className="w-px h-6 bg-[#3d3d4d]" />

        {/* Zoom Controls */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(prev => Math.min(200, prev + 10))}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <span className="text-xs text-white/60 min-w-[3rem] text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(prev => Math.max(25, prev - 10))}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#3d3d4d]" />

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

        {/* Save */}
        <Button
          variant="ghost"
          size="sm"
          onClick={saveFloorPlan}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-[#252535] border-r border-[#3d3d4d] flex flex-col items-center py-4 gap-2 flex-shrink-0">
          <Button
            variant={tool === 'select' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('select')}
            className={`w-12 h-12 ${tool === 'select' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Move className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'wall' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('wall')}
            className={`w-12 h-12 ${tool === 'wall' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Square className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'door' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('door')}
            className={`w-12 h-12 ${tool === 'door' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <DoorOpen className="w-5 h-5" />
          </Button>
          <div className="w-8 h-px bg-[#3d3d4d] my-1" />
          <Button
            variant={showGrid ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowGrid(!showGrid)}
            className={`w-12 h-12 ${showGrid ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Grid className="w-5 h-5" />
          </Button>
          <Button
            variant={showDimensions ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowDimensions(!showDimensions)}
            className={`w-12 h-12 ${showDimensions ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Ruler className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#1a1a2a]"
          onMouseDown={handleCanvasMouseDown}
        >
          <div className="p-8 min-w-max min-h-max">
            <svg
              ref={canvasRef}
              width={canvasWidth * (zoom / 100)}
              height={canvasHeight * (zoom / 100)}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="bg-white rounded shadow-xl"
              onMouseMove={handleCanvasMouseMove}
            >
              {/* Grid */}
              {renderGrid}

              {/* Walls */}
              {walls.map(wall => wall.floor === currentFloor && renderWall(wall))}

              {/* Temporary wall being drawn */}
              {drawingWall && wallStartPoint && tempWallEnd && (
                <g>
                  <line
                    x1={wallStartPoint.x}
                    y1={wallStartPoint.y}
                    x2={tempWallEnd.x}
                    y2={tempWallEnd.y}
                    stroke="#2969FF"
                    strokeWidth={6}
                    strokeDasharray="4 2"
                    strokeLinecap="round"
                  />
                  {/* Length preview */}
                  {showDimensions && (
                    <g>
                      <text
                        x={(wallStartPoint.x + tempWallEnd.x) / 2}
                        y={(wallStartPoint.y + tempWallEnd.y) / 2 - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#2969FF"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        {pixelsToFeet(Math.sqrt(Math.pow(tempWallEnd.x - wallStartPoint.x, 2) + Math.pow(tempWallEnd.y - wallStartPoint.y, 2))).toFixed(1)} ft
                      </text>
                    </g>
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
