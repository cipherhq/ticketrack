import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, Link2, RefreshCw, Check, X, AlertCircle, 
  Calendar, Users, ChevronRight, Loader2, ExternalLink,
  Plus, Settings, History, Trash2, ArrowLeft, ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { FieldMappingEditor } from '@/components/FieldMappingEditor'

// Platform logos and info
const PLATFORMS = {
  eventbrite: {
    name: 'Eventbrite',
    logo: 'https://cdn.worldvectorlogo.com/logos/eventbrite-1.svg',
    color: 'bg-orange-500',
    description: 'Import events from your Eventbrite account',
    authType: 'oauth2',
    oauthUrl: 'https://www.eventbrite.com/oauth/authorize',
  },
  tixafrica: {
    name: 'Tix.Africa',
    logo: 'https://tix.africa/favicon.ico',
    color: 'bg-purple-500',
    description: 'Import events from Tix.Africa',
    authType: 'api_key',
  },
  afrotix: {
    name: 'Afrotix',
    logo: '/platforms/afrotix.png',
    color: 'bg-green-500',
    description: 'Import events from Afrotix',
    authType: 'api_key',
  },
  partyvest: {
    name: 'PartyVest',
    logo: '/platforms/partyvest.png',
    color: 'bg-pink-500',
    description: 'Import events from PartyVest',
    authType: 'api_key',
  },
}

