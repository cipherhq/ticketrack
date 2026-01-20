import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, Loader2, Share2, Copy, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { createGroupSession, getShareableLink } from '@/services/groupBuy'

const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 360, label: '6 hours' },
  { value: 1440, label: '24 hours' },
]

export function StartGroupModal({ open, onOpenChange, event }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [step, setStep] = useState('form') // form, creating, success
  const [groupName, setGroupName] = useState('')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdSession, setCreatedSession] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!user) {
      navigate(`/login?redirect=/event/${event?.slug}`)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStep('creating')
      
      const result = await createGroupSession(
        event.id,
        groupName.trim() || null,
        duration
      )
      
      setCreatedSession(result)
      setStep('success')
    } catch (err) {
      console.error('Error creating group:', err)
      setError(err.message)
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    const link = getShareableLink(createdSession.code)
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const link = getShareableLink(createdSession.code)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my group for ${event?.title}`,
          text: `Buy tickets together! Join my group: ${createdSession.code}`,
          url: link
        })
      } catch (err) {
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }

  const handleGoToLobby = () => {
    onOpenChange(false)
    navigate(`/group/${createdSession.code}`)
  }

  const handleClose = () => {
    setStep('form')
    setGroupName('')
    setError(null)
    setCreatedSession(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Users className="w-6 h-6 text-[#2969FF]" />
                Start a Group
              </DialogTitle>
              <DialogDescription>
                Create a group so your friends can buy tickets together for {event?.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Group Name (Optional)</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Sarah's Birthday Squad"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Session Duration</Label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
                        duration === opt.value
                          ? 'border-[#2969FF] bg-[#2969FF]/10 text-[#2969FF]'
                          : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#0F0F0F]/50">
                  Friends can join and buy tickets within this time
                </p>
              </div>

              <div className="bg-[#F4F6FA] rounded-xl p-4">
                <h4 className="font-medium text-[#0F0F0F] mb-2">How it works:</h4>
                <ol className="text-sm text-[#0F0F0F]/70 space-y-1 list-decimal pl-4">
                  <li>You create a group and get a shareable link</li>
                  <li>Share the link with your friends</li>
                  <li>Everyone joins and selects their tickets</li>
                  <li>Each person pays for their own tickets</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={loading}
                className="flex-1 bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Group'}
              </Button>
            </div>
          </>
        )}

        {step === 'creating' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">Creating your group...</p>
          </div>
        )}

        {step === 'success' && createdSession && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-green-600">
                <CheckCircle className="w-6 h-6" />
                Group Created!
              </DialogTitle>
            </DialogHeader>

            <div className="py-6">
              {/* Group Code */}
              <div className="bg-gradient-to-r from-[#2969FF]/10 to-[#2969FF]/5 rounded-2xl p-6 text-center mb-6">
                <p className="text-sm text-[#0F0F0F]/60 mb-2">Your Group Code</p>
                <p className="text-4xl font-mono font-bold text-[#2969FF] tracking-wider">
                  {createdSession.code}
                </p>
                <p className="text-sm text-[#0F0F0F]/50 mt-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Expires in {DURATION_OPTIONS.find(d => d.value === duration)?.label}
                </p>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3 mb-6">
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="flex-1 rounded-xl"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleShare}
                  className="flex-1 bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              <p className="text-sm text-[#0F0F0F]/60 text-center mb-6">
                Share this code or link with your friends so they can join!
              </p>

              <Button
                onClick={handleGoToLobby}
                className="w-full bg-[#0F0F0F] hover:bg-[#0F0F0F]/90 text-white rounded-xl py-6"
              >
                <Users className="w-5 h-5 mr-2" />
                Go to Group Lobby
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
