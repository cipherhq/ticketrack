import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, MapPin, Calendar } from 'lucide-react'

export default function Home() {
  const [countries, setCountries] = useState([])
  const [categories, setCategories] = useState([])
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [countriesRes, categoriesRes, eventsRes] = await Promise.all([
          supabase.from('countries').select('*').eq('is_active', true),
          supabase.from('categories').select('*').eq('is_active', true),
          supabase.from('events').select('*, organizers(business_name), categories(name)').eq('status', 'published').eq('is_featured', true).limit(6)
        ])
        
        if (countriesRes.data) setCountries(countriesRes.data)
        if (categoriesRes.data) setCategories(categoriesRes.data)
        if (eventsRes.data) setFeaturedEvents(eventsRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Africa's Premier Event<br />Ticketing Platform
          </h1>
          <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
            Buy and sell event tickets securely across Nigeria, Ghana, Kenya, Rwanda, South Africa, and Cameroon.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center px-4">
              <Search className="w-5 h-5 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search events..."
                className="w-full py-3 text-gray-700 focus:outline-none"
              />
            </div>
            <Link to="/events">
              <button className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-8 rounded-xl">
                Search
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-primary-500">{countries.length}</p>
            <p className="text-gray-600">Countries</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">{categories.length}</p>
            <p className="text-gray-600">Categories</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">10%</p>
            <p className="text-gray-600">Platform Fee</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary-500">🔒</p>
            <p className="text-gray-600">Secure</p>
          </div>
        </div>
      </section>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Featured Events</h2>
              <Link to="/events" className="text-primary-500 hover:underline">View all</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredEvents.map((event) => (
                <Link to={`/events/${event.id}`} key={event.id}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition border">
                    <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600"></div>
                    <div className="p-6">
                      <span className="text-xs font-medium text-primary-500 bg-primary-50 px-2 py-1 rounded-full">
                        {event.categories?.name || 'Event'}
                      </span>
                      <h3 className="text-lg font-semibold mt-3">{event.title}</h3>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(event.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.city}</span>
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
      <section id="categories" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Event Categories</h2>
          {loading ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Link to={`/events?category=${cat.slug}`} key={cat.id}>
                  <div className="bg-white border rounded-xl p-6 text-center hover:shadow-lg hover:border-primary-500 cursor-pointer transition">
                    <span className="text-4xl">{cat.icon}</span>
                    <p className="mt-3 font-medium">{cat.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Countries */}
      <section id="countries" className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Available In</h2>
          <p className="text-gray-600 text-center mb-12">6 African countries with local currency support</p>
          {loading ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {countries.map((country) => (
                <div key={country.id} className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition border">
                  <p className="text-2xl font-bold text-primary-500">{country.currency_symbol}</p>
                  <p className="font-semibold mt-2">{country.name}</p>
                  <p className="text-sm text-gray-500">{country.currency}</p>
                  <p className="text-xs text-gray-400 mt-2">VAT: {country.tax_percent}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Ticketrack?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Payments</h3>
              <p className="text-gray-600">Bank-level security with encrypted transactions.</p>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Tickets</h3>
              <p className="text-gray-600">QR codes for easy event check-in.</p>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Low Fees</h3>
              <p className="text-gray-600">Only 10% with no hidden charges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-500 text-white text-center">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-primary-100 mb-8">Join thousands across Africa.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <button className="bg-white text-primary-500 hover:bg-gray-100 font-semibold py-4 px-8 rounded-xl text-lg">
                Sign Up Free
              </button>
            </Link>
            <Link to="/events">
              <button className="border-2 border-white text-white hover:bg-white hover:text-primary-500 font-semibold py-4 px-8 rounded-xl text-lg transition">
                Browse Events
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
