import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/**
 * ORGANIZER DASHBOARD HOME
 * 
 * Shows key metrics and recent activity.
 */

// Format price helper
function formatPrice(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export function OrganizerHome() {
  const { organizer } = useOutletContext();
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalTicketsSold: 0,
    totalRevenue: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!organizer) return;

      try {
        // Fetch events
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('organizer_id', organizer.id)
          .order('created_at', { ascending: false });

        if (eventsError) throw eventsError;

        // Fetch orders for this organizer's events
        const eventIds = events?.map(e => e.id) || [];
        let totalRevenue = 0;
        let totalTickets = 0;

        if (eventIds.length > 0) {
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('total, id')
            .in('event_id', eventIds)
            .eq('status', 'completed');

          if (!ordersError && orders) {
            totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
          }

          // Count tickets
          const { count, error: ticketsError } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .in('event_id', eventIds);

          if (!ticketsError) {
            totalTickets = count || 0;
          }
        }

        const activeEvents = events?.filter(e => e.status === 'published' && new Date(e.start_date) > new Date()) || [];

        setStats({
          totalEvents: events?.length || 0,
          activeEvents: activeEvents.length,
          totalTicketsSold: totalTickets,
          totalRevenue: totalRevenue,
        });

        setRecentEvents(events?.slice(0, 5) || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, [organizer]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {organizer?.business_name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Events"
          value={stats.totalEvents}
          icon="calendar"
          color="blue"
        />
        <StatCard
          title="Active Events"
          value={stats.activeEvents}
          icon="check"
          color="green"
        />
        <StatCard
          title="Tickets Sold"
          value={stats.totalTicketsSold}
          icon="ticket"
          color="purple"
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(stats.totalRevenue)}
          icon="money"
          color="yellow"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Link
            to="/organizer/events/new"
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Create Event</p>
              <p className="text-sm text-gray-500">Start a new event</p>
            </div>
          </Link>

          <Link
            to="/organizer/sales"
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">View Sales</p>
              <p className="text-sm text-gray-500">Check ticket sales</p>
            </div>
          </Link>

          <Link
            to="/organizer/payouts"
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Payouts</p>
              <p className="text-sm text-gray-500">Withdraw earnings</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Events */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
          <Link to="/organizer/events" className="text-sm text-blue-600 hover:text-blue-700">
            View all →
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
          {recentEvents.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-500">{event.venue_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(event.start_date).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/organizer/events/${event.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center">
              <div className="text-4xl">📅</div>
              <h3 className="mt-4 font-medium text-gray-900">No events yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create your first event to get started</p>
              <Link
                to="/organizer/events/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Event
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  const icons = {
    calendar: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    check: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    ticket: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    money: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color]}`}>
          {icons[icon]}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-600',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-600',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Draft'}
    </span>
  );
}
