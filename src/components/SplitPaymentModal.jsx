import { useState, useEffect } from 'react';
import { X, Users, DollarSign, Mail, Clock, Send, Copy, Check, Loader2, AlertCircle, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/config/currencies';
import { createSplitPayment, getPayYourShareLink, calculateSplitAmounts } from '@/services/splitPayment';
import { toast } from 'sonner';

export function SplitPaymentModal({ 
  isOpen, 
  onClose, 
  sessionId,
  ticketSelection, // Array of { ticket_type_id, name, quantity, price }
  totalAmount,
  currency,
  serviceFee = 0,
  existingMembers = [], // Members already in the group
  eventTitle
}) {
  const [members, setMembers] = useState([
    { email: '', name: '', isNew: true }
  ]);
  const [splitType, setSplitType] = useState('equal');
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [splitResult, setSplitResult] = useState(null);
  const [shares, setShares] = useState([]);
  const [copiedLink, setCopiedLink] = useState(null);

  // Initialize with existing group members
  useEffect(() => {
    if (existingMembers.length > 0) {
      setMembers(existingMembers.map(m => ({
        email: m.email || '',
        name: m.name || '',
        user_id: m.user_id,
        isExisting: true
      })));
    }
  }, [existingMembers]);

  const grandTotal = totalAmount + serviceFee;
  const memberCount = members.filter(m => m.email).length;
  const amountPerPerson = memberCount > 0 ? Math.ceil((grandTotal / memberCount) * 100) / 100 : 0;

  const addMember = () => {
    setMembers([...members, { email: '', name: '', isNew: true }]);
  };

  const removeMember = (index) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const updateMember = (index, field, value) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleCreate = async () => {
    const validMembers = members.filter(m => m.email.trim());
    
    if (validMembers.length < 2) {
      toast.error('Add at least 2 members to split the payment');
      return;
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validMembers.filter(m => !emailRegex.test(m.email));
    if (invalidEmails.length > 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    setLoading(true);
    try {
      const result = await createSplitPayment({
        sessionId,
        ticketSelection,
        totalAmount,
        currency,
        serviceFee,
        members: validMembers.map(m => ({
          email: m.email.trim(),
          name: m.name.trim() || m.email.split('@')[0],
          user_id: m.user_id || null
        })),
        splitType,
        deadlineHours
      });

      setSplitResult(result);
      setCreated(true);
      toast.success('Split payment created! Share the links with your friends.');
    } catch (err) {
      console.error('Error creating split payment:', err);
      toast.error(err.message || 'Failed to create split payment');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (token, index) => {
    const link = getPayYourShareLink(token);
    await navigator.clipboard.writeText(link);
    setCopiedLink(index);
    toast.success('Link copied!');
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {created ? 'Share Payment Links' : 'Split Payment'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {created ? 'Send these links to your friends' : 'Split the cost with your group'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!created ? (
            <>
              {/* Order Summary */}
              <Card className="border-border/10">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    {ticketSelection.map((ticket, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{ticket.quantity}x {ticket.name}</span>
                        <span>{formatPrice(ticket.price * ticket.quantity, currency)}</span>
                      </div>
                    ))}
                    {serviceFee > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Service Fee</span>
                        <span>{formatPrice(serviceFee, currency)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(grandTotal, currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Split Type Toggle */}
              <div className="space-y-2">
                <Label>Split Type</Label>
                <div className="flex rounded-xl overflow-hidden border border-border">
                  <button
                    type="button"
                    onClick={() => setSplitType('equal')}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                      splitType === 'equal'
                        ? 'bg-[#2969FF] text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('pool')}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                      splitType === 'pool'
                        ? 'bg-[#2969FF] text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Pool (Flexible)
                  </button>
                </div>
              </div>

              {/* Split Preview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                {splitType === 'equal' ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">{memberCount} people</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatPrice(amountPerPerson, currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">per person</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <span className="text-2xl font-bold text-blue-600">
                        {formatPrice(grandTotal, currency)}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Target total &middot; {memberCount} contributors
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Each person pays what they can until the target is met
                    </p>
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Who's splitting?
                </Label>
                
                {members.map((member, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="friend@email.com"
                      value={member.email}
                      onChange={(e) => updateMember(index, 'email', e.target.value)}
                      className="flex-1 rounded-xl"
                      disabled={member.isExisting}
                    />
                    <Input
                      type="text"
                      placeholder="Name (optional)"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      className="w-32 rounded-xl"
                      disabled={member.isExisting}
                    />
                    {members.length > 1 && !member.isExisting && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(index)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addMember}
                  className="w-full rounded-xl border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Person
                </Button>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Payment Deadline
                </Label>
                <select
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(parseInt(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl bg-muted border-0"
                >
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours (3 days)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Everyone must pay before the deadline or the split is cancelled
                </p>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">How it works:</p>
                  {splitType === 'equal' ? (
                    <ul className="mt-1 space-y-1 list-disc list-inside text-amber-700">
                      <li>Each person gets a unique payment link</li>
                      <li>Tickets are only issued when everyone pays</li>
                      <li>If someone doesn't pay, all payments are refunded</li>
                    </ul>
                  ) : (
                    <ul className="mt-1 space-y-1 list-disc list-inside text-amber-700">
                      <li>Each person gets a payment link and can contribute any amount</li>
                      <li>Tickets are issued when the pool reaches the target</li>
                      <li>If the target isn't met by the deadline, all contributions are refunded</li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleCreate}
                disabled={loading || memberCount < 2}
                className="w-full h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Split...</>
                ) : (
                  <><Users className="w-4 h-4 mr-2" />Create Split Payment</>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Success State - Share Links */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Split Payment Created!</h3>
                <p className="text-muted-foreground mt-1">
                  Share these links with your friends
                </p>
              </div>

              {/* Amount Per Person / Pool Target */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 text-center">
                {splitType === 'pool' ? (
                  <>
                    <div className="text-3xl font-bold text-green-600">
                      {formatPrice(grandTotal, currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">pool target</div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-green-600">
                      {formatPrice(splitResult?.amount_per_share || amountPerPerson, currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">per person</div>
                  </>
                )}
              </div>

              {/* Payment Links */}
              <div className="space-y-3">
                <Label>Payment Links</Label>
                {members.filter(m => m.email).map((member, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-background rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {member.name || member.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(member.payment_token, index)}
                      className="rounded-lg"
                    >
                      {copiedLink === index ? (
                        <><Check className="w-4 h-4 mr-1" />Copied</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-1" />Copy Link</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = getPayYourShareLink(member.payment_token);
                        const text = `Hey ${member.name || 'friend'}! Pay your share for ${eventTitle}: ${link}`;
                        if (navigator.share) {
                          navigator.share({ title: 'Pay Your Share', text, url: link });
                        } else {
                          navigator.clipboard.writeText(text);
                          toast.success('Message copied!');
                        }
                      }}
                      className="rounded-lg"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Deadline Reminder */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="text-sm">
                  <span className="font-medium text-blue-800">Deadline: </span>
                  <span className="text-blue-600">
                    {new Date(splitResult?.expires_at || Date.now() + deadlineHours * 60 * 60 * 1000).toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                onClick={onClose}
                className="w-full h-12 bg-[#0F0F0F] hover:bg-[#0F0F0F]/90 text-white rounded-xl"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
