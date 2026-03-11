import { useState, useEffect } from 'react';
import { Loader2, Wallet, Plus, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getInviteFund, createFund, updateFund, getContributions } from '@/services/partyInvites';
import { formatDistanceToNow } from 'date-fns';

const CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS', 'EUR', 'KES', 'ZAR', 'CAD'];
const SYMBOLS = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', GHS: 'GH\u20B5', EUR: '\u20AC', KES: 'KSh', ZAR: 'R', CAD: 'C$' };

export function FundTab({ invite, organizer }) {
  const [fund, setFund] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');

  useEffect(() => {
    loadFund();
  }, [invite.id]);

  async function loadFund() {
    setLoading(true);
    try {
      const f = await getInviteFund(invite.id);
      setFund(f);
      if (f) {
        const contribs = await getContributions(f.id);
        setContributions(contribs);
      }
    } catch (err) {
      console.error('Error loading fund:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const f = await createFund(invite.id, organizer.id, {
        title: title.trim(),
        description: description.trim() || null,
        goalAmount: goalAmount ? Number(goalAmount) : null,
        currency,
      });
      setFund(f);
      toast.success('Cash fund created!');
    } catch (err) {
      console.error('Error creating fund:', err);
      toast.error('Failed to create fund');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive() {
    try {
      const updated = await updateFund(fund.id, { isActive: !fund.is_active });
      setFund(updated);
      toast.success(updated.is_active ? 'Fund activated' : 'Fund paused');
    } catch {
      toast.error('Failed to update fund');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show creation form if no fund exists
  if (!fund) {
    return (
      <div className="space-y-5">
        <div className="text-center py-6">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Create a Cash Fund</h3>
          <p className="text-sm text-gray-400">Let guests contribute to a shared fund for the party</p>
        </div>
        <div className="space-y-4 max-w-md mx-auto">
          <div>
            <Label className="text-sm font-medium">Fund Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Birthday Gift Fund" className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-sm font-medium">Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this fund for?"
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Goal Amount</Label>
              <Input type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="Optional" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="rounded-xl h-10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={!title.trim() || creating} className="w-full rounded-xl gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Fund
          </Button>
        </div>
      </div>
    );
  }

  // Display existing fund
  const sym = SYMBOLS[fund.currency] || '$';
  const totalRaised = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
  const progressPercent = fund.goal_amount ? Math.min(100, (totalRaised / Number(fund.goal_amount)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Fund overview */}
      <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{fund.title}</h3>
            {fund.description && <p className="text-sm text-gray-500 mt-0.5">{fund.description}</p>}
          </div>
          <button
            onClick={handleToggleActive}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              fund.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {fund.is_active ? 'Active' : 'Paused'}
          </button>
        </div>

        <div className="mb-2">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-emerald-700">{sym}{totalRaised.toLocaleString()}</span>
            {fund.goal_amount && (
              <span className="text-sm text-gray-500">of {sym}{Number(fund.goal_amount).toLocaleString()} goal</span>
            )}
          </div>
        </div>

        {fund.goal_amount && (
          <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Contributions list */}
      {contributions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Contributions</h4>
          {contributions.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.guest_name}</p>
                  {c.message && <p className="text-xs text-gray-500 mt-0.5">"{c.message}"</p>}
                  <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-700">{sym}{Number(c.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {contributions.length === 0 && (
        <div className="text-center py-8">
          <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No contributions yet. Share the invite link to start receiving contributions!</p>
        </div>
      )}
    </div>
  );
}
