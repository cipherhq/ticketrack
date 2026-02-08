import { useState, useEffect } from 'react'
import { Users, Clock, HelpCircle, Settings, Check, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { supabase } from '@/lib/supabase'

/**
 * GroupBuySettings - Organizer controls for enabling/configuring group purchases on events
 * 
 * WHAT IS GROUP BUY?
 * Group Buy lets friends coordinate ticket purchases together. One person starts a "group session",
 * shares a link, and everyone picks and pays for their own tickets within a time window.
 * 
 * WHY ENABLE IT?
 * - Increases sales: People are more likely to buy when buying with friends
 * - Reduces no-shows: Group accountability = higher attendance
 * - Social marketing: Each group member shares the event link
 * - Better experience: Attendees know they're going with friends
 */

export function GroupBuySettings({ eventId, onSave }) {
  const [settings, setSettings] = useState({
    enabled: true,
    default_duration_minutes: 60,
    max_group_size: 10,
    min_group_size: 2,
    allow_mixed_tickets: true,
    reserve_tickets_on_select: false,
    reservation_duration_minutes: 10
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (eventId) {
      loadSettings()
    }
  }, [eventId])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('event_group_buy_settings')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle()

      if (!error && data) {
        setSettings({
          enabled: data.enabled ?? true,
          default_duration_minutes: data.default_duration_minutes || 60,
          max_group_size: data.max_group_size || 10,
          min_group_size: data.min_group_size || 2,
          allow_mixed_tickets: data.allow_mixed_tickets ?? true,
          reserve_tickets_on_select: data.reserve_tickets_on_select || false,
          reservation_duration_minutes: data.reservation_duration_minutes || 10
        })
      }
    } catch (err) {
      console.error('Error loading group buy settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('event_group_buy_settings')
        .upsert({
          event_id: eventId,
          enabled: settings.enabled,
          default_duration_minutes: settings.default_duration_minutes,
          max_group_size: settings.max_group_size,
          min_group_size: settings.min_group_size,
          allow_mixed_tickets: settings.allow_mixed_tickets,
          reserve_tickets_on_select: settings.reserve_tickets_on_select,
          reservation_duration_minutes: settings.reservation_duration_minutes,
          updated_at: new Date().toISOString()
        }, { onConflict: 'event_id' })

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      
      if (onSave) onSave(settings)
    } catch (err) {
      console.error('Error saving group buy settings:', err)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="rounded-2xl animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-muted rounded w-full"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Group Buy
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4">
                <p className="font-semibold mb-2">What is Group Buy?</p>
                <p className="text-sm text-foreground/70">
                  Group Buy lets attendees coordinate ticket purchases with friends. 
                  One person starts a session, shares a link, and everyone picks & pays 
                  for their own tickets within a time window.
                </p>
                <p className="text-sm text-foreground/70 mt-2">
                  <strong>Benefits:</strong> Higher sales, reduced no-shows, 
                  organic social sharing, better attendee experience.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable Group Buy</Label>
              <p className="text-sm text-muted-foreground">
                Allow attendees to buy tickets together with friends
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          {settings.enabled && (
            <>
              {/* Session Duration */}
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label>Session Duration</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How long groups have to complete their purchase</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={String(settings.default_duration_minutes)}
                  onValueChange={(v) => setSettings({ ...settings, default_duration_minutes: Number(v) })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Group Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Min Group Size</Label>
                  <Input
                    type="number"
                    min={2}
                    max={settings.max_group_size}
                    value={settings.min_group_size}
                    onChange={(e) => setSettings({ ...settings, min_group_size: Number(e.target.value) })}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max Group Size</Label>
                  <Input
                    type="number"
                    min={settings.min_group_size}
                    max={100}
                    value={settings.max_group_size}
                    onChange={(e) => setSettings({ ...settings, max_group_size: Number(e.target.value) })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Allow Mixed Tickets */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Allow Mixed Tickets</Label>
                  <p className="text-sm text-muted-foreground">
                    Group members can buy different ticket types
                  </p>
                </div>
                <Switch
                  checked={settings.allow_mixed_tickets}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_mixed_tickets: checked })}
                />
              </div>

              {/* Info Box */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="font-medium text-purple-900 flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  How Group Buy Works
                </h4>
                <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
                  <li>Someone clicks "Buy with Friends" on your event</li>
                  <li>They share the group link with friends via email/SMS/WhatsApp</li>
                  <li>Friends join, select their tickets, and pay individually</li>
                  <li>Everyone gets their tickets, no one person has to collect money</li>
                </ol>
              </div>
            </>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded-xl ${saved ? 'bg-green-500 hover:bg-green-600' : 'bg-[#2969FF] hover:bg-[#1a4fd8]'} text-white`}
          >
            {saving ? (
              <Settings className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <Check className="w-4 h-4 mr-2" />
            ) : null}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default GroupBuySettings
