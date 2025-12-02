import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Calendar, MapPin, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'

const mockEvents = [
  { id: '1', name: 'Lagos Tech Summit 2024', date: 'Dec 15, 2024', location: 'Eko Convention Center', city: 'Lagos', category: 'Technology', price: 'From ₦15,000', priceValue: 15000, image: 'tech conference' },
  { id: '2', name: 'Afrobeats Festival', date: 'Dec 25, 2024', location: 'Landmark Event Center', city: 'Lagos', category: 'Music', price: 'From ₦35,000', priceValue: 35000, image: 'music festival' },
  { id: '3', name: 'Business Conference 2024', date: 'Dec 20, 2024', location: 'Lagos Business School', city: 'Lagos', category: 'Business', price: 'From ₦25,000', priceValue: 25000, image: 'business conference' },
  { id: '4', name: 'Art Exhibition', date: 'Dec 18, 2024', location: 'Nike Art Gallery', city: 'Lagos', category: 'Art', price: 'Free', priceValue: 0, image: 'art exhibition' },
  { id: '5', name: 'Food Festival Abuja', date: 'Dec 22, 2024', location: 'Millennium Park', city: 'Abuja', category: 'Food', price: 'From ₦10,000', priceValue: 10000, image: 'food festival' },
  { id: '6', name: 'Sports Tournament', date: 'Dec 28, 2024', location: 'National Stadium', city: 'Lagos', category: 'Sports', price: 'From ₦5,000', priceValue: 5000, image: 'sports event' },
]

const categories = ['Technology', 'Music', 'Business', 'Sports', 'Art', 'Food']
const priceRanges = ['Free', 'Under ₦10,000', '₦10,000 - ₦30,000', 'Above ₦30,000']

export function WebEventBrowse() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [priceRange, setPriceRange] = useState([])

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category])
  }

  const handlePriceToggle = (range) => {
    setPriceRange(prev => prev.includes(range) ? prev.filter(r => r !== range) : [...prev, range])
  }

  const filteredEvents = mockEvents.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(event.category)
    return matchesSearch && matchesCategory
  })

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-[#0F0F0F] mb-4">Categories</h3>
        <div className="space-y-3">
          {categories.map(category => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox id={`cat-${category}`} checked={selectedCategories.includes(category)} onCheckedChange={() => handleCategoryToggle(category)} />
              <Label htmlFor={`cat-${category}`} className="cursor-pointer">{category}</Label>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-6 border-t border-[#0F0F0F]/10">
        <h3 className="font-medium text-[#0F0F0F] mb-4">Price Range</h3>
        <div className="space-y-3">
          {priceRanges.map(range => (
            <div key={range} className="flex items-center space-x-2">
              <Checkbox id={`price-${range}`} checked={priceRange.includes(range)} onCheckedChange={() => handlePriceToggle(range)} />
              <Label htmlFor={`price-${range}`} className="cursor-pointer">{range}</Label>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-6 border-t border-[#0F0F0F]/10">
        <Button variant="outline" className="w-full rounded-xl" onClick={() => { setSelectedCategories([]); setPriceRange([]) }}>Clear All Filters</Button>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">Browse Events</h1>
        <p className="text-[#0F0F0F]/60">Discover amazing events happening near you</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
          <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 rounded-xl border-[#0F0F0F]/10" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="md:w-48 rounded-xl border-[#0F0F0F]/10"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden rounded-xl border-[#0F0F0F]/10"><SlidersHorizontal className="w-5 h-5 mr-2" />Filters</Button>
          </SheetTrigger>
          <SheetContent className="rounded-l-2xl"><SheetHeader><SheetTitle className="text-[#0F0F0F]">Filters</SheetTitle></SheetHeader><div className="mt-6"><FilterPanel /></div></SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-8">
        <aside className="hidden md:block w-64 flex-shrink-0">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6"><Filter className="w-5 h-5 text-[#2969FF]" /><h2 className="font-medium text-[#0F0F0F]">Filters</h2></div>
              <FilterPanel />
            </CardContent>
          </Card>
        </aside>

        <div className="flex-1">
          <div className="mb-4 text-[#0F0F0F]/60">Showing {filteredEvents.length} events</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => (
              <Card key={event.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/event/${event.id}`)}>
                <div className="aspect-video bg-[#F4F6FA] relative overflow-hidden">
                  <ImageWithFallback src={`https://source.unsplash.com/800x600/?${event.image}`} alt={event.name} className="w-full h-full object-cover" />
                  <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 rounded-lg">{event.category}</Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold text-[#0F0F0F] mb-3">{event.name}</h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60"><Calendar className="w-4 h-4" /><span className="text-sm">{event.date}</span></div>
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60"><MapPin className="w-4 h-4" /><span className="text-sm">{event.location}</span></div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-[#0F0F0F]/10">
                    <span className="font-semibold text-[#2969FF]">{event.price}</span>
                    <Button size="sm" className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
