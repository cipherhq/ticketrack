import { formatPrice } from '@/config/currencies'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Calendar, MapPin, SlidersHorizontal, ChevronDown, X, Loader2, Monitor } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getCategories } from '@/services/events'
import { supabase } from '@/lib/supabase'
import { getUserLocation, getUserCountry, sortEventsByDistance, formatDistance } from '@/utils/location'

const dateOptions = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

const sortOptions = [
  { value: 'distance', label: 'Distance (Nearest)' },
  { value: 'date', label: 'Date (Soonest)' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
]

export function WebEventBrowse() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Search bar state
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'all')
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  
  // Filter state
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'date')
  const [selectedCategories, setSelectedCategories] = useState(
    searchParams.get('category') ? [searchParams.get('category')] : []
  )
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  
  // Data state
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [userCountryCode, setUserCountryCode] = useState(null)
  const [locationPermission, setLocationPermission] = useState(null) // 'granted', 'denied', 'prompt'

  // Load categories and get user location on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const categoriesData = await getCategories()
        setCategories(categoriesData)
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()

    // Load events immediately (don't wait for location)
    loadEvents(null, null)

    // Get user location and country code for filtering (non-blocking)
    getUserCountry()
      .then(result => {
        if (result) {
          setUserLocation({ lat: result.lat, lng: result.lng })
          setUserCountryCode(result.countryCode)
          setLocationPermission('granted')
          // Reload events with location-based filtering
          if (sortBy === 'distance' || (!sortBy || sortBy === 'date')) {
            loadEvents({ lat: result.lat, lng: result.lng }, result.countryCode)
          }
        } else {
          setLocationPermission('denied')
        }
      })
      .catch(error => {
        console.log('Location not available:', error.message)
        setLocationPermission('denied')
      })
  }, [])

  // Load events when filters change
  useEffect(() => {
    // Always load events, even if location permission is still being determined
    loadEvents(userLocation, userCountryCode)
  }, [dateFilter, location, searchTerm, selectedCategories, sortBy])

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
        return { start: startOfDay.toISOString(), end: endOfWeek.toISOString() }
      case 'month':
        const endOfMonth = new Date(startOfDay)
        endOfMonth.setMonth(endOfMonth.getMonth() + 1)
        return { start: startOfDay.toISOString(), end: endOfMonth.toISOString() }
      default:
        return { start: now.toISOString(), end: null }
    }
  }

  const loadEvents = async (useLocation = null, countryCode = null) => {
    setLoading(true)
    setLoadError(false)

    try {
      const { start, end } = getDateRange()
      
      // Use country code from parameter or state
      const userCountry = countryCode || userCountryCode
      
      let query = supabase
        .from('events')
        .select('id, title, slug, description, image_url, venue_name, city, start_date, category, currency, is_free, tickets_sold, is_virtual, is_recurring, parent_event_id, venue_lat, venue_lng, country_code, ticket_types (price, quantity_available, quantity_sold)')
        .eq('status', 'published')
        .or('visibility.eq.public,visibility.is.null')
        .is('parent_event_id', null) // Only show parent events in browse (child events accessible via parent page)
        .gte('start_date', start)

      // Removed US-only restriction to show events from all countries
      // Users can filter by location if needed

      // Date filter
      if (end) {
        query = query.lte('start_date', end)
      }

      // Location filter (search in city or venue)
      if (location.trim()) {
        const locationTerm = `%${location.trim()}%`
        query = query.or(`city.ilike.${locationTerm},venue_name.ilike.${locationTerm}`)
      }

      // Text search
      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`
        // Use separate filter for text search to avoid conflicts with location filter
        query = query.or(`title.ilike.${term},description.ilike.${term},category.ilike.${term}`)
      }

      // Category filter
      if (selectedCategories.length > 0) {
        const cat = categories.find(c => c.slug === selectedCategories[0])
        if (cat) {
          query = query.eq('category', cat.name)
        }
      }

      query = query.order('start_date', { ascending: true }).limit(50)

      const { data, error } = await query

      if (error) throw error

      // Calculate min price and sold out status for each event
      let results = (data || []).map(event => {
        const min_price = event.ticket_types?.length > 0
          ? Math.min(...event.ticket_types.map(t => parseFloat(t.price) || 0))
          : 0
        let totalRemaining = 0
        let totalCapacity = 0
        event.ticket_types?.forEach(t => {
          const remaining = (t.quantity_available || 0) - (t.quantity_sold || 0)
          totalRemaining += remaining
          totalCapacity += (t.quantity_available || 0)
        })
        const isSoldOut = totalCapacity > 0 && totalRemaining <= 0
        return { ...event, min_price, isSoldOut }
      })

      // Sort by distance first if user location is available and sortBy is 'distance' or default
      const locationToUse = useLocation || userLocation
      if ((sortBy === 'distance' || (!sortBy || sortBy === 'date')) && locationToUse) {
        results = sortEventsByDistance(results, locationToUse.lat, locationToUse.lng)
        // If sortBy is 'distance', keep distance sort; otherwise sort by date within distance groups
        if (sortBy === 'distance') {
          // Already sorted by distance
        } else {
          // Sort by date within same distance ranges (events within 5km sorted by date, then 5-10km, etc.)
          results = results.sort((a, b) => {
            const distanceDiff = Math.floor(a.distance || Infinity) - Math.floor(b.distance || Infinity)
            if (Math.abs(distanceDiff) <= 5) {
              // Same distance range, sort by date
              return new Date(a.start_date) - new Date(b.start_date)
            }
            return distanceDiff
          })
        }
      } else {
        // Client-side sorting by other criteria
      if (sortBy === 'price-low') {
        results.sort((a, b) => a.min_price - b.min_price)
      } else if (sortBy === 'price-high') {
        results.sort((a, b) => b.min_price - a.min_price)
      } else if (sortBy === 'popular') {
        results.sort((a, b) => (b.tickets_sold || 0) - (a.tickets_sold || 0))
        } else {
          // Default: sort by date
          results.sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        }
      }

      // Price range filter (client-side)
      if (minPrice || maxPrice) {
        results = results.filter(event => {
          const price = event.min_price
          if (minPrice && price < parseFloat(minPrice)) return false
          if (maxPrice && price > parseFloat(maxPrice)) return false
          return true
        })
      }

      setEvents(results)
      console.log(`Loaded ${results.length} events`)
    } catch (error) {
      console.error('Error loading events:', error)
      setEvents([])
      setLoadError(true)
      toast.error('Failed to load events. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    // Update URL params
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (location) params.set('location', location)
    if (dateFilter !== 'all') params.set('date', dateFilter)
    if (sortBy !== 'date') params.set('sort', sortBy)
    if (selectedCategories.length === 1) params.set('category', selectedCategories[0])
    setSearchParams(params)
    
    loadEvents(userLocation)
  }

  const handleCategoryToggle = (categorySlug) => {
    setSelectedCategories(prev => 
      prev.includes(categorySlug) 
        ? prev.filter(c => c !== categorySlug) 
        : [categorySlug] // Only allow one category
    )
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setMinPrice("")
    setMaxPrice("")
    setSearchTerm('')
    setLocation('')
    setDateFilter('all')
    setSortBy('date')
    setSearchParams({})
    loadEvents()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDateDropdown(false)
      setShowSortDropdown(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-medium text-foreground mb-4">Categories</h3>
        <div className="space-y-3">
          {categories.map(category => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`cat-${category.slug}`} 
                checked={selectedCategories.includes(category.slug)} 
                onCheckedChange={() => handleCategoryToggle(category.slug)} 
              />
              <Label htmlFor={`cat-${category.slug}`} className="cursor-pointer flex items-center gap-2">
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pt-6 border-t border-border/10">
        <h3 className="font-medium text-foreground mb-4">Price Range</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-border/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              placeholder="Max"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-border/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="price-free" 
              checked={minPrice === "0" && maxPrice === "0"} 
              onCheckedChange={(checked) => {
                if (checked) { setMinPrice("0"); setMaxPrice("0"); }
                else { setMinPrice(""); setMaxPrice(""); }
              }} 
            />
            <Label htmlFor="price-free" className="cursor-pointer">Free events only</Label>
          </div>
        </div>
      </div>

      {/* Apply & Clear Buttons */}
      <div className="pt-6 border-t border-border/10 space-y-3">
        <Button 
          className="w-full rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90 text-white" 
          onClick={handleSearch}
        >
          Apply Filters
        </Button>
        <Button 
          variant="outline" 
          className="w-full rounded-xl" 
          onClick={clearFilters}
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted">
      {/* Search Header */}
      <div className="bg-[#2969FF] py-4 md:py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-background rounded-2xl p-2 md:p-3 flex flex-col md:flex-row gap-2 md:gap-2 shadow-lg border border-border/20">
            {/* Location Input */}
            <div className="flex-1 relative">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border border-border/30 rounded-xl hover:border-[#2969FF]/40 transition-colors">
                <MapPin className="w-5 h-5 text-[#2969FF] flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Location</div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="City or Venue"
                    className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 text-sm"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                {location && (
                  <button onClick={() => setLocation('')} className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Filter */}
            <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
              <div
                className="flex items-center gap-2 px-4 py-3 bg-muted/50 border border-border/30 rounded-xl cursor-pointer hover:border-[#2969FF]/40 transition-colors"
                onClick={() => setShowDateDropdown(!showDateDropdown)}
              >
                <Calendar className="w-5 h-5 text-[#2969FF] flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Dates</div>
                  <div className="text-sm text-foreground">{dateOptions.find(d => d.value === dateFilter)?.label}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
              {showDateDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/30 rounded-xl shadow-xl z-20">
                  {dateOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setDateFilter(option.value); setShowDateDropdown(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-muted text-sm min-h-[44px] touch-manipulation first:rounded-t-xl last:rounded-b-xl ${dateFilter === option.value ? 'bg-[#2969FF]/10 text-[#2969FF] font-medium' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-[2] relative">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border border-border/30 rounded-xl hover:border-[#2969FF]/40 transition-colors">
                <Search className="w-5 h-5 text-[#2969FF] flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Search</div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Artist, Event or Venue"
                    className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 text-sm"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearch}
              className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl px-8 py-6 min-h-[44px] touch-manipulation w-full md:w-auto font-semibold shadow-md"
            >
              <Search className="w-4 h-4 mr-2 md:hidden lg:block" />
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {searchTerm || location ? 'Search Results' : 'Browse Events'}
            </h1>
            <p className="text-muted-foreground">
              {loading ? 'Loading...' : `${events.length} events found`}
            </p>
          </div>
          
          {/* Sort Dropdown */}
          <div className="flex items-center gap-3">
            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden rounded-xl border-border/10 min-h-[44px] touch-manipulation">
                  <SlidersHorizontal className="w-5 h-5 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel />
                </div>
              </SheetContent>
            </Sheet>

            <div className="relative hidden md:block" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-border/10 rounded-xl bg-card"
              >
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Sort: {sortOptions.find(s => s.value === sortBy)?.label}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-card border border-border/10 rounded-xl shadow-lg z-20 min-w-[200px]">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setShowSortDropdown(false); handleSearch(); }}
                      className={`w-full text-left px-4 py-3 hover:bg-muted text-sm min-h-[44px] touch-manipulation ${sortBy === option.value ? 'bg-[#2969FF]/10 text-[#2969FF]' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-card rounded-2xl p-6 border border-border/10">
              <h2 className="text-lg font-semibold text-foreground mb-4">Filters</h2>
              <FilterPanel />
            </div>
          </div>

          {/* Events Grid */}
          <div className="flex-1">
            {/* Active Filters */}
            {(selectedCategories.length > 0 || location || searchTerm || dateFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedCategories.map(catSlug => {
                  const cat = categories.find(c => c.slug === catSlug)
                  return cat ? (
                    <Badge 
                      key={catSlug}
                      variant="secondary" 
                      className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg px-3 py-1 cursor-pointer"
                      onClick={() => handleCategoryToggle(catSlug)}
                    >
                      {cat.icon} {cat.name} ✕
                    </Badge>
                  ) : null
                })}
                {location && (
                  <Badge 
                    variant="secondary" 
                    className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg px-3 py-1 cursor-pointer"
                    onClick={() => { setLocation(''); handleSearch(); }}
                  >
                    📍 {location} ✕
                  </Badge>
                )}
                {searchTerm && (
                  <Badge 
                    variant="secondary" 
                    className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg px-3 py-1 cursor-pointer"
                    onClick={() => { setSearchTerm(''); handleSearch(); }}
                  >
                    🔍 {searchTerm} ✕
                  </Badge>
                )}
                {dateFilter !== 'all' && (
                  <Badge 
                    variant="secondary" 
                    className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg px-3 py-1 cursor-pointer"
                    onClick={() => { setDateFilter('all'); handleSearch(); }}
                  >
                    📅 {dateOptions.find(d => d.value === dateFilter)?.label} ✕
                  </Badge>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
                <span className="ml-3 text-muted-foreground">Loading events...</span>
              </div>
            ) : loadError ? (
              <div className="text-center py-16 bg-card rounded-2xl">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Failed to load events</h3>
                <p className="text-muted-foreground mb-6">Please check your connection and try again.</p>
                <Button onClick={() => loadEvents(userLocation)} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl min-h-[44px] touch-manipulation">
                  Retry
                </Button>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl">
                <div className="text-6xl mb-4">🎫</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No events found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl min-h-[44px] touch-manipulation">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {events.map((event) => (
                  <Card 
                    key={event.id}
                    className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-0 rounded-2xl bg-card group touch-manipulation active:scale-[0.98]"
                    onClick={() => navigate(`/e/${event.slug || event.id}`)}
                  >
                    <div className="relative h-48 bg-muted">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${event.isSoldOut ? 'grayscale opacity-70' : ''}`}
                        onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; e.target.parentElement.classList.add('flex', 'items-center', 'justify-center'); e.target.insertAdjacentHTML('afterend', '<div class="text-muted-foreground text-sm">No Image</div>'); }}
                        loading="lazy"
                        decoding="async"
                      />
                      {event.isSoldOut && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                            Sold Out
                          </span>
                        </div>
                      )}
                      {event.category && (
                        <Badge className="absolute top-4 left-4 bg-black/60 text-white border-0 font-medium backdrop-blur-sm">
                          {event.category}
                        </Badge>
                      )}
                      {event.is_free && !event.isSoldOut && (
                        <Badge className="absolute top-4 right-4 bg-green-500 text-white border-0">
                          Free
                        </Badge>
                      )}
                      {event.is_recurring && (
                        <Badge className={`absolute ${event.is_free && !event.isSoldOut ? 'top-12' : 'top-4'} right-4 bg-purple-500 text-white border-0 flex items-center gap-1`}>
                          <Calendar className="w-3 h-3" /> Series
                        </Badge>
                      )}
                      {event.is_virtual && (
                        <Badge className="absolute bottom-4 left-4 bg-purple-600 text-white border-0 flex items-center gap-1">
                          <Monitor className="w-3 h-3" /> Virtual
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-5">
                      <h3 className="font-semibold text-lg text-foreground mb-3 line-clamp-1">
                        {event.title}
                      </h3>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(event.start_date)}
                      </div>

                      <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="line-clamp-2">
                            {event.is_virtual ? 'Virtual Event' : [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || 'Location TBA'}
                          </span>
                          {event.distance && event.distance !== Infinity && (
                            <span className="text-[#2969FF] font-medium block mt-0.5">
                              {formatDistance(event.distance)} away
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-border/10 pt-4 mt-2">
                        <div className="flex justify-between items-center">
                          {event.isSoldOut ? (
                            <span className="font-bold text-red-500 text-lg">Sold Out</span>
                          ) : (
                            <span className="font-bold text-[#2969FF] text-lg">
                              {event.is_free ? "Free" : formatPrice(event.min_price, event.currency)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            className={`rounded-full px-5 ${event.isSoldOut ? 'bg-gray-400 hover:bg-gray-500' : 'bg-[#2969FF] hover:bg-[#1a4fd8]'} text-white`}
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/e/${event.slug || event.id}`)
                            }}
                          >
                            {event.isSoldOut ? 'View Event' : 'Get Tickets'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
