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
  Plus, Minus, X, Download, Upload, Settings, Camera, Building2
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
  // TOOL STATE
  // =============================================================================

  const [tempWallEnd, setTempWallEnd] = useState(null)
  const [selectedWallType, setSelectedWallType] = useState('wall')
  const [selectedElement, setSelectedElement] = useState(null) // For doors/windows/rooms

  // =============================================================================
  // WALL DRAWING
  // =============================================================================

  const handleCanvasMouseDown = useCallback((e) => {
    const coords = getCanvasCoords(e)
    const snappedCoords = {
      x: snapValue(coords.x),
      y: snapValue(coords.y)
    }

    if (tool === 'wall') {
      if (!drawingWall) {
        // Start drawing wall
        setDrawingWall(true)
        setWallStartPoint(snappedCoords)
      } else {
        // Finish drawing wall
        const wallThickness = selectedWallType === 'wall-exterior' ? 12 : selectedWallType === 'wall-glass' ? 4 : 6
        const newWall = {
          id: `wall-${Date.now()}`,
          type: selectedWallType,
          x1: wallStartPoint.x,
          y1: wallStartPoint.y,
          x2: snappedCoords.x,
          y2: snappedCoords.y,
          thickness: wallThickness,
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
    } else if (tool === 'door') {
      // Place door
      const doorType = ROOM_ELEMENTS.find(el => el.type.startsWith('door-')) || ROOM_ELEMENTS[0]
      const newDoor = {
        id: `door-${Date.now()}`,
        type: doorType.type,
        x: snappedCoords.x,
        y: snappedCoords.y,
        width: doorType.width,
        height: doorType.height,
        rotation: 0,
        floor: currentFloor,
      }
      setDoors(prev => {
        const updated = [...prev, newDoor]
        saveToHistory(updated)
        return updated
      })
    } else if (tool === 'window') {
      // Place window
      const windowType = ROOM_ELEMENTS.find(el => el.type.startsWith('window-')) || ROOM_ELEMENTS[3]
      const newWindow = {
        id: `window-${Date.now()}`,
        type: windowType.type,
        x: snappedCoords.x,
        y: snappedCoords.y,
        width: windowType.width,
        height: windowType.height,
        rotation: 0,
        floor: currentFloor,
      }
      setWindows(prev => {
        const updated = [...prev, newWindow]
        saveToHistory(updated)
        return updated
      })
    } else if (tool === 'room') {
      // Start room selection (click and drag)
      // For now, just place a room marker
      const roomType = ROOM_TYPES[0]
      const newRoom = {
        id: `room-${Date.now()}`,
        type: 'room',
        x: snappedCoords.x,
        y: snappedCoords.y,
        width: 200,
        height: 150,
        name: roomType.name,
        color: roomType.color,
        floor: currentFloor,
      }
      setRooms(prev => {
        const updated = [...prev, newRoom]
        saveToHistory(updated)
        return updated
      })
    } else {
      // Select mode
      setSelectedIds([])
    }
  }, [tool, drawingWall, wallStartPoint, selectedWallType, getCanvasCoords, snapValue, currentFloor, saveToHistory])

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
    
    // Wall color based on type
    const wallColor = wall.type === 'wall-exterior' ? '#222' : wall.type === 'wall-glass' ? '#4FC3F7' : '#333'
    const wallOpacity = wall.type === 'wall-glass' ? 0.6 : 1

    return (
      <g key={wall.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedIds([wall.id])}>
        {/* Wall shadow */}
        <line
          x1={wall.x1 + 1}
          y1={wall.y1 + 1}
          x2={wall.x2 + 1}
          y2={wall.y2 + 1}
          stroke="#000"
          strokeWidth={wall.thickness}
          strokeLinecap="round"
          opacity={0.2}
        />
        {/* Wall line */}
        <line
          x1={wall.x1}
          y1={wall.y1}
          x2={wall.x2}
          y2={wall.y2}
          stroke={wallColor}
          strokeWidth={wall.thickness}
          strokeLinecap="round"
          opacity={wallOpacity}
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
          opacity={wall.type === 'wall-glass' ? 0.3 : 0.8}
        />
        {/* Glass wall pattern */}
        {wall.type === 'wall-glass' && (
          <>
            {Array.from({ length: Math.floor(length / 20) }).map((_, i) => {
              const t = i / Math.floor(length / 20)
              const px = wall.x1 + dx * t
              const py = wall.y1 + dy * t
              return (
                <line
                  key={i}
                  x1={px - dy / length * 8}
                  y1={py + dx / length * 8}
                  x2={px + dy / length * 8}
                  y2={py - dx / length * 8}
                  stroke="#2196F3"
                  strokeWidth={1}
                  opacity={0.5}
                />
              )
            })}
          </>
        )}
        {/* Dimensions */}
        {showDimensions && length > 50 && (
          <g transform={`translate(${(wall.x1 + wall.x2) / 2}, ${(wall.y1 + wall.y2) / 2}) rotate(${angle})`}>
            <rect x={-25} y={-15} width={50} height={20} fill="#fff" fillOpacity={0.9} rx={3} />
            <text
              x={0}
              y={-3}
              textAnchor="middle"
              fontSize="10"
              fill="#333"
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              {pixelsToFeet(length).toFixed(1)} ft
            </text>
          </g>
        )}
        {/* Selection indicator */}
        {selectedIds.includes(wall.id) && (
          <>
            <circle cx={wall.x1} cy={wall.y1} r={8} fill="#2969FF" stroke="#fff" strokeWidth={2} />
            <circle cx={wall.x2} cy={wall.y2} r={8} fill="#2969FF" stroke="#fff" strokeWidth={2} />
          </>
        )}
      </g>
    )
  }, [showDimensions, pixelsToFeet, selectedIds])

  const renderDoor = useCallback((door) => {
    const cx = door.x
    const cy = door.y
    const w = door.width
    const h = door.height

    return (
      <g key={door.id} transform={`translate(${cx}, ${cy}) rotate(${door.rotation || 0})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedIds([door.id])}>
        {/* Door frame */}
        <rect x={-w/2} y={-h/2} width={w} height={h} fill="#8B4513" stroke="#654321" strokeWidth={1.5} rx={2} />
        {/* Door panel */}
        <rect x={-w/2 + 2} y={-h/2 + 2} width={w - 4} height={h - 4} fill="#DEB887" stroke="#8B4513" strokeWidth={1} rx={1} />
        {/* Door handle */}
        <circle cx={w/2 - 8} cy={0} r={2} fill="#C0C0C0" stroke="#999" strokeWidth={0.5} />
        {/* Door arc (open indicator) */}
        <path
          d={`M ${w/2} ${-h/2} A ${w} ${w} 0 0 1 ${w/2 + w*0.6} ${h/2}`}
          fill="none"
          stroke="#8B4513"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.4}
        />
        {/* Selection indicator */}
        {selectedIds.includes(door.id) && (
          <rect x={-w/2 - 4} y={-h/2 - 4} width={w + 8} height={h + 8} fill="none" stroke="#2969FF" strokeWidth={2} strokeDasharray="4 2" rx={4} />
        )}
      </g>
    )
  }, [selectedIds])

  const renderWindow = useCallback((window) => {
    const cx = window.x
    const cy = window.y
    const w = window.width
    const h = window.height

    return (
      <g key={window.id} transform={`translate(${cx}, ${cy}) rotate(${window.rotation || 0})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedIds([window.id])}>
        {/* Window frame */}
        <rect x={-w/2} y={-h/2} width={w} height={h} fill="#8B4513" stroke="#654321" strokeWidth={2} rx={2} />
        {/* Glass panes */}
        <rect x={-w/2 + 4} y={-h/2 + 4} width={w - 8} height={h - 8} fill="#B3E5FC" stroke="#4FC3F7" strokeWidth={1} opacity={0.6} />
        {/* Window mullions */}
        <line x1={0} y1={-h/2 + 4} x2={0} y2={h/2 - 4} stroke="#8B4513" strokeWidth={1} />
        <line x1={-w/2 + 4} y1={0} x2={w/2 - 4} y2={0} stroke="#8B4513" strokeWidth={1} />
        {/* Selection indicator */}
        {selectedIds.includes(window.id) && (
          <rect x={-w/2 - 4} y={-h/2 - 4} width={w + 8} height={h + 8} fill="none" stroke="#2969FF" strokeWidth={2} strokeDasharray="4 2" rx={4} />
        )}
      </g>
    )
  }, [selectedIds])

  const renderRoom = useCallback((room) => {
    return (
      <g key={room.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedIds([room.id])}>
        {/* Room background */}
        <rect
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          fill={room.color}
          fillOpacity={0.2}
          stroke={room.color}
          strokeWidth={2}
          strokeDasharray="8 4"
          rx={4}
        />
        {/* Room label */}
        <text
          x={room.x + room.width / 2}
          y={room.y + room.height / 2}
          textAnchor="middle"
          fontSize="14"
          fill={room.color}
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          {room.name}
        </text>
        {/* Room area */}
        {showDimensions && (
          <text
            x={room.x + room.width / 2}
            y={room.y + room.height / 2 + 18}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
            style={{ pointerEvents: 'none' }}
          >
            {((pixelsToFeet(room.width) * pixelsToFeet(room.height)) / 100).toFixed(1)} sq ft
          </text>
        )}
        {/* Selection indicator */}
        {selectedIds.includes(room.id) && (
          <rect
            x={room.x - 4}
            y={room.y - 4}
            width={room.width + 8}
            height={room.height + 8}
            fill="none"
            stroke="#2969FF"
            strokeWidth={3}
            strokeDasharray="6 3"
            rx={6}
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
  // KEYBOARD SHORTCUTS
  // =============================================================================

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 's' || e.key === 'S') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          saveFloorPlan()
        } else if (!e.ctrlKey && !e.metaKey) {
          setTool('select')
        }
      } else if (e.key === 'w' || e.key === 'W') setTool('wall')
      else if (e.key === 'd' || e.key === 'D') setTool('door')
      else if (e.key === 'i' || e.key === 'I') setTool('window')
      else if (e.key === 'r' || e.key === 'R') setTool('room')
      else if (e.key === 'g' || e.key === 'G') setShowGrid(!showGrid)
      else if (e.key === 'm' || e.key === 'M') setShowDimensions(!showDimensions)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          setWalls(prev => prev.filter(w => !selectedIds.includes(w.id)))
          setDoors(prev => prev.filter(d => !selectedIds.includes(d.id)))
          setWindows(prev => prev.filter(w => !selectedIds.includes(w.id)))
          setRooms(prev => prev.filter(r => !selectedIds.includes(r.id)))
          setSelectedIds([])
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [tool, showGrid, showDimensions, selectedIds, saveFloorPlan])

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
            title="Select (S)"
          >
            <Move className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'wall' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('wall')}
            className={`w-12 h-12 ${tool === 'wall' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Draw Wall (W)"
          >
            <Square className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'door' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('door')}
            className={`w-12 h-12 ${tool === 'door' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Add Door (D)"
          >
            <DoorOpen className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'window' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('window')}
            className={`w-12 h-12 ${tool === 'window' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Add Window (I)"
          >
            <Eye className="w-5 h-5" />
          </Button>
          <Button
            variant={tool === 'room' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('room')}
            className={`w-12 h-12 ${tool === 'room' ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Add Room (R)"
          >
            <Home className="w-5 h-5" />
          </Button>
          <div className="w-8 h-px bg-[#3d3d4d] my-1" />
          <Button
            variant={showGrid ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowGrid(!showGrid)}
            className={`w-12 h-12 ${showGrid ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Toggle Grid (G)"
          >
            <Grid className="w-5 h-5" />
          </Button>
          <Button
            variant={showDimensions ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowDimensions(!showDimensions)}
            className={`w-12 h-12 ${showDimensions ? 'bg-[#2969FF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Toggle Dimensions (M)"
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

              {/* Rooms (render first so they're behind walls) */}
              {rooms.map(room => room.floor === currentFloor && renderRoom(room))}

              {/* Walls */}
              {walls.map(wall => wall.floor === currentFloor && renderWall(wall))}

              {/* Doors */}
              {doors.map(door => door.floor === currentFloor && renderDoor(door))}

              {/* Windows */}
              {windows.map(window => window.floor === currentFloor && renderWindow(window))}

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
                      <rect
                        x={(wallStartPoint.x + tempWallEnd.x) / 2 - 30}
                        y={(wallStartPoint.y + tempWallEnd.y) / 2 - 18}
                        width={60}
                        height={18}
                        fill="#2969FF"
                        fillOpacity={0.9}
                        rx={3}
                      />
                      <text
                        x={(wallStartPoint.x + tempWallEnd.x) / 2}
                        y={(wallStartPoint.y + tempWallEnd.y) / 2 - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#fff"
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

        {/* Right Panel - Properties */}
        <div className="w-64 bg-[#252535] border-l border-[#3d3d4d] flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[#3d3d4d]">
            <h3 className="text-sm font-medium text-white/80 mb-3">Properties</h3>
            
            {/* Floor Selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-white/60">Current Floor</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newFloor = {
                      name: `Floor ${floors.length}`,
                      level: floors.length
                    }
                    setFloors(prev => [...prev, newFloor])
                    setCurrentFloor(floors.length)
                  }}
                  className="w-6 h-6 text-white/60 hover:text-white hover:bg-white/10"
                  title="Add Floor"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <Select value={currentFloor.toString()} onValueChange={(val) => setCurrentFloor(parseInt(val))}>
                <SelectTrigger className="w-full h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {floors.map((floor, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        {floor.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tool Options */}
            {tool === 'wall' && (
              <div className="mb-4">
                <Label className="text-xs text-white/60 mb-1">Wall Type</Label>
                <Select value={selectedWallType} onValueChange={setSelectedWallType}>
                  <SelectTrigger className="w-full h-8 bg-[#1e1e2e] border-[#3d3d4d] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wall">Interior Wall</SelectItem>
                    <SelectItem value="wall-exterior">Exterior Wall</SelectItem>
                    <SelectItem value="wall-glass">Glass Wall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Selection Info */}
            {selectedIds.length > 0 && (
              <div className="mb-4 p-3 bg-[#1e1e2e] rounded-lg border border-[#3d3d4d]">
                <p className="text-xs text-white/60 mb-2">Selected: {selectedIds.length} item(s)</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Delete selected items
                    setWalls(prev => prev.filter(w => !selectedIds.includes(w.id)))
                    setDoors(prev => prev.filter(d => !selectedIds.includes(d.id)))
                    setWindows(prev => prev.filter(w => !selectedIds.includes(w.id)))
                    setRooms(prev => prev.filter(r => !selectedIds.includes(r.id)))
                    setSelectedIds([])
                  }}
                  className="w-full h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete Selected
                </Button>
              </div>
            )}

            {/* Statistics */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Walls:</span>
                <span className="text-white">{walls.filter(w => w.floor === currentFloor).length}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Doors:</span>
                <span className="text-white">{doors.filter(d => d.floor === currentFloor).length}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Windows:</span>
                <span className="text-white">{windows.filter(w => w.floor === currentFloor).length}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Rooms:</span>
                <span className="text-white">{rooms.filter(r => r.floor === currentFloor).length}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 border-t border-[#3d3d4d] mt-auto">
            <h4 className="text-xs font-medium text-white/80 mb-2">Instructions</h4>
            <div className="space-y-1 text-xs text-white/60">
              <p>• <strong>Wall:</strong> Click to start, click to end</p>
              <p>• <strong>Door/Window:</strong> Click to place</p>
              <p>• <strong>Room:</strong> Click to add room marker</p>
              <p>• <strong>Grid:</strong> 4 feet per unit</p>
              <p>• <strong>Snap:</strong> Enabled by default</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
