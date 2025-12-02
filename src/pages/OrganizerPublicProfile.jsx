import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Calendar, MapPin, Star, ExternalLink, Mail, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'

const mockOrganizer = { id: '1', name: 'Tech Events NG', tagline: 'Bringing the best tech experiences to Africa', description: 'Tech Events NG is a leading event organization company focused on creating memorable tech experiences across Africa. We specialize in conferences, workshops, and networking events.', logo: null, cover: 'tech conference stage', website: 'https://techeventsng.com', email: 'hello@techeventsng.com', location: 'Lagos, Nigeria', followers: 5420, eventsHosted: 48, totalAttendees: 125000, rating: 4.8, verified: true }

const mockUpcomingEvents = [
  { id: '1', name: 'Lagos Tech Summit 2024', date: 'December 15, 2024', location: 'Eko Convention Center', price: '₦15,000', image: 'tech conference' },
  { id: '2', name: 'Developer Workshop', date: 'January 20, 2025', location: 'The Zone, Lagos', price: '₦5,000', image: 'coding workshop' },
]

const mockPastEvents = [
  { id: '3', name: 'AI Conference 2024', date: 'October 15, 2024', location: 'Landmark Event Center', attendees: 3500, image: 'ai conference' },
  { id: '4', name: 'Startup Pitch Night', date: 'September 8, 2024', location: 'The Zone, Lagos', attendees: 800, image: 'startup pitch' },
]

export function OrganizerPublicProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [isFollowing, setIsFollowing] = useState(false)
  const organizer = mockOrganizer

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="relative h-64 md:h-80">
        <ImageWithFallback src={`https://source.unsplash.com/1600x400/?${organizer.cover}`} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 mb-8">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Avatar className="w-32 h-32 border-4 border-white shadow-lg -mt-16 md:-mt-20">
                  <AvatarImage src={organizer.logo} />
                  <AvatarFallback className="bg-[#2969FF] text-white text-3xl">{organizer.name[0]}</AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-[#0F0F0F]">{organizer.name}</h1>
                        {organizer.verified && <Badge className="bg-[#2969FF] text-white border-0 rounded-lg">Verified</Badge>}
                      </div>
                      <p className="text-[#0F0F0F]/60 mb-2">{organizer.tagline}</p>
                      <div className="flex items-center gap-4 text-sm text-[#0F0F0F]/60">
                        <div className="flex items-center gap-1"><MapPin className="w-4 h-4" />{organizer.location}</div>
                        <div className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500" />{organizer.rating}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="rounded-xl border-[#0F0F0F]/10"><Share2 className="w-5 h-5" /></Button>
                      <Button onClick={() => setIsFollowing(!isFollowing)} className={`rounded-xl ${isFollowing ? 'bg-[#0F0F0F]/10 text-[#0F0F0F] hover:bg-[#0F0F0F]/20' : 'bg-[#2969FF] hover:bg-[#2969FF]/90 text-white'}`}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><div className="text-2xl font-bold text-[#0F0F0F]">{organizer.eventsHosted}</div><div className="text-sm text-[#0F0F0F]/60">Events</div></div>
                    <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><div className="text-2xl font-bold text-[#0F0F0F]">{(organizer.totalAttendees / 1000).toFixed(0)}k+</div><div className="text-sm text-[#0F0F0F]/60">Attendees</div></div>
                    <div className="text-center p-4 bg-[#F4F6FA] rounded-xl"><div className="text-2xl font-bold text-[#0F0F0F]">{(organizer.followers / 1000).toFixed(1)}k</div><div className="text-sm text-[#0F0F0F]/60">Followers</div></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          <aside className="lg:col-span-1 space-y-6">
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-6">
                <h2 className="font-semibold text-[#0F0F0F] mb-4">About</h2>
                <p className="text-[#0F0F0F]/70 text-sm leading-relaxed">{organizer.description}</p>
              </CardContent>
            </Card>

            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-[#0F0F0F] mb-4">Contact</h2>
                {organizer.website && (
                  <a href={organizer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[#2969FF] hover:underline">
                    <ExternalLink className="w-5 h-5" /><span className="text-sm">{organizer.website.replace('https://', '')}</span>
                  </a>
                )}
                {organizer.email && (
                  <a href={`mailto:${organizer.email}`} className="flex items-center gap-3 text-[#0F0F0F]/70 hover:text-[#2969FF]">
                    <Mail className="w-5 h-5" /><span className="text-sm">{organizer.email}</span>
                  </a>
                )}
              </CardContent>
            </Card>
          </aside>

          <main className="lg:col-span-2">
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
                <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Upcoming ({mockUpcomingEvents.length})</TabsTrigger>
                <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Past ({mockPastEvents.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-4">
                {mockUpcomingEvents.map(event => (
                  <Card key={event.id} onClick={() => navigate(`/event/${event.id}`)} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex gap-4">
                        <div className="w-40 h-28 flex-shrink-0"><ImageWithFallback src={`https://source.unsplash.com/400x300/?${event.image}`} alt={event.name} className="w-full h-full object-cover" /></div>
                        <div className="flex-1 p-4">
                          <h3 className="font-semibold text-[#0F0F0F] mb-2">{event.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-1"><Calendar className="w-4 h-4" />{event.date}</div>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-3"><MapPin className="w-4 h-4" />{event.location}</div>
                          <span className="font-semibold text-[#2969FF]">From {event.price}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="past" className="space-y-4">
                {mockPastEvents.map(event => (
                  <Card key={event.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex gap-4">
                        <div className="w-40 h-28 flex-shrink-0 relative">
                          <ImageWithFallback src={`https://source.unsplash.com/400x300/?${event.image}`} alt={event.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30" />
                        </div>
                        <div className="flex-1 p-4">
                          <h3 className="font-semibold text-[#0F0F0F] mb-2">{event.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-1"><Calendar className="w-4 h-4" />{event.date}</div>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-1"><MapPin className="w-4 h-4" />{event.location}</div>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60"><Users className="w-4 h-4" />{event.attendees.toLocaleString()} attendees</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  )
}
