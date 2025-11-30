import React from 'react';
import { useNavigate } from 'react-router-dom';

// Format price helper
function formatPrice(amount, currency = 'NGN') {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format date helper
function formatEventDate(dateString) {
  const date = new Date(dateString);
  return {
    day: date.getDate(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

export function EventCard({ event, onQuickBuy }) {
  const navigate = useNavigate();
  const formattedDate = formatEventDate(event.start_date || event.date);
  const formattedPrice = formatPrice(event.price || 0, event.currency);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={event.image_url || event.imageUrl || 'https://placehold.co/400x300/e2e8f0/64748b?text=Event'}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-lg bg-white px-3 py-2 shadow-lg">
          <span className="text-xs font-bold text-blue-600">{formattedDate.month}</span>
          <span className="text-xl font-bold text-gray-900">{formattedDate.day}</span>
        </div>

        {event.category && (
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {event.category}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 line-clamp-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600">
          <button onClick={() => navigate(`/event/${event.id}`)} className="text-left">
            {event.title}
          </button>
        </h3>

        <div className="mb-3 flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="truncate">{event.venue_name || event.location}</span>
        </div>

        <div className="mb-4 flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formattedDate.time}</span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">From</span>
            <p className="text-xl font-bold text-gray-900">{formattedPrice}</p>
          </div>
          <button
            onClick={() => onQuickBuy?.(event.id)}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
          >
            Get Tickets
          </button>
        </div>
      </div>
    </article>
  );
}

export function EventsSection({ title, subtitle, events = [], onQuickBuy, showViewAll = true }) {
  const navigate = useNavigate();

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h2>
            {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
          </div>
          
          {showViewAll && (
            <button
              onClick={() => navigate('/events')}
              className="hidden items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 sm:flex"
            >
              View All
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} onQuickBuy={onQuickBuy} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white py-16 text-center">
            <div className="text-4xl">🎫</div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No events found</h3>
            <p className="mt-2 text-gray-500">Check back later for upcoming events</p>
          </div>
        )}
      </div>
    </section>
  );
}
