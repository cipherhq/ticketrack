import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { NavigationHeader } from './NavigationHeader';
import { EventCard } from './EventCard';

/**
 * EVENTS BROWSE PAGE
 * 
 * Lists all events with search and category filters.
 * URL: /events
 */

const CATEGORIES = [
  { id: 'all', label: 'All Events' },
  { id: 'tech', label: 'Tech & Innovation' },
  { id: 'music', label: 'Music & Concerts' },
  { id: 'business', label: 'Business & Networking' },
  { id: 'sports', label: 'Sports & Fitness' },
  { id: 'education', label: 'Education & Workshops' },
  { id: 'arts', label: 'Arts & Culture' },
  { id: 'food', label: 'Food & Drinks' },
  { id: 'comedy', label: 'Comedy & Entertainment' },
];

// Sample events for demo
const SAMPLE_EVENTS = [
  {
    id: 'sample-1',
    title: 'Lagos Tech Summit 2025',
    image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
    start_date: '2025-02-15T09:00:00',
    venue_name: 'Landmark Centre, Lagos',
    price: 15000,
    currency: 'NGN',
    category: 'Tech & Innovation',
  },
  {
    id: 'sample-2',
    title: 'Afrobeats & Chill Concert',
    image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
    start_date: '2025-02-20T19:00:00',
    venue_name: 'Eko Convention Centre',
    price: 15000,
    currency: 'NGN',
    category: 'Music & Concerts',
  },
  {
    id: 'sample-3',
    title: 'Startup Pitch Competition',
    image_url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=300&fit=crop',
    start_date: '2025-02-25T10:00:00',
    venue_name: 'Co-Creation Hub, Yaba',
    price: 0,
    currency: 'NGN',
    category: 'Business & Networking',
  },
  {
    id: 'sample-4',
    title: 'Nigerian Food Festival',
    image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
    start_date: '2025-03-01T12:00:00',
    venue_name: 'Muri Okunola Park',
    price: 5000,
    currency: 'NGN',
    category: 'Food & Drinks',
  },
  {
    id: 'sample-5',
    title: 'Comedy Night with Bovi',
    image_url: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&h=300&fit=crop',
    start_date: '2025-03-05T20:00:00',
    venue_name: 'Terra Kulture, Lagos',
    price: 20000,
    currency: 'NGN',
    category: 'Comedy & Entertainment',
  },
  {
    id: 'sample-6',
    title: 'Lagos Marathon 2025',
    image_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=400&h=300&fit=crop',
    start_date: '2025-03-10T06:00:00',
    venue_name: 'National Stadium, Lagos',
    price: 10000,
    currency: 'NGN',
    category: 'Sports & Fitness',
  },
  {
    id: 'sample-7',
    title: 'Art Exhibition: Lagos Stories',
    image_url: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=400&h=300&fit=crop',
    start_date: '2025-03-15T11:00:00',
    venue_name: 'Nike Art Gallery',
    price: 3000,
    currency: 'NGN',
    category: 'Arts & Culture',
  },
  {
    id: 'sample-8',
    title: 'Digital Marketing Masterclass',
    image_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
    start_date: '2025-03-20T09:00:00',
    venue_name: 'Radisson Blu, VI',
    price: 50000,
    currency: 'NGN',
    category: 'Education & Workshops',
  },
];

export function WebEventBrowse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('events')
          .select(`
            *,
            categories (name, slug)
          `)
          .eq('status', 'published')
          .order('start_date', { ascending: true });

        // Apply category filter
        if (selectedCategory && selectedCategory !== 'all') {
          query = query.eq('categories.slug', selectedCategory);
        }

        // Apply search filter
        if (searchQuery) {
          query = query.ilike('title', `%${searchQuery}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          const eventsWithCategory = data.map(event => ({
            ...event,
            category: event.categories?.name,
          }));
          setEvents(eventsWithCategory);
        } else {
          // Use sample events filtered
          let filtered = SAMPLE_EVENTS;
          
          if (selectedCategory && selectedCategory !== 'all') {
            const categoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label;
            filtered = filtered.filter(e => e.category === categoryLabel);
          }
          
          if (searchQuery) {
            filtered = filtered.filter(e => 
              e.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          
          setEvents(filtered);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents(SAMPLE_EVENTS);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [selectedCategory, searchQuery]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    const params = new URLSearchParams(searchParams);
    if (categoryId && categoryId !== 'all') {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Browse Events</h1>
          <p className="mt-2 text-gray-600">Discover amazing events happening near you</p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-6 flex gap-3">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-500 px-6 py-2.5 font-medium text-white hover:bg-blue-600"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          
          {/* Sidebar - Categories */}
          <aside className="lg:w-64">
            <div className="sticky top-20 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">Categories</h2>
              <nav className="mt-4 space-y-1">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-50 font-medium text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Events Grid */}
          <main className="flex-1">
            {/* Results Count */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-gray-600">
                {isLoading ? 'Loading...' : `${events.length} event${events.length !== 1 ? 's' : ''} found`}
              </p>
              <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option>Date: Upcoming First</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-white p-4">
                    <div className="aspect-[4/3] rounded-xl bg-gray-200" />
                    <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                    <div className="mt-4 h-8 w-1/3 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : events.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white py-16 text-center">
                <div className="text-5xl">🔍</div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">No events found</h3>
                <p className="mt-2 text-gray-500">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSearchParams({});
                  }}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          © 2025 Ticketrack. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
