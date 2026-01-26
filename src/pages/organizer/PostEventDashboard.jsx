import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Download, Mail, Star, Megaphone, Loader2,
  Users, DollarSign, CheckCircle, Clock,
  MapPin, CreditCard, Ticket, BarChart3, PieChart, Calendar,
  Send, MessageSquare, FileText, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { supabase } from '@/lib/supabase'

const countryNames = {
  'NG': 'Nigeria', 'GH': 'Ghana', 'KE': 'Kenya', 'ZA': 'South Africa',
  'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
  'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IN': 'India',
  'AE': 'UAE', 'SA': 'Saudi Arabia', 'EG': 'Egypt', 'MA': 'Morocco',
  'TZ': 'Tanzania', 'UG': 'Uganda', 'RW': 'Rwanda', 'ET': 'Ethiopia'
}

export function PostEventDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [event, setEvent] = useState(null)
  const [summary, setSummary] = useState({
    totalRevenue: 0, ticketsSold: 0, totalCapacity: 0, checkedIn: 0,
    refundCount: 0, refundAmount: 0, avgTicketPrice: 0, pageViews: 0,
    platformFees: 0, netRevenue: 0
  })
  const [insights, setInsights] = useState({
    locationBreakdown: [], ticketTypeBreakdown: [], purchaseByHour: [],
    paymentMethods: []
  })
  const [attendees, setAttendees] = useState([])
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [feedbackLink, setFeedbackLink] = useState('')
  const [photosLink, setPhotosLink] = useState('')
  const [nextEventId, setNextEventId] = useState('')
  const [nextEvents, setNextEvents] = useState([])
  const [activeTab, setActiveTab] = useState('summary')

  useEffect(() => {
    if (id && organizer?.id) loadAllData()
  }, [id, organizer?.id])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const { data: eventData, error } = await supabase
        .from('events').select('*').eq('id', id).eq('organizer_id', organizer.id).single()
      if (error) throw error
      setEvent(eventData)
      await Promise.all([loadSummary(eventData), loadInsights(), loadAttendees(), loadNextEvents()])
      setThankYouMessage(`Thank you for attending ${eventData.title}! We hope you had an amazing time.`)
    } catch (err) { console.error('Error:', err) }
    finally { setLoading(false) }
  }

  const loadSummary = async (eventData) => {
    const { data: tickets } = await supabase.from('tickets').select('*').eq('event_id', id).in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
    const { data: orders } = await supabase.from('orders').select('*').eq('event_id', id).eq('status', 'completed')
    const { data: refunds } = await supabase.from('refund_requests').select('*').eq('event_id', id)
    
    const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0) || 0
    const platformFees = orders?.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0) || 0
    const ticketsSold = tickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0
    const checkedIn = tickets?.filter(t => t.is_checked_in).reduce((sum, t) => sum + (t.quantity || 1), 0) || 0
    const refundCount = refunds?.filter(r => r.status === 'approved' || r.refund_reference).length || 0
    const refundAmount = refunds?.filter(r => r.status === 'approved' || r.refund_reference)
      .reduce((sum, r) => sum + parseFloat(r.refund_amount || r.amount || 0), 0) || 0

    setSummary({
      totalRevenue, ticketsSold, totalCapacity: eventData.total_capacity || ticketsSold,
      checkedIn, refundCount, refundAmount, avgTicketPrice: ticketsSold > 0 ? totalRevenue / ticketsSold : 0,
      pageViews: eventData.views_count || 0, platformFees, netRevenue: totalRevenue - platformFees - refundAmount
    })
  }

  const loadInsights = async () => {
    const { data: tickets } = await supabase.from('tickets')
      .select('*, user:profiles(country_code), ticket_type:ticket_types(name)')
      .eq('event_id', id).in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
    const { data: orders } = await supabase.from('orders').select('*').eq('event_id', id).eq('status', 'completed')

    const locationMap = {}
    tickets?.forEach(t => { const c = t.user?.country_code || 'Unknown'; locationMap[c] = (locationMap[c] || 0) + (t.quantity || 1) })
    const locationBreakdown = Object.entries(locationMap).map(([code, count]) => ({ code, name: countryNames[code] || code, count })).sort((a, b) => b.count - a.count)

    const ticketTypeMap = {}
    tickets?.forEach(t => { const n = t.ticket_type?.name || 'Standard'; ticketTypeMap[n] = (ticketTypeMap[n] || 0) + (t.quantity || 1) })
    const ticketTypeBreakdown = Object.entries(ticketTypeMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

    const hourMap = {}
    orders?.forEach(o => { const h = new Date(o.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1 })
    const purchaseByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap[i] || 0 }))

    const paymentMap = {}
    orders?.forEach(o => { const m = o.payment_provider || 'Unknown'; paymentMap[m] = (paymentMap[m] || 0) + 1 })
    const paymentMethods = Object.entries(paymentMap).map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count)

    setInsights({ locationBreakdown, ticketTypeBreakdown, purchaseByHour, paymentMethods })
  }

  const loadAttendees = async () => {
    const { data } = await supabase.from('tickets')
      .select('attendee_name, attendee_email, is_checked_in, quantity, user:profiles(country_code)')
      .eq('event_id', id).in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
    setAttendees(data || [])
  }

  const loadNextEvents = async () => {
    const { data } = await supabase.from('events').select('id, title, start_date')
      .eq('organizer_id', organizer.id).gt('start_date', new Date().toISOString())
      .order('start_date', { ascending: true }).limit(10)
    setNextEvents(data || [])
  }

  const sendThankYouEmail = async () => {
    if (!thankYouMessage.trim()) { alert('Please enter a message'); return }
    setSending(true)
    try {
      const emails = [...new Set(attendees.map(a => a.attendee_email).filter(Boolean))]
      for (const email of emails) {
        await supabase.functions.invoke('send-email', {
          body: { to: email, subject: `Thank you for attending ${event.title}!`, template: 'post_event_thank_you',
            data: { eventTitle: event.title, message: thankYouMessage, photosLink } }
        })
      }
      alert(`Sent to ${emails.length} attendees!`)
    } catch (err) { alert('Failed to send') }
    finally { setSending(false) }
  }

  const sendFeedbackRequest = async () => {
    if (!feedbackLink.trim()) { alert('Please enter feedback link'); return }
    setSending(true)
    try {
      const emails = [...new Set(attendees.map(a => a.attendee_email).filter(Boolean))]
      for (const email of emails) {
        await supabase.functions.invoke('send-email', {
          body: { to: email, subject: `How was ${event.title}?`, template: 'post_event_feedback',
            data: { eventTitle: event.title, feedbackLink } }
        })
      }
      alert(`Sent to ${emails.length} attendees!`)
    } catch (err) { alert('Failed to send') }
    finally { setSending(false) }
  }

  const announceNextEvent = async () => {
    if (!nextEventId) { alert('Select an event'); return }
    const nextEvent = nextEvents.find(e => e.id === nextEventId)
    setSending(true)
    try {
      const emails = [...new Set(attendees.map(a => a.attendee_email).filter(Boolean))]
      for (const email of emails) {
        await supabase.functions.invoke('send-email', {
          body: { to: email, subject: `You're invited: ${nextEvent.title}`, template: 'post_event_next_event',
            data: { nextEventTitle: nextEvent.title, eventLink: `${window.location.origin}/e/${nextEvent.id}` } }
        })
      }
      alert(`Sent to ${emails.length} attendees!`)
    } catch (err) { alert('Failed to send') }
    finally { setSending(false) }
  }

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Tickets', 'Checked In', 'Country']
    const rows = attendees.map(a => [a.attendee_name || '', a.attendee_email || '', a.quantity || 1, a.is_checked_in ? 'Yes' : 'No', countryNames[a.user?.country_code] || 'Unknown'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`; a.click()
  }

  const exportFinancialReport = () => {
    const report = `FINANCIAL REPORT\n================\nEvent: ${event.title}\nDate: ${new Date(event.start_date).toLocaleDateString()}\n\nGross Revenue: ${formatPrice(summary.totalRevenue, event.currency)}\nPlatform Fees: ${formatPrice(summary.platformFees, event.currency)}\nRefunds: ${formatPrice(summary.refundAmount, event.currency)}\nNet Revenue: ${formatPrice(summary.netRevenue, event.currency)}\n\nTickets Sold: ${summary.ticketsSold}\nCheck-in Rate: ${summary.ticketsSold > 0 ? ((summary.checkedIn / summary.ticketsSold) * 100).toFixed(1) : 0}%`
    const blob = new Blob([report], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}_report.txt`; a.click()
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
  if (!event) return <div className="text-center py-12"><p>Event not found</p><Button onClick={() => navigate('/organizer/events')} className="mt-4">Back</Button></div>

  const fillRate = summary.totalCapacity > 0 ? (summary.ticketsSold / summary.totalCapacity) * 100 : 0
  const checkInRate = summary.ticketsSold > 0 ? (summary.checkedIn / summary.ticketsSold) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/events')}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F0F0F]">{event.title}</h1>
            <Badge className="bg-green-100 text-green-700">Completed</Badge>
          </div>
          <p className="text-[#0F0F0F]/60">{new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <Button onClick={exportFinancialReport} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl"><Download className="w-4 h-4 mr-2" />Export</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#0F0F0F]/10 pb-2 overflow-x-auto">
        {[{ id: 'summary', label: 'Summary', icon: BarChart3 }, { id: 'insights', label: 'Insights', icon: PieChart }, { id: 'followup', label: 'Follow-up', icon: Mail }, { id: 'reports', label: 'Reports', icon: FileText }].map(tab => (
          <Button key={tab.id} variant={activeTab === tab.id ? 'default' : 'ghost'} className={`rounded-xl whitespace-nowrap ${activeTab === tab.id ? 'bg-[#2969FF] text-white' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon className="w-4 h-4 mr-2" />{tab.label}
          </Button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#0F0F0F]/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-xl"><DollarSign className="w-5 h-5 text-green-600" /></div>
                  <div><p className="text-sm text-[#0F0F0F]/60">Net Revenue</p><p className="text-xl font-bold">{formatPrice(summary.netRevenue, event.currency)}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#0F0F0F]/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Ticket className="w-5 h-5 text-blue-600" /></div>
                  <div><p className="text-sm text-[#0F0F0F]/60">Tickets Sold</p><p className="text-xl font-bold">{summary.ticketsSold} <span className="text-sm font-normal text-[#0F0F0F]/60">({fillRate.toFixed(0)}%)</span></p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#0F0F0F]/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl"><CheckCircle className="w-5 h-5 text-purple-600" /></div>
                  <div><p className="text-sm text-[#0F0F0F]/60">Check-in Rate</p><p className="text-xl font-bold">{checkInRate.toFixed(0)}%</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#0F0F0F]/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-xl"><RefreshCw className="w-5 h-5 text-orange-600" /></div>
                  <div><p className="text-sm text-[#0F0F0F]/60">Refunds</p><p className="text-xl font-bold">{summary.refundCount}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl bg-[#F4F6FA]"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Gross Revenue</p><p className="text-lg font-semibold">{formatPrice(summary.totalRevenue, event.currency)}</p></CardContent></Card>
            <Card className="rounded-2xl bg-[#F4F6FA]"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Platform Fees</p><p className="text-lg font-semibold">{formatPrice(summary.platformFees, event.currency)}</p></CardContent></Card>
            <Card className="rounded-2xl bg-[#F4F6FA]"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Avg. Price</p><p className="text-lg font-semibold">{formatPrice(summary.avgTicketPrice, event.currency)}</p></CardContent></Card>
            <Card className="rounded-2xl bg-[#F4F6FA]"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Page Views</p><p className="text-lg font-semibold">{summary.pageViews.toLocaleString()}</p></CardContent></Card>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="w-5 h-5 text-[#2969FF]" />Attendee Locations</CardTitle></CardHeader>
            <CardContent>
              {insights.locationBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {insights.locationBreakdown.slice(0, 8).map((loc) => (
                    <div key={loc.code} className="flex items-center justify-between">
                      <span>{loc.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2969FF] rounded-full" style={{ width: `${(loc.count / summary.ticketsSold) * 100}%` }} />
                        </div>
                        <span className="text-sm text-[#0F0F0F]/60 w-12 text-right">{loc.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-4 text-[#0F0F0F]/60">No data</p>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Ticket className="w-5 h-5 text-[#2969FF]" />Ticket Types</CardTitle></CardHeader>
            <CardContent>
              {insights.ticketTypeBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {insights.ticketTypeBreakdown.map((type) => (
                    <div key={type.name} className="flex items-center justify-between">
                      <span>{type.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2969FF] rounded-full" style={{ width: `${(type.count / summary.ticketsSold) * 100}%` }} />
                        </div>
                        <span className="text-sm text-[#0F0F0F]/60 w-12 text-right">{type.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-4 text-[#0F0F0F]/60">No data</p>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="w-5 h-5 text-[#2969FF]" />Payment Methods</CardTitle></CardHeader>
            <CardContent>
              {insights.paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {insights.paymentMethods.map((m) => (
                    <div key={m.method} className="flex items-center justify-between">
                      <span className="capitalize">{m.method}</span>
                      <Badge variant="outline">{m.count} orders</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-4 text-[#0F0F0F]/60">No data</p>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Clock className="w-5 h-5 text-[#2969FF]" />Purchase Times</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {insights.purchaseByHour.map((h) => {
                  const max = Math.max(...insights.purchaseByHour.map(x => x.count), 1)
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-[#2969FF] rounded-t" style={{ height: `${(h.count / max) * 100}%`, minHeight: h.count > 0 ? '4px' : '0' }} title={`${h.hour}:00 - ${h.count} orders`} />
                      {h.hour % 6 === 0 && <span className="text-xs text-[#0F0F0F]/40 mt-1">{h.hour}</span>}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-center mt-2 text-[#0F0F0F]/60">Hour of day (24h)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Follow-up Tab */}
      {activeTab === 'followup' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Mail className="w-5 h-5 text-[#2969FF]" />Send Thank You</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} className="min-h-[100px] rounded-xl bg-[#F4F6FA] border-0" />
              </div>
              <div className="space-y-2">
                <Label>Photos Link (optional)</Label>
                <Input value={photosLink} onChange={(e) => setPhotosLink(e.target.value)} className="h-12 rounded-xl bg-[#F4F6FA] border-0" placeholder="https://..." />
              </div>
              <Button onClick={sendThankYouEmail} disabled={sending} className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Send to {attendees.length} Attendees
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Star className="w-5 h-5 text-[#2969FF]" />Request Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Feedback Form Link</Label>
                <Input value={feedbackLink} onChange={(e) => setFeedbackLink(e.target.value)} className="h-12 rounded-xl bg-[#F4F6FA] border-0" placeholder="https://forms.google.com/..." />
                <p className="text-xs text-[#0F0F0F]/60">Use Google Forms, Typeform, etc.</p>
              </div>
              <Button onClick={sendFeedbackRequest} disabled={sending || !feedbackLink} className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}Send Request
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10 md:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="w-5 h-5 text-[#2969FF]" />Announce Next Event</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {nextEvents.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <Label>Select Event</Label>
                    <select value={nextEventId} onChange={(e) => setNextEventId(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0">
                      <option value="">Choose...</option>
                      {nextEvents.map(e => <option key={e.id} value={e.id}>{e.title} - {new Date(e.start_date).toLocaleDateString()}</option>)}
                    </select>
                  </div>
                  <Button onClick={announceNextEvent} disabled={sending || !nextEventId} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Send to Past Attendees
                  </Button>
                </>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-2" />
                  <p className="text-[#0F0F0F]/60">No upcoming events</p>
                  <Button onClick={() => navigate('/organizer/create-event')} className="mt-4 bg-[#2969FF] rounded-xl">Create Event</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5 text-[#2969FF]" />Payout Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-[#0F0F0F]/10"><span className="text-[#0F0F0F]/60">Gross Revenue</span><span className="font-medium">{formatPrice(summary.totalRevenue, event.currency)}</span></div>
                <div className="flex justify-between py-2 border-b border-[#0F0F0F]/10"><span className="text-[#0F0F0F]/60">Platform Fees</span><span className="font-medium text-red-600">-{formatPrice(summary.platformFees, event.currency)}</span></div>
                <div className="flex justify-between py-2 border-b border-[#0F0F0F]/10"><span className="text-[#0F0F0F]/60">Refunds</span><span className="font-medium text-red-600">-{formatPrice(summary.refundAmount, event.currency)}</span></div>
                <div className="flex justify-between py-2"><span className="font-semibold">Net Payout</span><span className="font-bold text-green-600 text-lg">{formatPrice(summary.netRevenue, event.currency)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Download className="w-5 h-5 text-[#2969FF]" />Export Data</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={exportCSV} variant="outline" className="w-full rounded-xl justify-start"><FileText className="w-4 h-4 mr-2" />Attendee List (CSV)</Button>
              <Button onClick={exportFinancialReport} variant="outline" className="w-full rounded-xl justify-start"><FileText className="w-4 h-4 mr-2" />Financial Report (TXT)</Button>
              <p className="text-xs text-[#0F0F0F]/60">For accounting and tax filing.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#0F0F0F]/10 md:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5 text-[#2969FF]" />Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><p className="text-2xl font-bold">{fillRate.toFixed(0)}%</p><p className="text-sm text-[#0F0F0F]/60">Fill Rate</p></div>
                <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><p className="text-2xl font-bold">{checkInRate.toFixed(0)}%</p><p className="text-sm text-[#0F0F0F]/60">Check-in Rate</p></div>
                <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><p className="text-2xl font-bold">{summary.ticketsSold > 0 ? ((summary.refundCount / summary.ticketsSold) * 100).toFixed(1) : 0}%</p><p className="text-sm text-[#0F0F0F]/60">Refund Rate</p></div>
                <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><p className="text-2xl font-bold">{summary.pageViews > 0 ? ((summary.ticketsSold / summary.pageViews) * 100).toFixed(1) : 0}%</p><p className="text-sm text-[#0F0F0F]/60">Conversion</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
