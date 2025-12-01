import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, MapPin, Calendar, Filter, X, Grid, List } from 'lucide-react'
import { Input, Select } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { formatDate, formatCurrency } from '../lib/utils'

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  
  const [filters, setFilters] = useState({
    search: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    country: searchParams.get('country') || '',
    dateRange: searchParams.get('date') || '',
    priceRange: searchParams.get('price') || ''
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchFilters()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [filters])

  const fetchFilters = async () => {
    const [categoriesRes, countriesRes] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true),
      supabase.from('countries').select('*').eq('is_active', true)
    ])
    if (categoriesRes.data) setCategories(categoriesRes.data)
    if (countriesRes.data) setCountries(countriesRes.data)
  }

  const fetchEvents = async () => {
    setLoading(true)
    
    let query = supabase
      .from('events')
      .select('*, organizers(business_name, is_verified), categories(name, slug), countries(name, currency_symbol)')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })

    // Apply category filter
    if (filters.category) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', filters.category)
        .single()
      if (cat) query = query.eq('category_id', cat.id)
    }

    // Apply country filter
    if (filters.country) {
      query = query.eq('country_code', filters.country)
    }

    // Apply price filter
    if (filters.priceRange === 'free') {
      query = query.eq('is_free', true)
    }

    const { data, error } = await query.limit(50)

    if (error) {
      console.error('Error fetching events:', error)
    } else {
      // Apply client-side search filter
      let filteredData = data || []
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredData = filteredData.filter(event =>
          event.title.toLowerCase().includes(searchLower) ||
          event.city?.toLowerCase().includes(searchLower) ||
          event.venue_name?.toLowerCase().includes(searchLower)
        )
      }
      setEvents(filteredData)
    }
    setLoading(false)
  }

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    if (value) {
      searchParams.set(key === 'search' ? 'q' : key, value)
    } else {
      searchParams.delete(key === 'search' ? 'q' : key)
    }
    setSearchParams(searchParams)
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      country: '',
      dateRange: '',
      priceRange: ''
    })
    setSearchParams({})
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Browse Events</h1>
          <p className="text-primary-100">Discover amazing events happening across Africa</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search events, venues, cities..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <Select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="w-40"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </Select>

              <Select
                value={filters.country}
                onChange={(e) => updateFilter('country', e.target.value)}
                className="w-40"
              >
                <option value="">All Countries</option>
                {countries.map(country => (
                  <option key={country.id} value={country.code}>{country.name}</option>
                ))}
              </Select>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="primary">{activeFilterCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                <Select
                  value={filters.priceRange}
                  onChange={(e) => updateFilter('priceRange', e.target.value)}
                >
                  <option value="">Any Price</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <Select
                  value={filters.dateRange}
                  onChange={(e) => updateFilter('dateRange', e.target.value)}
                >
                  <option value="">Any Date</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="text-red-500">
                  <X className="w-4 h-4 mr-1" /> Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">
            {loading ? 'Loading...' : `${events.length} events found`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-500' : 'text-gray-400'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-500' : 'text-gray-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border">
            <div className="text-6xl mb-4">🎫</div>
            <h3 className="text-xl font-semibold text-gray-700">No events found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your filters or search query</p>
            <Button onClick={clearFilters} className="mt-6">Clear Filters</Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' 
            : 'space-y-4'
          }>
            {events.map((event) => (
              <Link to={`/events/${event.id}`} key={event.id}>
                <div className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border group ${
                  viewMode === 'list' ? 'flex' : ''
                }`}>
                  <div className={`bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden ${
                    viewMode === 'list' ? 'w-48 h-32' : 'h-48'
                  }`}>
                    {event.image_url && (
                      <img 
                        src={event.image_url} 
                        alt={event.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    )}
                    {event.is_featured && (
                      <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                        ⭐ FEATURED
                      </span>
                    )}
                    {event.is_free && (
                      <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        FREE
                      </span>
                    )}
                  </div>
                  <div className={`p-5 flex-1 ${viewMode === 'list' ? 'flex flex-col justify-center' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="primary">{event.categories?.name}</Badge>
                      {event.organizers?.is_verified && (
                        <Badge variant="info">✓ Verified</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{event.organizers?.business_name}</p>
                    <div className="flex items-center gap-4 text-gray-500 text-sm mt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(event.start_date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.city}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="text-sm text-gray-400">{event.countries?.name}</span>
                      <span className="font-bold text-primary-500">
                        {event.is_free ? 'Free' : `From ${event.countries?.currency_symbol || '₦'}0`}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
