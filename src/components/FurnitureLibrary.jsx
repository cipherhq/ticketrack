/**
 * Furniture Library Component
 * Drag-and-drop furniture items for venue layout designer
 */

import { useState, useEffect } from 'react'
import { Search, Chair, Table, Mic, Monitor, Coffee, Users, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'

const categoryIcons = {
  chair: Chair,
  table: Table,
  stage: Mic,
  screen: Monitor,
  bar: Coffee,
  area: Users,
  entrance: Star,
  exit: Star
}

const categoryColors = {
  chair: '#8B4513',
  table: '#654321',
  stage: '#2C2C2C',
  screen: '#000000',
  bar: '#8B4513',
  area: '#90EE90',
  entrance: '#FF0000',
  exit: '#FF0000'
}

export function FurnitureLibrary({ onItemSelect, onItemDragStart }) {
  const [furnitureTypes, setFurnitureTypes] = useState([])
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

      if (error) throw error
      setFurnitureTypes(data || [])
    } catch (error) {
      console.error('Failed to load furniture types:', error)
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
          <Chair className="w-5 h-5" />
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
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-4">
            {categories.slice(0, 4).map(category => (
              <TabsTrigger key={category} value={category} className="text-xs">
                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.slice(4).map(category => (
            <TabsTrigger key={category} value={category} className="hidden">
              {category}
            </TabsTrigger>
          ))}

          <TabsContent value={selectedCategory} className="mt-4">
            {renderFurnitureGrid(filteredFurniture)}
          </TabsContent>
        </Tabs>

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
              <Chair className="w-4 h-4 mr-2" />
              Chair
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