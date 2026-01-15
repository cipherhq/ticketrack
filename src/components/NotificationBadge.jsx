/**
 * NotificationBadge Component
 * Displays a count badge for notifications, with optional pulse animation
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
 * Hook to fetch notification counts for organizers
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

        // Get organizer's events first for orders/transfers queries
        const { data: orgEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', organizerId)
        
        const eventIds = orgEvents?.map(e => e.id) || []

        // Fetch pending orders for organizer's events
        if (eventIds.length > 0) {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('event_id', eventIds)
            .eq('status', 'pending')
          ordersCount = count || 0
        }

        // Fetch pending refund requests
        try {
          const { count } = await supabase
            .from('refund_requests')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .eq('status', 'pending')
          refundsCount = count || 0
        } catch (e) { /* table may not exist */ }

        // Fetch new followers (last 7 days)
        try {
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          const { count } = await supabase
            .from('organizer_followers')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .gte('created_at', weekAgo.toISOString())
          followersCount = count || 0
        } catch (e) { /* table may not exist */ }

        // Fetch open support tickets (check user_id if organizer_id doesn't exist)
        try {
          // First try with organizer_id
          let { count, error } = await supabase
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', organizerId)
            .in('status', ['open', 'pending'])
          
          if (error) {
            // Fallback: try via events
            if (eventIds.length > 0) {
              const result = await supabase
                .from('support_tickets')
                .select('*', { count: 'exact', head: true })
                .in('event_id', eventIds)
                .in('status', ['open', 'pending'])
              count = result.count || 0
            }
          }
          supportCount = count || 0
        } catch (e) { /* table may not exist */ }

        // Fetch pending project tasks (using event_tasks table)
        try {
          if (eventIds.length > 0) {
            const { count } = await supabase
              .from('event_tasks')
              .select('*', { count: 'exact', head: true })
              .in('event_id', eventIds)
              .eq('status', 'pending')
            projectsCount = count || 0
          }
        } catch (e) { /* table may not exist */ }

        // Fetch pending ticket transfers for organizer's events
        try {
          if (eventIds.length > 0) {
            // Get tickets for organizer's events that have pending transfers
            const { data: tickets } = await supabase
              .from('tickets')
              .select('id')
              .in('event_id', eventIds)
            
            const ticketIds = tickets?.map(t => t.id) || []
            
            if (ticketIds.length > 0) {
              const { count } = await supabase
                .from('ticket_transfers')
                .select('*', { count: 'exact', head: true })
                .in('ticket_id', ticketIds)
                .eq('status', 'pending')
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
        // Silently fail - tables may not exist
        console.log('Notification counts not available:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
    
    // Refresh every 60 seconds (reduced from 30 to avoid too many queries)
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [organizerId])

  return { counts, loading }
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

  useEffect(() => {
    const fetchCounts = async () => {
      let kycCount = 0
      let refundsCount = 0
      let supportCount = 0
      let flaggedCount = 0
      let waitlistCount = 0

      try {
        // Fetch pending KYC requests (also check for 'in_review' status)
        const { count, error } = await supabase
          .from('organizers')
          .select('*', { count: 'exact', head: true })
          .in('kyc_status', ['pending', 'in_review'])
        if (!error) kycCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch pending refunds
        const { count, error } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) refundsCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch open support tickets
        const { count, error } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
        if (!error) supportCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch flagged referrals
        const { count, error } = await supabase
          .from('affiliate_referrals')
          .select('*', { count: 'exact', head: true })
          .eq('is_flagged', true)
          .eq('status', 'pending')
        if (!error) flaggedCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch waitlist count
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
    const interval = setInterval(fetchCounts, 60000) // Refresh every 60 seconds
    return () => clearInterval(interval)
  }, [])

  return { counts, loading }
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

  useEffect(() => {
    const fetchCounts = async () => {
      let payoutsCount = 0
      let promoterCount = 0
      let affiliateCount = 0

      try {
        // Fetch pending event payouts
        const { count, error } = await supabase
          .from('payouts')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'scheduled'])
        if (!error) payoutsCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch pending promoter payouts
        const { count, error } = await supabase
          .from('promoter_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error) promoterCount = count || 0
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch pending affiliate payouts
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
    const interval = setInterval(fetchCounts, 60000) // Refresh every 60 seconds
    return () => clearInterval(interval)
  }, [])

  return { counts, loading }
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
