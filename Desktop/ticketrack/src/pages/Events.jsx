import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, MapPin, Calendar, Filter, X } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export default function Events() {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchFilters()
    fetchEvents()
  }, [selectedCategory, selectedCountry])

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
      .select('*, organizers(business_name), categories(name, slug), countries(name, currency_symbol)')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })

    if (selectedCategory) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', selectedCategory)
        .single()
      if (cat) {
        query = query.eq('category_id', cat.id)
      }
    }

    if (selectedCountry) {
      query = query.eq('country_code', selectedCountry)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching events:', error)
    } else {
      setEvents(data || [])
    }
    setLoading(false)
  }

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const clearFilters = () => {
    setSelectedCategory('')
    setSelectedCountry('')
    setSearchQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Browse Events</h1>
          <p className="text-primary-100">Discover amazing events happening across Africa</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              Filters
              {(selectedCategory || selectedCountry) && (
                <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {[selectedCategory, selectedCountry].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Countries</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(selectedCategory || selectedCountry) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm text-red-500 hover:underline flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <p className="text-gray-500 text-lg">No events found</p>
            <p className="text-gray-400 mt-2">Try adjusting your filters or search query</p>
            <Button onClick={clearFilters} className="mt-4">Clear Filters</Button>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">{filteredEvents.length} events found</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <Link to={`/events/${event.id}`} key={event.id}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition border h-full">
                    <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 relative">
                      {event.image_url && (
                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                      )}
                      {event.is_free && (
                        <span className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="p-6">
                      <span className="text-xs font-medium text-primary-500 bg-primary-50 px-2 py-1 rounded-full">
                        {event.categories?.name || 'Event'}
                      </span>
                      <h3 className="text-lg font-semibold mt-3 line-clamp-2">{event.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{event.organizers?.business_name}</p>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-3">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.venue_name}, {event.city}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-between items-center">
                        <span className="text-gray-400 text-sm">{event.countries?.name}</span>
                        <span className="font-semibold text-primary-500">
                          {event.is_free ? 'Free' : `${event.countries?.currency_symbol || '₦'}${event.total_revenue || '0'}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
