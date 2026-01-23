import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Calendar, MapPin, Sparkles, ChevronRight, Loader2, TrendingUp, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/config/currencies';
import { getForYouFeed, toggleSavedEvent, isEventSaved, recordEventView } from '@/services/recommendations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Individual Event Card for the Feed
function FeedEventCard({ event, onSaveToggle }) {
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      isEventSaved(event.id).then(setIsSaved);
    }
  }, [event.id, user]);

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.info('Sign in to save events');
      return;
    }

    setSaving(true);
    try {
      const nowSaved = await toggleSavedEvent(event.id);
      setIsSaved(nowSaved);
      toast.success(nowSaved ? 'Event saved!' : 'Event removed from saved');
      onSaveToggle?.(event.id, nowSaved);
    } catch (err) {
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleClick = () => {
    recordEventView(event.id, 'for_you_feed');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getReasonBadge = () => {
    if (event.recommendation_reasons && event.recommendation_reasons.length > 0) {
      const reason = event.recommendation_reasons[0];
      if (reason.includes('attended') || reason.includes('interests')) {
        return { icon: Sparkles, text: 'For You', color: 'bg-purple-100 text-purple-700' };
      }
      if (reason.includes('Popular') || reason.includes('Trending')) {
        return { icon: TrendingUp, text: 'Trending', color: 'bg-orange-100 text-orange-700' };
      }
    }
    return null;
  };

  const badge = getReasonBadge();

  return (
    <Link 
      to={`/e/${event.slug || event.id}`}
      onClick={handleClick}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative h-[180px] overflow-hidden">
        <img 
          src={event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'} 
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            isSaved 
              ? 'bg-red-500 text-white' 
              : 'bg-white/90 text-gray-600 hover:bg-white hover:text-red-500'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          )}
        </button>

        {/* Recommendation Badge */}
        {badge && (
          <div className="absolute top-3 left-3">
            <Badge className={`${badge.color} flex items-center gap-1`}>
              <badge.icon className="w-3 h-3" />
              {badge.text}
            </Badge>
          </div>
        )}

        {/* Price Badge */}
        <div className="absolute bottom-3 left-3">
          <Badge className="bg-white/95 text-[#0F0F0F] font-semibold">
            {event.min_price > 0 
              ? `From ${formatPrice(event.min_price, event.currency)}`
              : 'Free'
            }
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-[#0F0F0F] line-clamp-2 mb-2 group-hover:text-[#2969FF] transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-1.5 text-sm text-[#0F0F0F]/60 mt-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{formatDate(event.start_date)}</span>
          </div>
          {event.venue_name && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{event.venue_name}{event.city ? `, ${event.city}` : ''}</span>
            </div>
          )}
        </div>

        {/* Recommendation Reason */}
        {event.recommendation_reasons && event.recommendation_reasons.length > 0 && (
          <p className="text-xs text-[#2969FF] mt-3 line-clamp-1">
            {event.recommendation_reasons[0]}
          </p>
        )}
      </div>
    </Link>
  );
}

// Main For You Feed Component
export function ForYouFeed({ limit = 12, showHeader = true, className = '' }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    loadFeed();
  }, [user]);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await getForYouFeed(limit);
      setEvents(feed);
    } catch (err) {
      console.error('Error loading feed:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToggle = (eventId, saved) => {
    // Optionally update local state
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-semibold text-[#0F0F0F]">For You</h2>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-[320px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-[#0F0F0F]/60">{error}</p>
        <Button onClick={loadFeed} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Sparkles className="w-12 h-12 text-purple-200 mx-auto mb-4" />
        <p className="text-[#0F0F0F]/60">No recommendations yet</p>
        <p className="text-sm text-[#0F0F0F]/40 mt-1">
          Browse and purchase events to get personalized suggestions
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-[#0F0F0F]">For You</h2>
            {user && (
              <Badge variant="outline" className="text-xs">
                Personalized
              </Badge>
            )}
          </div>
          <Link 
            to="/discover" 
            className="text-[#2969FF] text-sm font-medium hover:underline flex items-center gap-1"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {events.map((event) => (
          <FeedEventCard 
            key={event.id} 
            event={event} 
            onSaveToggle={handleSaveToggle}
          />
        ))}
      </div>
    </div>
  );
}

// Horizontal Scrolling Version for Mobile
export function ForYouFeedHorizontal({ limit = 10, showHeader = true }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadFeed();
  }, [user]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const feed = await getForYouFeed(limit);
      setEvents(feed);
    } catch (err) {
      console.error('Error loading feed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || events.length === 0) {
    return null;
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-[#0F0F0F]">For You</h2>
          </div>
          <Link 
            to="/discover" 
            className="text-[#2969FF] text-sm font-medium hover:underline flex items-center gap-1"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
        {events.map((event) => (
          <div key={event.id} className="flex-shrink-0 w-[280px]">
            <FeedEventCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
