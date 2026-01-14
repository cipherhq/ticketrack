/**
 * Pricing Zones Component
 * Configure section-based pricing for events
 */

import { useState, useEffect } from 'react'
import { DollarSign, Users, TrendingUp, AlertCircle, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'

export function PricingZones({ eventId, layoutId, sections, onPricingChange }) {
  const [ticketTypes, setTicketTypes] = useState([])
  const [sectionPricing, setSectionPricing] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (eventId && layoutId) {
      loadTicketTypes()
      loadSectionPricing()
    }
  }, [eventId, layoutId])

  const loadTicketTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('id, name, price, quantity_available')
        .eq('event_id', eventId)
        .order('price', { ascending: true })

      if (error) throw error
      setTicketTypes(data || [])
    } catch (error) {
      console.error('Failed to load ticket types:', error)
    }
  }

  const loadSectionPricing = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('section_pricing')
        .select(`
          *,
          layout_sections (name, section_type, capacity),
          ticket_types (name, price)
        `)
        .eq('event_id', eventId)

      if (error) throw error

      const pricing = data?.map(item => ({
        id: item.id,
        sectionId: item.section_id,
        ticketTypeId: item.ticket_type_id,
        basePrice: item.base_price,
        dynamicPricingEnabled: item.dynamic_pricing_enabled,
        minPrice: item.min_price,
        maxPrice: item.max_price,
        currentPrice: item.current_price,
        capacityAllocated: item.capacity_allocated,
        ticketsSold: item.tickets_sold,
        isActive: item.is_active,
        section: item.layout_sections,
        ticketType: item.ticket_types
      })) || []

      setSectionPricing(pricing)
    } catch (error) {
      console.error('Failed to load section pricing:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializePricing = () => {
    const initialPricing = []
    sections.forEach(section => {
      ticketTypes.forEach(ticketType => {
        const existing = sectionPricing.find(p =>
          p.sectionId === section.id && p.ticketTypeId === ticketType.id
        )

        if (!existing) {
          initialPricing.push({
            id: null,
            sectionId: section.id,
            ticketTypeId: ticketType.id,
            basePrice: ticketType.price * (section.pricing_multiplier || 1.0),
            dynamicPricingEnabled: false,
            minPrice: ticketType.price * 0.8,
            maxPrice: ticketType.price * 1.5,
            currentPrice: ticketType.price * (section.pricing_multiplier || 1.0),
            capacityAllocated: Math.floor(section.capacity / ticketTypes.length),
            ticketsSold: 0,
            isActive: true,
            section,
            ticketType
          })
        }
      })
    })

    setSectionPricing([...sectionPricing, ...initialPricing])
  }

  const updatePricing = (index, field, value) => {
    const updated = [...sectionPricing]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-update current price when base price changes
    if (field === 'basePrice') {
      updated[index].currentPrice = value
    }

    setSectionPricing(updated)
    onPricingChange && onPricingChange(updated)
  }

  const savePricing = async () => {
    try {
      setSaving(true)

      // Delete existing pricing
      await supabase
        .from('section_pricing')
        .delete()
        .eq('event_id', eventId)

      // Insert new pricing
      const pricingData = sectionPricing.map(p => ({
        event_id: eventId,
        section_id: p.sectionId,
        ticket_type_id: p.ticketTypeId,
        base_price: p.basePrice,
        dynamic_pricing_enabled: p.dynamicPricingEnabled,
        min_price: p.minPrice,
        max_price: p.maxPrice,
        current_price: p.currentPrice,
        capacity_allocated: p.capacityAllocated,
        tickets_sold: p.ticketsSold,
        is_active: p.isActive
      }))

      const { error } = await supabase
        .from('section_pricing')
        .insert(pricingData)

      if (error) throw error

      alert('Pricing configuration saved successfully!')
    } catch (error) {
      console.error('Failed to save pricing:', error)
      alert('Failed to save pricing: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const getTotalCapacity = () => {
    return sectionPricing.reduce((sum, p) => sum + (p.capacityAllocated || 0), 0)
  }

  const getTotalRevenue = () => {
    return sectionPricing.reduce((sum, p) => sum + (p.currentPrice * p.capacityAllocated), 0)
  }

  const getPricingBySection = (sectionId) => {
    return sectionPricing.filter(p => p.sectionId === sectionId)
  }

  const getPricingByTicketType = (ticketTypeId) => {
    return sectionPricing.filter(p => p.ticketTypeId === ticketTypeId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2969FF]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Section-Based Pricing</h3>
          <p className="text-sm text-gray-500">
            Configure different pricing for different sections of your venue
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sectionPricing.length === 0 && sections.length > 0 && ticketTypes.length > 0 && (
            <Button variant="outline" onClick={initializePricing}>
              Initialize Pricing
            </Button>
          )}
          <Button onClick={savePricing} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {sectionPricing.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{getTotalCapacity()}</div>
                  <div className="text-sm text-gray-500">Total Capacity</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">${getTotalRevenue().toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Potential Revenue</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {sections.length > 0 ? Math.round((sectionPricing.length / (sections.length * ticketTypes.length)) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-500">Pricing Configured</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pricing Configuration */}
      {sectionPricing.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pricing Configuration</h3>
            <p className="text-gray-500 mb-4">
              Set up section-based pricing to charge different rates for different areas
            </p>
            {sections.length > 0 && ticketTypes.length > 0 && (
              <Button onClick={initializePricing}>
                Set Up Pricing
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* By Section View */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing by Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sections.map(section => {
                  const sectionPricingData = getPricingBySection(section.id)
                  return (
                    <div key={section.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: section.display_color }}
                          />
                          <div>
                            <h4 className="font-medium">{section.name}</h4>
                            <p className="text-sm text-gray-500 capitalize">
                              {section.section_type} • {section.capacity} capacity
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {sectionPricingData.length} ticket types
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionPricingData.map((pricing, index) => (
                          <div key={pricing.ticketTypeId} className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {pricing.ticketType.name}
                              </span>
                              <Badge variant={pricing.isActive ? "default" : "secondary"}>
                                {pricing.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs">Base Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={pricing.basePrice}
                                  onChange={(e) => updatePricing(
                                    sectionPricing.findIndex(p => p.id === pricing.id || (
                                      p.sectionId === pricing.sectionId && p.ticketTypeId === pricing.ticketTypeId
                                    )),
                                    'basePrice',
                                    parseFloat(e.target.value)
                                  )}
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Allocated Capacity</Label>
                                <Input
                                  type="number"
                                  value={pricing.capacityAllocated}
                                  onChange={(e) => updatePricing(
                                    sectionPricing.findIndex(p => p.id === pricing.id || (
                                      p.sectionId === pricing.sectionId && p.ticketTypeId === pricing.ticketTypeId
                                    )),
                                    'capacityAllocated',
                                    parseInt(e.target.value)
                                  )}
                                  className="h-8"
                                />
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={pricing.dynamicPricingEnabled}
                                  onCheckedChange={(checked) => updatePricing(
                                    sectionPricing.findIndex(p => p.id === pricing.id || (
                                      p.sectionId === pricing.sectionId && p.ticketTypeId === pricing.ticketTypeId
                                    )),
                                    'dynamicPricingEnabled',
                                    checked
                                  )}
                                />
                                <Label className="text-xs">Dynamic Pricing</Label>
                              </div>

                              {pricing.dynamicPricingEnabled && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Min Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={pricing.minPrice}
                                      onChange={(e) => updatePricing(
                                        sectionPricing.findIndex(p => p.id === pricing.id || (
                                          p.sectionId === pricing.sectionId && p.ticketTypeId === pricing.ticketTypeId
                                        )),
                                        'minPrice',
                                        parseFloat(e.target.value)
                                      )}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Max Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={pricing.maxPrice}
                                      onChange={(e) => updatePricing(
                                        sectionPricing.findIndex(p => p.id === pricing.id || (
                                          p.sectionId === pricing.sectionId && p.ticketTypeId === pricing.ticketTypeId
                                        )),
                                        'maxPrice',
                                        parseFloat(e.target.value)
                                      )}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warnings */}
      {sectionPricing.some(p => p.capacityAllocated > (p.section?.capacity || 0)) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some sections have allocated capacity exceeding their total capacity.
            Please adjust the allocations.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}