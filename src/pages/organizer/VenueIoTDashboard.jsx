/**
 * IoT Smart Venue Dashboard
 * Real-time monitoring and management of smart venues
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, Thermometer, Droplets, Wind, Volume2, Zap,
  Users, MapPin, AlertTriangle, CheckCircle, Wifi, WifiOff,
  TrendingUp, TrendingDown, RefreshCw, Settings, Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'
import { iotVenueService } from '@/services/iotVenueService'
import { formatPrice } from '@/config/currencies'

export function VenueIoTDashboard() {
  const navigate = useNavigate()
  const { organizer } = useOrganizer()

  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [capacityData, setCapacityData] = useState([])
  const [environmentalData, setEnvironmentalData] = useState([])
  const [sensorStatus, setSensorStatus] = useState([])
  const [maintenanceAlerts, setMaintenanceAlerts] = useState([])
  const [realTimeConnection, setRealTimeConnection] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load venues on mount
  useEffect(() => {
    loadVenues()
  }, [])

  // Initialize real-time updates when venue is selected
  useEffect(() => {
    if (selectedVenue) {
      initializeRealTimeUpdates(selectedVenue.id)
      loadVenueData(selectedVenue.id)
    }

    return () => {
      if (realTimeConnection) {
        realTimeConnection.unsubscribe()
      }
    }
  }, [selectedVenue])

  const loadVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('organizer_id', organizer?.id)
        .eq('iot_enabled', true)

      if (error) throw error
      setVenues(data || [])

      if (data?.length > 0 && !selectedVenue) {
        setSelectedVenue(data[0])
      }
    } catch (error) {
      console.error('Failed to load venues:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVenueData = async (venueId) => {
    try {
      // Load capacity data
      const capacity = await iotVenueService.getVenueCapacity(venueId)
      setCapacityData(capacity)

      // Load environmental data (last 24 hours)
      const environmental = await iotVenueService.getEnvironmentalData(venueId, 24)
      setEnvironmentalData(environmental)

      // Load sensor status
      const sensors = await iotVenueService.getVenueSensorStatus(venueId)
      setSensorStatus(sensors)

      // Load maintenance alerts
      const { data: alerts } = await supabase
        .from('maintenance_alerts')
        .select('*')
        .eq('venue_id', venueId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      setMaintenanceAlerts(alerts || [])
    } catch (error) {
      console.error('Failed to load venue data:', error)
    }
  }

  const initializeRealTimeUpdates = async (venueId) => {
    const connection = await iotVenueService.initializeRealTimeUpdates(venueId)
    setRealTimeConnection(connection)

    // Subscribe to updates
    const unsubscribe = iotVenueService.subscribeToVenueUpdates(venueId, (update) => {
      switch (update.type) {
        case 'capacity':
          setCapacityData(prev => prev.map(cap =>
            cap.zoneId === update.zoneId
              ? { ...cap, currentOccupancy: update.data.occupancy, utilizationRate: update.data.utilization }
              : cap
          ))
          break
        case 'sensor':
          // Refresh sensor status
          loadVenueData(venueId)
          break
      }
    })

    return unsubscribe
  }

  const getTotalCapacity = () => {
    return capacityData.reduce((total, zone) => total + zone.maxCapacity, 0)
  }

  const getTotalOccupancy = () => {
    return capacityData.reduce((total, zone) => total + zone.currentOccupancy, 0)
  }

  const getOverallUtilization = () => {
    const totalCapacity = getTotalCapacity()
    const totalOccupancy = getTotalOccupancy()
    return totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0
  }

  const getEnvironmentalSummary = () => {
    if (environmentalData.length === 0) return null

    const latest = environmentalData[0]
    return {
      temperature: latest.temperature,
      humidity: latest.humidity,
      co2: latest.co2_level,
      noise: latest.noise_level
    }
  }

  const getSensorHealth = () => {
    const total = sensorStatus.length
    const online = sensorStatus.filter(s => s.isOnline).length
    return { total, online, offline: total - online }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2969FF]"></div>
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Smart Venues</h2>
          <p className="text-gray-600 mb-6">
            You haven't set up any IoT-enabled venues yet.
          </p>
          <Button onClick={() => navigate('/organizer/venues')}>
            <Plus className="w-4 h-4 mr-2" />
            Set Up Smart Venue
          </Button>
        </div>
      </div>
    )
  }

  const totalCapacity = getTotalCapacity()
  const totalOccupancy = getTotalOccupancy()
  const overallUtilization = getOverallUtilization()
  const environmental = getEnvironmentalSummary()
  const sensorHealth = getSensorHealth()

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F0F0F]">Smart Venue Dashboard</h1>
          <p className="text-[#0F0F0F]/60 mt-1">
            Real-time monitoring and management of your IoT-enabled venues
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={realTimeConnection ? "default" : "secondary"} className="flex items-center gap-1">
            {realTimeConnection ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {realTimeConnection ? 'Live' : 'Offline'}
          </Badge>
          <Button variant="outline" onClick={() => selectedVenue && loadVenueData(selectedVenue.id)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Venue Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-[#0F0F0F]">Select Venue:</label>
            <div className="flex gap-2">
              {venues.map(venue => (
                <Button
                  key={venue.id}
                  variant={selectedVenue?.id === venue.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedVenue(venue)}
                >
                  {venue.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Capacity Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Venue Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOccupancy}/{totalCapacity}</div>
            <p className="text-xs text-muted-foreground">
              {overallUtilization.toFixed(1)}% utilization
            </p>
            <Progress value={overallUtilization} className="mt-2" />
          </CardContent>
        </Card>

        {/* Environmental Quality */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Air Quality</CardTitle>
            <Wind className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {environmental ? (
              <>
                <div className="text-2xl font-bold">
                  {environmental.co2 ? `${environmental.co2} ppm` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  CO₂ levels • {environmental.temperature}°C
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">No Data</div>
            )}
          </CardContent>
        </Card>

        {/* Sensor Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sensor Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sensorHealth.online}/{sensorHealth.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {sensorHealth.online} online • {sensorHealth.offline} offline
            </p>
            {sensorHealth.offline > 0 && (
              <Badge variant="destructive" className="mt-2">
                {sensorHealth.offline} offline
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{maintenanceAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Active alerts
            </p>
            {maintenanceAlerts.length > 0 && (
              <Badge variant="destructive" className="mt-2">
                Action Required
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="capacity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="capacity">Capacity & Zones</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Capacity Tab */}
        <TabsContent value="capacity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zone Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {capacityData.map((zone, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{zone.zoneId || 'Main Area'}</h3>
                      <Badge variant={zone.utilizationRate > 80 ? "destructive" : zone.utilizationRate > 60 ? "secondary" : "default"}>
                        {zone.utilizationRate.toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Occupancy</span>
                        <span>{zone.currentOccupancy}/{zone.maxCapacity}</span>
                      </div>
                      <Progress value={zone.utilizationRate} />
                      <p className="text-xs text-muted-foreground">
                        Updated {zone.lastUpdated ? new Date(zone.lastUpdated).toLocaleTimeString() : 'Never'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Environment Tab */}
        <TabsContent value="environment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {environmental && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Temperature</CardTitle>
                    <Thermometer className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{environmental.temperature}°C</div>
                    <p className="text-xs text-muted-foreground">Comfortable range: 18-24°C</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Humidity</CardTitle>
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{environmental.humidity}%</div>
                    <p className="text-xs text-muted-foreground">Ideal range: 40-60%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Air Quality</CardTitle>
                    <Wind className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{environmental.co2} ppm</div>
                    <p className="text-xs text-muted-foreground">Good: &lt;1000 ppm</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Noise Level</CardTitle>
                    <Volume2 className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{environmental.noise} dB</div>
                    <p className="text-xs text-muted-foreground">Quiet: &lt;50 dB</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* Sensors Tab */}
        <TabsContent value="sensors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sensor Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sensorStatus.map((sensor) => (
                  <div key={sensor.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium capitalize">{sensor.type.replace('_', ' ')}</h3>
                      <Badge variant={sensor.isOnline ? "default" : "secondary"}>
                        {sensor.isOnline ? <CheckCircle className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                        {sensor.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Device: {sensor.deviceId}</p>
                      <p>Zone: {sensor.zone || 'Unassigned'}</p>
                      {sensor.batteryLevel && (
                        <p>Battery: {sensor.batteryLevel}%</p>
                      )}
                      <p>Last Seen: {sensor.lastSeen ? new Date(sensor.lastSeen).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {maintenanceAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All Systems Operational</h3>
                  <p className="text-gray-500">No maintenance alerts at this time.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {maintenanceAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className={`w-5 h-5 ${
                              alert.severity === 'critical' ? 'text-red-500' :
                              alert.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'
                            }`} />
                            <h3 className="font-medium">{alert.title}</h3>
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'secondary' : 'outline'
                            }>
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                          <p className="text-sm font-medium">{alert.recommended_action}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}