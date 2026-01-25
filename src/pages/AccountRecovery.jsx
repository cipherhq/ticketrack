/**
 * Account Recovery Page
 * 
 * Helps users regain access when they:
 * - Lost their phone
 * - Changed phone number
 * - Can't receive OTP
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Phone, Mail, AlertTriangle, ArrowLeft, Loader2, 
  CheckCircle, Shield, HelpCircle, MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

export function AccountRecovery() {
  const navigate = useNavigate()
  const [step, setStep] = useState('options') // 'options', 'email-recovery', 'support-request', 'success'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    email: '',
    oldPhone: '',
    newPhone: '',
    reason: '',
    additionalInfo: '',
  })

  // Option 1: Email-based password reset (then login and update phone)
  const handleEmailRecovery = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (error) throw error

      setSuccess('Password reset email sent! Check your inbox.')
      setStep('success')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  // Option 2: Submit support request for manual verification
  const handleSupportRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Create support ticket
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          email: formData.email,
          subject: 'Phone Number Recovery Request',
          category: 'account_recovery',
          priority: 'high',
          description: `
User has lost access to their phone number and needs to update it.

Email: ${formData.email}
Old Phone: ${formData.oldPhone || 'Not provided'}
New Phone: ${formData.newPhone || 'Not provided'}
Reason: ${formData.reason}
Additional Info: ${formData.additionalInfo || 'None'}

SECURITY NOTE: Verify user identity before updating phone number.
Suggested verification methods:
1. Confirm recent ticket purchases
2. Confirm event names they attended
3. Confirm payment method details
4. Video call verification
          `.trim(),
          status: 'open',
          metadata: {
            type: 'phone_recovery',
            old_phone: formData.oldPhone,
            new_phone: formData.newPhone,
            reason: formData.reason,
          }
        })

      if (error) throw error

      setSuccess('Support request submitted! Our team will contact you within 24-48 hours.')
      setStep('success')
    } catch (err) {
      // If support_tickets table doesn't exist, show manual instructions
      console.error('Support ticket error:', err)
      setSuccess('Please email support@ticketrack.com with your account details for manual verification.')
      setStep('success')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <CardTitle className="text-2xl">Account Recovery</CardTitle>
          <CardDescription>
            Lost access to your phone? We'll help you get back in.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && step === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-green-700">{success}</p>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            </div>
          )}

          {/* Step 1: Choose recovery method */}
          {step === 'options' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-6">
                Choose how you'd like to recover your account:
              </p>

              {/* Option 1: Email Recovery */}
              <button
                onClick={() => setStep('email-recovery')}
                className="w-full p-4 border rounded-xl hover:border-[#2969FF] hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Reset via Email</h3>
                    <p className="text-sm text-muted-foreground">
                      Get a password reset link, then update your phone number in settings
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Support Request */}
              <button
                onClick={() => setStep('support-request')}
                className="w-full p-4 border rounded-xl hover:border-[#2969FF] hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Contact Support</h3>
                    <p className="text-sm text-muted-foreground">
                      Request manual verification if you can't access your email either
                    </p>
                  </div>
                </div>
              </button>

              <div className="pt-4 border-t">
                <Link 
                  to="/login" 
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          {/* Step 2a: Email Recovery */}
          {step === 'email-recovery' && (
            <form onSubmit={handleEmailRecovery} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700">
                  <strong>How this works:</strong><br />
                  1. Enter your email address<br />
                  2. Check your inbox for a reset link<br />
                  3. Set a new password<br />
                  4. Login and update your phone number in Profile Settings
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setStep('options')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  disabled={loading || !formData.email}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Reset Link
                </Button>
              </div>
            </form>
          )}

          {/* Step 2b: Support Request */}
          {step === 'support-request' && (
            <form onSubmit={handleSupportRequest} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex gap-2">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    For security, we'll verify your identity before updating your phone number.
                    This usually takes 24-48 hours.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-email">Email Address *</Label>
                <Input
                  id="support-email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="old-phone">Old Phone Number (if you remember)</Label>
                <Input
                  id="old-phone"
                  type="tel"
                  placeholder="+234..."
                  value={formData.oldPhone}
                  onChange={(e) => setFormData({ ...formData, oldPhone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-phone">New Phone Number *</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  placeholder="+234..."
                  value={formData.newPhone}
                  onChange={(e) => setFormData({ ...formData, newPhone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Why can't you access your old phone? *</Label>
                <select
                  id="reason"
                  className="w-full h-10 px-3 border rounded-xl bg-background"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="lost">Lost my phone</option>
                  <option value="stolen">Phone was stolen</option>
                  <option value="broken">Phone is broken/dead</option>
                  <option value="changed_number">Changed my phone number</option>
                  <option value="no_signal">Can't receive SMS (no signal/roaming)</option>
                  <option value="other">Other reason</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional">Additional Information</Label>
                <Textarea
                  id="additional"
                  placeholder="Any details that can help us verify your identity (recent events attended, ticket purchases, etc.)"
                  value={formData.additionalInfo}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setStep('options')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  disabled={loading || !formData.email || !formData.newPhone || !formData.reason}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Submit Request
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AccountRecovery
