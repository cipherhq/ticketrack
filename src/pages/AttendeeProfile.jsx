import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Ticket, Heart, Settings, Camera, Mail, Phone, MapPin, Calendar, Edit2, LogOut, Loader2, CheckCircle, DollarSign, Gift, Copy, ExternalLink, Share2, Banknote, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { TaxDocuments } from '@/components/TaxDocuments';

export function AttendeeProfile() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [savedEvents, setSavedEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [stats, setStats] = useState({ eventsAttended: 0, ticketsPurchased: 0, following: 0 })
  const [activeTab, setActiveTab] = useState(location.state?.tab || "profile")
  const [notificationSettings, setNotificationSettings] = useState({ email: true, sms: false })
  const [earnings, setEarnings] = useState({ balance: 0, total: 0, pending: 0, referralCode: '', referralCount: 0, affiliateStatus: null })
  const [earningsHistory, setEarningsHistory] = useState([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadProfileData()
    loadEarnings()
  }, [user, navigate])

  const loadProfileData = async () => {
    setLoading(true)
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setEditForm({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
        })
        setNotificationSettings({ email: profileData.email_notifications ?? true, sms: profileData.sms_notifications ?? false })
      }

      // Load tickets with event details
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          *,
          event:events(id, title, slug, start_date, venue_name, city, image_url),
          ticket_type:ticket_types(name, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setTickets(ticketsData || [])

      // Calculate stats
      const activeTickets = ticketsData?.filter(t => t.status === 'valid') || []
      const uniqueEvents = new Set(ticketsData?.map(t => t.event_id) || [])
      
      setStats({
        eventsAttended: uniqueEvents.size,
        ticketsPurchased: ticketsData?.length || 0,
        following: 0
      })

    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }


  // Load affiliate earnings data
  const loadEarnings = async () => {
    if (!user) return
    try {
      // Get profile with referral info
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code, affiliate_balance, total_referral_earnings, referral_count, affiliate_status')
        .eq('id', user.id)
        .single()

      // Get pending earnings (not yet available)
      const { data: pendingData } = await supabase
        .from('referral_earnings')
        .select('commission_amount')
        .eq('user_id', user.id)
        .eq('status', 'pending')

      const pendingTotal = pendingData?.reduce((sum, e) => sum + parseFloat(e.commission_amount || 0), 0) || 0

      // Get recent earnings history
      const { data: historyData } = await supabase
        .from('referral_earnings')
        .select(`
          id, commission_amount, currency, status, created_at,
          events:event_id (title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setEarnings({
        balance: parseFloat(profileData?.affiliate_balance || 0),
        total: parseFloat(profileData?.total_referral_earnings || 0),
        pending: pendingTotal,
        referralCode: profileData?.referral_code || '',
        referralCount: profileData?.referral_count || 0,
        affiliateStatus: profileData?.affiliate_status || null
      })
      setEarningsHistory(historyData || [])
    } catch (error) {
      console.error('Error loading earnings:', error)
    }
  }

  // Copy referral link to clipboard
  const copyReferralLink = () => {
    const link = `${window.location.origin}?aff=${earnings.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Share referral link
  const shareReferralLink = async () => {
    const link = `${window.location.origin}?aff=${earnings.referralCode}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Ticketrack',
          text: 'Get tickets to amazing events!',
          url: link
        })
      } catch (err) {
        copyReferralLink()
      }
    } else {
      copyReferralLink()
    }
  }

  // Handle becoming an affiliate (opt-in)

  // Handle becoming an affiliate
  const handleBecomeAffiliate = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('become_affiliate', { p_user_id: user.id })
      if (error) throw error
      if (data?.success) {
        await loadEarnings()
        alert(data.message)
      } else {
        alert(data?.message || 'Failed to join')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          full_name: `${editForm.first_name} ${editForm.last_name}`,
          phone: editForm.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => ({
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        full_name: `${editForm.first_name} ${editForm.last_name}`,
        phone: editForm.phone
      }))
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleNotificationToggle = async (type) => {
    const newValue = !notificationSettings[type]
    setNotificationSettings(prev => ({ ...prev, [type]: newValue }))
    try {
      await supabase
        .from("profiles")
        .update({ [`${type}_notifications`]: newValue })
        .eq("id", user.id)
    } catch (error) {
      console.error("Error updating notification settings:", error)
      setNotificationSettings(prev => ({ ...prev, [type]: !newValue }))
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  const getMemberSince = () => {
    if (profile?.created_at) {
      return new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return 'Recently'
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  const activeTickets = tickets.filter(t => t.status === 'valid')
  const pastTickets = tickets.filter(t => t.status !== 'valid')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-[#2969FF] text-white text-2xl">{getInitials()}</AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#2969FF]/90">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-[#0F0F0F]">
                  {profile?.full_name || profile?.first_name || 'User'}
                </h2>
                <p className="text-[#0F0F0F]/60 text-sm">Member since {getMemberSince()}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl">
                  <div className="text-xl font-bold text-[#0F0F0F]">{stats.eventsAttended}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Events</div>
                </div>
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl">
                  <div className="text-xl font-bold text-[#0F0F0F]">{stats.ticketsPurchased}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Tickets</div>
                </div>
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl">
                  <div className="text-xl font-bold text-[#0F0F0F]">{stats.following}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Following</div>
                </div>
              </div>

              <Separator className="mb-4" />

              <nav className="space-y-1">
                {[
                  { icon: User, label: "Profile", tab: "profile" },
                  { icon: Ticket, label: "My Tickets", tab: "tickets" },
                  { icon: Heart, label: "Saved Events", tab: "saved" },
                  { icon: Settings, label: "Settings", tab: "settings" }
                ].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button 
                      key={index} 
                      onClick={() => setActiveTab(item.tab)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        activeTab === item.tab 
                          ? 'bg-[#2969FF]/10 text-[#2969FF]' 
                          : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Profile</TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Tickets</TabsTrigger>
              <TabsTrigger value="saved" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Saved</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Settings</TabsTrigger>
              <TabsTrigger value="earnings" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-1" />Earnings
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-[#0F0F0F]">Personal Information</CardTitle>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditing(false)}>Cancel</Button>
                      <Button size="sm" className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={editForm.email} disabled className="rounded-xl border-[#0F0F0F]/10 bg-[#F4F6FA]" />
                        <p className="text-xs text-[#0F0F0F]/60">Email cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                        <Mail className="w-5 h-5 text-[#0F0F0F]/60" />
                        <div>
                          <p className="text-xs text-[#0F0F0F]/60">Email</p>
                          <p className="text-[#0F0F0F]">{profile?.email}</p>
                        </div>
                        {profile?.is_verified && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                        <Phone className="w-5 h-5 text-[#0F0F0F]/60" />
                        <div>
                          <p className="text-xs text-[#0F0F0F]/60">Phone</p>
                          <p className="text-[#0F0F0F]">{profile?.phone || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                        <Calendar className="w-5 h-5 text-[#0F0F0F]/60" />
                        <div>
                          <p className="text-xs text-[#0F0F0F]/60">Member Since</p>
                          <p className="text-[#0F0F0F]">{getMemberSince()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tickets Tab */}
            <TabsContent value="tickets">
              {tickets.length === 0 ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                      <Ticket className="w-10 h-10 text-[#0F0F0F]/40" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No tickets yet</h3>
                    <p className="text-[#0F0F0F]/60 mb-6">Start exploring events and book your tickets</p>
                    <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                      Browse Events
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {tickets.slice(0, 5).map((ticket) => (
                    <Card key={ticket.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                      <div className="flex">
                        <div className="w-32 h-32 bg-[#F4F6FA] flex-shrink-0">
                          <img 
                            src={ticket.event?.image_url} 
                            alt={ticket.event?.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        </div>
                        <CardContent className="flex-1 p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-[#0F0F0F] mb-1">{ticket.event?.title}</h3>
                              <p className="text-sm text-[#0F0F0F]/60 mb-2">
                                {formatDate(ticket.event?.start_date)} • {ticket.event?.venue_name}
                              </p>
                              <Badge className={ticket.status === 'valid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                                {ticket.status === 'valid' ? 'Active' : 'Used'}
                              </Badge>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-xl"
                              onClick={() => navigate(`/tickets`)}
                            >
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                  {tickets.length > 5 && (
                    <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/tickets')}>
                      View All Tickets ({tickets.length})
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Saved Tab */}
            <TabsContent value="saved">
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                    <Heart className="w-10 h-10 text-[#0F0F0F]/40" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No saved events</h3>
                  <p className="text-[#0F0F0F]/60 mb-6">Save events you're interested in</p>
                  <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[#0F0F0F]">Account Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                    <div>
                      <p className="font-medium text-[#0F0F0F]">Email Notifications</p>
                      <p className="text-sm text-[#0F0F0F]/60">Receive updates about your tickets</p>
                    </div>
                    <Checkbox 
                      checked={notificationSettings.email} 
                      onCheckedChange={() => handleNotificationToggle('email')}
                      className="h-6 w-6 data-[state=checked]:bg-[#2969FF]"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                    <div>
                      <p className="font-medium text-[#0F0F0F]">SMS Notifications</p>
                      <p className="text-sm text-[#0F0F0F]/60">Get reminders via SMS</p>
                    </div>
                    <Checkbox 
                      checked={notificationSettings.sms} 
                      onCheckedChange={() => handleNotificationToggle('sms')}
                      className="h-6 w-6 data-[state=checked]:bg-[#2969FF]"
                    />
                  </div>
                  <Separator />
                  <Button variant="outline" className="w-full rounded-xl text-red-500 border-red-200 hover:bg-red-50" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />Sign Out
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Earnings Tab */}
            <TabsContent value="earnings">
              {!earnings.affiliateStatus ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="py-12 text-center">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Gift className="w-10 h-10 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#0F0F0F] mb-3">Earn Money Sharing Events</h2>
                    <p className="text-[#0F0F0F]/60 mb-6 max-w-md mx-auto">
                      Join our affiliate program and earn <span className="font-semibold text-green-600">40% commission</span> on platform fees when people buy tickets using your link.
                    </p>
                    <Button onClick={handleBecomeAffiliate} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-8 py-6 text-lg">
                      {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Gift className="w-5 h-5 mr-2" />}
                      Become an Affiliate
                    </Button>
                    <p className="text-xs text-[#0F0F0F]/40 mt-4">Minimum withdrawal: ₦5,000 / $10 / £8</p>
                  </CardContent>
                </Card>
              ) : earnings.affiliateStatus === 'suspended' ? (
                <Card className="border-red-200 bg-red-50 rounded-2xl">
                  <CardContent className="py-12 text-center">
                    <h2 className="text-xl font-bold text-red-700 mb-2">Affiliate Account Suspended</h2>
                    <p className="text-red-600">Please contact support.</p>
                  </CardContent>
                </Card>
              ) : (
              <div className="space-y-6">
                {/* Earnings Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-[#0F0F0F]/10 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#0F0F0F]/60">Available Balance</p>
                          <h3 className="text-2xl font-bold text-green-600">₦{earnings.balance.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                          <Banknote className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#0F0F0F]/10 rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                          <h3 className="text-2xl font-bold text-[#0F0F0F]">₦{earnings.pending.toLocaleString()}</h3>
                          <p className="text-xs text-[#0F0F0F]/50">Available after event</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-yellow-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#0F0F0F]/10 rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#0F0F0F]/60">Total Earned</p>
                          <h3 className="text-2xl font-bold text-[#0F0F0F]">₦{earnings.total.toLocaleString()}</h3>
                          <p className="text-xs text-[#0F0F0F]/50">{earnings.referralCount} referrals</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                          <Gift className="w-6 h-6 text-[#2969FF]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Referral Link Card */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-[#2969FF]" />
                      Your Referral Link
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-[#0F0F0F]/70">
                      Share your unique link and earn <span className="font-semibold text-green-600">40%</span> of our platform fee when someone buys a ticket!
                    </p>
                    
                    <div className="flex gap-2">
                      <div className="flex-1 bg-[#F4F6FA] rounded-xl px-4 py-3 font-mono text-sm truncate">
                        {window.location.origin}?aff={earnings.referralCode}
                      </div>
                      <Button 
                        onClick={copyReferralLink}
                        variant="outline" 
                        className="rounded-xl border-[#0F0F0F]/10"
                      >
                        {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button 
                        onClick={shareReferralLink}
                        className="rounded-xl bg-[#2969FF] hover:bg-[#1e4fcc]"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                      <p className="font-medium mb-1">💡 How it works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-700">
                        <li>Share your link with friends</li>
                        <li>They buy tickets to any event</li>
                        <li>You earn 40% of our service fee</li>
                        <li>Withdraw after the event happens</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                {/* Earnings History */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[#2969FF]" />
                        Earnings History
                      </span>
                      {earnings.balance >= 5000 && (
                        <Button 
                          onClick={() => navigate('/affiliate/withdraw')}
                          className="rounded-xl bg-green-600 hover:bg-green-700"
                        >
                          Withdraw ₦{earnings.balance.toLocaleString()}
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {earningsHistory.length === 0 ? (
                      <div className="text-center py-8 text-[#0F0F0F]/50">
                        <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No earnings yet</p>
                        <p className="text-sm">Share your referral link to start earning!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {earningsHistory.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                            <div>
                              <p className="font-medium text-[#0F0F0F]">{item.events?.title || 'Event'}</p>
                              <p className="text-xs text-[#0F0F0F]/60">
                                {new Date(item.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                +₦{parseFloat(item.commission_amount).toLocaleString()}
                              </p>
                              <Badge className={`text-xs ${
                                item.status === 'available' ? 'bg-green-100 text-green-700' :
                                item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                item.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {earnings.balance > 0 && earnings.balance < 5000 && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-sm text-yellow-800">
                        <p>Minimum withdrawal is ₦5,000. You need ₦{(5000 - earnings.balance).toLocaleString()} more to withdraw.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
