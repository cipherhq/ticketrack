import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, MapPin, Calendar, ArrowRight, Shield, Zap, CreditCard } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { formatDate } from '../lib/utils'

export default function Home() {
  const [countries, setCountries] = useState([])
  const [categories, setCategories] = useState([])
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [countriesRes, categoriesRes, featuredRes, upcomingRes] = await Promise.all([
        supabase.from('countries').select('*').eq('is_active', true),
        supabase.from('categories').select('*').eq('is_active', true),
        supabase.from('events').select('*, organizers(business_name), categories(name), countries(currency_symbol)').eq('status', 'published').eq('is_featured', true).limit(3),
        supabase.from('events').select('*, organizers(business_name), categories(name), countries(currency_symbol)').eq('status', 'published').gte('start_date', new Date().toISOString()).order('start_date', { ascending: true }).limit(6)
      ])
      
      if (countriesRes.data) setCountries(countriesRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (featuredRes.data) setFeaturedEvents(featuredRes.data)
      if (upcomingRes.data) setUpcomingEvents(upcomingRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Discover Amazing Events<br />Across Africa
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-10 max-w-2xl mx-auto">
              Buy and sell event tickets securely in Nigeria, Ghana, Kenya, Rwanda, South Africa, and Cameroon.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-xl">
                <div className="flex-1 flex items-center px-4">
                  <Search className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    type="text"
                    placeholder="Search events, venues, or cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-3 text-gray-700 focus:outline-none"
                  />
                </div>
                <Button type="submit" size="lg" className="whitespace-nowrap">
                  Find Events
                </Button>
              </div>
            </form>

            {/* Quick Links */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {categories.slice(0, 5).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/events?category=${cat.slug}`}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-sm transition"
                >
                  {cat.icon} {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-primary-500">{countries.length}</p>
            <p className="text-gray-600 mt-1">Countries</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">{categories.length}</p>
            <p className="text-gray-600 mt-1">Categories</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">10%</p>
            <p className="text-gray-600 mt-1">Platform Fee</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">🔒</p>
            <p className="text-gray-600 mt-1">Secure Payments</p>
          </div>
        </div>
      </section>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">Featured Events</h2>
                <p className="text-gray-500 mt-1">Hand-picked events you'll love</p>
              </div>
              <Link to="/events?featured=true" className="text-primary-500 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredEvents.map((event) => (
                <Link to={`/events/${event.id}`} key={event.id}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border group">
                    <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden">
                      {event.image_url && (
                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      )}
                      <div className="absolute top-4 left-4">
                        <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                          ⭐ FEATURED
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <span className="text-xs font-medium text-primary-500 bg-primary-50 px-2 py-1 rounded-full">
                        {event.categories?.name}
                      </span>
                      <h3 className="text-lg font-semibold mt-3 line-clamp-2">{event.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{event.organizers?.business_name}</p>
                      <div className="flex items-center gap-4 text-gray-500 text-sm mt-3">
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
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Browse by Category</h2>
            <p className="text-gray-500 mt-2">Find events that match your interests</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <Link to={`/events?category=${cat.slug}`} key={cat.id}>
                <div className="bg-white border rounded-2xl p-6 text-center hover:shadow-lg hover:border-primary-500 cursor-pointer transition-all duration-200">
                  <span className="text-4xl">{cat.icon}</span>
                  <p className="mt-3 font-medium text-gray-800">{cat.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">Upcoming Events</h2>
                <p className="text-gray-500 mt-1">Don't miss out on these events</p>
              </div>
              <Link to="/events" className="text-primary-500 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <Link to={`/events/${event.id}`} key={event.id}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition border group">
                    <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden">
                      {event.image_url && (
                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      )}
                      {event.is_free && (
                        <span className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary-500">{event.categories?.name}</span>
                        <span className="text-xs text-gray-400">{event.city}</span>
                      </div>
                      <h3 className="font-semibold mt-2 line-clamp-1">{event.title}</h3>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-sm text-gray-500">
                          {formatDate(event.start_date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-semibold text-primary-500">
                          {event.is_free ? 'Free' : `${event.countries?.currency_symbol || '₦'}0+`}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Countries */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Available Across Africa</h2>
            <p className="text-gray-500 mt-2">6 countries with local currency support</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {countries.map((country) => (
              <div key={country.id} className="bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition border">
                <p className="text-3xl font-bold text-primary-500">{country.currency_symbol}</p>
                <p className="font-semibold mt-2 text-gray-800">{country.name}</p>
                <p className="text-sm text-gray-500">{country.currency}</p>
                <p className="text-xs text-gray-400 mt-2">VAT: {country.tax_percent}%</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Why Choose Ticketrack?</h2>
            <p className="text-gray-500 mt-2">The trusted platform for African events</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white rounded-2xl border hover:shadow-lg transition">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Secure Payments</h3>
              <p className="text-gray-600">Bank-level security with encrypted transactions. Your money is always safe with us.</p>
            </div>
            <div className="text-center p-8 bg-white rounded-2xl border hover:shadow-lg transition">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Instant Tickets</h3>
              <p className="text-gray-600">Get your tickets instantly with QR codes for seamless event check-in.</p>
            </div>
            <div className="text-center p-8 bg-white rounded-2xl border hover:shadow-lg transition">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CreditCard className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Low Fees</h3>
              <p className="text-gray-600">Only 10% platform fee with transparent pricing. No hidden charges, ever.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-500 text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto text-lg">
            Join thousands of event organizers and attendees across Africa. Create your account today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="secondary" size="lg" className="bg-white text-primary-500 hover:bg-gray-100 border-0">
                Sign Up Free
              </Button>
            </Link>
            <Link to="/events">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-primary-500">
                Browse Events
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
