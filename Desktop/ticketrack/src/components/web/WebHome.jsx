import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NavigationHeader } from './NavigationHeader';
import { LandingHero } from './LandingHero';
import { CategorySection } from './CategorySection';
import { EventCard } from './EventCard';
import { supabase } from '../../lib/supabase';

export function WebHome() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch events from Supabase
  useEffect(() => {
    async function fetchEvents() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            categories (name),
            ticket_types (price)
          `)
          .eq('status', 'published')
          .order('start_date', { ascending: true })
          .limit(8);

        if (error) throw error;
        
        // Transform data to include category name and lowest price
        const transformedEvents = (data || []).map(event => ({
          ...event,
          category: event.categories?.name,
          price: event.ticket_types?.length > 0 
            ? Math.min(...event.ticket_types.map(t => t.price))
            : 0,
        }));
        
        setEvents(transformedEvents);
      } catch (err) {
        console.error('Error fetching events:', err);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <LandingHero />
      <CategorySection />
      
      {/* Featured Events Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
            <p className="mt-1 text-gray-600">Discover what's happening near you</p>
          </div>
          <Link
            to="/events"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View all →
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
                <div className="aspect-[4/3] rounded-xl bg-gray-200" />
                <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                <div className="mt-4 h-8 w-1/3 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl bg-white py-16 text-center shadow-sm">
            <div className="text-5xl">📅</div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No events yet</h3>
            <p className="mt-2 text-gray-500">
              Be the first to create an event on Ticketrack!
            </p>
            <Link
              to="/organizer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600"
            >
              Create Event
            </Link>
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Why Choose Ticketrack?</h2>
            <p className="mt-2 text-gray-600">The easiest way to discover and book events in Nigeria</p>
          </div>
          
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Secure Payments</h3>
              <p className="mt-2 text-sm text-gray-600">Pay safely with Paystack. Your payment details are always protected.</p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Mobile Tickets</h3>
              <p className="mt-2 text-sm text-gray-600">Get your tickets instantly on your phone. No printing needed.</p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Easy Check-in</h3>
              <p className="mt-2 text-sm text-gray-600">Quick QR code scanning for hassle-free event entry.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-gray-900">Ticketrack</span>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Africa's premier event ticketing platform.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900">For Attendees</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link to="/events" className="hover:text-gray-900">Browse Events</Link></li>
                <li><Link to="/tickets" className="hover:text-gray-900">My Tickets</Link></li>
                <li><Link to="/help" className="hover:text-gray-900">Help Center</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900">For Organizers</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link to="/organizer" className="hover:text-gray-900">Create Event</Link></li>
                <li><Link to="/organizer" className="hover:text-gray-900">Dashboard</Link></li>
                <li><a href="#" className="hover:text-gray-900">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900">Company</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">About Us</a></li>
                <li><a href="#" className="hover:text-gray-900">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-gray-900">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
            © 2025 Ticketrack. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
