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
    if (!organizerId) return

    const fetchCounts = async () => {
      try {
        // Fetch pending orders (last 24 hours)
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('status', 'pending')

        // Fetch pending refund requests
        const { count: refundsCount } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('status', 'pending')

        // Fetch new followers (last 7 days)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const { count: followersCount } = await supabase
          .from('organizer_followers')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .gte('created_at', weekAgo.toISOString())

        // Fetch open support tickets
        const { count: supportCount } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .in('status', ['open', 'pending'])

        // Fetch pending project tasks
        const { count: projectsCount } = await supabase
          .from('project_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('status', 'pending')

        // Fetch pending transfers
        const { count: transfersCount } = await supabase
          .from('ticket_transfers')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('status', 'pending')

        const newCounts = {
          orders: ordersCount || 0,
          refunds: refundsCount || 0,
          followers: followersCount || 0,
          support: supportCount || 0,
          projects: projectsCount || 0,
          transfers: transfersCount || 0,
          total: (ordersCount || 0) + (refundsCount || 0) + (supportCount || 0) + (projectsCount || 0) + (transfersCount || 0)
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
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000)
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
      try {
        // Fetch pending KYC requests
        const { count: kycCount } = await supabase
          .from('organizers')
          .select('*', { count: 'exact', head: true })
          .eq('kyc_status', 'pending')

        // Fetch pending refunds
        const { count: refundsCount } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        // Fetch open support tickets
        const { count: supportCount } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])

        // Fetch flagged referrals
        const { count: flaggedCount } = await supabase
          .from('affiliate_referrals')
          .select('*', { count: 'exact', head: true })
          .eq('is_flagged', true)
          .eq('status', 'pending')

        // Fetch waitlist count
        const { count: waitlistCount } = await supabase
          .from('waitlist')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        const newCounts = {
          kycPending: kycCount || 0,
          refundsPending: refundsCount || 0,
          supportOpen: supportCount || 0,
          flaggedReferrals: flaggedCount || 0,
          waitlist: waitlistCount || 0,
          total: (kycCount || 0) + (refundsCount || 0) + (supportCount || 0) + (flaggedCount || 0)
        }
        setCounts(newCounts)
      } catch (error) {
        console.log('Admin notification counts not available:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
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
      try {
        // Fetch pending event payouts
        const { count: payoutsCount } = await supabase
          .from('payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        // Fetch pending promoter payouts
        const { count: promoterCount } = await supabase
          .from('promoter_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        // Fetch pending affiliate payouts
        const { count: affiliateCount } = await supabase
          .from('affiliate_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        const newCounts = {
          pendingPayouts: payoutsCount || 0,
          promoterPayouts: promoterCount || 0,
          affiliatePayouts: affiliateCount || 0,
          total: (payoutsCount || 0) + (promoterCount || 0) + (affiliateCount || 0)
        }
        setCounts(newCounts)
      } catch (error) {
        console.log('Finance notification counts not available:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
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
