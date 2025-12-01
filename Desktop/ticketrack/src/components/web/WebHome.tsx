import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Event, Category } from '@/types/database';

export function WebHome() {
  const navigate = useNavigate();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('*, organizers(business_name), categories(name, icon)')
        .eq('status', 'published')
        .eq('is_featured', true)
        .order('start_date', { ascending: true })
        .limit(6);

      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setFeaturedEvents(events || []);
      setCategories(cats || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1E4FCC] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="bg-white/20 text-white border-0 rounded-full mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Trusted by 10,000+ event organizers
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Discover Amazing Events Near You
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Book tickets for concerts, conferences, festivals, and more. Your next experience
              starts here.
            </p>

            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 flex flex-col md:flex-row gap-2 shadow-xl">
              <div className="flex-1 flex items-center gap-2 px-4">
                <Search className="w-5 h-5 text-[#0F0F0F]/40" />
                <Input
                  placeholder="Search for events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[#0F0F0F]"
                />
              </div>
              <Button
                type="submit"
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8"
              >
                Search Events
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-[#0F0F0F] mb-8">Browse by Category</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Card
                key={category.id}
                className="border-[#0F0F0F]/10 rounded-2xl cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/events?category=${category.slug}`)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">{category.icon || '📅'}</div>
                  <h3 className="font-medium text-[#0F0F0F]">{category.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Featured Events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F0F0F]">Featured Events</h2>
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="rounded-xl text-[#2969FF]"
          >
            View All
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#0F0F0F]/60 mb-4">No featured events yet</p>
            <Button onClick={() => navigate('/events')} variant="outline" className="rounded-xl">
              Browse All Events
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEvents.slice(0, 3).map((event) => (
              <Card
                key={event.id}
                className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/event/${event.id}`)}
              >
                <div className="aspect-video bg-[#F4F6FA] relative overflow-hidden">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2969FF]/20 to-[#1E4FCC]/20">
                      <Calendar className="w-12 h-12 text-[#2969FF]/50" />
                    </div>
                  )}
                  <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 rounded-lg">
                    {(event as any).categories?.name || 'Event'}
                  </Badge>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-[#0F0F0F] mb-3 line-clamp-1">
                    {event.title}
                  </h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{formatDate(event.start_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm line-clamp-1">{event.venue_name}, {event.city}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-[#0F0F0F]/10">
                    <span className="text-[#2969FF] font-medium">View Details</span>
                    <Button className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                      Get Tickets
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0F0F0F] mb-4">
              Why Choose Ticketrack?
            </h2>
            <p className="text-[#0F0F0F]/60 max-w-2xl mx-auto">
              We make event ticketing simple, secure, and hassle-free
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Instant Booking</h3>
              <p className="text-[#0F0F0F]/60">
                Get your tickets instantly via email with QR codes
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Secure Payments</h3>
              <p className="text-[#0F0F0F]/60">
                Your payment information is always protected with Paystack
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Best Events</h3>
              <p className="text-[#0F0F0F]/60">
                Discover curated events from verified organizers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1E4FCC] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/90 mb-8">
              Join thousands of event-goers discovering amazing experiences across Africa
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/signup')}
                className="bg-white hover:bg-white/90 text-[#2969FF] rounded-xl px-8 py-6 text-lg"
              >
                Sign Up Now
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/events')}
                className="border-white text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg"
              >
                Browse Events
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
