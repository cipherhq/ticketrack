import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search as SearchIcon, MapPin, Calendar, X, Clock } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { formatDate } from '../lib/utils'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('ticketrack_recent_searches')
    return saved ? JSON.parse(saved) : []
  })
  const [popularCategories, setPopularCategories] = useState([])

  useEffect(() => {
    fetchCategories()
    if (query) {
      handleSearch()
    }
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .limit(6)
    if (data) setPopularCategories(data)
  }

  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setSearchParams({ q: searchQuery })

    // Save to recent searches
    const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5)
    setRecentSearches(newRecent)
    localStorage.setItem('ticketrack_recent_searches', JSON.stringify(newRecent))

    const { data, error } = await supabase
      .from('events')
      .select('*, organizers(business_name), categories(name), countries(currency_symbol)')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .or(`title.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,venue_name.ilike.%${searchQuery}%`)
      .order('start_date', { ascending: true })
      .limit(20)

    if (!error) {
      setResults(data || [])
    }
    setLoading(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleSearch()
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('ticketrack_recent_searches')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search events, venues, cities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 pr-12 py-4 text-lg"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setResults([])
                    setSearchParams({})
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Show results if we have a query */}
        {query && searchParams.get('q') ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {loading ? 'Searching...' : `${results.length} results for "${query}"`}
              </h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
                    <div className="w-32 h-24 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-6 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-700">No events found</h3>
                <p className="text-gray-500 mt-2">Try different keywords or browse all events</p>
                <Link to="/events">
                  <Button className="mt-6">Browse All Events</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((event) => (
                  <Link to={`/events/${event.id}`} key={event.id}>
                    <div className="bg-white rounded-xl border p-4 hover:shadow-md transition flex gap-4 group">
                      <div className="w-32 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg overflow-hidden flex-shrink-0">
                        {event.image_url && (
                          <img src={event.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge variant="primary" className="mb-2">{event.categories?.name}</Badge>
                        <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-500 transition">
                          {event.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{event.organizers?.business_name}</p>
                        <div className="flex items-center gap-4 text-gray-400 text-sm mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(event.start_date, { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.city}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary-500">
                          {event.is_free ? 'Free' : `${event.countries?.currency_symbol || '₦'}0+`}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Show suggestions when no query */
          <div className="space-y-8">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-700">Recent Searches</h2>
                  <button
                    onClick={clearRecentSearches}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(search)
                        handleSearch(search)
                      }}
                      className="flex items-center gap-2 bg-white border rounded-full px-4 py-2 hover:border-primary-500 transition"
                    >
                      <Clock className="w-4 h-4 text-gray-400" />
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Categories */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Browse by Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {popularCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/events?category=${cat.slug}`}
                    className="bg-white border rounded-xl p-4 text-center hover:border-primary-500 hover:shadow-md transition"
                  >
                    <span className="text-3xl">{cat.icon}</span>
                    <p className="font-medium mt-2">{cat.name}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Links</h2>
              <div className="grid grid-cols-2 gap-4">
                <Link to="/events?price=free" className="bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition">
                  <p className="font-semibold text-green-700">🎉 Free Events</p>
                  <p className="text-sm text-green-600 mt-1">Discover free events near you</p>
                </Link>
                <Link to="/events?featured=true" className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:shadow-md transition">
                  <p className="font-semibold text-yellow-700">⭐ Featured Events</p>
                  <p className="text-sm text-yellow-600 mt-1">Hand-picked events you'll love</p>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
