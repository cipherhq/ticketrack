import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Calendar, MapPin, Clock, TrendingUp, History, Loader2, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/config/currencies'

const RECENT_SEARCHES_KEY = 'ticketrack_recent_searches'
const trendingSearches = ['Concert', 'Music', 'Festival', 'Party', 'Free Events']

const dateOptions = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date_asc', label: 'Date (Soonest)' },
  { value: 'price_asc', label: 'Price (Low to High)' },
  { value: 'price_desc', label: 'Price (High to Low)' },
]

export function WebSearch() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Filter states
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'all')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance')
  
  // Data states
  const [searchResults, setSearchResults] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [recentSearchList, setRecentSearchList] = useState([])
  
  // Dropdown visibility
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Load cities and recent searches on mount
  useEffect(() => {
    loadCities()
    loadRecentSearches()
    
    // If there are URL params, search immediately
    if (searchParams.get('q') || searchParams.get('location')) {
      handleSearch()
    }
  }, [])

  const loadCities = async () => {
    const { data } = await supabase
      .from('events')
      .select('city')
      .eq('status', 'published')
      .not('city', 'eq', '')
      .not('city', 'is', null)
    
    if (data) {
      const uniqueCities = [...new Set(data.map(e => e.city))].filter(Boolean).sort()
      setCities(uniqueCities)
    }
  }

  const loadRecentSearches = () => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (saved) {
      try {
        setRecentSearchList(JSON.parse(saved))
      } catch (e) {
        setRecentSearchList([])
      }
    }
  }

  const saveRecentSearch = (term) => {
    if (!term.trim()) return
    const updated = [term, ...recentSearchList.filter(t => t !== term)].slice(0, 5)
    setRecentSearchList(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  const getDateRange = () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (dateFilter) {
      case 'today':
        const endOfDay = new Date(startOfDay)
        endOfDay.setDate(endOfDay.getDate() + 1)
        return { start: startOfDay.toISOString(), end: endOfDay.toISOString() }
      case 'week':
        const endOfWeek = new Date(startOfDay)
        endOfWeek.setDate(endOfWeek.getDate() + 7)
        return { start: now.toISOString(), end: endOfWeek.toISOString() }
      case 'month':
        const endOfMonth = new Date(startOfDay)
        endOfMonth.setMonth(endOfMonth.getMonth() + 1)
        return { start: now.toISOString(), end: endOfMonth.toISOString() }
      default:
        return { start: now.toISOString(), end: null }
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    
    // Update URL params
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (location) params.set('location', location)
    if (dateFilter !== 'all') params.set('date', dateFilter)
    if (sortBy !== 'relevance') params.set('sort', sortBy)
    setSearchParams(params)

    try {
      const { start, end } = getDateRange()
      
      let queryBuilder = supabase
        .from('events')
        .select('id, title, description, image_url, venue_name, city, start_date, category, currency, status, ticket_types (price)')
        .eq('status', 'published')
        .gte('start_date', start)

      // Date filter
      if (end) {
        queryBuilder = queryBuilder.lte('start_date', end)
      }

      // Location filter
      if (location) {
        queryBuilder = queryBuilder.eq('city', location)
      }

      // Text search
      if (query.trim()) {
        const searchTerm = `%${query.trim()}%`
        queryBuilder = queryBuilder.or(`title.ilike.${searchTerm},description.ilike.${searchTerm},venue_name.ilike.${searchTerm},category.ilike.${searchTerm}`)
        saveRecentSearch(query.trim())
      }

      // Sorting
      if (sortBy === 'date_asc') {
        queryBuilder = queryBuilder.order('start_date', { ascending: true })
      } else {
        queryBuilder = queryBuilder.order('start_date', { ascending: true })
      }

      queryBuilder = queryBuilder.limit(50)

      const { data, error } = await queryBuilder

      if (error) throw error

      // Calculate min price and sort by price if needed
      let resultsWithPrices = (data || []).map(event => ({
        ...event,
        minPrice: event.ticket_types?.length > 0
          ? Math.min(...event.ticket_types.map(t => parseFloat(t.price) || 0))
          : 0
      }))

      // Client-side price sorting
      if (sortBy === 'price_asc') {
        resultsWithPrices.sort((a, b) => a.minPrice - b.minPrice)
      } else if (sortBy === 'price_desc') {
        resultsWithPrices.sort((a, b) => b.minPrice - a.minPrice)
      }

      setSearchResults(resultsWithPrices)
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const clearLocation = () => {
    setLocation('')
  }

  const clearRecent = () => {
    setRecentSearchList([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }

  const handleQuickSearch = (term) => {
    setQuery(term)
    setTimeout(() => handleSearch(), 100)
  }

  const formatEventDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowLocationDropdown(false)
      setShowDateDropdown(false)
      setShowSortDropdown(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Search Header */}
      <div className="bg-[#2969FF] py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-2xl p-2 flex flex-col md:flex-row gap-2">
            {/* Location Filter */}
            <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
              <div 
                className="flex items-center gap-2 px-4 py-3 border border-[#0F0F0F]/10 rounded-xl cursor-pointer hover:border-[#2969FF]/50"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              >
                <MapPin className="w-5 h-5 text-[#2969FF]" />
                <div className="flex-1">
                  <div className="text-xs text-[#0F0F0F]/60 uppercase font-medium">Location</div>
                  <div className="text-sm text-[#0F0F0F]">{location || 'All Locations'}</div>
                </div>
                {location ? (
                  <button onClick={(e) => { e.stopPropagation(); clearLocation(); }} className="text-[#0F0F0F]/40 hover:text-[#0F0F0F]">
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#0F0F0F]/40" />
                )}
              </div>
              {showLocationDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0F0F0F]/10 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setLocation(''); setShowLocationDropdown(false); }}
                    className={`w-full text-left px-4 py-3 hover:bg-[#F4F6FA] ${!location ? 'bg-[#2969FF]/10 text-[#2969FF]' : ''}`}
                  >
                    All Locations
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city}
                      onClick={() => { setLocation(city); setShowLocationDropdown(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-[#F4F6FA] ${location === city ? 'bg-[#2969FF]/10 text-[#2969FF]' : ''}`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Filter */}
            <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
              <div 
                className="flex items-center gap-2 px-4 py-3 border border-[#0F0F0F]/10 rounded-xl cursor-pointer hover:border-[#2969FF]/50"
                onClick={() => setShowDateDropdown(!showDateDropdown)}
              >
                <Calendar className="w-5 h-5 text-[#2969FF]" />
                <div className="flex-1">
                  <div className="text-xs text-[#0F0F0F]/60 uppercase font-medium">Dates</div>
                  <div className="text-sm text-[#0F0F0F]">{dateOptions.find(d => d.value === dateFilter)?.label}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#0F0F0F]/40" />
              </div>
              {showDateDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0F0F0F]/10 rounded-xl shadow-lg z-20">
                  {dateOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setDateFilter(option.value); setShowDateDropdown(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-[#F4F6FA] ${dateFilter === option.value ? 'bg-[#2969FF]/10 text-[#2969FF]' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-[2] relative">
              <div className="flex items-center gap-2 px-4 py-3 border border-[#0F0F0F]/10 rounded-xl">
                <Search className="w-5 h-5 text-[#2969FF]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Artist, Event or Venue"
                  className="flex-1 outline-none text-sm"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[#0F0F0F]/40 hover:text-[#0F0F0F]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Button */}
            <Button 
              onClick={handleSearch}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8 py-6"
            >
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {!hasSearched ? (
          /* Initial State - Trending & Recent */
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#2969FF]" />
                <h2 className="font-semibold text-[#0F0F0F]">Trending Searches</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    onClick={() => handleQuickSearch(term)}
                    className="cursor-pointer hover:bg-[#2969FF]/10 hover:border-[#2969FF] transition-colors px-4 py-2 rounded-xl border-[#0F0F0F]/10 text-[#0F0F0F]"
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </div>

            {recentSearchList.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#0F0F0F]/60" />
                    <h2 className="font-semibold text-[#0F0F0F]">Recent Searches</h2>
                  </div>
                  <button onClick={clearRecent} className="text-sm text-[#2969FF] hover:underline">Clear all</button>
                </div>
                <div className="space-y-2">
                  {recentSearchList.map((term, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSearch(term)}
                      className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white transition-colors text-left"
                    >
                      <Clock className="w-4 h-4 text-[#0F0F0F]/40" />
                      <span className="text-[#0F0F0F]/80">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Search Results */
          <div>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-lg font-semibold text-[#0F0F0F]">{searchResults.length} Results</p>
              </div>
              
              {/* Sort Dropdown */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#0F0F0F]/10 rounded-xl bg-white"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#0F0F0F]/60" />
                  <span className="text-sm">{sortOptions.find(s => s.value === sortBy)?.label}</span>
                  <ChevronDown className="w-4 h-4 text-[#0F0F0F]/40" />
                </button>
                {showSortDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-[#0F0F0F]/10 rounded-xl shadow-lg z-20 min-w-[180px]">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => { setSortBy(option.value); setShowSortDropdown(false); handleSearch(); }}
                        className={`w-full text-left px-4 py-3 hover:bg-[#F4F6FA] text-sm ${sortBy === option.value ? 'bg-[#2969FF]/10 text-[#2969FF]' : ''}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
                <span className="ml-3 text-[#0F0F0F]/60">Searching...</span>
              </div>
            ) : searchResults.length === 0 ? (
              /* No Results */
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="py-16 text-center">
                  <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                  <p className="text-[#0F0F0F]/60 mb-2">No events found</p>
                  <p className="text-sm text-[#0F0F0F]/40 mb-6">Try adjusting your filters or search term</p>
                  <Button onClick={() => navigate('/events')} variant="outline" className="rounded-xl border-[#0F0F0F]/10">
                    Browse All Events
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Results Grid */
              <div className="space-y-4">
                {searchResults.map((event) => (
                  <Card
                    key={event.id}
                    onClick={() => navigate(`/e/${event.slug || event.id}`)}
                    className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-white"
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-48 h-32 flex-shrink-0">
                          <ImageWithFallback src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 p-4">
                          {event.category && (
                            <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg mb-2">{event.category}</Badge>
                          )}
                          <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2 line-clamp-1">{event.title}</h3>
                          <div className="flex flex-wrap gap-4 text-sm text-[#0F0F0F]/60 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatEventDate(event.start_date)}
                            </div>
                            {(event.venue_name || event.city) && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {event.venue_name || event.city}
                              </div>
                            )}
                          </div>
                          <div className="text-lg font-bold text-[#2969FF]">
                            {event.minPrice === 0 ? 'Free' : formatPrice(event.minPrice, event.currency)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
