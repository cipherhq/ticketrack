import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, Clock, CheckCircle, XCircle, AlertCircle, 
  Share2, Loader2, Calendar, MapPin, ChevronRight,
  Plus, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatTimeRemaining, getShareableLink } from '@/services/groupBuy'
import { format } from 'date-fns'
import { toast } from 'sonner'

export function MyGroups() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState({ active: [], completed: [], expired: [] })
  const [invitations, setInvitations] = useState([])

  useEffect(() => {
    if (user) {
      loadGroups()
    }
  }, [user])

  const loadGroups = async () => {
    try {
      setLoading(true)
      
      // Get all group memberships for this user
      const { data: memberships, error } = await supabase
        .from('group_buy_members')
        .select(`
          *,
          session:group_buy_sessions(
            *,
            event:events(id, title, slug, start_date, venue_name, venue_address, city, image_url, is_virtual)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Categorize groups
      const active = []
      const completed = []
      const expired = []

      memberships?.forEach(m => {
        if (!m.session) return
        
        const isExpired = new Date(m.session.expires_at) < new Date()
        const isCompleted = m.status === 'completed' || m.session.status === 'completed'

        if (isCompleted) {
          completed.push(m)
        } else if (isExpired || m.session.status === 'expired') {
          expired.push(m)
        } else if (m.session.status === 'active') {
          active.push(m)
        }
      })

      setGroups({ active, completed, expired })

      // Load pending invitations (sent to user's email)
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()

      if (profile?.email) {
        const { data: pendingInvites } = await supabase
          .from('group_buy_invitations')
          .select(`
            *,
            session:group_buy_sessions(
              *,
              event:events(id, title, slug, start_date, venue_name, venue_address, city, image_url, is_virtual)
            )
          `)
          .eq('email', profile.email.toLowerCase())
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())

        setInvitations(pendingInvites || [])
      }
    } catch (err) {
      console.error('Error loading groups:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvite = async (invite) => {
    navigate(`/group/${invite.session?.code}`)
  }

  const handleDeclineInvite = async (inviteId) => {
    try {
      await supabase
        .from('group_buy_invitations')
        .update({ status: 'declined' })
        .eq('id', inviteId)
      
      setInvitations(prev => prev.filter(i => i.id !== inviteId))
    } catch (err) {
      console.error('Error declining invite:', err)
    }
  }

  const getStatusBadge = (member, session) => {
    if (member.status === 'completed') {
      return <Badge className="bg-green-100 text-green-700">Purchased</Badge>
    }
    if (session.status === 'expired' || new Date(session.expires_at) < new Date()) {
      return <Badge className="bg-muted text-muted-foreground">Expired</Badge>
    }
    if (member.status === 'ready') {
      return <Badge className="bg-blue-100 text-blue-700">Ready to Pay</Badge>
    }
    if (member.status === 'selecting') {
      return <Badge className="bg-yellow-100 text-yellow-700">Selecting</Badge>
    }
    return <Badge className="bg-purple-100 text-purple-700">Active</Badge>
  }

  const GroupCard = ({ membership, showActions = true }) => {
    const session = membership.session
    const event = session?.event
    const isHost = membership.is_host
    const timeLeft = session?.expires_at ? formatTimeRemaining(session.expires_at) : null
    const isActive = session?.status === 'active' && new Date(session.expires_at) > new Date()

    return (
      <Card className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex">
          {/* Event Image */}
          <div 
            className="w-24 h-24 sm:w-32 sm:h-32 bg-cover bg-center flex-shrink-0"
            style={{ backgroundImage: event?.image_url ? `url(${event.image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          />
          
          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">{session?.name || 'Group Session'}</h3>
                  {isHost && <Badge variant="outline" className="text-xs">Host</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">{event?.title}</p>
              </div>
              {getStatusBadge(membership, session)}
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {session?.member_count || 1} member{(session?.member_count || 1) !== 1 ? 's' : ''}
              </span>
              {isActive && timeLeft && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Clock className="w-3 h-3" />
                  {timeLeft} left
                </span>
              )}
              {event?.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(event.start_date), 'MMM d')}
                </span>
              )}
            </div>

            {showActions && isActive && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-lg text-xs"
                  onClick={() => navigate(`/group/${session.code}`)}
                >
                  Open Group
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(getShareableLink(session.code))
                    toast.success('Link copied!')
                  }}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to view your group sessions</p>
            <Button 
              onClick={() => navigate('/login?redirect=/my-groups')}
              className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  const totalGroups = groups.active.length + groups.completed.length + groups.expired.length

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border/10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Groups</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Coordinate ticket purchases with friends
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadGroups}
              className="rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card className="rounded-2xl border-[#2969FF]/20 bg-[#2969FF]/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#2969FF]" />
                Pending Invitations ({invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.map(invite => (
                <div 
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-card rounded-xl"
                >
                  <div>
                    <p className="font-medium">{invite.session?.name || 'Group Session'}</p>
                    <p className="text-sm text-muted-foreground">{invite.session?.event?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invite.inviter_name || 'a friend'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="rounded-lg"
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvite(invite)}
                      className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-lg"
                    >
                      Join
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Groups Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-card rounded-xl p-1">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Active ({groups.active.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white">
              Completed ({groups.completed.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="rounded-lg data-[state=active]:bg-background0 data-[state=active]:text-white">
              Expired ({groups.expired.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {groups.active.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Active Groups</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start a group from any event page to buy tickets with friends
                  </p>
                  <Button
                    onClick={() => navigate('/events')}
                    className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
                  >
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            ) : (
              groups.active.map(m => <GroupCard key={m.id} membership={m} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {groups.completed.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Completed Groups</h3>
                  <p className="text-sm text-muted-foreground">
                    Groups where you've purchased tickets will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              groups.completed.map(m => <GroupCard key={m.id} membership={m} showActions={false} />)
            )}
          </TabsContent>

          <TabsContent value="expired" className="mt-4 space-y-3">
            {groups.expired.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Clock className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Expired Groups</h3>
                  <p className="text-sm text-muted-foreground">
                    Groups that timed out without purchase will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              groups.expired.map(m => <GroupCard key={m.id} membership={m} showActions={false} />)
            )}
          </TabsContent>
        </Tabs>

        {/* How it works */}
        <Card className="rounded-2xl bg-gradient-to-br from-[#2969FF]/5 to-purple-50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2969FF]" />
              How Group Buy Works
            </h3>
            <div className="grid gap-4 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <p className="font-medium">Start a Group</p>
                  <p className="text-muted-foreground">From any event page, click "Buy with Friends" to create a group session</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <p className="font-medium">Invite Friends</p>
                  <p className="text-muted-foreground">Share the group link or send email/SMS invitations</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                <div>
                  <p className="font-medium">Everyone Selects Tickets</p>
                  <p className="text-muted-foreground">Each person picks and pays for their own tickets</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>
                <div>
                  <p className="font-medium">Enjoy Together!</p>
                  <p className="text-muted-foreground">Everyone gets their tickets and you're ready for the event</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default MyGroups
