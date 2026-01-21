import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Ticket, Heart, Settings, Camera, Mail, Phone, MapPin, Calendar, Edit2, LogOut, Loader2, CheckCircle, DollarSign, Gift, Copy, ExternalLink, Share2, Banknote, TrendingUp, Lock, Trash2, Eye, EyeOff, AlertTriangle, CreditCard, Building, Users, Star, Receipt, X, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const getCurrencySymbol = (countryCode) => {
  const symbols = { NG: "₦", GH: "₵", US: "$", GB: "£", CA: "C$", KE: "KSh", ZA: "R" };
  return symbols[countryCode] || "$";
};

const getMinWithdrawal = (countryCode) => {
  const mins = { NG: 5000, GH: 50, US: 10, GB: 8, CA: 15, KE: 1000, ZA: 150 };
  return mins[countryCode] || 10;
};

import { formatCurrency } from '@/lib/utils'

// Interest categories
const INTEREST_CATEGORIES = [
  { id: 'music', label: 'Music & Concerts', icon: '🎵' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'arts', label: 'Arts & Theatre', icon: '🎭' },
  { id: 'comedy', label: 'Comedy', icon: '😂' },
  { id: 'food', label: 'Food & Drink', icon: '🍕' },
  { id: 'tech', label: 'Tech & Business', icon: '💻' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: '🏋️' },
  { id: 'nightlife', label: 'Nightlife & Parties', icon: '🎉' },
  { id: 'family', label: 'Family & Kids', icon: '👨‍👩‍👧' },
  { id: 'education', label: 'Education & Workshops', icon: '📚' },
  { id: 'charity', label: 'Charity & Causes', icon: '❤️' },
  { id: 'networking', label: 'Networking', icon: '🤝' },
]

// Month names for birthday
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

