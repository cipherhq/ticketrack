/**
 * NotificationBadge Component
 * Displays a count badge for notifications, with optional pulse animation
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { 
  Bell, Receipt, RotateCcw, UserPlus, HelpCircle, ClipboardList, 
  ArrowRightLeft, ShieldCheck, Flag, Users, DollarSign, X,
  TrendingUp, CreditCard
} from 'lucide-react'

export function NotificationBadge({ 
  count = 0, 
  showZero = false, 
  pulse = false,
  className = '',
  size = 'md' // 'sm', 'md', 'lg'
}) {
  if (count === 0 && !showZero) return null
  
  const sizeClasses = {
    sm: 'text-[10px] min-w-[16px] h-[16px] px-1',
    md: 'text-xs min-w-[20px] h-[20px] px-1.5',
    lg: 'text-sm min-w-[24px] h-[24px] px-2'
  }
  
  return (
    <span className={`
      inline-flex items-center justify-center rounded-full 
      bg-red-500 text-white font-medium
      ${sizeClasses[size]}
      ${pulse ? 'animate-pulse' : ''}
      ${className}
    `}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * Get last viewed timestamp from localStorage
 */
const getLastViewed = (key) => {
  try {
    const stored = localStorage.getItem(`notification_viewed_${key}`)
    return stored ? new Date(stored) : null
  } catch {
    return null
  }
}

/**
 * Set last viewed timestamp in localStorage
 */
const setLastViewed = (key) => {
  try {
    localStorage.setItem(`notification_viewed_${key}`, new Date().toISOString())
  } catch {
    // localStorage not available
  }
}

/**
 * Notification Dropdown Component for Organizers
 */
