import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Calendar, MapPin, Star, ExternalLink, Mail, Share2, Loader2, AlertCircle, Twitter, Facebook, Instagram, Linkedin } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/config/currencies'

export function OrganizerPublicProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  
  const [organizer, setOrganizer] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  useEffect(() => {
    checkCurrentUser()
    if (id) {
      fetchOrganizerData()
    }
  }, [id])

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    if (user && id) {
      checkIfFollowing(user.id)
      
      // Check if this is the user's own organizer profile
      const { data: ownOrganizer } = await supabase
        .from('organizers')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', id)
        .maybeSingle()
      
      setIsOwnProfile(!!ownOrganizer)
    }
  }

  const checkIfFollowing = async (userId) => {
    if (!userId || !id) {
      setIsFollowing(false)
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('user_id', userId)
        .eq('organizer_id', id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no row found
      
      setIsFollowing(!!data && !error)
    } catch (err) {
      // Not following - that's fine
      setIsFollowing(false)
    }
  }

  const fetchOrganizerData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Only select public-safe fields (exclude sensitive: user_id, balances, kyc_status, stripe_connect_id, etc.)
      const { data: orgData, error: orgError } = await supabase
        .from('organizers')
        .select(`
          id,
          business_name,
          business_email,
          business_phone,
          description,
          logo_url,
          cover_image_url,
          banner_url,
          website_url,
          website,
          social_twitter,
          social_facebook,
          social_instagram,
          social_linkedin,
          twitter,
          facebook,
          instagram,
          linkedin,
          country_code,
          location,
          is_verified,
          verification_level,
          verified_at,
          is_active,
          total_events,
          total_tickets_sold,
          total_revenue,
          average_rating,
          created_at,
          is_trusted,
          trusted_at
        `)
        .eq('id', id)
        .single()
      
      if (orgError) throw orgError
      if (!orgData) throw new Error('Organizer not found')
      
      setOrganizer(orgData)
      
      const { count: followCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('organizer_id', id)
      
      setFollowersCount(followCount || 0)
      
      const now = new Date().toISOString()
      const { data: upcomingData } = await supabase
        .from('events')
        .select('id, title, image_url, venue_name, start_date, currency, status, ticket_types (price)')
        .eq('organizer_id', id)
        .gte('start_date', now)
        .eq('status', 'published')
        .order('start_date', { ascending: true })
      
      const upcomingWithPrices = (upcomingData || []).map(event => ({
        ...event,
        minPrice: event.ticket_types?.length > 0 
          ? Math.min(...event.ticket_types.map(t => parseFloat(t.price) || 0))
          : 0
      }))
      
      setUpcomingEvents(upcomingWithPrices)
      
      const { data: pastData } = await supabase
        .from('events')
        .select('id, title, image_url, venue_name, start_date, ticket_types (quantity_sold)')
        .eq('organizer_id', id)
        .lt('start_date', now)
        .order('start_date', { ascending: false })
        .limit(10)
      
      const pastWithAttendees = (pastData || []).map(event => ({
        ...event,
        attendees: event.ticket_types?.reduce((sum, t) => sum + (t.quantity_sold || 0), 0) || 0
      }))
      
      setPastEvents(pastWithAttendees)
      
    } catch (err) {
      console.error('Error fetching organizer:', err)
      setError(err.message || 'Failed to load organizer profile')
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!currentUser) {
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    
    // Check if user is trying to follow their own organizer profile
    const { data: ownOrganizer } = await supabase
      .from('organizers')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('id', id)
      .maybeSingle()
    
    if (ownOrganizer) {
      toast.info("You cannot follow your own organizer profile")
      return
    }
    
    setFollowLoading(true)
    
    try {
      if (isFollowing) {
        await supabase.from('followers').delete().eq('user_id', currentUser.id).eq('organizer_id', id)
        setIsFollowing(false)
        setFollowersCount(prev => Math.max(0, prev - 1))
      } else {
        await supabase.from('followers').insert({ user_id: currentUser.id, organizer_id: id, notifications_enabled: true })
        setIsFollowing(true)
        setFollowersCount(prev => prev + 1)
        
        // Send notification emails for new follower
        try {
          // Get user profile for follower name
          const { data: followerProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', currentUser.id)
            .single()
          
          // Get organizer profile for email
          const { data: orgProfile } = await supabase
            .from('organizers')
            .select('email, profiles(email)')
            .eq('id', id)
            .single()
          
          const organizerEmail = orgProfile?.email || orgProfile?.profiles?.email
          
          // Notify organizer of new follower
          if (organizerEmail) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'new_follower',
                to: organizerEmail,
                data: {
                  organizerName: organizer?.business_name,
                  followerName: followerProfile?.full_name || 'Someone',
                  totalFollowers: followersCount + 1,
                  appUrl: window.location.origin
                }
              }
            })
          }
          
          // Notify user they're now following
          if (followerProfile?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'following_organizer',
                to: followerProfile.email,
                data: {
                  userName: followerProfile.full_name || 'there',
                  organizerName: organizer?.business_name,
                  organizerSlug: organizer?.slug || id,
                  appUrl: window.location.origin
                }
              }
            })
          }
        } catch (emailErr) {
          console.error('Failed to send follow notification emails:', emailErr)
          // Don't fail the follow action if emails fail
        }
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: organizer?.business_name, text: 'Check out ' + organizer?.business_name + ' on Ticketrack', url })
      } catch (err) {
        // User cancelled share dialog - expected behavior, no action needed
      }
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
    }
  }

  const formatEventDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'k'
    return num?.toString() || '0'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading organizer profile...</p>
        </div>
      </div>
    )
  }

  if (error || !organizer) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Card className="border-border/10 rounded-2xl max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Organizer Not Found</h2>
            <p className="text-muted-foreground mb-6">{error || 'This organizer profile does not exist or has been removed.'}</p>
            <Button onClick={() => navigate('/')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const coverImage = organizer.cover_image_url || organizer.banner_url

  return (
    <div className="min-h-screen bg-muted">
      <div className="relative h-64 md:h-80">
        {coverImage ? (
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2969FF] to-[#1e4fc9]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 mb-8">
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Avatar className="w-32 h-32 border-4 border-white shadow-lg -mt-16 md:-mt-20">
                  <AvatarImage src={organizer.logo_url} />
                  <AvatarFallback className="bg-[#2969FF] text-white text-3xl">{organizer.business_name?.[0] || 'O'}</AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-foreground">{organizer.business_name}</h1>
                        {organizer.is_verified && <Badge className="bg-[#2969FF] text-white border-0 rounded-lg">Verified</Badge>}
                      </div>
                      {organizer.description && <p className="text-muted-foreground mb-2 line-clamp-2">{organizer.description}</p>}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {organizer.location && <div className="flex items-center gap-1"><MapPin className="w-4 h-4" />{organizer.location}</div>}
                        {organizer.average_rating > 0 && <div className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500" />{parseFloat(organizer.average_rating).toFixed(1)}</div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="rounded-xl border-border/10" onClick={handleShare}><Share2 className="w-5 h-5" /></Button>
                      {!isOwnProfile && (
                        <Button onClick={handleFollow} disabled={followLoading} className={`rounded-xl ${isFollowing ? 'bg-[#0F0F0F]/10 text-foreground hover:bg-[#0F0F0F]/20' : 'bg-[#2969FF] hover:bg-[#2969FF]/90 text-white'}`}>
                          {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? 'Following' : 'Follow'}
                        </Button>
                      )}
                      {isOwnProfile && (
                        <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0">Your Profile</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="text-2xl font-bold text-foreground">{organizer.total_events || 0}</div><div className="text-sm text-muted-foreground">Events</div></div>
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="text-2xl font-bold text-foreground">{formatNumber(organizer.total_tickets_sold || 0)}</div><div className="text-sm text-muted-foreground">Attendees</div></div>
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="text-2xl font-bold text-foreground">{formatNumber(followersCount)}</div><div className="text-sm text-muted-foreground">Followers</div></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          <aside className="lg:col-span-1 space-y-6">
            {organizer.description && (
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-foreground mb-4">About</h2>
                  <p className="text-foreground/70 text-sm leading-relaxed">{organizer.description}</p>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-foreground mb-4">Contact</h2>
                {(organizer.website_url || organizer.website) && (
                  <a href={organizer.website_url || organizer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[#2969FF] hover:underline">
                    <ExternalLink className="w-5 h-5" /><span className="text-sm truncate">{(organizer.website_url || organizer.website).replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {(organizer.business_email || organizer.email) && (
                  <a href={'mailto:' + (organizer.business_email || organizer.email)} className="flex items-center gap-3 text-foreground/70 hover:text-[#2969FF]">
                    <Mail className="w-5 h-5" /><span className="text-sm truncate">{organizer.business_email || organizer.email}</span>
                  </a>
                )}
              </CardContent>
            </Card>

            {(organizer.social_twitter || organizer.twitter || organizer.social_facebook || organizer.facebook || organizer.social_instagram || organizer.instagram || organizer.social_linkedin || organizer.linkedin) && (
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-foreground mb-4">Social</h2>
                  <div className="flex gap-3">
                    {(organizer.social_twitter || organizer.twitter) && <a href={'https://twitter.com/' + (organizer.social_twitter || organizer.twitter)} target="_blank" rel="noopener noreferrer" className="p-2 bg-muted rounded-lg hover:bg-[#2969FF]/10 transition-colors"><Twitter className="w-5 h-5 text-foreground/70" /></a>}
                    {(organizer.social_facebook || organizer.facebook) && <a href={'https://facebook.com/' + (organizer.social_facebook || organizer.facebook)} target="_blank" rel="noopener noreferrer" className="p-2 bg-muted rounded-lg hover:bg-[#2969FF]/10 transition-colors"><Facebook className="w-5 h-5 text-foreground/70" /></a>}
                    {(organizer.social_instagram || organizer.instagram) && <a href={'https://instagram.com/' + (organizer.social_instagram || organizer.instagram)} target="_blank" rel="noopener noreferrer" className="p-2 bg-muted rounded-lg hover:bg-[#2969FF]/10 transition-colors"><Instagram className="w-5 h-5 text-foreground/70" /></a>}
                    {(organizer.social_linkedin || organizer.linkedin) && <a href={'https://linkedin.com/in/' + (organizer.social_linkedin || organizer.linkedin)} target="_blank" rel="noopener noreferrer" className="p-2 bg-muted rounded-lg hover:bg-[#2969FF]/10 transition-colors"><Linkedin className="w-5 h-5 text-foreground/70" /></a>}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>

          <main className="lg:col-span-2">
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList className="bg-card border border-border/10 rounded-xl p-1">
                <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Upcoming ({upcomingEvents.length})</TabsTrigger>
                <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Past ({pastEvents.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <Card className="border-border/10 rounded-2xl">
                    <CardContent className="p-8 text-center">
                      <Calendar className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground">No upcoming events</p>
                      <p className="text-sm text-muted-foreground mt-1">Follow this organizer to get notified of new events</p>
                    </CardContent>
                  </Card>
                ) : (
                  upcomingEvents.map(event => (
                    <Card key={event.id} onClick={() => navigate('/e/' + (event.slug || event.id))} className="border-border/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="flex gap-4">
                          <div className="w-40 h-28 flex-shrink-0"><ImageWithFallback src={event.image_url} alt={event.title} className="w-full h-full object-cover" /></div>
                          <div className="flex-1 p-4">
                            <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{event.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Calendar className="w-4 h-4" />{formatEventDate(event.start_date)}</div>
                            {event.venue_name && <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3"><MapPin className="w-4 h-4" />{event.venue_name}</div>}
                            <span className="font-semibold text-[#2969FF]">{event.minPrice === 0 ? 'Free' : 'From ' + formatPrice(event.minPrice, event.currency)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-4">
                {pastEvents.length === 0 ? (
                  <Card className="border-border/10 rounded-2xl">
                    <CardContent className="p-8 text-center">
                      <Calendar className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground">No past events</p>
                    </CardContent>
                  </Card>
                ) : (
                  pastEvents.map(event => (
                    <Card key={event.id} className="border-border/10 rounded-2xl overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex gap-4">
                          <div className="w-40 h-28 flex-shrink-0 relative">
                            <ImageWithFallback src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30" />
                          </div>
                          <div className="flex-1 p-4">
                            <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{event.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Calendar className="w-4 h-4" />{formatEventDate(event.start_date)}</div>
                            {event.venue_name && <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><MapPin className="w-4 h-4" />{event.venue_name}</div>}
                            {event.attendees > 0 && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-4 h-4" />{event.attendees.toLocaleString()} attendees</div>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  )
}
