/**
 * Venue Details Page
 * Comprehensive view of a single venue with tabs for layouts, events, IoT sensors, and settings
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MapPin, Plus, Settings, Edit, Eye, Trash2, ArrowLeft,
  Users, Layout, Building2, Calendar, Activity, Wifi,
  ExternalLink, MoreHorizontal
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/hooks/useConfirm'
import { toast } from 'sonner'

export function VenueDetails() {
  const { venueId } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const confirm = useConfirm()

  const [venue, setVenue] = useState(null)
  const [layouts, setLayouts] = useState([])
  const [events, setEvents] = useState([])
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditVenue, setShowEditVenue] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    capacity: '',
    venue_type: 'indoor',
    iot_enabled: false,
    latitude: '',
    longitude: ''
  })

  useEffect(() => {
    if (venueId) {
      loadVenueData()
    }
  }, [venueId])

  const loadVenueData = async () => {
    try {
      setLoading(true)

      // Load venue with layouts
      const { data: venueData, error: venueError } = await supabase
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
        .eq('id', venueId)
        .single()

      if (venueError) throw venueError

      setVenue(venueData)
      setLayouts(venueData.venue_layouts || [])

      // Initialize edit form
      setEditForm({
        name: venueData.name || '',
        address: venueData.address || '',
        capacity: venueData.capacity?.toString() || '',
        venue_type: venueData.venue_type || 'indoor',
        iot_enabled: venueData.iot_enabled || false,
        latitude: venueData.latitude?.toString() || '',
        longitude: venueData.longitude?.toString() || ''
      })

      // Load events that use this venue
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, event_date, status')
        .eq('venue_id', venueId)
        .order('event_date', { ascending: false })
        .limit(10)

      setEvents(eventsData || [])

      // Load IoT sensors if enabled
      if (venueData.iot_enabled) {
        const { data: sensorsData } = await supabase
          .from('iot_sensors')
          .select('*')
          .eq('venue_id', venueId)

        setSensors(sensorsData || [])
      }
    } catch (error) {
      console.error('Failed to load venue:', error)
      toast.error('Failed to load venue details')
    } finally {
      setLoading(false)
    }
  }

  const updateVenue = async () => {
    try {
      const venueData = {
        name: editForm.name,
        address: editForm.address,
        capacity: parseInt(editForm.capacity) || 100,
        venue_type: editForm.venue_type,
        iot_enabled: editForm.iot_enabled,
        latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
        longitude: editForm.longitude ? parseFloat(editForm.longitude) : null
      }

      const { data, error } = await supabase
        .from('venues')
        .update(venueData)
        .eq('id', venueId)
        .select()
        .single()

      if (error) throw error

      setVenue({ ...venue, ...data })
      setShowEditVenue(false)
      toast.success('Venue updated successfully!')
    } catch (error) {
      console.error('Failed to update venue:', error)
      toast.error('Failed to update venue: ' + error.message)
    }
  }

  const deleteVenue = async () => {
    const confirmed = await confirm(
      'Delete Venue?',
      'This will permanently delete this venue and all associated layouts. This action cannot be undone.',
      { variant: 'destructive', confirmText: 'Delete', cancelText: 'Cancel' }
    )

    if (!confirmed) return

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

      if (error) throw error

      toast.success('Venue deleted successfully')
      navigate('/organizer/venues')
    } catch (error) {
      console.error('Failed to delete venue:', error)
      toast.error('Failed to delete venue: ' + error.message)
    }
  }

  const deleteLayout = async (layoutId) => {
    const confirmed = await confirm(
      'Delete Layout?',
      'This will permanently delete this layout. This action cannot be undone.',
      { variant: 'destructive', confirmText: 'Delete', cancelText: 'Cancel' }
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('venue_layouts')
        .delete()
        .eq('id', layoutId)

      if (error) throw error

      setLayouts(prev => prev.filter(l => l.id !== layoutId))
      toast.success('Layout deleted successfully')
    } catch (error) {
      console.error('Failed to delete layout:', error)
      toast.error('Failed to delete layout: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2969FF]"></div>
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Venue Not Found</h2>
          <p className="text-gray-600 mb-6">
            The venue you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/organizer/venues')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Venues
          </Button>
        </div>
      </div>
    )
  }

  const activeLayouts = layouts.filter(l => l.is_active).length
  const totalSections = layouts.reduce((sum, l) => sum + (l.layout_sections?.[0]?.count || 0), 0)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/organizer/venues')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[#0F0F0F]">{venue.name}</h1>
              <Badge variant="outline" className="capitalize">{venue.venue_type}</Badge>
              {venue.iot_enabled ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Wifi className="w-3 h-3 mr-1" />
                  IoT Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Basic</Badge>
              )}
            </div>
            <p className="text-[#0F0F0F]/60 mt-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {venue.address}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {venue.iot_enabled && (
            <Button variant="outline" onClick={() => navigate('/organizer/venues/iot')}>
              <Activity className="w-4 h-4 mr-2" />
              IoT Dashboard
            </Button>
          )}
          <Button onClick={() => setShowEditVenue(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Venue
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{venue.capacity || 0}</div>
            <p className="text-xs text-muted-foreground">Maximum attendees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Layouts</CardTitle>
            <Layout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{layouts.length}</div>
            <p className="text-xs text-muted-foreground">{activeLayouts} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Linked Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">Events using this venue</p>
          </CardContent>
        </Card>

        {venue.iot_enabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">IoT Sensors</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sensors.length}</div>
              <p className="text-xs text-muted-foreground">
                {sensors.filter(s => s.status === 'online').length} online
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Map Preview */}
      {venue.latitude && venue.longitude && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY || 'YOUR_API_KEY'}&q=${venue.latitude},${venue.longitude}`}
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="layouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          {venue.iot_enabled && <TabsTrigger value="sensors">IoT Sensors</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Layouts Tab */}
        <TabsContent value="layouts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Venue Layouts</h3>
            <Button onClick={() => navigate(`/organizer/venues/${venueId}/layouts/create`)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Layout
            </Button>
          </div>

          {layouts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Layout className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Layouts Yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first layout to start designing seating arrangements.
                </p>
                <Button onClick={() => navigate(`/organizer/venues/${venueId}/layouts/create`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Layout
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {layouts.map(layout => (
                <Card key={layout.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{layout.name}</CardTitle>
                      <Badge variant={layout.is_active ? 'default' : 'secondary'}>
                        {layout.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>
                      Created {new Date(layout.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>{layout.layout_sections?.[0]?.count || 0} sections</span>
                      <span>{layout.layout_furniture?.[0]?.count || 0} furniture</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/organizer/venues/${venueId}/layouts/${layout.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/organizer/venues/${venueId}/layouts/${layout.id}/edit`)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLayout(layout.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <h3 className="text-lg font-semibold">Linked Events</h3>

          {events.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Linked</h3>
                <p className="text-gray-500">
                  No events are currently using this venue. Link a venue when creating an event.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                    >
                      <div>
                        <h4 className="font-medium">{event.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.event_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IoT Sensors Tab */}
        {venue.iot_enabled && (
          <TabsContent value="sensors" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">IoT Sensors</h3>
              <Button variant="outline" onClick={() => navigate('/organizer/venues/iot')}>
                <Activity className="w-4 h-4 mr-2" />
                Open IoT Dashboard
              </Button>
            </div>

            {sensors.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Sensors Configured</h3>
                  <p className="text-gray-500 mb-4">
                    IoT is enabled but no sensors have been registered yet.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/organizer/venues/iot')}>
                    Configure Sensors
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sensors.map(sensor => (
                  <Card key={sensor.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base capitalize">
                          {sensor.type?.replace('_', ' ') || 'Sensor'}
                        </CardTitle>
                        <Badge variant={sensor.status === 'online' ? 'default' : 'secondary'}>
                          {sensor.status || 'Unknown'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Device ID: {sensor.device_id}</p>
                        <p>Zone: {sensor.zone || 'Unassigned'}</p>
                        {sensor.last_reading && (
                          <p>Last Reading: {new Date(sensor.last_reading).toLocaleString()}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Venue Settings</CardTitle>
              <CardDescription>Manage your venue configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{venue.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{venue.venue_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Address:</span>
                  <p className="font-medium">{venue.address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Capacity:</span>
                  <p className="font-medium">{venue.capacity}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">IoT Features:</span>
                  <p className="font-medium">{venue.iot_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                {venue.latitude && venue.longitude && (
                  <div>
                    <span className="text-muted-foreground">Coordinates:</span>
                    <p className="font-medium">{venue.latitude}, {venue.longitude}</p>
                  </div>
                )}
              </div>
              <div className="pt-4">
                <Button onClick={() => setShowEditVenue(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Venue
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-red-600">Delete Venue</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this venue and all associated layouts.
                  </p>
                </div>
                <Button variant="destructive" onClick={deleteVenue}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Venue
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Venue Dialog */}
      <Dialog open={showEditVenue} onOpenChange={setShowEditVenue}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editVenueName">Venue Name</Label>
              <Input
                id="editVenueName"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter venue name"
              />
            </div>
            <div>
              <Label htmlFor="editVenueAddress">Address</Label>
              <Textarea
                id="editVenueAddress"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter full address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editVenueCapacity">Capacity</Label>
                <Input
                  id="editVenueCapacity"
                  type="number"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="editVenueType">Type</Label>
                <Select
                  value={editForm.venue_type}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, venue_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editLatitude">Latitude (optional)</Label>
                <Input
                  id="editLatitude"
                  type="number"
                  step="any"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm(prev => ({ ...prev, latitude: e.target.value }))}
                  placeholder="e.g., 40.7128"
                />
              </div>
              <div>
                <Label htmlFor="editLongitude">Longitude (optional)</Label>
                <Input
                  id="editLongitude"
                  type="number"
                  step="any"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm(prev => ({ ...prev, longitude: e.target.value }))}
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIotEnabled"
                checked={editForm.iot_enabled}
                onChange={(e) => setEditForm(prev => ({ ...prev, iot_enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#2969FF] focus:ring-[#2969FF]"
              />
              <Label htmlFor="editIotEnabled" className="flex items-center gap-2 cursor-pointer">
                <Wifi className="w-4 h-4 text-[#2969FF]" />
                Enable IoT Smart Features
              </Label>
            </div>
            {editForm.iot_enabled && (
              <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                IoT features include real-time occupancy tracking, environmental monitoring, and smart sensor integration.
              </p>
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditVenue(false)}>
                Cancel
              </Button>
              <Button onClick={updateVenue} disabled={!editForm.name || !editForm.address}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