export default function EventImport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [organizer, setOrganizer] = useState(null)
  const [connections, setConnections] = useState([])
  const [importedEvents, setImportedEvents] = useState([])
  const [importJobs, setImportJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  
  // Dialog states
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  
  // Field mapping states
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [mappingConnection, setMappingConnection] = useState(null)
  const [mappingType, setMappingType] = useState('event') // 'event' or 'attendee'
  const [currentMappings, setCurrentMappings] = useState({})
  const [savingMappings, setSavingMappings] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Get organizer
      const { data: org } = await supabase
        .from('organizers')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single()

      if (org) {
        setOrganizer(org)

        // Load connections
        const { data: conns } = await supabase
          .from('external_platform_connections')
          .select('*')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })

        setConnections(conns || [])

        // Load imported events
        const { data: events } = await supabase
          .from('imported_events')
          .select(`
            *,
            event:events(id, title, start_date, status, image_url)
          `)
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(20)

        setImportedEvents(events || [])

        // Load recent import jobs
        const { data: jobs } = await supabase
          .from('import_jobs')
          .select('*')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(10)

        setImportJobs(jobs || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectPlatform = async () => {
    if (!selectedPlatform || !organizer) return
    setConnecting(true)

    try {
      const platform = PLATFORMS[selectedPlatform]

      if (platform.authType === 'api_key') {
        // Save API key connection
        const { error } = await supabase
          .from('external_platform_connections')
          .upsert({
            organizer_id: organizer.id,
            platform: selectedPlatform,
            platform_name: platform.name,
            api_key: apiKey,
            status: 'connected',
          }, { onConflict: 'organizer_id,platform' })

        if (error) throw error

        setConnectDialogOpen(false)
        setApiKey('')
        setSelectedPlatform(null)
        loadData()
      } else if (platform.authType === 'oauth2') {
        // Redirect to OAuth flow
        // This would typically open a popup or redirect
        alert('OAuth integration coming soon. For now, use API key method.')
      }
    } catch (error) {
      console.error('Connection error:', error)
      alert('Failed to connect: ' + error.message)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectPlatform = async (connectionId) => {
    if (!confirm('Are you sure you want to disconnect this platform?')) return

    try {
      await supabase
        .from('external_platform_connections')
        .delete()
        .eq('id', connectionId)

      loadData()
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  // Open field mapping dialog
  const openFieldMapping = (connection, type = 'event') => {
    setMappingConnection(connection)
    setMappingType(type)
    // Load existing custom mappings
    const existingMappings = type === 'event' 
      ? connection.custom_event_mappings 
      : connection.custom_attendee_mappings
    setCurrentMappings(existingMappings || {})
    setMappingDialogOpen(true)
  }

  // Save custom field mappings
  const saveFieldMappings = async () => {
    if (!mappingConnection) return
    setSavingMappings(true)

    try {
      const updateField = mappingType === 'event' 
        ? 'custom_event_mappings' 
        : 'custom_attendee_mappings'
      
      const { error } = await supabase
        .from('external_platform_connections')
        .update({ [updateField]: currentMappings })
        .eq('id', mappingConnection.id)

      if (error) throw error

      setMappingDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Save mappings error:', error)
      alert('Failed to save mappings: ' + error.message)
    } finally {
      setSavingMappings(false)
    }
  }

  // Get sample source fields for each platform
  const getSourceFieldsForPlatform = (platform) => {
    const fields = {
      eventbrite: {
        event: ['name.text', 'description.text', 'start.utc', 'end.utc', 'venue.name', 
                'venue.address.localized_address_display', 'venue.address.city', 
                'venue.address.country', 'logo.url', 'online_event', 'is_free', 
                'currency', 'url', 'capacity', 'status'],
        attendee: ['profile.email', 'profile.name', 'profile.first_name', 'profile.last_name',
                   'profile.cell_phone', 'ticket_class_name', 'order_id', 'checked_in',
                   'quantity', 'costs.gross.major_value', 'created'],
      },
      tixafrica: {
        event: ['title', 'description', 'start_date', 'end_date', 'venue.name',
                'venue.address', 'venue.city', 'venue.country', 'image', 
                'is_online', 'currency', 'status'],
        attendee: ['email', 'name', 'phone', 'ticket_name', 'order_reference',
                   'quantity', 'amount', 'checked_in', 'created_at'],
      },
      afrotix: {
        event: ['event_name', 'event_description', 'event_date', 'venue', 
                'city', 'event_image', 'category'],
        attendee: ['attendee_email', 'attendee_name', 'attendee_phone', 
                   'ticket_type', 'order_ref', 'amount'],
      },
      partyvest: {
        event: ['event_title', 'description', 'start_datetime', 'venue_name',
                'location', 'flyer_url', 'event_type'],
        attendee: ['guest_email', 'guest_name', 'guest_phone', 'ticket_category',
                   'order_id', 'amount_paid', 'check_in_status'],
      },
    }
    return fields[platform] || { event: [], attendee: [] }
  }

  const startImport = async (connectionId, platform) => {
    if (!organizer) return
    setImporting(true)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-external-events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            platform,
            connectionId,
            organizerId: organizer.id,
            importAttendees: true,
          }),
        }
      )

      const result = await response.json()

      if (result.success) {
        alert(`Import complete! ${result.stats.imported} events imported, ${result.stats.updated} updated.`)
        loadData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('Import failed: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-muted text-foreground',
      expired: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    }
    return <Badge className={styles[status] || styles.disconnected}>{status}</Badge>
  }

  const getJobStatusBadge = (status) => {
    const styles = {
      pending: 'bg-muted text-foreground',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Events</h1>
          <p className="text-muted-foreground">
            Import events and attendees from other ticketing platforms
          </p>
        </div>
      </div>

      <Tabs defaultValue="connections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="connections">
            <Link2 className="w-4 h-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="imported">
            <Calendar className="w-4 h-4 mr-2" />
            Imported Events
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Import History
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          {/* Connected Platforms */}
          {connections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected Platforms</CardTitle>
                <CardDescription>
                  Manage your connected ticketing platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connections.map((conn) => {
                  const platform = PLATFORMS[conn.platform]
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg ${platform?.color || 'bg-background0'} flex items-center justify-center`}>
                          {platform?.logo ? (
                            <img src={platform.logo} alt={conn.platform_name} className="w-8 h-8 object-contain" />
                          ) : (
                            <Link2 className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium">{conn.platform_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {getStatusBadge(conn.status)}
                            {conn.last_sync_at && (
                              <span>Last sync: {new Date(conn.last_sync_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openFieldMapping(conn, 'event')}
                          title="Configure field mappings"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startImport(conn.id, conn.platform)}
                          disabled={importing || conn.status !== 'connected'}
                        >
                          {importing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Import Now
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectPlatform(conn.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Available Platforms */}
          <Card>
            <CardHeader>
              <CardTitle>Connect a Platform</CardTitle>
              <CardDescription>
                Link your accounts to import events and attendees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(PLATFORMS).map(([key, platform]) => {
                  const isConnected = connections.some(c => c.platform === key)
                  return (
                    <div
                      key={key}
                      className={`p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                        isConnected ? 'opacity-50' : ''
                      }`}
                      onClick={() => {
                        if (!isConnected) {
                          setSelectedPlatform(key)
                          setConnectDialogOpen(true)
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg ${platform.color} flex items-center justify-center`}>
                          {platform.logo ? (
                            <img src={platform.logo} alt={platform.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <Link2 className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{platform.name}</h3>
                            {isConnected && (
                              <Badge variant="secondary">Connected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{platform.description}</p>
                        </div>
                        {!isConnected && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imported Events Tab */}
        <TabsContent value="imported" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Imported Events</CardTitle>
              <CardDescription>
                Events imported from external platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importedEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events imported yet</p>
                  <p className="text-sm">Connect a platform and import your events</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {importedEvents.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {item.event?.image_url ? (
                          <img
                            src={item.event.image_url}
                            alt={item.event?.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium">{item.event?.title || 'Unknown Event'}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{item.platform}</Badge>
                            <span>
                              {item.event?.start_date && new Date(item.event.start_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            item.import_status === 'imported' ? 'bg-green-100 text-green-800' :
                            item.import_status === 'updated' ? 'bg-blue-100 text-blue-800' :
                            'bg-muted text-foreground'
                          }
                        >
                          {item.import_status}
                        </Badge>
                        {item.external_event_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={item.external_event_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {item.event_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/organizer/events/${item.event_id}`)}
                          >
                            View Event
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                Recent import jobs and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No import history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {importJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium capitalize">{job.platform}</h3>
                          {getJobStatusBadge(job.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {job.status === 'completed' && (
                          <div className="space-y-1">
                            <p className="text-green-600">{job.imported_items} imported</p>
                            {job.updated_items > 0 && (
                              <p className="text-blue-600">{job.updated_items} updated</p>
                            )}
                            {job.failed_items > 0 && (
                              <p className="text-red-600">{job.failed_items} failed</p>
                            )}
                          </div>
                        )}
                        {job.status === 'running' && (
                          <p className="text-blue-600">
                            {job.processed_items}/{job.total_items} processed
                          </p>
                        )}
                        {job.status === 'failed' && (
                          <p className="text-red-600">{job.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Platform Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {selectedPlatform && PLATFORMS[selectedPlatform]?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your API key to connect your account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Find your API key in your {selectedPlatform && PLATFORMS[selectedPlatform]?.name} account settings
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={connectPlatform} disabled={!apiKey || connecting}>
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Field Mapping - {mappingConnection && PLATFORMS[mappingConnection.platform]?.name}
            </DialogTitle>
            <DialogDescription>
              Map fields from {mappingConnection?.platform_name} to TickeTrack. 
              This controls how data is imported.
            </DialogDescription>
          </DialogHeader>

          {/* Mapping Type Tabs */}
          <div className="flex gap-2 border-b pb-4">
            <Button
              variant={mappingType === 'event' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMappingType('event')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Event Fields
            </Button>
            <Button
              variant={mappingType === 'attendee' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMappingType('attendee')}
            >
              <Users className="w-4 h-4 mr-2" />
              Attendee Fields
            </Button>
          </div>

          {/* Field Mapping Editor */}
          {mappingConnection && (
            <FieldMappingEditor
              sourceFields={getSourceFieldsForPlatform(mappingConnection.platform)[mappingType]}
              fieldType={mappingType === 'event' ? 'event' : 'attendee'}
              existingMappings={currentMappings}
              onMappingsChange={setCurrentMappings}
              platform={mappingConnection.platform_name}
              showAdvanced={true}
            />
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveFieldMappings} disabled={savingMappings}>
              {savingMappings ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Mappings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
