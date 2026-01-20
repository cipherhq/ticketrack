import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, Clock, CheckCircle, ShoppingCart, Loader2, Copy, Share2, 
  MessageCircle, Send, X, Crown, UserPlus, ExternalLink, AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import {
  getGroupSession,
  getMyMembership,
  sendGroupMessage,
  getGroupMessages,
  subscribeToSession,
  getShareableLink,
  formatTimeRemaining,
  leaveGroup
} from '@/services/groupBuy'

const STATUS_CONFIG = {
  invited: { label: 'Invited', color: 'bg-gray-100 text-gray-600', icon: '📨' },
  joined: { label: 'In Lobby', color: 'bg-blue-100 text-blue-700', icon: '👋' },
  selecting: { label: 'Selecting', color: 'bg-yellow-100 text-yellow-700', icon: '🎫' },
  ready: { label: 'Ready', color: 'bg-purple-100 text-purple-700', icon: '✅' },
  paying: { label: 'Paying...', color: 'bg-orange-100 text-orange-700', icon: '💳' },
  completed: { label: 'Purchased!', color: 'bg-green-100 text-green-700', icon: '🎉' },
  dropped: { label: 'Left', color: 'bg-red-100 text-red-600', icon: '👋' },
}

export function GroupBuyLobby({ sessionId, onSelectTickets, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [myMembership, setMyMembership] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)

  // Load session data
  useEffect(() => {
    loadData()
  }, [sessionId])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = subscribeToSession(sessionId, {
      onMemberChange: (payload) => {
        // Reload session to get updated members
        loadData()
      },
      onMessageReceived: (message) => {
        setMessages(prev => [...prev, message])
      },
      onSessionChange: (updatedSession) => {
        setSession(prev => ({ ...prev, ...updatedSession }))
      }
    })

    return () => unsubscribe()
  }, [sessionId])

  // Update countdown timer
  useEffect(() => {
    if (!session?.expires_at) return

    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(session.expires_at)
      setTimeRemaining(remaining)

      if (remaining === 'Expired') {
        setSession(prev => ({ ...prev, status: 'expired' }))
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session?.expires_at])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sessionData, membership, msgs] = await Promise.all([
        getGroupSession(sessionId),
        getMyMembership(sessionId),
        getGroupMessages(sessionId)
      ])
      setSession(sessionData)
      setMyMembership(membership)
      setMessages(msgs)
    } catch (err) {
      console.error('Error loading group session:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    const link = getShareableLink(session.code)
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const link = getShareableLink(session.code)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${session.name}`,
          text: `Join my group to buy tickets for ${session.event?.title}!`,
          url: link
        })
      } catch (err) {
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      await sendGroupMessage(sessionId, newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return
    
    try {
      await leaveGroup(myMembership.id)
      onClose?.()
    } catch (err) {
      console.error('Error leaving group:', err)
    }
  }

  const handleSelectTickets = () => {
    onSelectTickets?.(session, myMembership)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <Card className="border-red-200 rounded-2xl">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Group Not Found</h3>
          <p className="text-[#0F0F0F]/60 mb-4">{error || 'This group session may have expired.'}</p>
          <Button onClick={onClose} className="rounded-xl">Go Back</Button>
        </CardContent>
      </Card>
    )
  }

  const isExpired = session.status === 'expired' || timeRemaining === 'Expired'
  const members = session.members || []
  const completedCount = members.filter(m => m.status === 'completed').length
  const activeMembers = members.filter(m => !['dropped', 'invited'].includes(m.status))

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-[#2969FF]/20 bg-gradient-to-r from-[#2969FF]/5 to-transparent rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {session.event?.image_url && (
                <img 
                  src={session.event.image_url} 
                  alt={session.event.title}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              )}
              <div>
                <p className="text-sm text-[#2969FF] font-medium mb-1">GROUP SESSION</p>
                <h2 className="text-xl font-bold text-[#0F0F0F]">{session.name}</h2>
                <p className="text-[#0F0F0F]/60 text-sm">{session.event?.title}</p>
              </div>
            </div>
            
            {/* Timer */}
            <div className={`text-center px-4 py-2 rounded-xl ${isExpired ? 'bg-red-100' : 'bg-[#0F0F0F]/5'}`}>
              <Clock className={`w-5 h-5 mx-auto mb-1 ${isExpired ? 'text-red-500' : 'text-[#0F0F0F]/60'}`} />
              <p className={`text-lg font-mono font-bold ${isExpired ? 'text-red-600' : 'text-[#0F0F0F]'}`}>
                {timeRemaining}
              </p>
              <p className="text-xs text-[#0F0F0F]/50">remaining</p>
            </div>
          </div>

          {/* Share Section */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 bg-white border border-[#0F0F0F]/10 rounded-xl px-4 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#0F0F0F]/50">Group Code</p>
                <p className="text-lg font-mono font-bold text-[#2969FF]">{session.code}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="rounded-lg"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={handleShare} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
              <Share2 className="w-4 h-4 mr-2" />
              Invite Friends
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members Grid */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-[#2969FF]" />
              Group Members
              <Badge className="bg-[#0F0F0F]/10 text-[#0F0F0F]">
                {activeMembers.length}/{session.max_members}
              </Badge>
            </CardTitle>
            <Badge className="bg-green-100 text-green-700">
              {completedCount} purchased
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {members.map((member) => {
              const status = STATUS_CONFIG[member.status] || STATUS_CONFIG.joined
              const isMe = member.user_id === user?.id
              
              return (
                <div 
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isMe ? 'bg-[#2969FF]/5 border border-[#2969FF]/20' : 'bg-[#F4F6FA]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={isMe ? 'bg-[#2969FF] text-white' : 'bg-[#0F0F0F]/10'}>
                        {member.name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#0F0F0F]">
                          {member.name}
                          {isMe && <span className="text-[#2969FF]"> (You)</span>}
                        </p>
                        {member.is_host && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      {member.selected_tickets?.length > 0 && (
                        <p className="text-xs text-[#0F0F0F]/60">
                          {member.selected_tickets.reduce((sum, t) => sum + t.quantity, 0)} tickets selected
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Badge className={status.color}>
                    <span className="mr-1">{status.icon}</span>
                    {status.label}
                  </Badge>
                </div>
              )
            })}
            
            {/* Invite More */}
            {activeMembers.length < session.max_members && !isExpired && (
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#0F0F0F]/10 text-[#0F0F0F]/50 hover:border-[#2969FF]/30 hover:text-[#2969FF] transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Invite more friends
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {!isExpired && myMembership && !['completed', 'dropped'].includes(myMembership.status) && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowChat(!showChat)}
            className="rounded-xl flex-none"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Chat
            {messages.filter(m => m.message_type === 'chat').length > 0 && (
              <Badge className="ml-2 bg-[#2969FF] text-white text-xs">
                {messages.filter(m => m.message_type === 'chat').length}
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={handleSelectTickets}
            className="flex-1 bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {myMembership.status === 'ready' ? 'Edit Tickets' : 'Select Tickets'}
          </Button>
        </div>
      )}

      {/* Completed State */}
      {myMembership?.status === 'completed' && (
        <Card className="bg-green-50 border-green-200 rounded-2xl">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-green-700 mb-2">You're all set!</h3>
            <p className="text-green-600 mb-4">Your tickets have been purchased successfully.</p>
            <Button onClick={() => navigate('/tickets')} className="bg-green-600 hover:bg-green-700 text-white rounded-xl">
              View My Tickets
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expired State */}
      {isExpired && myMembership?.status !== 'completed' && (
        <Card className="bg-red-50 border-red-200 rounded-2xl">
          <CardContent className="p-6 text-center">
            <Clock className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-red-700 mb-2">Session Expired</h3>
            <p className="text-red-600 mb-4">This group session has ended. You can still purchase tickets individually.</p>
            <Button 
              onClick={() => navigate(`/event/${session.event?.slug}`)} 
              className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Go to Event
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Chat Panel */}
      {showChat && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#2969FF]" />
                Group Chat
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowChat(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-y-auto space-y-2 mb-3 p-2 bg-[#F4F6FA] rounded-xl">
              {messages.length === 0 ? (
                <p className="text-center text-[#0F0F0F]/40 py-8">No messages yet</p>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`text-sm ${
                      msg.message_type === 'system' 
                        ? 'text-center text-[#0F0F0F]/50 italic' 
                        : 'bg-white rounded-lg p-2'
                    }`}
                  >
                    {msg.message_type !== 'system' && (
                      <span className="font-medium text-[#2969FF]">{msg.user_name}: </span>
                    )}
                    {msg.message}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="rounded-xl"
              />
              <Button type="submit" className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave Group */}
      {myMembership && !['completed', 'dropped'].includes(myMembership.status) && !myMembership.is_host && (
        <button
          onClick={handleLeaveGroup}
          className="w-full text-center text-sm text-[#0F0F0F]/40 hover:text-red-500 transition-colors"
        >
          Leave group
        </button>
      )}
    </div>
  )
}
