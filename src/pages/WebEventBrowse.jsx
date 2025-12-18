import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Calendar, MapPin, SlidersHorizontal, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getEvents, getCategories, getCities } from '@/services/events'

export function WebEventBrowse() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [sortBy, setSortBy] = useState('date')
  const [selectedCategories, setSelectedCategories] = useState(
    searchParams.get('category') ? [searchParams.get('category')] : []
  )
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '')
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [categoriesData, citiesData] = await Promise.all([
          getCategories(),
          getCities()
        ])
        setCategories(categoriesData)
        setCities(citiesData)
      } catch (error) {
        console.error('Error loading filter data:', error)
      }
    }
    loadData()
  }, [])

  // Load events based on filters
  useEffect(() => {
    async function loadEvents() {
      setLoading(true)
      try {
        const categoryId = selectedCategories.length === 1 
          ? categories.find(c => c.slug === selectedCategories[0])?.id 
          : null
        
        const eventsData = await getEvents({
          search: searchTerm || null,
          category: categoryId,
          city: selectedCity || null,
          limit: 20
        })
        
        // Sort events
        let sortedEvents = [...eventsData]
        if (sortBy === 'date') {
          sortedEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        } else if (sortBy === 'price-low') {
          sortedEvents.sort((a, b) => (a.is_free ? 0 : 1) - (b.is_free ? 0 : 1))
        } else if (sortBy === 'price-high') {
          sortedEvents.sort((a, b) => (b.is_free ? 0 : 1) - (a.is_free ? 0 : 1))
        } else if (sortBy === 'popular') {
          sortedEvents.sort((a, b) => (b.tickets_sold || 0) - (a.tickets_sold || 0))
        }
        
        setEvents(sortedEvents)
      } catch (error) {
        console.error('Error loading events:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (categories.length > 0) {
      loadEvents()
    }
  }, [searchTerm, selectedCategories, selectedCity, sortBy, categories])

  const handleCategoryToggle = (categorySlug) => {
    setSelectedCategories(prev => 
      prev.includes(categorySlug) 
        ? prev.filter(c => c !== categorySlug) 
        : [...prev, categorySlug]
    )
  }

  const handleSearch = (e) => {
    e.preventDefault()
    // Update URL params
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (selectedCategories.length === 1) params.set('category', selectedCategories[0])
    if (selectedCity) params.set('city', selectedCity)
    setSearchParams(params)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }


  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedCity('')
    setMinPrice("")
    setMaxPrice("")
    setSearchTerm('')
    setSearchParams({})
  }

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-medium text-[#0F0F0F] mb-4">Categories</h3>
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

      {/* Cities */}
      <div className="pt-6 border-t border-[#0F0F0F]/10">
        <h3 className="font-medium text-[#0F0F0F] mb-4">City</h3>
        <div className="space-y-3">
          {cities.map(city => (
            <div key={city} className="flex items-center space-x-2">
              <Checkbox 
                id={`city-${city}`} 
                checked={selectedCity === city} 
                onCheckedChange={() => setSelectedCity(selectedCity === city ? '' : city)} 
              />
              <Label htmlFor={`city-${city}`} className="cursor-pointer">{city}</Label>
            </div>
          ))}
        </div>
      </div>
      {/* Price Range */}
      <div className="pt-6 border-t border-[#0F0F0F]/10">
        <h3 className="font-medium text-[#0F0F0F] mb-4">Price Range</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-[#0F0F0F]/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
            />
            <span className="text-[#0F0F0F]/40">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-[#0F0F0F]/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
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

      {/* Clear Filters */}
      <div className="pt-6 border-t border-[#0F0F0F]/10">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">Browse Events</h1>
        <p className="text-[#0F0F0F]/60">Discover amazing events happening near you</p>
      </div>

      {/* Search and Sort */}
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
          <Input 
            placeholder="Search events..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10 rounded-xl border-[#0F0F0F]/10" 
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="md:w-48 rounded-xl border-[#0F0F0F]/10">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Mobile Filter Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden rounded-xl border-[#0F0F0F]/10">
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
      </form>

      {/* Main Content */}
      <div className="flex gap-8">
        {/* Desktop Sidebar Filters */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <h2 className="text-lg font-semibold text-[#0F0F0F] mb-4">Filters</h2>
            <FilterPanel />
          </div>
        </div>

        {/* Events Grid */}
        <div className="flex-1">
          {/* Active Filters */}
          {(selectedCategories.length > 0 || selectedCity) && (
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
              {selectedCity && (
                <Badge 
                  variant="secondary" 
                  className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg px-3 py-1 cursor-pointer"
                  onClick={() => setSelectedCity('')}
                >
                  📍 {selectedCity} ✕
                </Badge>
              )}
            </div>
          )}

          {/* Results Count */}
          <p className="text-[#0F0F0F]/60 mb-6">
            {loading ? 'Loading...' : `${events.length} events found`}
          </p>

          {/* Events Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-80" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎫</div>
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No events found</h3>
              <p className="text-[#0F0F0F]/60 mb-6">Try adjusting your filters or search terms</p>
              <Button onClick={clearFilters} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card 
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-0 rounded-2xl bg-white group"
                  onClick={() => navigate(`/event/${event.slug}`)}
                >
                  <div className="relative h-48 bg-gray-100">
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 font-medium shadow-sm">
                      {event.category?.name || 'Event'}
                    </Badge>
                    {event.is_free && (
                      <Badge className="absolute top-4 right-4 bg-green-500 text-white border-0">
                        Free
                      </Badge>
                    )}
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
                      {event.venue_name}, {event.city}
                    </div>
                    
                    <div className="border-t border-[#0F0F0F]/10 pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#2969FF] text-lg">
                          {event.is_free ? "Free" : formatPrice(event.min_price, event.currency)}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