// Helper: Check if event date has passed
const isEventPast = (eventDate) => {
  if (!eventDate) return false
  return new Date(eventDate) < new Date()
}

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

  // Following state
  const [followedOrganizers, setFollowedOrganizers] = useState([])
  
  // Groups state
  const [groups, setGroups] = useState({ active: [], completed: [], expired: [] })
  const [loadingGroups, setLoadingGroups] = useState(false)
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([])
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState(null)

  // Order history state
  const [orders, setOrders] = useState([])

  // Watch for navigation state changes
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab)
    }
  }, [location.key])

  const [earnings, setEarnings] = useState({ balance: 0, total: 0, pending: 0, referralCode: '', referralCount: 0, affiliateStatus: null })
  const [earningsHistory, setEarningsHistory] = useState([])
  const [copied, setCopied] = useState(false)

  // Password change state
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadProfileData()
    loadEarnings()
    loadSavedEvents()
    loadFollowedOrganizers()
    loadPaymentMethods()
    loadOrders()
    loadGroups()
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
          city: profileData.city || '',
          country: profileData.country || '',
          birth_month: profileData.birth_month || '',
          birth_day: profileData.birth_day || '',
          interests: profileData.interests || [],
          billing_address: profileData.billing_address || {},
        })
      }

      // Load tickets with event details
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          *,
          event:events(id, title, slug, start_date, venue_name, venue_address, city, image_url, is_virtual),
          ticket_type:ticket_types(name, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setTickets(ticketsData || [])

      // Calculate stats
      const uniqueEvents = new Set(ticketsData?.map(t => t.event_id) || [])
      
      // Get following count
      const { count: followingCount } = await supabase
        .from('organizer_follows')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      setStats({
        eventsAttended: uniqueEvents.size,
        ticketsPurchased: ticketsData?.length || 0,
        following: followingCount || 0
      })

    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load followed organizers
  const loadFollowedOrganizers = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('organizer_follows')
        .select(`
          id,
          created_at,
          organizer:organizers (
            id,
            business_name,
            logo_url,
            is_verified
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFollowedOrganizers(data || [])
    } catch (error) {
      console.error('Error loading followed organizers:', error)
    }
  }

  // Unfollow organizer
  const unfollowOrganizer = async (followId) => {
    try {
      const { error } = await supabase
        .from('organizer_follows')
        .delete()
        .eq('id', followId)

      if (error) throw error
      
      setFollowedOrganizers(prev => prev.filter(f => f.id !== followId))
      setStats(prev => ({ ...prev, following: prev.following - 1 }))
    } catch (error) {
      console.error('Error unfollowing organizer:', error)
    }
  }

  // Load group buy sessions
  const loadGroups = async () => {
    if (!user) return
    try {
      setLoadingGroups(true)
      
      const { data: memberships, error } = await supabase
        .from('group_buy_members')
        .select(`
          *,
          session:group_buy_sessions(
            *,
            event:events(id, title, slug, start_date, venue_name, venue_address, city, image_url, is_virtual)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Group buy tables may not exist:', error.message)
        setGroups({ active: [], completed: [], expired: [] })
        return
      }

      // Categorize groups
      const active = []
      const completed = []
      const expired = []

      memberships?.forEach(m => {
        if (!m.session) return
        
        const isExpired = new Date(m.session.expires_at) < new Date()
        const isCompleted = m.status === 'completed' || m.session.status === 'completed'

        if (isCompleted) {
          completed.push(m)
        } else if (isExpired || m.session.status === 'expired') {
          expired.push(m)
        } else if (m.session.status === 'active') {
          active.push(m)
        }
      })

      setGroups({ active, completed, expired })
    } catch (error) {
      console.error('Error loading groups:', error)
      setGroups({ active: [], completed: [], expired: [] })
    } finally {
      setLoadingGroups(false)
    }
  }

  // Load payment methods
  const loadPaymentMethods = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('saved_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })

      if (error) throw error
      setPaymentMethods(data || [])
    } catch (error) {
      console.error('Error loading payment methods:', error)
    }
  }

  // Delete payment method
  const deletePaymentMethod = async (methodId) => {
    setDeletingPaymentMethod(methodId)
    try {
      const { error } = await supabase
        .from('saved_payment_methods')
        .delete()
        .eq('id', methodId)

      if (error) throw error
      setPaymentMethods(prev => prev.filter(m => m.id !== methodId))
    } catch (error) {
      console.error('Error deleting payment method:', error)
    } finally {
      setDeletingPaymentMethod(null)
    }
  }

  // Set default payment method
  const setDefaultPaymentMethod = async (methodId) => {
    try {
      // Remove default from all
      await supabase
        .from('saved_payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id)

      // Set new default
      await supabase
        .from('saved_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId)

      // Update local state
      setPaymentMethods(prev => prev.map(m => ({
        ...m,
        is_default: m.id === methodId
      })))
    } catch (error) {
      console.error('Error setting default payment method:', error)
    }
  }

  // Load order history
  const loadOrders = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          event:events(id, title, slug, image_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  // Load affiliate earnings data
  const loadEarnings = async () => {
    if (!user) return
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code, affiliate_balance, total_referral_earnings, referral_count, affiliate_status')
        .eq('id', user.id)
        .single()

      const { data: pendingData } = await supabase
        .from('referral_earnings')
        .select('commission_amount')
        .eq('user_id', user.id)
        .eq('status', 'pending')

      const pendingTotal = pendingData?.reduce((sum, e) => sum + parseFloat(e.commission_amount || 0), 0) || 0

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

  // Load saved events
  const loadSavedEvents = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('saved_events')
        .select(`
          id,
          created_at,
          event:events (
            id,
            title,
            slug,
            start_date,
            venue_name,
            city,
            image_url,
            is_free,
            currency
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSavedEvents(data || [])
    } catch (error) {
      console.error('Error loading saved events:', error)
    }
  }

  // Remove saved event
  const removeSavedEvent = async (savedEventId) => {
    try {
      const { error } = await supabase
        .from('saved_events')
        .delete()
        .eq('id', savedEventId)

      if (error) throw error
      setSavedEvents(prev => prev.filter(e => e.id !== savedEventId))
    } catch (error) {
      console.error('Error removing saved event:', error)
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

  // Toggle interest selection
  const toggleInterest = (interestId) => {
    setEditForm(prev => {
      const currentInterests = prev.interests || []
      if (currentInterests.includes(interestId)) {
        return { ...prev, interests: currentInterests.filter(i => i !== interestId) }
      } else {
        return { ...prev, interests: [...currentInterests, interestId] }
      }
    })
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
          city: editForm.city,
          country: editForm.country,
          birth_month: editForm.birth_month || null,
          birth_day: editForm.birth_day || null,
          interests: editForm.interests || [],
          billing_address: editForm.billing_address || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => ({
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        full_name: `${editForm.first_name} ${editForm.last_name}`,
        phone: editForm.phone,
        city: editForm.city,
        country: editForm.country,
        birth_month: editForm.birth_month,
        birth_day: editForm.birth_day,
        interests: editForm.interests,
        billing_address: editForm.billing_address,
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

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      setPasswordError('Please fill in all fields')
      return
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.current
      })

      if (signInError) {
        setPasswordError('Current password is incorrect')
        setChangingPassword(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.new
      })

      if (updateError) throw updateError

      setPasswordSuccess('Password changed successfully!')
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (error) {
      console.error('Error changing password:', error)
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setDeleting(true)
    try {
      const { error } = await supabase.rpc('delete_user_account', { user_id: user.id })
      
      if (error) throw error

      await signOut()
      navigate('/account-deleted')
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account. Please contact support.')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
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

  const getBirthdayDisplay = () => {
    if (profile?.birth_month && profile?.birth_day) {
      const month = MONTHS.find(m => m.value === profile.birth_month)?.label || ''
      return `${month} ${profile.birth_day}`
    }
    return 'Not set'
  }

  const getCardIcon = (brand) => {
    const brandLower = (brand || '').toLowerCase()
    if (brandLower.includes('visa')) return '💳'
    if (brandLower.includes('master')) return '💳'
    if (brandLower.includes('amex')) return '💳'
    return '💳'
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  // Sort tickets: upcoming events first, then past events
  const sortedTickets = [...tickets].sort((a, b) => {
    const aUpcoming = !isEventPast(a.event?.start_date)
    const bUpcoming = !isEventPast(b.event?.start_date)
    if (aUpcoming && !bUpcoming) return -1
    if (!aUpcoming && bUpcoming) return 1
    if (aUpcoming) {
      return new Date(a.event?.start_date || 0) - new Date(b.event?.start_date || 0)
    }
    return new Date(b.event?.start_date || 0) - new Date(a.event?.start_date || 0)
  })

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
                {profile?.city && (
                  <p className="text-[#0F0F0F]/50 text-sm flex items-center justify-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {profile.city}{profile.country ? `, ${profile.country}` : ''}
                  </p>
                )}
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
                <div 
                  className="text-center p-3 bg-[#F4F6FA] rounded-xl cursor-pointer hover:bg-[#2969FF]/10 transition-colors"
                  onClick={() => setActiveTab('following')}
                >
                  <div className="text-xl font-bold text-[#0F0F0F]">{stats.following}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Following</div>
                </div>
              </div>

              <Separator className="mb-4" />

              <nav className="space-y-1">
                {[
                  { icon: User, label: "Profile", tab: "profile" },
                  { icon: Ticket, label: "My Tickets", tab: "tickets" },
                  { icon: Receipt, label: "Order History", tab: "orders" },
                  { icon: Heart, label: "Saved Events", tab: "saved" },
                  { icon: Users, label: "Following", tab: "following" },
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors mt-2"
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
            <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1 flex-wrap h-auto">
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Profile</TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Tickets</TabsTrigger>
              <TabsTrigger value="orders" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Orders</TabsTrigger>
              <TabsTrigger value="saved" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Saved</TabsTrigger>
              <TabsTrigger value="following" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Following</TabsTrigger>
              <TabsTrigger value="groups" className="rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-1" />Groups
              </TabsTrigger>
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
                    <div className="space-y-6">
                      {/* Name */}
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

                      {/* Email */}
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={editForm.email} disabled className="rounded-xl border-[#0F0F0F]/10 bg-[#F4F6FA]" />
                        <p className="text-xs text-[#0F0F0F]/60">Email cannot be changed</p>
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" />
                      </div>

                      {/* Location */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" placeholder="e.g. Lagos" />
                        </div>
                        <div className="space-y-2">
                          <Label>Country</Label>
                          <Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" placeholder="e.g. Nigeria" />
                        </div>
                      </div>

                      {/* Birthday */}
                      <div className="space-y-2">
                        <Label>Birthday (for birthday wishes 🎂)</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Select value={String(editForm.birth_month || '')} onValueChange={(val) => setEditForm({ ...editForm, birth_month: parseInt(val) })}>
                            <SelectTrigger className="rounded-xl border-[#0F0F0F]/10">
                              <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map(month => (
                                <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={String(editForm.birth_day || '')} onValueChange={(val) => setEditForm({ ...editForm, birth_day: parseInt(val) })}>
                            <SelectTrigger className="rounded-xl border-[#0F0F0F]/10">
                              <SelectValue placeholder="Day" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Interests */}
                      <div className="space-y-2">
                        <Label>Interests (helps us recommend events)</Label>
                        <div className="flex flex-wrap gap-2">
                          {INTEREST_CATEGORIES.map(interest => (
                            <button
                              key={interest.id}
                              type="button"
                              onClick={() => toggleInterest(interest.id)}
                              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                editForm.interests?.includes(interest.id)
                                  ? 'bg-[#2969FF] text-white'
                                  : 'bg-[#F4F6FA] text-[#0F0F0F]/70 hover:bg-[#0F0F0F]/10'
                              }`}
                            >
                              {interest.icon} {interest.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Billing Address */}
                      <div className="space-y-2">
                        <Label>Billing Address (optional)</Label>
                        <div className="space-y-3 p-4 bg-[#F4F6FA] rounded-xl">
                          <Input 
                            placeholder="Street Address" 
                            value={editForm.billing_address?.street || ''} 
                            onChange={(e) => setEditForm({ ...editForm, billing_address: { ...editForm.billing_address, street: e.target.value } })} 
                            className="rounded-xl border-[#0F0F0F]/10 bg-white" 
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input 
                              placeholder="City" 
                              value={editForm.billing_address?.city || ''} 
                              onChange={(e) => setEditForm({ ...editForm, billing_address: { ...editForm.billing_address, city: e.target.value } })} 
                              className="rounded-xl border-[#0F0F0F]/10 bg-white" 
                            />
                            <Input 
                              placeholder="State/Province" 
                              value={editForm.billing_address?.state || ''} 
                              onChange={(e) => setEditForm({ ...editForm, billing_address: { ...editForm.billing_address, state: e.target.value } })} 
                              className="rounded-xl border-[#0F0F0F]/10 bg-white" 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input 
                              placeholder="Postal Code" 
                              value={editForm.billing_address?.postal_code || ''} 
                              onChange={(e) => setEditForm({ ...editForm, billing_address: { ...editForm.billing_address, postal_code: e.target.value } })} 
                              className="rounded-xl border-[#0F0F0F]/10 bg-white" 
                            />
                            <Input 
                              placeholder="Country" 
                              value={editForm.billing_address?.country || ''} 
                              onChange={(e) => setEditForm({ ...editForm, billing_address: { ...editForm.billing_address, country: e.target.value } })} 
                              className="rounded-xl border-[#0F0F0F]/10 bg-white" 
                            />
                          </div>
                        </div>
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
                        <MapPin className="w-5 h-5 text-[#0F0F0F]/60" />
                        <div>
                          <p className="text-xs text-[#0F0F0F]/60">Location</p>
                          <p className="text-[#0F0F0F]">{profile?.city ? `${profile.city}${profile.country ? `, ${profile.country}` : ''}` : 'Not set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                        <Calendar className="w-5 h-5 text-[#0F0F0F]/60" />
                        <div>
                          <p className="text-xs text-[#0F0F0F]/60">Birthday</p>
                          <p className="text-[#0F0F0F]">{getBirthdayDisplay()}</p>
                        </div>
                      </div>
                      
                      {/* Interests Display */}
                      {profile?.interests && profile.interests.length > 0 && (
                        <div className="p-4 bg-[#F4F6FA] rounded-xl">
                          <p className="text-xs text-[#0F0F0F]/60 mb-2">Interests</p>
                          <div className="flex flex-wrap gap-2">
                            {profile.interests.map(interestId => {
                              const interest = INTEREST_CATEGORIES.find(c => c.id === interestId)
                              return interest ? (
                                <Badge key={interestId} variant="outline" className="bg-white">
                                  {interest.icon} {interest.label}
                                </Badge>
                              ) : null
                            })}
                          </div>
                        </div>
                      )}

                      {/* Billing Address Display */}
                      {profile?.billing_address && Object.keys(profile.billing_address).some(k => profile.billing_address[k]) && (
                        <div className="flex items-start gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                          <Building className="w-5 h-5 text-[#0F0F0F]/60 mt-0.5" />
                          <div>
                            <p className="text-xs text-[#0F0F0F]/60">Billing Address</p>
                            <p className="text-[#0F0F0F]">
                              {[
                                profile.billing_address.street,
                                profile.billing_address.city,
                                profile.billing_address.state,
                                profile.billing_address.postal_code,
                                profile.billing_address.country
                              ].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                        <Star className="w-5 h-5 text-[#0F0F0F]/60" />
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
                  {sortedTickets.slice(0, 10).map((ticket) => {
                    const isPast = isEventPast(ticket.event?.start_date)
                    return (
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
                                <Badge className={!isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                                  {!isPast ? 'Active' : 'Past'}
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
                    )
                  })}
                  {tickets.length > 10 && (
                    <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/tickets')}>
                      View All Tickets ({tickets.length})
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              {orders.length === 0 ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                      <Receipt className="w-10 h-10 text-[#0F0F0F]/40" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No orders yet</h3>
                    <p className="text-[#0F0F0F]/60 mb-6">Your purchase history will appear here</p>
                    <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                      Browse Events
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="border-[#0F0F0F]/10 rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="w-16 h-16 bg-[#F4F6FA] rounded-xl overflow-hidden flex-shrink-0">
                              {order.event?.image_url && (
                                <img 
                                  src={order.event.image_url} 
                                  alt={order.event.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-[#0F0F0F]">{order.event?.title || 'Event'}</h3>
                              <p className="text-sm text-[#0F0F0F]/60">
                                Order #{order.reference_id?.slice(-8) || order.id.slice(-8)}
                              </p>
                              <p className="text-xs text-[#0F0F0F]/50 mt-1">
                                {formatDate(order.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#0F0F0F]">
                              {getCurrencySymbol(order.currency)}{parseFloat(order.total_amount || 0).toLocaleString()}
                            </p>
                            <Badge className={
                              order.status === 'completed' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'refunded' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Saved Tab */}
            <TabsContent value="saved">
              {savedEvents.length === 0 ? (
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
              ) : (
                <div className="space-y-4">
                  {savedEvents.map((saved) => {
                    const event = saved.event
                    if (!event) return null
                    const isPast = new Date(event.start_date) < new Date()
                    return (
                      <Card key={saved.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                        <div className="flex">
                          <div className="w-32 h-32 bg-[#F4F6FA] flex-shrink-0 cursor-pointer" onClick={() => navigate(`/events/${event.slug || event.id}`)}>
                            <img 
                              src={event.image_url} 
                              alt={event.title}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          </div>
                          <CardContent className="flex-1 p-4">
                            <div className="flex justify-between items-start">
                              <div className="cursor-pointer" onClick={() => navigate(`/events/${event.slug || event.id}`)}>
                                <h3 className="font-semibold text-[#0F0F0F] mb-1 hover:text-[#2969FF]">{event.title}</h3>
                                <p className="text-sm text-[#0F0F0F]/60 mb-2">
                                  {formatDate(event.start_date)} • {[event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || 'Location TBA'}
                                </p>
                                <div className="flex gap-2">
                                  <Badge className={!isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                                    {!isPast ? 'Upcoming' : 'Past'}
                                  </Badge>
                                  {event.is_free && (
                                    <Badge className="bg-blue-100 text-blue-700">Free</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="rounded-xl"
                                  onClick={() => navigate(`/events/${event.slug || event.id}`)}
                                >
                                  View
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => removeSavedEvent(saved.id)}
                                >
                                  <Heart className="w-4 h-4 fill-red-500" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Following Tab */}
            <TabsContent value="following">
              {followedOrganizers.length === 0 ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-[#0F0F0F]/40" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Not following anyone</h3>
                    <p className="text-[#0F0F0F]/60 mb-6">Follow organizers to get updates on their events</p>
                    <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                      Discover Organizers
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {followedOrganizers.map((follow) => {
                    const organizer = follow.organizer
                    if (!organizer) return null
                    return (
                      <Card key={follow.id} className="border-[#0F0F0F]/10 rounded-2xl">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex items-center gap-4 cursor-pointer"
                              onClick={() => navigate(`/o/${organizer.id}`)}
                            >
                              <Avatar className="w-14 h-14">
                                <AvatarImage src={organizer.logo_url} />
                                <AvatarFallback className="bg-[#2969FF]/10 text-[#2969FF]">
                                  {organizer.business_name?.[0] || 'O'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-[#0F0F0F] hover:text-[#2969FF]">
                                    {organizer.business_name}
                                  </h3>
                                  {organizer.is_verified && (
                                    <CheckCircle className="w-4 h-4 text-[#2969FF]" />
                                  )}
                                </div>
                                <p className="text-sm text-[#0F0F0F]/60">
                                  Following since {formatDate(follow.created_at)}
                                </p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-xl"
                              onClick={() => unfollowOrganizer(follow.id)}
                            >
                              Unfollow
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Groups Tab */}
            <TabsContent value="groups">
              {loadingGroups ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </CardContent>
                </Card>
              ) : (groups.active.length + groups.completed.length + groups.expired.length) === 0 ? (
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No groups yet</h3>
                    <p className="text-[#0F0F0F]/60 mb-6 text-center max-w-md">
                      Group Buy lets you coordinate ticket purchases with friends. Start a group from any event page!
                    </p>
                    <Button onClick={() => navigate('/events')} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
                      Browse Events
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Active Groups */}
                  {groups.active.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Active Groups ({groups.active.length})
                      </h3>
                      <div className="space-y-3">
                        {groups.active.map(m => (
                          <Card key={m.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                            <div className="flex">
                              <div 
                                className="w-24 h-24 sm:w-32 sm:h-32 bg-cover bg-center flex-shrink-0"
                                style={{ backgroundImage: m.session?.event?.image_url ? `url(${m.session.event.image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                              />
                              <CardContent className="flex-1 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold text-[#0F0F0F] truncate">{m.session?.name || 'Group Session'}</h4>
                                      {m.is_host && <Badge variant="outline" className="text-xs">Host</Badge>}
                                    </div>
                                    <p className="text-sm text-[#0F0F0F]/60 truncate">{m.session?.event?.title}</p>
                                  </div>
                                  <Badge className="bg-green-100 text-green-700 border-0">Active</Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-[#0F0F0F]/60">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {m.session?.member_count || 1} member{(m.session?.member_count || 1) !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs"
                                    onClick={() => navigate(`/group/${m.session?.code}`)}
                                  >
                                    Open Group
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/group/${m.session?.code}`)
                                      alert('Link copied!')
                                    }}
                                  >
                                    <Share2 className="w-3 h-3 mr-1" />
                                    Share
                                  </Button>
                                </div>
                              </CardContent>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Groups */}
                  {groups.completed.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Completed ({groups.completed.length})
                      </h3>
                      <div className="space-y-3">
                        {groups.completed.map(m => (
                          <Card key={m.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                            <div className="flex">
                              <div 
                                className="w-24 h-24 bg-cover bg-center flex-shrink-0 opacity-75"
                                style={{ backgroundImage: m.session?.event?.image_url ? `url(${m.session.event.image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                              />
                              <CardContent className="flex-1 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold text-[#0F0F0F] truncate">{m.session?.name || 'Group Session'}</h4>
                                    <p className="text-sm text-[#0F0F0F]/60 truncate">{m.session?.event?.title}</p>
                                  </div>
                                  <Badge className="bg-green-100 text-green-700 border-0">Purchased</Badge>
                                </div>
                              </CardContent>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expired Groups */}
                  {groups.expired.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-[#0F0F0F]/40">
                        Expired ({groups.expired.length})
                      </h3>
                      <div className="space-y-3">
                        {groups.expired.map(m => (
                          <Card key={m.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden opacity-60">
                            <div className="flex">
                              <div 
                                className="w-24 h-24 bg-cover bg-center flex-shrink-0 grayscale"
                                style={{ backgroundImage: m.session?.event?.image_url ? `url(${m.session.event.image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                              />
                              <CardContent className="flex-1 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold text-[#0F0F0F] truncate">{m.session?.name || 'Group Session'}</h4>
                                    <p className="text-sm text-[#0F0F0F]/60 truncate">{m.session?.event?.title}</p>
                                  </div>
                                  <Badge className="bg-gray-100 text-gray-600 border-0">Expired</Badge>
                                </div>
                              </CardContent>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* How it Works */}
                  <Card className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        How Group Buy Works
                      </h3>
                      <div className="grid gap-3 text-sm">
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="font-medium">Start a Group</p>
                            <p className="text-[#0F0F0F]/60">Click "Buy with Friends" on any event</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="font-medium">Invite Friends</p>
                            <p className="text-[#0F0F0F]/60">Share link via email, SMS, or WhatsApp</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="font-medium">Everyone Pays for Their Own</p>
                            <p className="text-[#0F0F0F]/60">No collecting money from friends!</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                {/* Saved Payment Methods */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#0F0F0F]">
                      <CreditCard className="w-5 h-5" />
                      Saved Payment Methods
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-6 text-[#0F0F0F]/50">
                        <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No saved payment methods</p>
                        <p className="text-sm">Cards will be saved when you make a purchase</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((method) => (
                          <div key={method.id} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getCardIcon(method.brand)}</span>
                              <div>
                                <p className="font-medium text-[#0F0F0F]">
                                  {method.brand} •••• {method.last_four}
                                </p>
                                <p className="text-sm text-[#0F0F0F]/60">
                                  Expires {method.exp_month}/{method.exp_year}
                                </p>
                              </div>
                              {method.is_default && (
                                <Badge className="bg-[#2969FF]/10 text-[#2969FF]">Default</Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {!method.is_default && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="rounded-xl"
                                  onClick={() => setDefaultPaymentMethod(method.id)}
                                >
                                  Set Default
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="rounded-xl text-red-500 hover:bg-red-50"
                                onClick={() => deletePaymentMethod(method.id)}
                                disabled={deletingPaymentMethod === method.id}
                              >
                                {deletingPaymentMethod === method.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-[#0F0F0F]/50">
                      🔒 Your card details are securely stored with our payment providers. We never see your full card number.
                    </p>
                  </CardContent>
                </Card>

                {/* Change Password Card */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#0F0F0F]">
                      <Lock className="w-5 h-5" />
                      Change Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {passwordError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {passwordSuccess}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Current Password</Label>
                      <div className="relative">
                        <Input 
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordForm.current}
                          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                          className="rounded-xl border-[#0F0F0F]/10 pr-10"
                          placeholder="Enter current password"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <div className="relative">
                        <Input 
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordForm.new}
                          onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                          className="rounded-xl border-[#0F0F0F]/10 pr-10"
                          placeholder="Enter new password"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                        >
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Confirm New Password</Label>
                      <div className="relative">
                        <Input 
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                          className="rounded-xl border-[#0F0F0F]/10 pr-10"
                          placeholder="Confirm new password"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button 
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
                    >
                      {changingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        'Change Password'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* GDPR Privacy Rights Card */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#0F0F0F]">
                      <Lock className="w-5 h-5 text-[#2969FF]" />
                      Privacy & Data Rights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-[#F4F6FA] rounded-xl">
                      <p className="text-sm text-[#0F0F0F]/70 mb-3">
                        Under GDPR and UK data protection laws, you have the right to access, export, and delete your personal data.
                      </p>
                    </div>
                    
                    {/* Marketing Preferences */}
                    <div className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                      <div>
                        <p className="font-medium text-[#0F0F0F]">Marketing Emails</p>
                        <p className="text-sm text-[#0F0F0F]/60">Receive event recommendations and offers</p>
                      </div>
                      <button
                        onClick={async () => {
                          const newValue = !profile?.marketing_consent
                          await supabase.from('profiles').update({ 
                            marketing_consent: newValue,
                            marketing_consent_date: newValue ? new Date().toISOString() : null
                          }).eq('id', user.id)
                          setProfile(p => ({ ...p, marketing_consent: newValue }))
                        }}
                        className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                          profile?.marketing_consent ? 'bg-[#2969FF] justify-end' : 'bg-[#0F0F0F]/20 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                    
                    {/* Data Export */}
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Gather all user data for export
                          const { data: profileData } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single()
                          
                          const { data: ticketsData } = await supabase
                            .from('tickets')
                            .select('*, event:events(title, start_date)')
                            .eq('user_id', user.id)
                          
                          const { data: ordersData } = await supabase
                            .from('orders')
                            .select('*')
                            .eq('user_id', user.id)
                          
                          const { data: followersData } = await supabase
                            .from('followers')
                            .select('*, organizer:organizers(business_name)')
                            .eq('user_id', user.id)
                          
                          const { data: savedData } = await supabase
                            .from('saved_events')
                            .select('*, event:events(title)')
                            .eq('user_id', user.id)
                          
                          const exportData = {
                            exported_at: new Date().toISOString(),
                            profile: profileData,
                            tickets: ticketsData,
                            orders: ordersData,
                            following: followersData,
                            saved_events: savedData,
                          }
                          
                          // Create and download JSON file
                          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `ticketrack-data-export-${new Date().toISOString().split('T')[0]}.json`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                          
                          alert('Your data has been exported successfully!')
                        } catch (error) {
                          console.error('Error exporting data:', error)
                          alert('Failed to export data. Please try again.')
                        }
                      }}
                      className="w-full rounded-xl"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Export My Data (GDPR)
                    </Button>
                    
                    <p className="text-xs text-[#0F0F0F]/50 text-center">
                      Your data will be downloaded as a JSON file containing your profile, tickets, orders, and saved events.
                    </p>
                  </CardContent>
                </Card>

                {/* Delete Account Card */}
                <Card className="border-red-200 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Trash2 className="w-5 h-5" />
                      Delete Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-red-50 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700">
                          <p className="font-medium mb-1">Warning: This action cannot be undone</p>
                          <p>Deleting your account will permanently remove all your data including tickets, saved events, and earnings history.</p>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline"
                      onClick={() => setShowDeleteDialog(true)}
                      className="w-full rounded-xl text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete My Account
                    </Button>
                  </CardContent>
                </Card>

                {/* Sign Out */}
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardContent className="p-4">
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl text-[#0F0F0F]/70 hover:bg-[#F4F6FA]" 
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-[#0F0F0F]/10 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#0F0F0F]/60">Available Balance</p>
                          <h3 className="text-2xl font-bold text-green-600">{getCurrencySymbol(profile?.country_code)}{earnings.balance.toLocaleString()}</h3>
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
                          <h3 className="text-2xl font-bold text-[#0F0F0F]">{getCurrencySymbol(profile?.country_code)}{earnings.pending.toLocaleString()}</h3>
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
                          <h3 className="text-2xl font-bold text-[#0F0F0F]">{getCurrencySymbol(profile?.country_code)}{earnings.total.toLocaleString()}</h3>
                          <p className="text-xs text-[#0F0F0F]/50">{earnings.referralCount} referrals</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                          <Gift className="w-6 h-6 text-[#2969FF]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

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

                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[#2969FF]" />
                        Earnings History
                      </span>
                      {earnings.balance >= getMinWithdrawal(profile?.country_code) && (
                        <Button 
                          onClick={() => navigate('/affiliate/withdraw')}
                          className="rounded-xl bg-green-600 hover:bg-green-700"
                        >
                          Withdraw {getCurrencySymbol(profile?.country_code)}{earnings.balance.toLocaleString()}
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
                                +{getCurrencySymbol(profile?.country_code)}{parseFloat(item.commission_amount).toLocaleString()}
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

                    {earnings.balance > 0 && earnings.balance < getMinWithdrawal(profile?.country_code) && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-sm text-yellow-800">
                        <p>Minimum withdrawal is {getCurrencySymbol(profile?.country_code)}{getMinWithdrawal(profile?.country_code).toLocaleString()}. You need {getCurrencySymbol(profile?.country_code)}{(getMinWithdrawal(profile?.country_code) - earnings.balance).toLocaleString()} more to withdraw.</p>
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

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>This action is permanent and cannot be undone. All your data will be deleted:</p>
              <ul className="list-disc list-inside text-sm space-y-1 text-[#0F0F0F]/70">
                <li>Your profile information</li>
                <li>All ticket history</li>
                <li>Saved events</li>
                <li>Affiliate earnings (unpaid balance will be forfeited)</li>
              </ul>
              <div className="pt-2">
                <Label className="text-[#0F0F0F]">Type DELETE to confirm</Label>
                <Input 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-2 rounded-xl"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
