import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Calendar, MapPin, Star, TrendingUp, Shield, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getFeaturedEvents, getCategories } from '@/services/events'

export function WebHome() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [eventsData, categoriesData] = await Promise.all([
          getFeaturedEvents(6),
          getCategories()
        ])
        setFeaturedEvents(eventsData)
        setCategories(categoriesData)
      } catch (error) {
        console.error('Error loading home data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatPrice = (event) => {
    if (event.is_free) return 'Free'
    return 'From ₦15,000'
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1a4fd8] text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Badge className="bg-white/20 text-white border-0 mb-6">
            <Star className="w-4 h-4 mr-1" />
            Trusted by 10,000+ event organizers
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Discover Amazing Events<br />Near You
          </h1>
          
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Book tickets for concerts, conferences, festivals, and more. Your next experience starts here.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex bg-white rounded-2xl p-2 shadow-lg">
              <div className="flex-1 flex items-center px-4">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <Input
                  type="text"
                  placeholder="Search for events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 focus-visible:ring-0 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <Button 
                type="submit"
                className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl px-8"
              >
                Search Events
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-8">Browse by Category</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-28" />
              ))
            ) : (
              categories.slice(0, 5).map((category) => (
                <Card 
                  key={category.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-[#0F0F0F]/10 rounded-2xl"
                  onClick={() => navigate(`/events?category=${category.slug}`)}
                >
                  <CardContent className="p-5 text-center">
                    <div className="text-3xl mb-2">{category.icon || '🎫'}</div>
                    <h3 className="font-medium text-[#0F0F0F] text-sm">{category.name}</h3>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="py-16 px-4 bg-[#F4F6FA]">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F]">Featured Events</h2>
            <Button 
              variant="ghost" 
              className="text-[#2969FF] hover:text-[#2969FF]/80"
              onClick={() => navigate('/events')}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-2xl h-96" />
              ))
            ) : (
              featuredEvents.map((event) => (
                <Card 
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-0 rounded-2xl bg-white group"
                  onClick={() => navigate(`/event/${event.slug}`)}
                >
                  <div className="relative h-52 bg-gray-100">
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 font-medium shadow-sm">
                      {event.category?.name || 'Event'}
                    </Badge>
                  </div>
                  
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-lg text-[#0F0F0F] mb-3 line-clamp-1">
                      {event.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(event.start_date)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-4">
                      <MapPin className="w-4 h-4" />
                      {event.venue_name}
                    </div>
                    
                    <div className="border-t border-[#0F0F0F]/10 pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#2969FF] text-lg">
                          {formatPrice(event)}
                        </span>
                        <Button 
                          size="sm"
                          className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-full px-5"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/event/${event.slug}`)
                          }}
                        >
                          Get Tickets
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </sect
cat > ~/Desktop/ticketrack/src/pages/WebHome.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Calendar, MapPin, Star, TrendingUp, Shield, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getFeaturedEvents, getCategories } from '@/services/events'

export function WebHome() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [eventsData, categoriesData] = await Promise.all([
          getFeaturedEvents(6),
          getCategories()
        ])
        setFeaturedEvents(eventsData)
        setCategories(categoriesData)
      } catch (error) {
        console.error('Error loading home data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatPrice = (event) => {
    if (event.is_free) return 'Free'
    return 'From ₦15,000'
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1a4fd8] text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Badge className="bg-white/20 text-white border-0 mb-6">
            <Star className="w-4 h-4 mr-1" />
            Trusted by 10,000+ event organizers
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Discover Amazing Events<br />Near You
          </h1>
          
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Book tickets for concerts, conferences, festivals, and more. Your next experience starts here.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex bg-white rounded-2xl p-2 shadow-lg">
              <div className="flex-1 flex items-center px-4">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <Input
                  type="text"
                  placeholder="Search for events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 focus-visible:ring-0 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <Button 
                type="submit"
                className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl px-8"
              >
                Search Events
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-8">Browse by Category</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-28" />
              ))
            ) : (
              categories.slice(0, 5).map((category) => (
                <Card 
                  key={category.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-[#0F0F0F]/10 rounded-2xl"
                  onClick={() => navigate(`/events?category=${category.slug}`)}
                >
                  <CardContent className="p-5 text-center">
                    <div className="text-3xl mb-2">{category.icon || '🎫'}</div>
                    <h3 className="font-medium text-[#0F0F0F] text-sm">{category.name}</h3>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="py-16 px-4 bg-[#F4F6FA]">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F]">Featured Events</h2>
            <Button 
              variant="ghost" 
              className="text-[#2969FF] hover:text-[#2969FF]/80"
              onClick={() => navigate('/events')}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-2xl h-96" />
              ))
            ) : (
              featuredEvents.map((event) => (
                <Card 
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-0 rounded-2xl bg-white group"
                  onClick={() => navigate(`/event/${event.slug}`)}
                >
                  <div className="relative h-52 bg-gray-100">
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 font-medium shadow-sm">
                      {event.category?.name || 'Event'}
                    </Badge>
                  </div>
                  
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-lg text-[#0F0F0F] mb-3 line-clamp-1">
                      {event.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(event.start_date)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-4">
                      <MapPin className="w-4 h-4" />
                      {event.venue_name}
                    </div>
                    
                    <div className="border-t border-[#0F0F0F]/10 pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#2969FF] text-lg">
                          {formatPrice(event)}
                        </span>
                        <Button 
                          size="sm"
                          className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-full px-5"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/event/${event.slug}`)
                          }}
                        >
                          Get Tickets
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[#2969FF] mb-2">10K+</div>
              <div className="text-[#0F0F0F]/60">Events Hosted</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#2969FF] mb-2">500K+</div>
              <div className="text-[#0F0F0F]/60">Tickets Sold</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#2969FF] mb-2">15+</div>
              <div className="text-[#0F0F0F]/60">African Countries</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#2969FF] mb-2">4.9</div>
              <div className="text-[#0F0F0F]/60">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-[#F4F6FA]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0F0F0F] text-center mb-12">Why Choose Ticketrack?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure Payments</h3>
              <p className="text-[#0F0F0F]/60">Your transactions are protected with bank-level security and encryption.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Tickets</h3>
              <p className="text-[#0F0F0F]/60">Get your tickets instantly via email and SMS with QR codes for easy entry.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Best Prices</h3>
              <p className="text-[#0F0F0F]/60">We offer competitive pricing with no hidden fees. What you see is what you pay.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#2969FF] to-[#1a4fd8] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-white/80 mb-8">
            Join thousands of event-goers discovering amazing experiences
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/signup')}
              className="bg-white text-[#2969FF] hover:bg-white/90 rounded-xl px-8 py-6 text-lg font-semibold"
            >
              Sign Up Now
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/events')}
              className="border-2 border-white text-white bg-transparent hover:bg-white/10 rounded-xl px-8 py-6 text-lg font-semibold"
            >
              Browse Events
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
