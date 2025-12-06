import { useState } from 'react';
import { Bell, Send, Users, Plus, CreditCard, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export function SMSCampaigns() {
  const [showCompose, setShowCompose] = useState(false);
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');

  const smsCredits = 500;
  const messageLength = message.length;
  const smsCount = Math.ceil(messageLength / 160) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-2">SMS Campaigns</h2>
          <p className="text-[#0F0F0F]/60">Send SMS messages to your attendees and followers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">
            <CreditCard className="w-4 h-4 mr-2" />
            Buy Credits
          </Button>
          <Button
            onClick={() => setShowCompose(!showCompose)}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            New SMS Campaign
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">SMS Credits</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{smsCredits}</p>
              </div>
              <CreditCard className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Messages Sent</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">1,234</p>
              </div>
              <Send className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Delivery Rate</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">98%</p>
              </div>
              <Bell className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Campaigns</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">8</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Credits Warning */}
      {smsCredits < 100 && (
        <Card className="border-yellow-300 bg-yellow-50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium text-yellow-800">Low SMS Credits</p>
              <p className="text-sm text-yellow-700">You have less than 100 credits remaining. Buy more to continue sending campaigns.</p>
            </div>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl">
              Buy Credits
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Compose New SMS */}
      {showCompose && (
        <Card className="border-[#2969FF] border-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#2969FF]" />
              Compose SMS Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                placeholder="e.g., Event Reminder"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Contacts (1,250)</SelectItem>
                  <SelectItem value="attendees">Event Attendees (450)</SelectItem>
                  <SelectItem value="followers">Followers Only (800)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Type your SMS message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-xl min-h-[120px]"
                maxLength={480}
              />
              <div className="flex justify-between text-sm text-[#0F0F0F]/60">
                <span>{messageLength}/480 characters</span>
                <span>{smsCount} SMS ({smsCount > 1 ? 'Long message' : 'Standard'})</span>
              </div>
            </div>

            <div className="p-4 bg-[#F4F6FA] rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-[#0F0F0F]">Estimated Cost</p>
                  <p className="text-sm text-[#0F0F0F]/60">Based on selected audience</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-[#0F0F0F]">{smsCount * 1250} credits</p>
                  <p className="text-sm text-[#0F0F0F]/60">{1250} recipients × {smsCount} SMS</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCompose(false)}
                className="rounded-xl flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={!message.trim() || smsCredits < smsCount * 1250}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Campaigns */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#F4F6FA]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-[#0F0F0F]">Event Reminder</h4>
                  <p className="text-sm text-[#0F0F0F]/60">Lagos Tech Summit tomorrow at 9 AM!</p>
                </div>
                <Badge className="bg-green-100 text-green-700">Sent</Badge>
              </div>
              <div className="flex gap-4 text-sm text-[#0F0F0F]/60">
                <span>450 recipients</span>
                <span>448 delivered (99.6%)</span>
                <span>Nov 28, 2024</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F4F6FA]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-[#0F0F0F]">Early Bird Promo</h4>
                  <p className="text-sm text-[#0F0F0F]/60">20% off early bird tickets - use code EARLY20</p>
                </div>
                <Badge className="bg-green-100 text-green-700">Sent</Badge>
              </div>
              <div className="flex gap-4 text-sm text-[#0F0F0F]/60">
                <span>800 recipients</span>
                <span>784 delivered (98%)</span>
                <span>Nov 15, 2024</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Info */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">SMS Credit Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[#0F0F0F]/10 text-center">
              <p className="text-2xl font-semibold text-[#0F0F0F] mb-1">₦5,000</p>
              <p className="text-[#0F0F0F]/60">500 Credits</p>
              <p className="text-sm text-green-600 mt-2">₦10/SMS</p>
            </div>
            <div className="p-4 rounded-xl border-2 border-[#2969FF] bg-[#2969FF]/5 text-center">
              <Badge className="bg-[#2969FF] text-white mb-2">Popular</Badge>
              <p className="text-2xl font-semibold text-[#0F0F0F] mb-1">₦18,000</p>
              <p className="text-[#0F0F0F]/60">2,000 Credits</p>
              <p className="text-sm text-green-600 mt-2">₦9/SMS</p>
            </div>
            <div className="p-4 rounded-xl border border-[#0F0F0F]/10 text-center">
              <p className="text-2xl font-semibold text-[#0F0F0F] mb-1">₦40,000</p>
              <p className="text-[#0F0F0F]/60">5,000 Credits</p>
              <p className="text-sm text-green-600 mt-2">₦8/SMS</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
