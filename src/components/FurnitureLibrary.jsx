/**
 * Furniture Library Component
 * Drag-and-drop furniture items for venue layout designer
 */

import { useState, useEffect } from 'react'
import { Search, Armchair, Table, Mic, Monitor, Coffee, Users, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

const categoryIcons = {
  chair: Armchair,
  table: Table,
  stage: Mic,
  screen: Monitor,
  bar: Coffee,
  area: Users,
  entrance: Star,
  exit: Star,
  checkin: Users,
  dj: Mic
}

const categoryColors = {
  chair: '#8B4513',
  table: '#654321',
  stage: '#2C2C2C',
  screen: '#000000',
  bar: '#8B4513',
  area: '#90EE90',
  entrance: '#FF0000',
  exit: '#FF0000',
  checkin: '#2196F3',
  dj: '#9C27B0'
}

// Default furniture types when database table doesn't exist
const DEFAULT_FURNITURE_TYPES = [
  { id: 'chair-1', name: 'Standard Chair', category: 'chair', description: 'Basic seating chair', default_width: 0.5, default_height: 0.5, default_capacity: 1, is_active: true },
  { id: 'chair-2', name: 'VIP Chair', category: 'chair', description: 'Premium leather chair', default_width: 0.6, default_height: 0.6, default_capacity: 1, is_active: true },
  { id: 'chair-3', name: 'Folding Chair', category: 'chair', description: 'Compact folding chair', default_width: 0.45, default_height: 0.45, default_capacity: 1, is_active: true },
  { id: 'table-1', name: 'Round Table', category: 'table', description: 'Round dining table', default_width: 1.5, default_height: 1.5, default_capacity: 8, is_active: true },
  { id: 'table-2', name: 'Rectangular Table', category: 'table', description: 'Long rectangular table', default_width: 2.0, default_height: 0.8, default_capacity: 6, is_active: true },
  { id: 'table-3', name: 'Cocktail Table', category: 'table', description: 'High cocktail/bar table', default_width: 0.6, default_height: 0.6, default_capacity: 4, is_active: true },
  { id: 'stage-1', name: 'Main Stage', category: 'stage', description: 'Large performance stage', default_width: 8.0, default_height: 5.0, default_capacity: 0, is_active: true },
  { id: 'stage-2', name: 'Small Stage', category: 'stage', description: 'Small platform stage', default_width: 4.0, default_height: 3.0, default_capacity: 0, is_active: true },
  { id: 'bar-1', name: 'Bar Counter', category: 'bar', description: 'Full bar counter', default_width: 4.0, default_height: 1.0, default_capacity: 0, is_active: true },
  { id: 'bar-2', name: 'Mobile Bar', category: 'bar', description: 'Portable bar station', default_width: 2.0, default_height: 0.8, default_capacity: 0, is_active: true },
  { id: 'dj-1', name: 'DJ Booth', category: 'dj', description: 'DJ performance area', default_width: 3.0, default_height: 2.0, default_capacity: 2, is_active: true },
  { id: 'checkin-1', name: 'Check-in Desk', category: 'checkin', description: 'Registration/check-in counter', default_width: 3.0, default_height: 1.0, default_capacity: 0, is_active: true },
  { id: 'screen-1', name: 'LED Screen', category: 'screen', description: 'Large LED display', default_width: 4.0, default_height: 2.5, default_capacity: 0, is_active: true },
  { id: 'entrance-1', name: 'Main Entrance', category: 'entrance', description: 'Main entry point', default_width: 2.0, default_height: 1.0, default_capacity: 0, is_active: true },
  { id: 'exit-1', name: 'Emergency Exit', category: 'exit', description: 'Emergency exit door', default_width: 1.5, default_height: 0.5, default_capacity: 0, is_active: true },
  { id: 'area-1', name: 'Dance Floor', category: 'area', description: 'Open dance area', default_width: 6.0, default_height: 6.0, default_capacity: 50, is_active: true },
  { id: 'area-2', name: 'Lounge Area', category: 'area', description: 'Relaxation zone', default_width: 4.0, default_height: 3.0, default_capacity: 15, is_active: true },
]

export function FurnitureLibrary({ onItemSelect, onItemDragStart }) {
  const [furnitureTypes, setFurnitureTypes] = useState(DEFAULT_FURNITURE_TYPES)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [draggedItem, setDraggedItem] = useState(null)

  useEffect(() => {
    loadFurnitureTypes()
  }, [])

  const loadFurnitureTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('furniture_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })

      if (error) {
        // If table doesn't exist, use default furniture types
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('Using default furniture types - database table not found')
          setFurnitureTypes(DEFAULT_FURNITURE_TYPES)
          return
        }
        throw error
      }
      setFurnitureTypes(data && data.length > 0 ? data : DEFAULT_FURNITURE_TYPES)
    } catch (error) {
      console.error('Failed to load furniture types:', error)
      // Use defaults on any error
      setFurnitureTypes(DEFAULT_FURNITURE_TYPES)
    }
  }

  const filteredFurniture = furnitureTypes.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ['all', ...new Set(furnitureTypes.map(item => item.category))]

  const handleDragStart = (e, item) => {
    setDraggedItem(item)
    e.dataTransfer.setData('application/json', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'

    // Call parent callback
    if (onItemDragStart) {
      onItemDragStart(item)
    }
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const renderFurnitureItem = (item) => {
    const IconComponent = categoryIcons[item.category] || Star

    return (
      <Card
        key={item.id}
        className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
          draggedItem?.id === item.id ? 'opacity-50 scale-95' : ''
        }`}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        onClick={() => onItemSelect && onItemSelect(item)}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {/* Furniture Icon/Preview */}
            <div className="flex-shrink-0">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: categoryColors[item.category] || '#CCCCCC' }}
              >
                <IconComponent className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Furniture Details */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {item.name}
              </h4>
              <p className="text-xs text-gray-500 truncate">
                {item.description}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {item.category}
                </Badge>
                <span className="text-xs text-gray-400">
                  {item.default_width}×{item.default_height}m
                </span>
                {item.default_capacity > 0 && (
                  <span className="text-xs text-gray-400">
                    {item.default_capacity} people
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="font-medium">Size:</span>
                <br />
                {item.default_width} × {item.default_height} m
              </div>
              <div>
                <span className="font-medium">Capacity:</span>
                <br />
                {item.default_capacity || 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderFurnitureGrid = (items) => (
    <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
      {items.map(renderFurnitureItem)}
    </div>
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Armchair className="w-5 h-5" />
          Furniture Library
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search furniture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Furniture Grid */}
        {renderFurnitureGrid(filteredFurniture)}

        {/* Quick Add Buttons */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Add</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const chair = furnitureTypes.find(f => f.category === 'chair')
                if (chair) onItemSelect && onItemSelect(chair)
              }}
            >
              <Armchair className="w-4 h-4 mr-2" />
              Armchair
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const table = furnitureTypes.find(f => f.category === 'table')
                if (table) onItemSelect && onItemSelect(table)
              }}
            >
              <Table className="w-4 h-4 mr-2" />
              Table
            </Button>
          </div>
        </div>

        {/* Library Stats */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>Total Items: {furnitureTypes.length}</div>
            <div>Categories: {categories.length - 1}</div>
            {searchTerm && (
              <div>Filtered: {filteredFurniture.length}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Furniture Item Preview Component
export function FurniturePreview({ item, size = 48 }) {
  if (!item) return null

  const IconComponent = categoryIcons[item.category] || Star

  return (
    <div
      className="flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50"
      style={{
        width: size,
        height: size,
        backgroundColor: categoryColors[item.category] || '#CCCCCC'
      }}
    >
      <IconComponent className="w-6 h-6 text-white" />
    </div>
  )
}

// Drag Overlay Component
export function FurnitureDragOverlay({ item }) {
  if (!item) return null

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <Card className="shadow-lg border-2 border-blue-500">
        <CardContent className="p-3">
          <div className="flex items-center space-x-2">
            <FurniturePreview item={item} size={32} />
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-gray-500">
                {item.default_width}×{item.default_height}m
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}