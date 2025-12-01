import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Calendar, MapPin, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Event, Category } from '@/types/database';

export function WebEventBrowse() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const searchQuery = searchParams.get('q') || '';
  const categoryFilter = searchParams.get('category') || '';
  const cityFilter = searchParams.get('city') || '';

  useEffect(() => {
    fetchData();
  }, [searchQuery, categoryFilter, cityFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch categories
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true);
      setCategories(cats || []);

      // Build events query
      let query = supabase
        .from('events')
        .select('*, organizers(business_name), categories(name, icon)')
        .eq('status', 'published')
        .order('start_date', { ascending: true });

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      if (categoryFilter) {
        const cat = cats?.find(c => c.slug === categoryFilter);
        if (cat) {
          query = query.eq('category_id', cat.id);
        }
      }

      if (cityFilter) {
        query = query.ilike('city', `%${cityFilter}%`);
      }

      const { data: eventsData } = await query;
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasFilters = searchQuery || categoryFilter || cityFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-[#0F0F0F] mb-8">Browse Events</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set('q', e.target.value);
                else params.delete('q');
                setSearchParams(params);
              }}
              className="pl-10 rounded-xl"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              const params = new URLSearchParams(searchParams);
              if (value) params.set('category', value);
              else params.delete('category');
              setSearchParams(params);
            }}
          >
            <SelectTrigger className="w-full md:w-48 rounded-xl">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters} className="rounded-xl">
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-[#0F0F0F]/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#0F0F0F] mb-2">No events found</h2>
          <p className="text-[#0F0F0F]/60 mb-4">Try adjusting your search or filters</p>
          {hasFilters && (
            <Button onClick={clearFilters} variant="outline" className="rounded-xl">
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Card
              key={event.id}
              className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/event/${event.id}`)}
            >
              <div className="aspect-video bg-[#F4F6FA] relative">
                {event.image_url ? (
                  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Calendar className="w-12 h-12 text-[#2969FF]/30" />
                  </div>
                )}
                <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0">
                  {(event as any).categories?.name || 'Event'}
                </Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-[#0F0F0F] mb-3 line-clamp-2">{event.title}</h3>
                <div className="space-y-2 text-sm text-[#0F0F0F]/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(event.start_date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {event.venue_name}, {event.city}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
