import { formatPrice } from '@/config/currencies'
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getPlatformStats } from '@/services/settings';
import {
  Search, MapPin, Calendar, ChevronRight, ChevronLeft, Star,
  Download, Shield, CreditCard, Headphones, TrendingUp, Clock,
  Heart, Users, Ticket, Globe, X, ChevronDown, Monitor, Sparkles,
  Music, Mic2, PartyPopper, Trophy, Drama, UtensilsCrossed,
  Wine, Laugh, Leaf, HeartHandshake, Gamepad2, GraduationCap, Briefcase, Baby
} from 'lucide-react';
import { ForYouFeed } from '@/components/ForYouFeed';
import { useAds } from '@/hooks/useAds';
import { AdBanner } from '@/components/AdBanner';

// Category styling with icons - all blue shades
const categoryStyles = {
  'music-concerts': { icon: Music, gradient: 'from-blue-600 via-blue-500 to-blue-400', glow: 'shadow-blue-500/30' },
  'conferences': { icon: Mic2, gradient: 'from-blue-700 via-blue-600 to-blue-500', glow: 'shadow-blue-600/30' },
  'festivals': { icon: PartyPopper, gradient: 'from-sky-500 via-blue-500 to-blue-600', glow: 'shadow-sky-500/30' },
  'sports': { icon: Trophy, gradient: 'from-blue-500 via-sky-500 to-cyan-500', glow: 'shadow-blue-500/30' },
  'arts-theatre': { icon: Drama, gradient: 'from-indigo-600 via-blue-500 to-blue-400', glow: 'shadow-indigo-500/30' },
  'food-drink': { icon: UtensilsCrossed, gradient: 'from-blue-600 via-sky-500 to-sky-400', glow: 'shadow-blue-500/30' },
  'nightlife': { icon: Wine, gradient: 'from-indigo-500 via-blue-600 to-blue-500', glow: 'shadow-indigo-500/30' },
  'comedy': { icon: Laugh, gradient: 'from-sky-400 via-blue-500 to-blue-600', glow: 'shadow-sky-500/30' },
  'wellness': { icon: Leaf, gradient: 'from-cyan-500 via-sky-500 to-blue-500', glow: 'shadow-cyan-500/30' },
  'charity': { icon: HeartHandshake, gradient: 'from-blue-500 via-blue-600 to-indigo-600', glow: 'shadow-blue-500/30' },
  'gaming': { icon: Gamepad2, gradient: 'from-indigo-600 via-indigo-500 to-blue-500', glow: 'shadow-indigo-500/30' },
  'education': { icon: GraduationCap, gradient: 'from-sky-600 via-blue-500 to-blue-400', glow: 'shadow-sky-500/30' },
  'business': { icon: Briefcase, gradient: 'from-blue-800 via-blue-700 to-blue-600', glow: 'shadow-blue-700/30' },
  'kids-family': { icon: Baby, gradient: 'from-cyan-400 via-sky-500 to-blue-500', glow: 'shadow-cyan-500/30' },
};

// Default style for unknown categories
const defaultCategoryStyle = {
  icon: Sparkles,
  gradient: 'from-blue-600 via-blue-500 to-blue-400',
  glow: 'shadow-blue-500/30',
};

const dateOptions = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

