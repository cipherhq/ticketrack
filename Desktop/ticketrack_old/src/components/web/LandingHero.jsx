import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LANDING HERO SECTION
 */

export function LandingHero() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    const sanitizedQuery = searchQuery.trim().replace(/<[^>]*>/g, '');
    if (sanitizedQuery) {
      navigate(`/events?search=${encodeURIComponent(sanitizedQuery)}`);
    }
  };

  return (
    <section className="relative min-h-[500px] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15)_0%,_transparent_50%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-medium text-gray-900 shadow-lg">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>Trusted by 10,000+ event organizers</span>
        </div>

        <h1 className="mb-6 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Discover Amazing Events
          <span className="block">Near You</span>
        </h1>

        <p className="mb-10 max-w-2xl text-lg text-blue-100 sm:text-xl">
          Book tickets for concerts, conferences, festivals, and more. Your next experience starts here.
        </p>

        <form onSubmit={handleSearch} className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
              placeholder="Search for events..."
              className="w-full rounded-xl border-0 bg-white py-4 pl-12 pr-4 text-gray-900 shadow-xl placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-300"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-8 py-4 font-semibold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-[0.98]"
          >
            <span>Search Events</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}
