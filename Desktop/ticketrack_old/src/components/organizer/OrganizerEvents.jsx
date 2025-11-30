import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/**
 * ORGANIZER EVENTS LIST
 * 
 * Shows all events created by this organizer.
 */

export function OrganizerEvents() {
  const { organizer } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, published, draft

  useEffect(() => {
    async function fetchEvents() {
      if (!organizer) return;

      try {
        let query = supabase
          .from('events')
          .select('*')
          .eq('organizer_id', organizer.id)
          .order('start_date', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setEvents(data || []);
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [organizer, filter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
          <p className="text-gray-600">Manage your events and ticket sales</p>
        </div>
        <Link
          to="/organizer/events/new"
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Event
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 flex gap-2">
        {['all', 'published', 'draft'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="mt-8 flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : events.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl bg-white py-16 text-center shadow-sm">
          <div className="text-5xl">📅</div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No events found</h3>
          <p className="mt-2 text-gray-500">
            {filter === 'all' 
              ? "You haven't created any events yet" 
              : `No ${filter} events`}
          </p>
          <Link
            to="/organizer/events/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            Create Your First Event
          </Link>
        </div>
      )}
    </div>
  );
}

// Event Card
function EventCard({ event }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-600',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-video relative">
        <img
          src={event.image_url || 'https://placehold.co/400x200/e2e8f0/64748b?text=Event'}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium ${statusColors[event.status] || statusColors.draft}`}>
          {event.status?.charAt(0).toUpperCase() + event.status?.slice(1) || 'Draft'}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {new Date(event.start_date).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <p className="text-sm text-gray-500">{event.venue_name}</p>
        
        <div className="mt-4 flex gap-2">
          <Link
            to={`/organizer/events/${event.id}`}
            className="flex-1 rounded-lg bg-gray-100 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Manage
          </Link>
          <Link
            to={`/event/${event.id}`}
            target="_blank"
            className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
