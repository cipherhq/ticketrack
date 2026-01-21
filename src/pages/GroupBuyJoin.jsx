import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Users, Loader2, AlertCircle, LogIn } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { GroupBuyLobby } from '@/components/GroupBuyLobby'
import { 
  joinGroupSession, 
  getGroupSessionByCode,
  getMyMembership 
} from '@/services/groupBuy'

export function GroupBuyJoin() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [manualCode, setManualCode] = useState(code || '')
  const [session, setSession] = useState(null)
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(!!code)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(code ? 'loading' : 'enter-code') // enter-code, loading, preview, lobby

  // Auto-join if code is in URL
  useEffect(() => {
    if (code) {
      // Always load preview first, then user can click to join
      loadSessionPreview(code)
    }
  }, [code])

  const loadSessionPreview = async (groupCode) => {
    console.log('=== loadSessionPreview started for:', groupCode)
    try {
      setLoading(true)
      setError(null)
      const sessionData = await getGroupSessionByCode(groupCode)
      console.log('=== Session data received:', sessionData)
      if (!sessionData) {
        throw new Error('Group not found')
      }
      console.log('=== Setting session and step to preview')
      setSession(sessionData)
      setStep('preview')
      setLoading(false)
      console.log('=== State updates complete')
    } catch (err) {
      console.error('=== Error loading group:', err)
      setError(err.message || 'Group not found or expired')
      setStep('enter-code')
      setLoading(false)
    }
  }

  const handleJoinWithCode = async (groupCode) => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/group/${groupCode}`)
      return
    }

    try {
      setJoining(true)
      setError(null)
      
      // Try to join the group
      const result = await joinGroupSession(groupCode)
      
      // Load full session and membership
      const [sessionData, membershipData] = await Promise.all([
        getGroupSessionByCode(groupCode),
        getMyMembership(result.session_id)
      ])
      
      setSession(sessionData)
      setMembership(membershipData)
      setStep('lobby')
    } catch (err) {
      console.error('Error joining group:', err)
      setError(err.message)
      setStep('enter-code')
    } finally {
      setJoining(false)
    }
  }

  const handleCodeSubmit = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    
    const cleanCode = manualCode.trim().toUpperCase()
    navigate(`/group/${cleanCode}`)
  }

  const handleSelectTickets = (session, membership) => {
    // Navigate to checkout with group context
    navigate(`/event/${session.event?.slug}`, {
      state: {
        groupSession: session,
        groupMembership: membership
      }
    })
  }

  // Debug logging
  console.log('=== Render state:', { step, loading, joining, hasSession: !!session, error })

  // Loading state
  if (loading && step === 'loading') {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">Loading group...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Lobby view (after joining)
  if (step === 'lobby' && session) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <GroupBuyLobby 
            sessionId={session.id}
            onSelectTickets={handleSelectTickets}
            onClose={() => navigate('/')}
          />
        </div>
      </div>
    )
  }

  // Preview view (before login)
  if (step === 'preview' && session) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl overflow-hidden">
          {session.event?.image_url && (
            <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${session.event.image_url})` }} />
          )}
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h1 className="text-2xl font-bold text-[#0F0F0F] mb-2">Join Group</h1>
              <p className="text-[#0F0F0F]/60">{session.name}</p>
            </div>

            <div className="bg-[#F4F6FA] rounded-xl p-4 mb-6">
              <p className="text-sm text-[#0F0F0F]/60 mb-1">Event</p>
              <p className="font-semibold text-[#0F0F0F]">{session.event?.title}</p>
              <p className="text-sm text-[#0F0F0F]/60 mt-2">
                {session.member_count} member{session.member_count !== 1 ? 's' : ''} in this group
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              onClick={() => handleJoinWithCode(session.code)}
              disabled={joining}
              className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6"
            >
              {joining ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  {user ? 'Join Group' : 'Sign In to Join'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Enter code view
  return (
    <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full rounded-2xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-[#2969FF]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F0F0F] mb-2">Join a Group</h1>
            <p className="text-[#0F0F0F]/60">
              Enter the group code shared by your friend to buy tickets together
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter group code (e.g., ABC123)"
                className="text-center text-2xl font-mono tracking-widest uppercase rounded-xl h-14"
                maxLength={8}
              />
            </div>

            <Button
              type="submit"
              disabled={!manualCode.trim() || joining}
              className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6"
            >
              {joining ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Find Group'
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#0F0F0F]/10 text-center">
            <p className="text-sm text-[#0F0F0F]/50 mb-3">Don't have a code?</p>
            <Button
              variant="outline"
              onClick={() => navigate('/events')}
              className="rounded-xl"
            >
              Browse Events
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
