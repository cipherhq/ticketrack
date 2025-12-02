import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Calendar, MapPin, Clock, TrendingUp, History } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'

const mockResults = [
  { id: '1', name: 'Lagos Tech Summit 2024', date: 'Dec 15, 2024', location: 'Eko Convention Center', price: '₦15,000', category: 'Technology', image: 'tech conference' },
  { id: '2', name: 'Afrobeats Festival', date: 'Dec 25, 2024', location: 'Landmark Event Center', price: '₦35,000', category: 'Music', image: 'music festival' },
  { id: '3', name: 'Business Conference 2024', date: 'Dec 20, 2024', location: 'Lagos Business School', price: '₦25,000', category: 'Business', image: 'business conference' },
]

const trendingSearches = ['Tech', 'Music', 'Food Festival', 'Lagos', 'Free Events']
const recentSearches = ['Concert', 'Business workshop', 'Art exhibition']

export function WebSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearchList, setRecentSearchList] = useState(recentSearches)

  const hasResults = query.length > 0
  const searchResults = hasResults ? mockResults.filter(event => 
    event.name.toLowerCase().includes(query.toLowerCase()) || event.category.toLowerCase().includes(query.toLowerCase()) || event.location.toLowerCase().includes(query.toLowerCase())
  ) : []

  const handleSearch = (term) => {
    setQuery(term)
    if (!recentSearchList.includes(term)) {
      setRecentSearchList([term, ...recentSearchList.slice(0, 4)])
    }
  }

  const clearRecent = () => setRecentSearchList([])

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="bg-white border-b border-[#0F0F0F]/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              onFocus={() => setIsFocused(true)}
              placeholder="Search events, venues, or categories..." 
              className="pl-12 pr-10 h-14 rounded-2xl border-[#0F0F0F]/10 text-base focus:ring-2 focus:ring-[#2969FF]" 
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!hasResults ? (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-[#2969FF]" /><h2 className="font-semibold text-[#0F0F0F]">Trending Searches</h2></div>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term, index) => (
                  <Badge key={index} variant="outline" onClick={() => handleSearch(term)} className="cursor-pointer hover:bg-[#2969FF]/10 hover:border-[#2969FF] transition-colors px-4 py-2 rounded-xl border-[#0F0F0F]/10 text-[#0F0F0F]">
                    {term}
                  </Badge>
                ))}
              </div>
            </div>

            {recentSearchList.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><History className="w-5 h-5 text-[#0F0F0F]/60" /><h2 className="font-semibold text-[#0F0F0F]">Recent Searches</h2></div>
                  <button onClick={clearRecent} className="text-sm text-[#2969FF] hover:underline">Clear all</button>
                </div>
                <div className="space-y-2">
                  {recentSearchList.map((term, index) => (
                    <button key={index} onClick={() => handleSearch(term)} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white transition-colors text-left">
                      <Clock className="w-4 h-4 text-[#0F0F0F]/40" />
                      <span className="text-[#0F0F0F]/80">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#0F0F0F]/60 mb-4">{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for "{query}"</p>
            {searchResults.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="py-16 text-center">
                  <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                  <p className="text-[#0F0F0F]/60 mb-6">No events found for "{query}"</p>
                  <Button onClick={() => navigate('/events')} variant="outline" className="rounded-xl border-[#0F0F0F]/10">Browse All Events</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {searchResults.map((event) => (
                  <Card key={event.id} onClick={() => navigate(`/event/${event.id}`)} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-48 h-32 flex-shrink-0">
                          <ImageWithFallback src={`https://source.unsplash.com/400x300/?${event.image}`} alt={event.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 p-4">
                          <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg mb-2">{event.category}</Badge>
                          <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">{event.name}</h3>
                          <div className="flex flex-wrap gap-4 text-sm text-[#0F0F0F]/60 mb-3">
                            <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{event.date}</div>
                            <div className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</div>
                          </div>
                          <div className="text-lg font-bold text-[#2969FF]">From {event.price}</div>
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
