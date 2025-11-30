import React, { useState, useEffect } from 'react';
import { NavigationHeader } from './NavigationHeader';
import { LandingHero } from './LandingHero';
import { CategorySection } from './CategorySection';
import { EventsSection } from './EventCard';
import { supabase } from '../../lib/supabase';

// Sample events for demo (used when database is empty)
const SAMPLE_EVENTS = [
  {
    id: '1',
    title: 'Lagos Tech Summit 2025',
    image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
    start_date: '2025-02-15T09:00:00',
    venue_name: 'Landmark Centre, Lagos',
    price: 25000,
    currency: 'NGN',
    category: 'Tech',
  },
  {
    id: '2',
    title: 'Afrobeats & Chill Concert',
    image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
    start_date: '2025-02-20T19:00:00',
    venue_name: 'Eko Convention Centre',
    price: 15000,
    currency: 'NGN',
    category: 'Music',
  },
  {
    id: '3',
    title: 'Startup Pitch Competition',
    image_url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=300&fit=crop',
    start_date: '2025-02-25T10:00:00',
    venue_name: 'Co-Creation Hub, Yaba',
    price: 0,
    currency: 'NGN',
    category: 'Business',
  },
  {
    id: '4',
    title: 'Nigerian Food Festival',
    image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
    start_date: '2025-03-01T12:00:00',
    venue_name: 'Muri Okunola Park',
    price: 5000,
    currency: 'NGN',
    category: 'Food',
  },
];

export function WebHome() {
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);

  // Fetch events from Supabase
  useEffect(() => {
    async function fetchEvents() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            categories (name)
          `)
          .eq('status', 'published')
          .order('start_date', { ascending: true })
          .limit(8);

        if (error) throw error;
        
        if (data && data.length > 0) {
          // Map category name
          const eventsWithCategory = data.map(event => ({
            ...event,
            category: event.categories?.name || null
          }));
          setEvents(eventsWithCategory);
        }
        // If no events in DB, keep sample events
      } catch (error) {
        console.error('Error fetching events:', error.message);
        // Keep sample events on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const handleQuickBuy = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setCartItems([...cartItems, event]);
      alert(`${event.title} added to cart!`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <NavigationHeader cartItemCount={cartItems.length} />
      <LandingHero />
      <CategorySection />
      
      <EventsSection
        title="Featured Events"
        subtitle="Hand-picked events you don't want to miss"
        events={events.slice(0, 4)}
        onQuickBuy={handleQuickBuy}
      />
      
      <EventsSection
        title="Upcoming Events"
        subtitle="Discover what's happening near you"
        events={events}
        onQuickBuy={handleQuickBuy}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-gray-900">Ticketrack</span>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Africa's premier event ticketing platform. Discover, book, and experience amazing events.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">Quick Links</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><a href="/events" className="hover:text-blue-600">Browse Events</a></li>
                <li><a href="/organizer" className="hover:text-blue-600">For Organizers</a></li>
                <li><a href="/about" className="hover:text-blue-600">About Us</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">Support</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><a href="/help" className="hover:text-blue-600">Help Center</a></li>
                <li><a href="/contact" className="hover:text-blue-600">Contact Us</a></li>
                <li><a href="/terms" className="hover:text-blue-600">Terms of Service</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">Connect</h3>
              <div className="mt-4 flex gap-4">
                <a href="#" className="text-gray-400 hover:text-blue-500">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-pink-500">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              <p className="mt-4 text-sm text-gray-500">© 2025 Ticketrack. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