// Event Card Component
const EventCard = ({ event, showDistance = false }) => {

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Link 
      to={`/e/${event.slug || event.id}`}
      className="group bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-w-[280px] max-w-[280px]"
    >
      <div className="relative h-[160px] overflow-hidden">
        <img 
          src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'} 
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {event.category && (
          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
            {event.category}
          </span>
        )}
        {event.is_virtual && (
          <span className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <Monitor size={12} /> Virtual
          </span>
        )}
        {showDistance && event.distance && !event.is_virtual && (
          <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
            {event.distance} km
          </span>
        )}
        {event.is_promoted && (
          <span className="absolute bottom-3 left-3 bg-gray-900/80 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} /> PROMOTED
          </span>
        )}
        {event.isLowStock && !event.is_promoted && (
          <span className="absolute bottom-3 left-3 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            🔥 Few left
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1">
          <Calendar size={14} />
          <span>{formatDate(event.start_date)}</span>
        </div>
        <div className="flex items-start gap-1 text-muted-foreground text-sm mb-3">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">
            {event.is_virtual ? 'Virtual Event' : [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || 'Location TBA'}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm text-muted-foreground">From</span>
          <span className="font-bold text-blue-600">
            {event.is_free || event.min_price === 0 || event.min_price === null 
              ? 'Free' 
              : formatPrice(event.min_price, event.currency || 'USD')}
          </span>
        </div>
      </div>
    </Link>
  );
};

// Grid Event Section with View More
const EventSection = ({ title, subtitle, icon: Icon, events, showDistance = false, viewAllLink }) => {
  const [expanded, setExpanded] = useState(false);
  const initialCount = 8;
  
  if (!events || events.length === 0) return null;
  
  const displayedEvents = expanded ? events : events.slice(0, initialCount);
  const hasMore = events.length > initialCount;

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="text-blue-600" size={24} />}
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
            View All <ChevronRight size={16} />
          </Link>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayedEvents.map(event => (
          <Link 
            key={event.id}
            to={`/e/${event.slug || event.id}`}
            className="group bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
          >
            <div className="relative h-[160px] overflow-hidden">
              <img 
                src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'} 
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {event.category && (
                <span className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full">
                  {event.category}
                </span>
              )}
              {showDistance && event.distance && (
                <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                  {event.distance} km
                </span>
              )}
              {event.isLowStock && (
                <span className="absolute bottom-3 left-3 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                  🔥 Few left
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                {event.title}
              </h3>
              <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1">
                <Calendar size={14} />
                <span>{new Date(event.start_date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex items-start gap-1 text-muted-foreground text-sm mb-3">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">
                  {event.is_virtual ? 'Virtual Event' : [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || 'Location TBA'}
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="font-bold text-blue-600">
                  {event.is_free || event.min_price === 0 || event.min_price === null 
                    ? 'Free' 
                    : formatPrice(event.min_price, event.currency || 'USD')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {hasMore && !expanded && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition-colors"
          >
            View More ({events.length - initialCount} more)
            <ChevronDown size={18} />
          </button>
        </div>
      )}
    </section>
  );
};

// Category Card with unique gradient per category
const CategoryCard = ({ category }) => {
  const style = categoryStyles[category.slug] || defaultCategoryStyle;
  const IconComponent = style.icon;

  return (
    <Link
      to={`/events?category=${category.slug}`}
      className={`relative min-w-[160px] h-[150px] rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${style.gradient} p-4 flex flex-col justify-between shadow-lg ${style.glow} hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-1`}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.2)_0%,transparent_40%)]" />
      </div>

      {/* Decorative elements */}
      <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-500" />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      {/* Icon with glass effect */}
      <div className="relative z-10 w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform duration-300">
        <IconComponent className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2} />
      </div>

      {/* Category name */}
      <div className="relative z-10">
        <span className="text-white font-bold text-sm leading-tight block drop-shadow-sm">
          {category.name}
        </span>
        {category.event_count > 0 && (
          <span className="text-white/80 text-xs font-medium">
            {category.event_count} event{category.event_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
};

export function WebHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ads } = useAds();

  // Search state
  const [location, setLocation] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [events, setEvents] = useState({
    trending: [],
    popular: [],
    featured: [],
    nearYou: [],
    weekend: [],
    free: []
  });
  const [categories, setCategories] = useState([]);
  const [platformStats, setPlatformStats] = useState({
    eventsHosted: '100+',
    ticketsSold: '1K+',
    organizers: '50+'
  });
  const [loading, setLoading] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.innerWidth >= 1440);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDateDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (categoriesData) {
        setCategories(categoriesData);
      }

      const { data: allEvents } = await supabase
        .from('events')
        .select('*, ticket_types(price, quantity_available, quantity_sold), is_virtual')
        .eq('status', 'published')
        .or('visibility.eq.public,visibility.is.null')
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      // Compute min_price and low stock status from ticket_types for each event
      const eventsWithPrices = allEvents?.map(event => {
        const prices = event.ticket_types?.map(t => t.price).filter(p => p !== null && p !== undefined) || [];
        let minPrice = prices.length > 0 ? Math.min(...prices) : null;
        
        // If event is marked as free, ensure min_price is 0
        if (event.is_free) {
          minPrice = 0;
        }
        
        // If no ticket types and not explicitly free, set to null (will show as "Free" or "Price TBA")
        if (minPrice === null && (!event.ticket_types || event.ticket_types.length === 0)) {
          // If event is not marked as free but has no ticket types, treat as free
          minPrice = 0;
        }
        
        // Calculate total remaining tickets and check if low stock
        let totalRemaining = 0;
        let totalCapacity = 0;
        event.ticket_types?.forEach(t => {
          const remaining = (t.quantity_available || 0) - (t.quantity_sold || 0);
          totalRemaining += remaining;
          totalCapacity += (t.quantity_available || 0);
        });
        const percentRemaining = totalCapacity > 0 ? (totalRemaining / totalCapacity) * 100 : 100;
        const isLowStock = totalCapacity > 0 && (totalRemaining <= 10 || percentRemaining <= 20);
        
        return { ...event, min_price: minPrice, isLowStock, totalRemaining };
      }) || [];

      if (eventsWithPrices.length > 0) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + (6 - dayOfWeek));
        saturday.setHours(0, 0, 0, 0);
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        sunday.setHours(23, 59, 59, 999);

        setEvents({
          trending: eventsWithPrices.filter(e => e.is_trending).slice(0, 20),
          popular: eventsWithPrices.sort((a, b) => (b.tickets_sold || 0) - (a.tickets_sold || 0)).slice(0, 20),
          featured: eventsWithPrices.filter(e => e.is_featured).slice(0, 20),
          nearYou: eventsWithPrices.slice(0, 20).map(e => ({ ...e, distance: Math.floor(Math.random() * 20) + 1 })),
          weekend: eventsWithPrices.filter(e => {
            const eventDate = new Date(e.start_date);
            return eventDate >= saturday && eventDate <= sunday;
          }).slice(0, 20),
          free: eventsWithPrices.filter(e => e.is_free).slice(0, 20)
        });
      }

      // Fetch platform stats
      try {
        const stats = await getPlatformStats();
        setPlatformStats(stats);
      } catch (err) {
        console.warn('Failed to fetch platform stats');
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('location', location);
    if (dateFilter !== 'all') params.set('date', dateFilter);
    navigate(`/events?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[600px] md:min-h-[700px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&q=80" 
            alt="Concert crowd"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/95 via-[#0f2847]/85 to-[#1a3a5c]/70" />
        </div>
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="text-lg">✨</span>
              Your Gateway to Amazing Events
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Your Next<br />
              <span className="text-blue-500">Unforgettable</span><br />
              Experience Awaits
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl">
              From electrifying concerts to inspiring conferences. Discover and book tickets for the best events happening worldwide.
            </p>
            
            {/* New Search Bar */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-3 flex flex-col lg:flex-row gap-2 max-w-4xl mb-12 shadow-xl">
              {/* Location Input */}
              <div className="flex-1 relative">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase font-medium tracking-wide">Location</div>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="City or Venue"
                      className="w-full outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent"
                    />
                  </div>
                  {location && (
                    <button onClick={() => setLocation('')} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter */}
              <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                >
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase font-medium tracking-wide">Dates</div>
                    <div className="text-sm text-gray-900">{dateOptions.find(d => d.value === dateFilter)?.label}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                {showDateDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                    {dateOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => { setDateFilter(option.value); setShowDateDropdown(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 text-sm first:rounded-t-xl last:rounded-b-xl ${dateFilter === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Input */}
              <div className="flex-[2] relative">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <Search className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase font-medium tracking-wide">Search</div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Artist, Event or Venue"
                      className="w-full outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent"
                    />
                  </div>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                Search
              </button>
            </div>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-8 md:gap-12">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{platformStats.eventsHosted}</div>
                <div className="text-gray-400 text-sm">Events Hosted</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{platformStats.ticketsSold}</div>
                <div className="text-gray-400 text-sm">Tickets Sold</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{platformStats.organizers}</div>
                <div className="text-gray-400 text-sm">Organizers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Banner Ad - Full width, above the 3-column layout */}
      <div className="max-w-[1200px] mx-auto px-4">
        <AdBanner position="top" ads={ads.top} />
      </div>

      {/* Main Content Area with Side Ads - Starts at Popular Categories */}
      <div className={`${isLargeScreen ? 'flex justify-center gap-6 px-4' : ''}`}>

        {/* Main Content */}
        <main className="max-w-[1200px] w-full px-4">

          {/* Popular Categories */}
          <section className="py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Popular categories</h2>
              <Link to="/categories" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                View All <ChevronRight size={16} />
              </Link>
            </div>
            <div className="relative group">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                {categories.map(category => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* For You - Personalized Recommendations */}
          {user && (
            <section className="py-8">
              <ForYouFeed limit={8} showHeader={true} />
            </section>
          )}

          {/* Event Sections */}
          <EventSection 
            title="Trending Now"
            subtitle="Hottest events this week"
            icon={TrendingUp}
            events={events.trending}
            viewAllLink="/events?filter=trending"
          />

          <EventSection 
            title="Most Popular"
            subtitle="Top selling events"
            icon={Users}
            events={events.popular}
            viewAllLink="/events?filter=popular"
          />

          <EventSection 
            title="Featured Events"
            subtitle="Hand-picked by our team"
            icon={Star}
            events={events.featured}
            viewAllLink="/events?filter=featured"
          />

          <EventSection 
            title="Events Near You"
            subtitle="Happening in your area"
            icon={MapPin}
            events={events.nearYou}
            showDistance={true}
            viewAllLink="/events?filter=nearby"
          />

          <EventSection 
            title="This Weekend"
            subtitle="Don't miss out"
            icon={Clock}
            events={events.weekend}
            viewAllLink="/events?filter=weekend"
          />

          <EventSection 
            title="Free Events"
            subtitle="No ticket required"
            icon={Heart}
            events={events.free}
            viewAllLink="/events?filter=free"
          />

          {/* Stats Section */}
          <section className="py-12 my-8 bg-card rounded-2xl shadow-sm">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">{platformStats.eventsHosted}</div>
                <div className="text-muted-foreground mt-1">Events</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">{platformStats.ticketsSold}</div>
                <div className="text-muted-foreground mt-1">Tickets Sold</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">{platformStats.organizers}</div>
                <div className="text-muted-foreground mt-1">Organizers</div>
              </div>
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="py-12">
            <h2 className="text-2xl font-bold text-foreground text-center mb-10">Why Choose Ticketrack</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-card p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Secure Payments</h3>
                <p className="text-sm text-muted-foreground">Your transactions are protected with bank-level security</p>
              </div>
              <div className="bg-card p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ticket className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Instant Delivery</h3>
                <p className="text-sm text-muted-foreground">Get your tickets delivered to your email instantly</p>
              </div>
              <div className="bg-card p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Easy Refunds</h3>
                <p className="text-sm text-muted-foreground">Hassle-free refund process for eligible events</p>
              </div>
              <div className="bg-card p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Headphones className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">24/7 Support</h3>
                <p className="text-sm text-muted-foreground">Our team is always here to help you</p>
              </div>
            </div>
          </section>

          {/* Bottom Banner Ad */}
          <AdBanner position="bottom" ads={ads.bottom} />

        </main>

        {/* Right Side Ad */}
        {false && ads.right.length > 0 && (
          <div className="flex-shrink-0 mt-8">
            <AdBanner position="right" ads={ads.right} />
          </div>
        )}
      </div>

      {/* Mobile App Coming Soon Section */}
      <section className="bg-[#F0EBFF] py-16 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-[#2969FF]/10 text-[#2969FF] px-4 py-2 rounded-full text-sm font-medium mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2969FF] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2969FF]"></span>
                </span>
                Coming Soon
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Ticketrack Mobile App</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                We're building something amazing! Soon you'll be able to manage your tickets, get exclusive deals, and check in to events - all from your pocket.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <div className="bg-muted text-muted-foreground px-6 py-3 rounded-lg flex items-center gap-2 cursor-not-allowed">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs">Coming to</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </div>
                <div className="bg-muted text-muted-foreground px-6 py-3 rounded-lg flex items-center gap-2 cursor-not-allowed">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs">Coming to</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Want to be notified when we launch? Stay tuned!
              </p>
            </div>
            <div className="relative">
              {/* Phone Mockup */}
              <div className="w-56 md:w-64 h-[420px] md:h-[480px] bg-gray-900 rounded-[3rem] p-2 shadow-2xl relative">
                {/* Phone Frame */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-b-2xl z-20"></div>
                
                {/* Screen */}
                <div className="w-full h-full bg-gradient-to-br from-[#2969FF] via-[#4F46E5] to-purple-600 rounded-[2.5rem] overflow-hidden relative">
                  {/* Status Bar */}
                  <div className="flex justify-between items-center px-6 py-3 text-white/80 text-xs">
                    <span>9:41</span>
                    <div className="flex gap-1 items-center">
                      <div className="w-4 h-2 flex gap-0.5">
                        <div className="w-0.5 h-1 bg-card/80 rounded-full"></div>
                        <div className="w-0.5 h-1.5 bg-card/80 rounded-full"></div>
                        <div className="w-0.5 h-2 bg-card/80 rounded-full"></div>
                        <div className="w-0.5 h-2 bg-card/60 rounded-full"></div>
                      </div>
                      <div className="w-6 h-2.5 border border-white/80 rounded-sm relative">
                        <div className="absolute inset-0.5 bg-card/80 rounded-[1px]" style={{width: '70%'}}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* App Content Preview */}
                  <div className="px-4 pt-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 bg-card rounded-lg flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2969FF]" fill="currentColor">
                          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z"/>
                        </svg>
                      </div>
                      <span className="text-white font-semibold text-lg">Ticketrack</span>
                    </div>
                    
                    {/* Placeholder Cards */}
                    <div className="space-y-3">
                      <div className="bg-card/20 backdrop-blur rounded-xl p-3">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 bg-card/30 rounded-lg"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-card/40 rounded w-3/4"></div>
                            <div className="h-2 bg-card/30 rounded w-1/2"></div>
                            <div className="h-2 bg-card/20 rounded w-2/3"></div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-card/20 backdrop-blur rounded-xl p-3">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 bg-card/30 rounded-lg"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-card/40 rounded w-2/3"></div>
                            <div className="h-2 bg-card/30 rounded w-1/3"></div>
                            <div className="h-2 bg-card/20 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-card/20 backdrop-blur rounded-xl p-3">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 bg-card/30 rounded-lg"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-card/40 rounded w-4/5"></div>
                            <div className="h-2 bg-card/30 rounded w-2/5"></div>
                            <div className="h-2 bg-card/20 rounded w-3/5"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Nav */}
                  <div className="absolute bottom-4 left-4 right-4 bg-card/10 backdrop-blur rounded-2xl p-3 flex justify-around">
                    <div className="w-6 h-6 bg-card/60 rounded-full"></div>
                    <div className="w-6 h-6 bg-card/40 rounded-full"></div>
                    <div className="w-6 h-6 bg-card/40 rounded-full"></div>
                    <div className="w-6 h-6 bg-card/40 rounded-full"></div>
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-card shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2969FF] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2969FF]"></span>
                </span>
                <span className="text-sm font-medium text-foreground">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Host Your Own Event?</h2>
          <p className="text-blue-100 mb-8">
            Join thousands of event organizers who trust Ticketrack to sell their tickets
          </p>
          <button 
            onClick={() => {
              if (user) {
                navigate('/create-event');
              } else {
                navigate('/login', { state: { from: '/create-event' } });
              }
            }}
            className="inline-block bg-card text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Create Your Event
          </button>
        </div>
      </section>
    </div>
  );
}
