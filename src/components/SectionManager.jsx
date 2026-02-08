/**
 * Section Manager Component
 * Configure sections with pricing, capacity, and properties
 */

import { useState, useEffect } from 'react'
import { Palette, Users, DollarSign, Settings, Trash2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

const sectionTypes = [
  { value: 'seating', label: 'Seating', color: '#4CAF50', description: 'Assigned seats' },
  { value: 'standing', label: 'Standing', color: '#FF9800', description: 'General admission standing' },
  { value: 'vip', label: 'VIP', color: '#FFD700', description: 'Premium seating area' },
  { value: 'stage', label: 'Stage', color: '#9C27B0', description: 'Performance area' },
  { value: 'bar', label: 'Bar', color: '#795548', description: 'Service area' },
  { value: 'entrance', label: 'Entrance', color: '#F44336', description: 'Entry/exit points' },
  { value: 'exit', label: 'Exit', color: '#F44336', description: 'Exit points' },
  { value: 'restroom', label: 'Restroom', color: '#2196F3', description: 'Bathroom facilities' },
  { value: 'storage', label: 'Storage', color: '#607D8B', description: 'Equipment storage' }
]

const accessibilityFeatures = [
  { value: 'wheelchair_access', label: 'Wheelchair Access', icon: '♿' },
  { value: 'hearing_assistance', label: 'Hearing Assistance', icon: '🦻' },
  { value: 'visual_aids', label: 'Visual Aids', icon: '👁️' },
  { value: 'elevator', label: 'Elevator Access', icon: '⬆️' },
  { value: 'ramp', label: 'Ramp Access', icon: '♿' }
]

export function SectionManager({ sections, onSectionsChange, eventId }) {
  const [selectedSection, setSelectedSection] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [ticketTypes, setTicketTypes] = useState([])

  useEffect(() => {
    if (eventId) {
      loadTicketTypes()
    }
  }, [eventId])

  const loadTicketTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('id, name, price')
        .eq('event_id', eventId)

      if (error) throw error
      setTicketTypes(data || [])
    } catch (error) {
      console.error('Failed to load ticket types:', error)
    }
  }

  const handleSectionUpdate = (sectionId, updates) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    )
    onSectionsChange(updatedSections)
  }

  const handleSectionDelete = (sectionId) => {
    const updatedSections = sections.filter(section => section.id !== sectionId)
    onSectionsChange(updatedSections)
    if (selectedSection?.id === sectionId) {
      setSelectedSection(null)
    }
  }

  const handleAddSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      name: `New Section ${sections.length + 1}`,
      section_type: 'seating',
      display_color: '#CCCCCC',
      capacity: 50,
      pricing_multiplier: 1.0,
      accessibility_features: [],
      coordinates: [],
      sort_order: sections.length
    }
    onSectionsChange([...sections, newSection])
    setSelectedSection(newSection)
    setIsDialogOpen(true)
  }

  const getSectionTypeInfo = (type) => {
    return sectionTypes.find(t => t.value === type) || sectionTypes[0]
  }

  const calculateSectionArea = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0

    // Simple polygon area calculation using shoelace formula
    let area = 0
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length
      area += coordinates[i].x * coordinates[j].y
      area -= coordinates[j].x * coordinates[i].y
    }
    return Math.abs(area) / 2
  }

  const SectionCard = ({ section }) => {
    const typeInfo = getSectionTypeInfo(section.section_type)
    const area = calculateSectionArea(section.coordinates)

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          selectedSection?.id === section.id ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedSection(section)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: section.display_color }}
              />
              <div>
                <h4 className="font-medium text-foreground">{section.name}</h4>
                <p className="text-sm text-muted-foreground">{typeInfo.label}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedSection(section)
                  setIsDialogOpen(true)
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSectionDelete(section.id)
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center text-muted-foreground mb-1">
                <Users className="w-3 h-3 mr-1" />
                Capacity
              </div>
              <div className="font-medium">{section.capacity || 0}</div>
            </div>
            <div>
              <div className="flex items-center text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3 mr-1" />
                Multiplier
              </div>
              <div className="font-medium">{section.pricing_multiplier}x</div>
            </div>
          </div>

          {area > 0 && (
            <div className="mt-3 pt-3 border-t border-border/10">
              <div className="text-xs text-muted-foreground">
                Area: {area.toFixed(1)} m²
              </div>
            </div>
          )}

          {section.accessibility_features && section.accessibility_features.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {section.accessibility_features.map(feature => {
                const featureInfo = accessibilityFeatures.find(f => f.value === feature)
                return featureInfo ? (
                  <Badge key={feature} variant="outline" className="text-xs">
                    {featureInfo.icon} {featureInfo.label}
                  </Badge>
                ) : null
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const SectionConfigDialog = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure Section: {selectedSection?.name}
          </DialogTitle>
        </DialogHeader>

        {selectedSection && (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sectionName">Section Name</Label>
                <Input
                  id="sectionName"
                  value={selectedSection.name}
                  onChange={(e) => handleSectionUpdate(selectedSection.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sectionType">Section Type</Label>
                <Select
                  value={selectedSection.section_type}
                  onValueChange={(value) => handleSectionUpdate(selectedSection.id, { section_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Visual Properties */}
            <div>
              <Label>Display Color</Label>
              <div className="flex items-center space-x-3 mt-2">
                <input
                  type="color"
                  value={selectedSection.display_color}
                  onChange={(e) => handleSectionUpdate(selectedSection.id, { display_color: e.target.value })}
                  className="w-12 h-8 border rounded cursor-pointer"
                />
                <Input
                  value={selectedSection.display_color}
                  onChange={(e) => handleSectionUpdate(selectedSection.id, { display_color: e.target.value })}
                  placeholder="#CCCCCC"
                />
              </div>
            </div>

            {/* Capacity & Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={selectedSection.capacity || ''}
                  onChange={(e) => handleSectionUpdate(selectedSection.id, { capacity: parseInt(e.target.value) || 0 })}
                  placeholder="Number of people"
                />
              </div>
              <div>
                <Label htmlFor="pricing">Price Multiplier</Label>
                <Input
                  id="pricing"
                  type="number"
                  step="0.1"
                  value={selectedSection.pricing_multiplier || ''}
                  onChange={(e) => handleSectionUpdate(selectedSection.id, { pricing_multiplier: parseFloat(e.target.value) || 1.0 })}
                  placeholder="1.0"
                />
              </div>
            </div>

            {/* Accessibility Features */}
            <div>
              <Label>Accessibility Features</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {accessibilityFeatures.map(feature => (
                  <div key={feature.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={feature.value}
                      checked={selectedSection.accessibility_features?.includes(feature.value) || false}
                      onChange={(e) => {
                        const features = selectedSection.accessibility_features || []
                        const newFeatures = e.target.checked
                          ? [...features, feature.value]
                          : features.filter(f => f !== feature.value)
                        handleSectionUpdate(selectedSection.id, { accessibility_features: newFeatures })
                      }}
                    />
                    <label htmlFor={feature.value} className="text-sm flex items-center space-x-1">
                      <span>{feature.icon}</span>
                      <span>{feature.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Section Statistics */}
            <div className="bg-background p-4 rounded-lg">
              <h4 className="font-medium text-foreground mb-2">Section Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Area:</span>
                  <span className="ml-2 font-medium">
                    {calculateSectionArea(selectedSection.coordinates).toFixed(1)} m²
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Coordinates:</span>
                  <span className="ml-2 font-medium">
                    {selectedSection.coordinates?.length || 0} points
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Density:</span>
                  <span className="ml-2 font-medium">
                    {selectedSection.capacity && selectedSection.coordinates ?
                      (selectedSection.capacity / calculateSectionArea(selectedSection.coordinates)).toFixed(1) :
                      'N/A'} people/m²
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ticket Types:</span>
                  <span className="ml-2 font-medium">{ticketTypes.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Section Management</h3>
          <p className="text-sm text-muted-foreground">
            Configure sections with pricing, capacity, and accessibility
          </p>
        </div>
        <Button onClick={handleAddSection}>
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </Button>
      </div>

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Sections Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create sections to organize your venue layout
            </p>
            <Button onClick={handleAddSection}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Section
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(section => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      )}

      {/* Configuration Dialog */}
      <SectionConfigDialog />

      {/* Summary Stats */}
      {sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layout Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{sections.length}</div>
                <div className="text-sm text-muted-foreground">Total Sections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {sections.reduce((sum, s) => sum + (s.capacity || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Capacity</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {sections.filter(s => s.accessibility_features?.length > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Accessible Sections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {sections.reduce((sum, s) => sum + calculateSectionArea(s.coordinates), 0).toFixed(0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Area (m²)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}