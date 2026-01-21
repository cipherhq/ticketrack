import { useState } from 'react'
import { 
  Mail, Phone, Copy, Share2, Check, Loader2, 
  X, Users, Link2, MessageSquare
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { getShareableLink } from '@/services/groupBuy'

export function GroupInviteModal({ open, onClose, session, userName }) {
  const [inviteMethod, setInviteMethod] = useState('link')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(`Hey! I'm buying tickets for ${session?.event?.title || 'an event'}. Join my group to buy yours!`)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const shareLink = session ? getShareableLink(session.code) : ''

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my group for ${session?.event?.title || 'an event'}`,
          text: message,
          url: shareLink
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err)
        }
      }
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setSending(true)
      setError(null)

      // Save invitation record
      const { error: inviteError } = await supabase
        .from('group_buy_invitations')
        .insert({
          session_id: session.id,
          email: email.toLowerCase().trim(),
          inviter_name: userName,
          message: message,
          expires_at: session.expires_at
        })

      if (inviteError) throw inviteError

      // Send email via Edge Function
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'group_invite',
          to: email.toLowerCase().trim(),
          data: {
            inviterName: userName,
            eventTitle: session.event?.title,
            eventDate: session.event?.start_date,
            groupName: session.name,
            groupCode: session.code,
            groupLink: shareLink,
            message: message,
            expiresAt: session.expires_at,
            appUrl: window.location.origin
          }
        }
      })

      if (emailError) console.error('Email send error:', emailError)

      setSent(prev => [...prev, { type: 'email', value: email }])
      setEmail('')
    } catch (err) {
      console.error('Invite error:', err)
      setError(err.message || 'Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const handleSendSMS = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return

    try {
      setSending(true)
      setError(null)

      // Save invitation record
      const { error: inviteError } = await supabase
        .from('group_buy_invitations')
        .insert({
          session_id: session.id,
          phone: phone.replace(/\D/g, ''),
          inviter_name: userName,
          message: message,
          expires_at: session.expires_at
        })

      if (inviteError) throw inviteError

      // Send SMS via Edge Function
      const smsMessage = `${userName} invited you to buy tickets for ${session.event?.title}! Join here: ${shareLink}`
      
      const { error: smsError } = await supabase.functions.invoke('send-sms', {
        body: {
          to: phone.replace(/\D/g, ''),
          message: smsMessage
        }
      })

      if (smsError) console.error('SMS send error:', smsError)

      setSent(prev => [...prev, { type: 'sms', value: phone }])
      setPhone('')
    } catch (err) {
      console.error('Invite error:', err)
      setError(err.message || 'Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2969FF]" />
            Invite Friends
          </DialogTitle>
        </DialogHeader>

        <Tabs value={inviteMethod} onValueChange={setInviteMethod} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-[#F4F6FA] rounded-xl p-1">
            <TabsTrigger value="link" className="rounded-lg text-sm">
              <Link2 className="w-4 h-4 mr-1" />
              Link
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-lg text-sm">
              <Mail className="w-4 h-4 mr-1" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms" className="rounded-lg text-sm">
              <MessageSquare className="w-4 h-4 mr-1" />
              SMS
            </TabsTrigger>
          </TabsList>

          {/* Link sharing */}
          <TabsContent value="link" className="mt-4 space-y-4">
            <div>
              <Label className="text-sm text-[#0F0F0F]/60">Group Code</Label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-[#F4F6FA] rounded-xl px-4 py-3 font-mono text-lg font-bold text-center">
                  {session?.code}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-[#0F0F0F]/60">Share Link</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={shareLink} 
                  readOnly 
                  className="rounded-xl text-sm bg-[#F4F6FA]"
                />
                <Button
                  onClick={handleCopyLink}
                  className="rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8] text-white px-4"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {navigator.share && (
              <Button
                onClick={handleShareNative}
                variant="outline"
                className="w-full rounded-xl"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share via...
              </Button>
            )}
          </TabsContent>

          {/* Email invite */}
          <TabsContent value="email" className="mt-4">
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <Label htmlFor="email">Friend's Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="emailMessage">Personal Message (optional)</Label>
                <Textarea
                  id="emailMessage"
                  placeholder="Add a personal note..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="rounded-xl mt-1 resize-none"
                  rows={2}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8] text-white"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email Invite
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* SMS invite */}
          <TabsContent value="sms" className="mt-4">
            <form onSubmit={handleSendSMS} className="space-y-4">
              <div>
                <Label htmlFor="phone">Friend's Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl mt-1"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                disabled={sending || !phone.trim()}
                className="w-full rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8] text-white"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send SMS Invite
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Sent confirmations */}
        {sent.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
            <p className="text-sm font-medium text-green-600 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Invitations Sent
            </p>
            <div className="mt-2 space-y-1">
              {sent.map((s, i) => (
                <p key={i} className="text-sm text-[#0F0F0F]/60">
                  {s.type === 'email' ? <Mail className="w-3 h-3 inline mr-1" /> : <Phone className="w-3 h-3 inline mr-1" />}
                  {s.value}
                </p>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GroupInviteModal
