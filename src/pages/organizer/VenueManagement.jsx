/**
 * Venue Management Page
 * Lists venues and allows organizers to manage layouts
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Plus, Settings, Edit, Eye, Trash2,
  Users, Layout, Building2, HelpCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'
import { HelpTip } from '@/components/HelpTip'

export function VenueManagement() {
  const navigate = useNavigate()
  const { organizer } = useOrganizer()

  const [venues, setVenues] = useState([])
  const [layouts, setLayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateVenue, setShowCreateVenue] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState(null)

  // Form state for creating venues
  const [venueForm, setVenueForm] = useState({
    name: '',
    address: '',
    capacity: '',
    venue_type: 'indoor',
    iot_enabled: false
  })

  useEffect(() => {
    if (organizer?.id) {
      loadVenues()
    }
  }, [organizer?.id])

  const loadVenues = async () => {
    if (!organizer?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('venues')
        .select(`
          *,
          venue_layouts (
            id,
            name,
            is_active,
            created_at,
            layout_sections (count),
            layout_furniture (count)
          )
        `)
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist, show empty state with helpful message
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('Venues table not found - database setup required')
          setVenues([])
          return
        }
        throw error
      }
      setVenues(data || [])
    } catch (error) {
      console.error('Failed to load venues:', error)
      setVenues([])
    } finally {
      setLoading(false)
    }
  }

  const createVenue = async () => {
    if (!organizer?.id) {
      alert('Please log in as an organizer to create venues')
      return
    }

    try {
      const venueData = {
        organizer_id: organizer.id,
        name: venueForm.name,
        address: venueForm.address,
        capacity: parseInt(venueForm.capacity) || 100,
        venue_type: venueForm.venue_type,
        iot_enabled: venueForm.iot_enabled
      }

      const { data, error } = await supabase
        .from('venues')
        .insert(venueData)
        .select()
        .single()

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          alert('The venue database tables need to be set up first. Please run the SQL schema from database/iot_venue_schema.sql')
          return
        }
        throw error
      }

      setVenues(prev => [data, ...prev])
      setVenueForm({
        name: '',
        address: '',
        capacity: '',
        venue_type: 'indoor',
        iot_enabled: false
      })
      setShowCreateVenue(false)

      // Navigate to create first layout for this venue
      navigate(`/organizer/venues/${data.id}/layouts/create`)
    } catch (error) {
      console.error('Failed to create venue:', error)
      alert('Failed to create venue: ' + error.message)
    }
  }

  const deleteVenue = async (venueId) => {
    if (!window.confirm('Are you sure you want to delete this venue? This will also delete all associated layouts.')) {
      return
    }

    try {
      // First delete associated layouts
      await supabase
        .from('venue_layouts')
        .delete()
        .eq('venue_id', venueId)

      // Then delete the venue
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', venueId)

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          // Table doesn't exist, just remove from local state
          setVenues(prev => prev.filter(v => v.id !== venueId))
          return
        }
        throw error
      }

      setVenues(prev => prev.filter(v => v.id !== venueId))
    } catch (error) {
      console.error('Failed to delete venue:', error)
      alert('Failed to delete venue: ' + error.message)
    }
  }

  const getVenueStats = (venue) => {
    const layouts = venue.venue_layouts || []
    const activeLayouts = layouts.filter(l => l.is_active)
    const totalSections = layouts.reduce((sum, l) => sum + (l.layout_sections?.[0]?.count || 0), 0)
    const totalFurniture = layouts.reduce((sum, l) => sum + (l.layout_furniture?.[0]?.count || 0), 0)

    return {
      layouts: layouts.length,
      activeLayouts: activeLayouts.length,
      totalSections,
      totalFurniture
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
          <h1 className="text-3xl font-bold text-[#0F0F0F] flex items-center gap-2">
            Venue Management
            <HelpTip>Create venue layouts with seating sections, standing areas, and amenities. Link layouts to events for seat selection ticketing.</HelpTip>
          </h1>
          <p className="text-[#0F0F0F]/60 mt-1">
            Manage your venues and create interactive layouts
          </p>
        </div>
        <Dialog open={showCreateVenue} onOpenChange={setShowCreateVenue}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Venue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="venueName">Venue Name</Label>
                <Input
                  id="venueName"
                  value={venueForm.name}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter venue name"
                />
              </div>
              <div>
                <Label htmlFor="venueAddress">Address</Label>
                <Textarea
                  id="venueAddress"
                  value={venueForm.address}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter full address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="venueCapacity">Capacity</Label>
                  <Input
                    id="venueCapacity"
                    type="number"
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm(prev => ({ ...prev, capacity: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="venueType">Type</Label>
                  <select
                    id="venueType"
                    className="w-full px-3 py-2 border rounded-md"
                    value={venueForm.venue_type}
                    onChange={(e) => setVenueForm(prev => ({ ...prev, venue_type: e.target.value }))}
                  >
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="iotEnabled"
                  checked={false}
                  disabled={true}
                  title="IoT feature is currently disabled"
                />
                <Label htmlFor="iotEnabled" className="flex items-center opacity-50">
                  Enable IoT Smart Features (Disabled)
                </Label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateVenue(false)}>
                  Cancel
                </Button>
                <Button onClick={createVenue} disabled={!venueForm.name || !venueForm.address}>
                  Create Venue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Venues List */}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Venues Yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first venue to start designing interactive layouts
            </p>
            <Button onClick={() => setShowCreateVenue(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Venue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map(venue => {
            const stats = getVenueStats(venue)
            return (
              <Card key={venue.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        {venue.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{venue.address}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="capitalize">
                        {venue.venue_type}
                      </Badge>
                      {false ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          IoT
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Basic
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Venue Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex items-center text-gray-600 mb-1">
                          <Users className="w-3 h-3 mr-1" />
                          Capacity
                        </div>
                        <div className="font-medium">{venue.capacity}</div>
                      </div>
                      <div>
                        <div className="flex items-center text-gray-600 mb-1">
                          <Layout className="w-3 h-3 mr-1" />
                          Layouts
                        </div>
                        <div className="font-medium">{stats.layouts} ({stats.activeLayouts} active)</div>
                      </div>
                    </div>

                    {/* Layout Details */}
                    {stats.layouts > 0 && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Layout Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>Sections: {stats.totalSections}</div>
                          <div>Furniture: {stats.totalFurniture}</div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/organizer/venues/${venue.id}/layouts`)}
                        >
                          <Layout className="w-4 h-4 mr-1" />
                          Layouts
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVenue(venue.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sample Data Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900">Sample Venue Available</h4>
              <p className="text-sm text-blue-700 mt-1">
                Try our sample "Tech Conference Center" with a complete layout to see how the venue designer works.
                Perfect for learning the layout features before creating your own venues.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={async () => {
                  // Check if sample already exists
                  let sampleVenue = venues.find(v => v.name === 'Tech Conference Center (Sample)')
                  
                  if (!sampleVenue && organizer?.id) {
                    // Create sample venue
                    const { data: newVenue, error } = await supabase
                      .from('venues')
                      .insert({
                        organizer_id: organizer.id,
                        name: 'Tech Conference Center (Sample)',
                        address: '123 Innovation Drive, Tech City',
                        capacity: 500,
                        venue_type: 'indoor',
                        description: 'A sample venue to help you learn the layout designer. Feel free to modify or delete it!'
                      })
                      .select()
                      .single()
                    
                    if (error) {
                      console.error('Failed to create sample venue:', error)
                      alert('Could not create sample venue. Please try creating a venue manually.')
                      return
                    }
                    
                    // Create sample layout
                    if (newVenue) {
                      const { data: layout } = await supabase
                        .from('venue_layouts')
                        .insert({
                          venue_id: newVenue.id,
                          name: 'Main Conference Layout',
                          is_active: true,
                          canvas_width: 1200,
                          canvas_height: 800
                        })
                        .select()
                        .single()
                      
                      if (layout) {
                        // Add sample sections
                        await supabase.from('layout_sections').insert([
                          { layout_id: layout.id, name: 'Main Stage', section_type: 'stage', x: 100, y: 50, width: 400, height: 150, color: '#3b82f6' },
                          { layout_id: layout.id, name: 'VIP Seating', section_type: 'seating', x: 100, y: 250, width: 200, height: 200, capacity: 50, color: '#f59e0b' },
                          { layout_id: layout.id, name: 'General Admission', section_type: 'seating', x: 350, y: 250, width: 250, height: 250, capacity: 200, color: '#10b981' },
                          { layout_id: layout.id, name: 'Bar Area', section_type: 'amenity', x: 650, y: 50, width: 150, height: 100, color: '#8b5cf6' },
                          { layout_id: layout.id, name: 'Registration', section_type: 'entrance', x: 100, y: 550, width: 200, height: 80, color: '#ec4899' }
                        ])
                      }
                      
                      sampleVenue = newVenue
                    }
                  }
                  
                  if (sampleVenue) {
                    navigate(`/organizer/venue-layout/${sampleVenue.id}`)
                  }
                }}
              >
                Explore Sample Layout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}