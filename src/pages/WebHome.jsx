import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Search, MapPin, Calendar, ChevronRight, ChevronLeft, Star, 
  Download, Shield, CreditCard, Headphones, TrendingUp, Clock,
  Heart, Users, Ticket, Globe, X
} from 'lucide-react';

// Category images mapping
const categoryImages = {
  'music-concerts': 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop',
  'conferences': 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
  'festivals': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop',
  'sports': 'https://images.unsplash.com/photo-1461896836934-28f9ba7a02e3?w=400&h=300&fit=crop',
  'arts-theatre': 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400&h=300&fit=crop',
  'food-drink': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
  'nightlife': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop',
  'comedy': 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&h=300&fit=crop',
  'wellness': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
  'charity': 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&h=300&fit=crop',
};

// Ad Component for Side Ads (300x600)
const SideAd = ({ ad }) => {
  const handleClick = async () => {
    if (ad?.id) {
      await supabase.rpc('increment_ad_clicks', { ad_id: ad.id });
      if (ad.link_url) {
        window.open(ad.link_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  useEffect(() => {
    if (ad?.id) {
      supabase.rpc('increment_ad_impressions', { ad_id: ad.id });
    }
  }, [ad?.id]);

  if (!ad) return null;

  return (
    <div className="relative">
      <div className="absolute -top-6 right-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
        Ad
      </div>
      <div 
        onClick={handleClick}
        className="w-[300px] h-[600px] bg-gray-100 rounded-lg overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
      >
        {ad.media_type === 'video' ? (
          <video 
            src={ad.image_url} 
            className="w-full h-full object-cover"
            autoPlay 
            muted 
            loop 
            playsInline
          />
        ) : (
          <img 
            src={ad.image_url} 
            alt={ad.advertiser_name || 'Advertisement'} 
            className="w-full h-full object-cover"
          />
        )}
      </div>
    </div>
  );
};

// Ad Component for Banner Ads (Top/Bottom - 1200x300)
const BannerAd = ({ ad }) => {
  const handleClick = async () => {
    if (ad?.id) {
      await supabase.rpc('increment_ad_clicks', { ad_id: ad.id });
      if (ad.link_url) {
        window.open(ad.link_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  useEffect(() => {
    if (ad?.id) {
      supabase.rpc('increment_ad_impressions', { ad_id: ad.id });
    }
  }, [ad?.id]);

  if (!ad) return null;

  return (
    <div className="relative max-w-[1200px] mx-auto my-8">
      <div className="absolute -top-5 right-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
        Ad
      </div>
      <div 
        onClick={handleClick}
        className="w-full h-[200px] md:h-[300px] bg-gray-100 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-shadow"
      >
        {ad.media_type === 'video' ? (
          <video 
            src={ad.image_url} 
            className="w-full h-full object-cover"
            autoPlay 
            muted 
            loop 
            playsInline
          />
        ) : (
          <img 
            src={ad.image_url} 
            alt={ad.advertiser_name || 'Advertisement'} 
            className="w-full h-full object-cover"
          />
        )}
      </div>
    </div>
  );
};

// Event Card Component
const EventCard = ({ event, showDistance = false }) => {
  const formatPrice = (price, isFree) => {
    if (isFree) return 'Free';
    if (!price && price !== 0) return '₦0';
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Link 
      to={`/events/${event.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-w-[280px] max-w-[280px]"
    >
      <div className="relative h-[160px] overflow-hidden">
        <img 
          src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'} 
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {event.category && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full">
            {event.category}
          </span>
        )}
        {showDistance && event.distance && (
          <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
            {event.distance} km
          </span>
        )}
        {event.is_promoted && (
          <span className="absolute bottom-3 left-3 bg-gray-900/80 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} /> PROMOTED
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
          <Calendar size={14} />
          <span>{formatDate(event.start_date)}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-sm mb-3">
          <MapPin size={14} />
          <span className="line-clamp-1">{event.venue || event.location}</span>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm text-gray-500">From</span>
          <span className="font-bold text-blue-600">{event.is_free ? 'Free' : formatPrice(event.min_price)}</span>
        </div>
      </div>
    </Link>
  );
};

// Horizontal Scroll Section
const EventSection = ({ title, subtitle, icon: Icon, events, showDistance = false, viewAllLink }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      return () => ref.removeEventListener('scroll', checkScroll);
    }
  }, [events]);

  if (!events || events.length === 0) return null;

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="text-blue-600" size={24} />}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewAllLink && (
            <Link to={viewAllLink} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              View All <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>
      
      <div className="relative group">
        {canScrollLeft && (
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {events.map(event => (
            <EventCard key={event.id} event={event} showDistance={showDistance} />
          ))}
        </div>
        
        {canScrollRight && (
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </section>
  );
};

// Category Card
const CategoryCard = ({ category, image }) => (
  <Link 
    to={`/events?category=${category.slug}`}
    className="relative min-w-[160px] h-[140px] rounded-xl overflow-hidden group cursor-pointer"
  >
    <img 
      src={image} 
      alt={category.name}
      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
    <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">
      {category.name}
    </span>
  </Link>
);

export function WebHome() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState({
    trending: [],
    popular: [],
    featured: [],
    nearYou: [],
    weekend: [],
    free: []
  });
  const [categories, setCategories] = useState([]);
  const [ads, setAds] = useState({
    top: null,
    bottom: null,
    left: null,
    right: null
  });
  const [loading, setLoading] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.innerWidth >= 1440);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const fetchAds = async () => {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('platform_adverts')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const adsByPosition = {
        top: data.find(ad => ad.position === 'top') || null,
        bottom: data.find(ad => ad.position === 'bottom') || null,
        left: data.find(ad => ad.position === 'left') || null,
        right: data.find(ad => ad.position === 'right') || null
      };
      setAds(adsByPosition);
    }
  };

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
        .select('*, ticket_types(price)')
        .eq('status', 'published')
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      // Compute min_price from ticket_types for each event
      const eventsWithPrices = allEvents?.map(event => {
        const prices = event.ticket_types?.map(t => t.price).filter(p => p !== null && p !== undefined) || [];
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
        return { ...event, min_price: minPrice };
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
          trending: eventsWithPrices.filter(e => e.is_trending).slice(0, 10),
          popular: eventsWithPrices.sort((a, b) => (b.tickets_sold || 0) - (a.tickets_sold || 0)).slice(0, 10),
          featured: eventsWithPrices.filter(e => e.is_featured).slice(0, 10),
          nearYou: eventsWithPrices.slice(0, 10).map(e => ({ ...e, distance: Math.floor(Math.random() * 20) + 1 })),
          weekend: eventsWithPrices.filter(e => {
            const eventDate = new Date(e.start_date);
            return eventDate >= saturday && eventDate <= sunday;
          }).slice(0, 10),
          free: eventsWithPrices.filter(e => e.is_free).slice(0, 10)
        });
      }

      await fetchAds();
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="text-lg">✨</span>
              Africa's #1 Ticketing Platform
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Your Next<br />
              <span className="text-blue-500">Unforgettable</span><br />
              Experience Awaits
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl">
              From electrifying concerts to inspiring conferences. Discover and book tickets for the best events happening across Africa.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mb-12">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search events, artists, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Explore Events
                <ChevronRight size={20} />
              </button>
            </form>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-8 md:gap-12">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">10K+</div>
                <div className="text-gray-400 text-sm">Events Hosted</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">500K+</div>
                <div className="text-gray-400 text-sm">Tickets Sold</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">6</div>
                <div className="text-gray-400 text-sm">Countries</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Banner Ad - Full width, above the 3-column layout */}
      <div className="max-w-[1200px] mx-auto px-4">
        {ads.top && <BannerAd ad={ads.top} />}
      </div>

      {/* Main Content Area with Side Ads - Starts at Popular Categories */}
      <div className={`${isLargeScreen ? 'flex justify-center gap-6 px-4' : ''}`}>
        
        {/* Left Side Ad */}
        {/*         {false && ads.left && ( */}
        {/*           <div className="flex-shrink-0 mt-8"> */}
        {/*             <SideAd ad={ads.left} /> */}
        {/*           </div> */}
        {/*         )} */}

        {/* Main Content */}
        <main className="max-w-[1200px] w-full px-4">

          {/* Popular Categories */}
          <section className="py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Popular categories</h2>
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
                    image={categoryImages[category.slug] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop'}
                  />
                ))}
              </div>
            </div>
          </section>

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
          <section className="py-12 my-8 bg-white rounded-2xl shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">10K+</div>
                <div className="text-gray-500 mt-1">Events</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">500K+</div>
                <div className="text-gray-500 mt-1">Tickets Sold</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">15+</div>
                <div className="text-gray-500 mt-1">Countries</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600">4.9</div>
                <div className="text-gray-500 mt-1">User Rating</div>
              </div>
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="py-12">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Why Choose Ticketrack</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Secure Payments</h3>
                <p className="text-sm text-gray-500">Your transactions are protected with bank-level security</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ticket className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Instant Delivery</h3>
                <p className="text-sm text-gray-500">Get your tickets delivered to your email instantly</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">Easy Refunds</h3>
                <p className="text-sm text-gray-500">Hassle-free refund process for eligible events</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Headphones className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold mb-2">24/7 Support</h3>
                <p className="text-sm text-gray-500">Our team is always here to help you</p>
              </div>
            </div>
          </section>

          {/* Bottom Banner Ad */}
          {ads.bottom && <BannerAd ad={ads.bottom} />}

        </main>

        {/* Right Side Ad */}
        {false && ads.right && (
          <div className="flex-shrink-0 mt-8">
            <SideAd ad={ads.right} />
          </div>
        )}
      </div>

      {/* Download App Section */}
      <section className="bg-[#F0EBFF] py-16 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Get the Ticketrack App</h2>
              <p className="text-gray-600 mb-6 max-w-md">
                Download our app for a better experience. Get exclusive deals and manage your tickets on the go.
              </p>
              <div className="flex gap-4 justify-center md:justify-start">
                <a href="#" className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors">
                  <Download size={20} />
                  <div className="text-left">
                    <div className="text-xs">Download on the</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </a>
                <a href="#" className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors">
                  <Download size={20} />
                  <div className="text-left">
                    <div className="text-xs">Get it on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
            <div className="w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center">
              <span className="text-white text-6xl">📱</span>
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
          <Link 
            to="/create-event"
            className="inline-block bg-white text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors"
          >
            Create Your Event
          </Link>
        </div>
      </section>
    </div>
  );
}
