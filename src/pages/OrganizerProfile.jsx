import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { formatDate } from '../lib/utils'
import { 
  CheckCircle, MapPin, Calendar, Users, Star, 
  Globe, Instagram, Twitter, Facebook, ExternalLink,
  Bell, BellOff
} from 'lucide-react'

export default function OrganizerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const [organizer, setOrganizer] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    fetchOrganizer()
  }, [id])

  const fetchOrganizer = async () => {
    const [organizerRes, eventsRes] = await Promise.all([
      supabase
        .from('organizers')
        .select('*, countries(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('events')
        .select('*, categories(name), countries(currency_symbol)')
        .eq('organizer_id', id)
        .eq('status', 'published')
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(6)
    ])

    if (organizerRes.data) {
      setOrganizer(organizerRes.data)
      setFollowerCount(organizerRes.data.follower_count || 0)
    }
    if (eventsRes.data) setEvents(eventsRes.data)

    // Check if following
    if (user) {
      const { data: follow } = await supabase
        .from('followers')
        .select('id')
        .eq('organizer_id', id)
        .eq('user_id', user.id)
        .single()
      setIsFollowing(!!follow)
    }

    setLoading(false)
  }

  const toggleFollow = async () => {
    if (!user) return

    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('organizer_id', id)
        .eq('user_id', user.id)
      setFollowerCount(prev => prev - 1)
    } else {
      await supabase
        .from('followers')
        .insert({ organizer_id: id, user_id: user.id })
      setFollowerCount(prev => prev + 1)
    }
    setIsFollowing(!isFollowing)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!organizer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Organizer Not Found</h2>
          <Link to="/events">
            <Button className="mt-6">Browse Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center overflow-hidden">
              {organizer.logo_url ? (
                <img src={organizer.logo_url} alt={organizer.business_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-primary-500">
                  {organizer.business_name?.charAt(0)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <h1 className="text-3xl font-bold">{organizer.business_name}</h1>
                {organizer.is_verified && (
                  <CheckCircle className="w-6 h-6 text-blue-300" />
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-primary-100 mb-4">
                {organizer.countries?.name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {organizer.countries.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {followerCount} followers
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {organizer.total_events || 0} events
                </span>
              </div>

              {/* Verification Badge */}
              {organizer.is_verified && (
                <Badge variant="info" className="bg-blue-400/30 text-white">
                  ✓ Verified Organizer
                </Badge>
              )}
            </div>

            {/* Follow Button */}
            <div>
              {user ? (
                <Button
                  onClick={toggleFollow}
                  variant={isFollowing ? 'outline' : 'secondary'}
                  className={isFollowing ? 'border-white text-white hover:bg-white hover:text-primary-500' : 'bg-white text-primary-500'}
                >
                  {isFollowing ? (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Following
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant="secondary" className="bg-white text-primary-500">
                    <Bell className="w-4 h-4 mr-2" />
                    Follow
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            {/* About */}
            <Card className="p-6 mb-6">
              <h3 className="font-bold mb-4">About</h3>
              <p className="text-gray-600 text-sm">
                {organizer.description || 'This organizer hasn\'t added a description yet.'}
              </p>
            </Card>

            {/* Social Links */}
            {(organizer.website_url || organizer.instagram || organizer.twitter || organizer.facebook) && (
              <Card className="p-6">
                <h3 className="font-bold mb-4">Connect</h3>
                <div className="space-y-3">
                  {organizer.website_url && (
                    <a
                      href={organizer.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-gray-600 hover:text-primary-500 transition"
                    >
                      <Globe className="w-5 h-5" />
                      <span>Website</span>
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </a>
                  )}
                  {organizer.instagram && (
                    <a
                      href={`https://instagram.com/${organizer.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-gray-600 hover:text-pink-500 transition"
                    >
                      <Instagram className="w-5 h-5" />
                      <span>@{organizer.instagram}</span>
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </a>
                  )}
                  {organizer.twitter && (
                    <a
                      href={`https://twitter.com/${organizer.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-gray-600 hover:text-blue-400 transition"
                    >
                      <Twitter className="w-5 h-5" />
                      <span>@{organizer.twitter}</span>
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </a>
                  )}
                  {organizer.facebook && (
                    <a
                      href={`https://facebook.com/${organizer.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition"
                    >
                      <Facebook className="w-5 h-5" />
                      <span>{organizer.facebook}</span>
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Events */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
            
            {events.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming events</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <Link to={`/events/${event.id}`} key={event.id}>
                    <Card className="p-4 hover:shadow-md transition">
                      <div className="flex gap-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl overflow-hidden flex-shrink-0">
                          {event.image_url && (
                            <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Badge variant="primary" className="mb-2">{event.categories?.name}</Badge>
                          <h3 className="font-semibold line-clamp-1">{event.title}</h3>
                          <div className="flex items-center gap-4 text-gray-500 text-sm mt-2">
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
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