export function OrganizerNotificationDropdown({ organizerId, isOpen, onClose }) {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && organizerId) {
      fetchNotifications()
    }
  }, [isOpen, organizerId])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const fetchNotifications = async () => {
    setLoading(true)
    const items = []

    try {
      // Get organizer's events
      const { data: orgEvents } = await supabase
        .from('events')
        .select('id, title')
        .eq('organizer_id', organizerId)
      
      const eventIds = orgEvents?.map(e => e.id) || []
      const eventMap = Object.fromEntries(orgEvents?.map(e => [e.id, e.title]) || [])

      // Fetch recent orders
      if (eventIds.length > 0) {
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, currency, created_at, event_id, buyer_name, buyer_email')
          .in('event_id', eventIds)
          .in('status', ['completed', 'confirmed', 'paid'])
          .gte('created_at', oneDayAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(10)

        if (ordersError) {
          console.log('Error fetching orders for notifications:', ordersError.message)
        }

        orders?.forEach(order => {
          items.push({
            id: `order-${order.id}`,
            type: 'order',
            icon: Receipt,
            title: 'New Order',
            message: `${order.buyer_name || order.buyer_email || 'Someone'} purchased tickets for ${eventMap[order.event_id] || 'an event'}`,
            amount: order.total_amount,
            currency: order.currency,
            time: order.created_at,
            path: '/organizer/orders',
            notificationKey: 'orders'
          })
        })
      }

      // Fetch pending refunds
      try {
        const { data: refunds } = await supabase
          .from('refund_requests')
          .select('id, amount, reason, created_at, ticket:tickets(event:events(title))')
          .eq('organizer_id', organizerId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        refunds?.forEach(refund => {
          items.push({
            id: `refund-${refund.id}`,
            type: 'refund',
            icon: RotateCcw,
            title: 'Refund Request',
            message: `Refund requested for ${refund.ticket?.event?.title || 'an event'}`,
            time: refund.created_at,
            path: '/organizer/refunds',
            notificationKey: 'refunds'
          })
        })
      } catch (e) { /* table may not exist */ }

      // Fetch new followers
      try {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const { data: followers } = await supabase
          .from('followers')
          .select('id, created_at, user:users(full_name)')
          .eq('organizer_id', organizerId)
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5)

        followers?.forEach(follower => {
          items.push({
            id: `follower-${follower.id}`,
            type: 'follower',
            icon: UserPlus,
            title: 'New Follower',
            message: `${follower.user?.full_name || 'Someone'} started following you`,
            time: follower.created_at,
            path: '/organizer/followers',
            notificationKey: 'followers'
          })
        })
      } catch (e) { /* table may not exist */ }

      // Fetch support tickets
      try {
        const { data: tickets } = await supabase
          .from('support_tickets')
          .select('id, subject, created_at')
          .eq('organizer_id', organizerId)
          .in('status', ['open', 'pending'])
          .order('created_at', { ascending: false })
          .limit(5)

        tickets?.forEach(ticket => {
          items.push({
            id: `support-${ticket.id}`,
            type: 'support',
            icon: HelpCircle,
            title: 'Support Ticket',
            message: ticket.subject || 'New support request',
            time: ticket.created_at,
            path: '/organizer/support',
            notificationKey: 'support'
          })
        })
      } catch (e) { /* table may not exist */ }

      // Sort by time
      items.sort((a, b) => new Date(b.time) - new Date(a.time))
      setNotifications(items.slice(0, 15))
    } catch (error) {
      console.log('Error fetching notifications:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification) => {
    setLastViewed(notification.notificationKey)
    navigate(notification.path)
    onClose()
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (!isOpen) return null

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-[#0F0F0F]/10 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-[#0F0F0F]/10">
        <h3 className="font-semibold text-[#0F0F0F]">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-[#F4F6FA] rounded-lg">
          <X className="w-4 h-4 text-[#0F0F0F]/60" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-[#0F0F0F]/60">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-[#0F0F0F]/60">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No new notifications</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className="w-full p-4 flex items-start gap-3 hover:bg-[#F4F6FA] transition-colors text-left border-b border-[#0F0F0F]/5 last:border-0"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                notification.type === 'order' ? 'bg-green-100 text-green-600' :
                notification.type === 'refund' ? 'bg-orange-100 text-orange-600' :
                notification.type === 'follower' ? 'bg-blue-100 text-blue-600' :
                notification.type === 'support' ? 'bg-purple-100 text-purple-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                <notification.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0F0F0F] text-sm">{notification.title}</p>
                <p className="text-[#0F0F0F]/60 text-xs line-clamp-2">{notification.message}</p>
                {notification.amount && (
                  <p className="text-green-600 text-xs font-medium mt-1">
                    +{notification.currency || '₦'}{notification.amount.toLocaleString()}
                  </p>
                )}
                <p className="text-[#0F0F0F]/40 text-xs mt-1">{formatTime(notification.time)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 border-t border-[#0F0F0F]/10">
          <button
            onClick={() => { navigate('/organizer/orders'); onClose(); }}
            className="w-full text-center text-sm text-[#2969FF] hover:underline"
          >
            View all activity
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Notification Dropdown Component for Promoters
 */
export function PromoterNotificationDropdown({ promoterId, isOpen, onClose }) {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && promoterId) {
      fetchNotifications()
    }
  }, [isOpen, promoterId])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const fetchNotifications = async () => {
    setLoading(true)
    const items = []

    try {
      // Fetch recent sales
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      
      try {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, currency, created_at, event:events(title)')
          .eq('promoter_id', promoterId)
          .in('status', ['completed', 'confirmed', 'paid'])
          .gte('created_at', oneDayAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(10)

        orders?.forEach(order => {
          items.push({
            id: `sale-${order.id}`,
            type: 'sale',
            icon: TrendingUp,
            title: 'New Sale',
            message: `Commission earned from ${order.event?.title || 'an event'}`,
            amount: order.total_amount,
            currency: order.currency,
            time: order.created_at,
            path: '/promoter/performance',
            notificationKey: 'newSales'
          })
        })
      } catch (e) { /* table may not exist */ }

      // Fetch pending payouts
      try {
        const { data: payouts } = await supabase
          .from('promoter_payouts')
          .select('id, amount, currency, created_at')
          .eq('promoter_id', promoterId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        payouts?.forEach(payout => {
          items.push({
            id: `payout-${payout.id}`,
            type: 'payout',
            icon: CreditCard,
            title: 'Pending Payout',
            message: `${payout.currency || '₦'}${payout.amount?.toLocaleString()} ready for withdrawal`,
            time: payout.created_at,
            path: '/promoter/payment-history',
            notificationKey: 'pendingPayouts'
          })
        })
      } catch (e) { /* table may not exist */ }

      // Sort by time
      items.sort((a, b) => new Date(b.time) - new Date(a.time))
      setNotifications(items.slice(0, 15))
    } catch (error) {
      console.log('Error fetching notifications:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification) => {
    setLastViewed(notification.notificationKey)
    navigate(notification.path)
    onClose()
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (!isOpen) return null

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-[#0F0F0F]/10 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-[#0F0F0F]/10">
        <h3 className="font-semibold text-[#0F0F0F]">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-[#F4F6FA] rounded-lg">
          <X className="w-4 h-4 text-[#0F0F0F]/60" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-[#0F0F0F]/60">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-[#0F0F0F]/60">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No new notifications</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className="w-full p-4 flex items-start gap-3 hover:bg-[#F4F6FA] transition-colors text-left border-b border-[#0F0F0F]/5 last:border-0"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                notification.type === 'sale' ? 'bg-green-100 text-green-600' :
                notification.type === 'payout' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                <notification.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0F0F0F] text-sm">{notification.title}</p>
                <p className="text-[#0F0F0F]/60 text-xs line-clamp-2">{notification.message}</p>
                {notification.amount && (
                  <p className="text-green-600 text-xs font-medium mt-1">
                    +{notification.currency || '₦'}{notification.amount.toLocaleString()}
                  </p>
                )}
                <p className="text-[#0F0F0F]/40 text-xs mt-1">{formatTime(notification.time)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 border-t border-[#0F0F0F]/10">
          <button
            onClick={() => { navigate('/promoter/performance'); onClose(); }}
            className="w-full text-center text-sm text-[#2969FF] hover:underline"
          >
            View all activity
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Hook to fetch notification counts for organizers
 * Now uses localStorage to track viewed notifications
 */
export function useOrganizerNotifications(organizerId) {
  const [counts, setCounts] = useState({
    orders: 0,
    refunds: 0,
    followers: 0,
    support: 0,
    projects: 0,
    transfers: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)

  const markAsViewed = (key) => {
    setLastViewed(key)
    setCounts(prev => ({
      ...prev,
      [key]: 0,
      total: prev.total - prev[key]
    }))
  }

  useEffect(() => {
    if (!organizerId) {
      setLoading(false)
      return
    }

    const fetchCounts = async () => {
      try {
        let ordersCount = 0
        let refundsCount = 0
        let followersCount = 0
        let supportCount = 0
        let projectsCount = 0
        let transfersCount = 0

        // Get last viewed times
        const ordersLastViewed = getLastViewed('orders')
        const refundsLastViewed = getLastViewed('refunds')
        const followersLastViewed = getLastViewed('followers')
        const supportLastViewed = getLastViewed('support')
        const projectsLastViewed = getLastViewed('projects')
        const transfersLastViewed = getLastViewed('transfers')

        // Get organizer's events first for orders/transfers queries
        const { data: orgEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', organizerId)
        
        const eventIds = orgEvents?.map(e => e.id) || []

        // Fetch new orders (since last viewed or last 24 hours)
        if (eventIds.length > 0) {
          const sinceTime = ordersLastViewed || new Date(Date.now() - 24 * 60 * 60 * 1000)
          const { count, error: ordersError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('event_id', eventIds)
            .in('status', ['completed', 'confirmed', 'paid'])
            .gte('created_at', sinceTime.toISOString())

          if (ordersError) {
            console.log('Error counting orders:', ordersError.message)
          }
          ordersCount = count || 0
        }

        // Fetch pending refund requests (since last viewed)
        try {
          let query = supabase
            .from('refund_requests')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .eq('status', 'pending')
          
          if (refundsLastViewed) {
            query = query.gte('created_at', refundsLastViewed.toISOString())
          }
          
          const { count } = await query
          refundsCount = count || 0
        } catch (e) { /* table may not exist */ }

        // Fetch new followers (since last viewed or last 7 days)
        try {
          const sinceTime = followersLastViewed || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          const { count } = await supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .gte('created_at', sinceTime.toISOString())
          followersCount = count || 0
        } catch (e) { /* table may not exist */ }

        // Fetch open support tickets
        try {
          let query = supabase
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .in('status', ['open', 'pending'])
          
          if (supportLastViewed) {
            query = query.gte('created_at', supportLastViewed.toISOString())
          }

          const { count, error } = await query
          
          if (error && eventIds.length > 0) {
            // Fallback: try via events
            const result = await supabase
              .from('support_tickets')
              .select('*', { count: 'exact', head: true })
              .in('event_id', eventIds)
              .in('status', ['open', 'pending'])
            supportCount = result.count || 0
          } else {
            supportCount = count || 0
          }
        } catch (e) { /* table may not exist */ }

        // Fetch pending project tasks
        try {
          if (eventIds.length > 0) {
            let query = supabase
              .from('event_tasks')
              .select('*', { count: 'exact', head: true })
              .in('event_id', eventIds)
              .eq('status', 'pending')
            
            if (projectsLastViewed) {
              query = query.gte('created_at', projectsLastViewed.toISOString())
            }
            
            const { count } = await query
            projectsCount = count || 0
          }
        } catch (e) { /* table may not exist */ }

        // Fetch pending ticket transfers
        try {
          if (eventIds.length > 0) {
            const { data: tickets } = await supabase
              .from('tickets')
              .select('id')
              .in('event_id', eventIds)
            
            const ticketIds = tickets?.map(t => t.id) || []
            
            if (ticketIds.length > 0) {
              let query = supabase
                .from('ticket_transfers')
                .select('*', { count: 'exact', head: true })
                .in('ticket_id', ticketIds)
                .eq('status', 'pending')
              
              if (transfersLastViewed) {
                query = query.gte('created_at', transfersLastViewed.toISOString())
              }
              
              const { count } = await query
              transfersCount = count || 0
            }
          }
        } catch (e) { /* table may not exist */ }

        const newCounts = {
          orders: ordersCount,
          refunds: refundsCount,
          followers: followersCount,
          support: supportCount,
          projects: projectsCount,
          transfers: transfersCount,
          total: ordersCount + refundsCount + supportCount + projectsCount + transfersCount
        }
        setCounts(newCounts)
      } catch (error) {
        console.log('Notification counts not available:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [organizerId])

  return { counts, loading, markAsViewed }
}

/**
 * Hook to fetch notification counts for admin
 */
export function useAdminNotifications() {
  const [counts, setCounts] = useState({
    kycPending: 0,
    refundsPending: 0,
    supportOpen: 0,
    flaggedReferrals: 0,
    waitlist: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)

  const markAsViewed = (key) => {
    setLastViewed(key)
    setCounts(prev => ({
      ...prev,
      [key]: 0,
      total: prev.total - prev[key]
    }))
  }

  useEffect(() => {
    const fetchCounts = async () => {
      let kycCount = 0
      let refundsCount = 0
      let supportCount = 0
      let flaggedCount = 0
      let waitlistCount = 0

      try {
        const { count, error } = await supabase
          .from('organizers')
          .select('*', { count: 'exact', head: true })
          .in('kyc_status', ['pending', 'in_review'])
        if (!error) kycCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) refundsCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
        if (!error) supportCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('affiliate_referrals')
          .select('*', { count: 'exact', head: true })
          .eq('is_flagged', true)
          .eq('status', 'pending')
        if (!error) flaggedCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('waitlist')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) waitlistCount = count || 0
      } catch (e) { /* table may not exist */ }

      const newCounts = {
        kycPending: kycCount,
        refundsPending: refundsCount,
        supportOpen: supportCount,
        flaggedReferrals: flaggedCount,
        waitlist: waitlistCount,
        total: kycCount + refundsCount + supportCount + flaggedCount + waitlistCount
      }
      setCounts(newCounts)
      setLoading(false)
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  return { counts, loading, markAsViewed }
}

/**
 * Hook to fetch notification counts for finance
 */
export function useFinanceNotifications() {
  const [counts, setCounts] = useState({
    pendingPayouts: 0,
    promoterPayouts: 0,
    affiliatePayouts: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)

  const markAsViewed = (key) => {
    setLastViewed(key)
    setCounts(prev => ({
      ...prev,
      [key]: 0,
      total: prev.total - prev[key]
    }))
  }

  useEffect(() => {
    const fetchCounts = async () => {
      let payoutsCount = 0
      let promoterCount = 0
      let affiliateCount = 0

      try {
        const { count, error } = await supabase
          .from('payouts')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'scheduled'])
        if (!error) payoutsCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('promoter_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) promoterCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        const { count, error } = await supabase
          .from('affiliate_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) affiliateCount = count || 0
      } catch (e) { /* table may not exist */ }

      const newCounts = {
        pendingPayouts: payoutsCount,
        promoterPayouts: promoterCount,
        affiliatePayouts: affiliateCount,
        total: payoutsCount + promoterCount + affiliateCount
      }
      setCounts(newCounts)
      setLoading(false)
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  return { counts, loading, markAsViewed }
}

/**
 * Tooltip component for navigation items
 */
export function NavTooltip({ children, content, show = true }) {
  if (!show) return children
  
  return (
    <div className="group relative">
      {children}
      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded 
                      opacity-0 invisible group-hover:opacity-100 group-hover:visible
                      transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
        {content}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  )
}
