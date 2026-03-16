import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ShieldAlert, ShieldCheck, ShieldX, Ban, Eye, ChevronDown, ChevronUp, Plus, ToggleLeft, ToggleRight, Trash2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const STATUS_COLORS = {
  clean: 'bg-green-100 text-green-800',
  flagged: 'bg-yellow-100 text-yellow-800',
  blocked: 'bg-red-100 text-red-800',
  reviewed_ok: 'bg-emerald-100 text-emerald-800',
  reviewed_fraud: 'bg-red-200 text-red-900',
};

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : score >= 10 ? 'bg-blue-500' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-medium">{score}</span>
    </div>
  );
}

export function AdminFraud() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('flagged');

  // Stats
  const [stats, setStats] = useState({ flagged: 0, blocked: 0, avgScore: 0, blocklistEntries: 0 });

  // Flagged orders state
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderFlags, setOrderFlags] = useState({});
  const [orderCardMeta, setOrderCardMeta] = useState({});
  const [reviewModal, setReviewModal] = useState({ open: false, order: null, action: null });
  const [reviewNotes, setReviewNotes] = useState('');
  const [addToBlocklist, setAddToBlocklist] = useState(false);
  const [blocklistType, setBlocklistType] = useState('email');
  const [blocklistValue, setBlocklistValue] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Blocklist state
  const [blocklist, setBlocklist] = useState([]);
  const [blocklistLoading, setBlocklistLoading] = useState(false);
  const [addBlockModal, setAddBlockModal] = useState(false);
  const [newBlock, setNewBlock] = useState({ block_type: 'email', block_value: '', reason: '', expires_at: '' });

  // Card intelligence state
  const [cardSearch, setCardSearch] = useState('');
  const [cardResults, setCardResults] = useState([]);
  const [cardSearching, setCardSearching] = useState(false);

  const loadStats = useCallback(async () => {
    const [flaggedRes, blockedRes, scoreRes, blocklistRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('fraud_status', 'flagged'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('fraud_status', 'blocked'),
      supabase.from('orders').select('fraud_risk_score').gt('fraud_risk_score', 0),
      supabase.from('fraud_blocklist').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    const scores = scoreRes.data || [];
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, o) => s + (o.fraud_risk_score || 0), 0) / scores.length)
      : 0;

    setStats({
      flagged: flaggedRes.count || 0,
      blocked: blockedRes.count || 0,
      avgScore,
      blocklistEntries: blocklistRes.count || 0,
    });
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('id, order_number, buyer_name, buyer_email, buyer_phone, event_id, total_amount, currency, fraud_risk_score, fraud_status, fraud_reviewed_by, fraud_reviewed_at, ip_address, user_agent, device_fingerprint, created_at, events(title)')
      .gt('fraud_risk_score', 0)
      .order('fraud_risk_score', { ascending: false })
      .limit(100);

    if (orderStatusFilter !== 'all') {
      query = query.eq('fraud_status', orderStatusFilter);
    }

    if (orderSearch) {
      query = query.or(`order_number.ilike.%${orderSearch}%,buyer_name.ilike.%${orderSearch}%,buyer_email.ilike.%${orderSearch}%`);
    }

    const { data, error } = await query;
    if (!error) setOrders(data || []);
    setLoading(false);
  }, [orderStatusFilter, orderSearch]);

  const loadOrderDetails = async (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);

    const [flagsRes, cardRes] = await Promise.all([
      supabase.from('fraud_flags').select('*').eq('order_id', orderId).order('score', { ascending: false }),
      supabase.from('fraud_card_metadata').select('*').eq('order_id', orderId).limit(1),
    ]);

    setOrderFlags(prev => ({ ...prev, [orderId]: flagsRes.data || [] }));
    setOrderCardMeta(prev => ({ ...prev, [orderId]: cardRes.data?.[0] || null }));
  };

  const loadBlocklist = async () => {
    setBlocklistLoading(true);
    const { data } = await supabase
      .from('fraud_blocklist')
      .select('*')
      .order('created_at', { ascending: false });
    setBlocklist(data || []);
    setBlocklistLoading(false);
  };

  const handleReview = async () => {
    if (!reviewModal.order) return;
    setReviewing(true);

    const newStatus = reviewModal.action === 'safe' ? 'reviewed_ok' : 'reviewed_fraud';

    await supabase.from('orders').update({
      fraud_status: newStatus,
      fraud_reviewed_by: user.id,
      fraud_reviewed_at: new Date().toISOString(),
    }).eq('id', reviewModal.order.id);

    // Update flags to reviewed
    await supabase.from('fraud_flags').update({
      status: reviewModal.action === 'safe' ? 'dismissed' : 'confirmed',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    }).eq('order_id', reviewModal.order.id);

    // Optionally add to blocklist
    if (reviewModal.action === 'fraud' && addToBlocklist && blocklistValue) {
      await supabase.from('fraud_blocklist').upsert({
        block_type: blocklistType,
        block_value: blocklistType === 'email' ? blocklistValue.toLowerCase() : blocklistValue,
        reason: reviewNotes || 'Confirmed fraud from order review',
        source: 'manual',
        added_by: user.id,
      }, { onConflict: 'block_type,block_value' });
    }

    toast.success(`Order marked as ${reviewModal.action === 'safe' ? 'safe' : 'fraudulent'}`);
    setReviewModal({ open: false, order: null, action: null });
    setReviewNotes('');
    setAddToBlocklist(false);
    setBlocklistValue('');
    setReviewing(false);
    loadOrders();
    loadStats();
  };

  const handleAddBlock = async () => {
    if (!newBlock.block_value) return;
    const { error } = await supabase.from('fraud_blocklist').insert({
      block_type: newBlock.block_type,
      block_value: newBlock.block_type === 'email' ? newBlock.block_value.toLowerCase() : newBlock.block_value,
      reason: newBlock.reason || null,
      expires_at: newBlock.expires_at || null,
      source: 'manual',
      added_by: user.id,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Entry already exists' : 'Failed to add');
    } else {
      toast.success('Added to blocklist');
      setAddBlockModal(false);
      setNewBlock({ block_type: 'email', block_value: '', reason: '', expires_at: '' });
      loadBlocklist();
      loadStats();
    }
  };

  const toggleBlockActive = async (entry) => {
    await supabase.from('fraud_blocklist').update({ is_active: !entry.is_active, updated_at: new Date().toISOString() }).eq('id', entry.id);
    loadBlocklist();
    loadStats();
  };

  const deleteBlockEntry = async (id) => {
    await supabase.from('fraud_blocklist').delete().eq('id', id);
    toast.success('Removed from blocklist');
    loadBlocklist();
    loadStats();
  };

  const searchCards = async () => {
    if (!cardSearch.trim()) return;
    setCardSearching(true);
    const term = cardSearch.trim();

    let query = supabase.from('fraud_card_metadata').select('*, orders(order_number, buyer_name, buyer_email, total_amount, currency, fraud_status, created_at)');

    if (term.length === 4) {
      query = query.eq('card_last4', term);
    } else if (term.length === 6) {
      query = query.eq('card_first6', term);
    } else {
      query = query.eq('card_signature', term);
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    setCardResults(data || []);
    setCardSearching(false);
  };

  useEffect(() => { loadStats(); loadOrders(); }, [loadStats, loadOrders]);

  useEffect(() => {
    if (activeTab === 'blocklist') loadBlocklist();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fraud Detection</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor suspicious orders, manage blocklists, and review card intelligence.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged Orders</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.flagged}</p>
              </div>
              <ShieldAlert className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked Orders</p>
                <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
              </div>
              <ShieldX className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Risk Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}</p>
              </div>
              <ShieldCheck className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocklist Entries</p>
                <p className="text-2xl font-bold">{stats.blocklistEntries}</p>
              </div>
              <Ban className="w-8 h-8 text-gray-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="flagged">Flagged Orders</TabsTrigger>
          <TabsTrigger value="blocklist">Blocklist</TabsTrigger>
          <TabsTrigger value="cards">Card Intelligence</TabsTrigger>
        </TabsList>

        {/* === Tab 1: Flagged Orders === */}
        <TabsContent value="flagged" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by order #, name, or email..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="reviewed_ok">Reviewed OK</SelectItem>
                <SelectItem value="reviewed_fraud">Confirmed Fraud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No flagged orders found.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {orders.map(order => (
                <Card key={order.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => loadOrderDetails(order.id)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.buyer_name} - {order.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-medium hidden sm:block">{order.events?.title?.substring(0, 25)}</span>
                      <span className="text-sm font-medium">{formatPrice(order.total_amount, order.currency)}</span>
                      <ScoreBar score={order.fraud_risk_score} />
                      <Badge className={STATUS_COLORS[order.fraud_status] || 'bg-gray-100'}>{order.fraud_status?.replace('_', ' ')}</Badge>
                      {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {expandedOrder === order.id && (
                    <div className="border-t px-4 py-4 space-y-4 bg-muted/30">
                      {/* Fraud Flags */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Fraud Flags</h4>
                        {(orderFlags[order.id] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : (
                          <div className="space-y-1">
                            {(orderFlags[order.id] || []).map(flag => (
                              <div key={flag.id} className="flex items-center gap-2 text-sm">
                                <Badge className={SEVERITY_COLORS[flag.severity]}>{flag.severity}</Badge>
                                <span className="font-medium">{flag.rule_code}</span>
                                <span className="text-muted-foreground">{flag.rule_name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">+{flag.score} pts</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Metadata */}
                      {orderCardMeta[order.id] && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Card Details</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Last 4:</span> {orderCardMeta[order.id].card_last4}</div>
                            <div><span className="text-muted-foreground">BIN:</span> {orderCardMeta[order.id].card_first6}</div>
                            <div><span className="text-muted-foreground">Brand:</span> {orderCardMeta[order.id].card_brand}</div>
                            <div><span className="text-muted-foreground">Type:</span> {orderCardMeta[order.id].card_type}</div>
                            <div><span className="text-muted-foreground">Country:</span> {orderCardMeta[order.id].card_country}</div>
                            <div><span className="text-muted-foreground">Bank:</span> {orderCardMeta[order.id].card_bank}</div>
                            <div><span className="text-muted-foreground">Channel:</span> {orderCardMeta[order.id].card_channel}</div>
                            <div><span className="text-muted-foreground">Provider:</span> {orderCardMeta[order.id].provider}</div>
                          </div>
                        </div>
                      )}

                      {/* Order Context */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Order Context</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">IP:</span> {order.ip_address || 'N/A'}</div>
                          <div className="truncate"><span className="text-muted-foreground">UA:</span> {order.user_agent?.substring(0, 60) || 'N/A'}</div>
                          <div className="truncate"><span className="text-muted-foreground">Fingerprint:</span> {order.device_fingerprint?.substring(0, 16) || 'N/A'}...</div>
                        </div>
                      </div>

                      {/* Actions */}
                      {(order.fraud_status === 'flagged' || order.fraud_status === 'blocked') && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => { setReviewModal({ open: true, order, action: 'safe' }); setReviewNotes(''); }}>
                            <ShieldCheck className="w-4 h-4 mr-1" /> Mark Safe
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            setReviewModal({ open: true, order, action: 'fraud' });
                            setReviewNotes('');
                            setAddToBlocklist(false);
                            setBlocklistValue(order.buyer_email || '');
                            setBlocklistType('email');
                          }}>
                            <ShieldX className="w-4 h-4 mr-1" /> Confirm Fraud
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === Tab 2: Blocklist === */}
        <TabsContent value="blocklist" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{blocklist.length} entries</p>
            <Button size="sm" onClick={() => setAddBlockModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add to Blocklist
            </Button>
          </div>

          {blocklistLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : blocklist.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No blocklist entries.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Value</th>
                    <th className="pb-2 font-medium">Reason</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">Active</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blocklist.map(entry => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2"><Badge variant="outline">{entry.block_type}</Badge></td>
                      <td className="py-2 font-mono text-xs">{entry.block_value}</td>
                      <td className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">{entry.reason || '-'}</td>
                      <td className="py-2 text-xs">{entry.source}</td>
                      <td className="py-2 text-xs">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="py-2">
                        <Badge className={entry.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          {entry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleBlockActive(entry)} title={entry.is_active ? 'Deactivate' : 'Activate'}>
                            {entry.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteBlockEntry(entry.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === Tab 3: Card Intelligence === */}
        <TabsContent value="cards" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by BIN (6 digits), last 4, or card signature..."
                value={cardSearch}
                onChange={e => setCardSearch(e.target.value)}
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && searchCards()}
              />
            </div>
            <Button onClick={searchCards} disabled={cardSearching}>
              {cardSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {cardResults.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Search by BIN, last 4 digits, or card signature to find matching transactions.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {(() => {
                // Group by user
                const grouped = {};
                cardResults.forEach(r => {
                  if (!grouped[r.user_id]) grouped[r.user_id] = [];
                  grouped[r.user_id].push(r);
                });
                return Object.entries(grouped).map(([userId, records]) => (
                  <Card key={userId}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        User: {records[0].orders?.buyer_name || userId.slice(0, 8)}
                        <span className="text-xs text-muted-foreground font-normal">{records[0].orders?.buyer_email}</span>
                        {Object.keys(grouped).length > 1 && <Badge className="bg-orange-100 text-orange-800">Cross-user</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {records.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="font-mono">{r.card_first6}...{r.card_last4}</span>
                              <span>{r.card_brand}</span>
                              <span className="text-muted-foreground">{r.card_country}</span>
                              <span className="text-muted-foreground">{r.provider}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>{r.orders?.order_number}</span>
                              <span>{formatPrice(r.orders?.total_amount, r.orders?.currency)}</span>
                              {r.orders?.fraud_status && r.orders.fraud_status !== 'clean' && (
                                <Badge className={STATUS_COLORS[r.orders.fraud_status]}>{r.orders.fraud_status}</Badge>
                              )}
                              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={reviewModal.open} onOpenChange={(open) => { if (!open) setReviewModal({ open: false, order: null, action: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewModal.action === 'safe' ? 'Mark as Safe' : 'Confirm Fraud'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Review Notes</Label>
              <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add notes about this review..." />
            </div>
            {reviewModal.action === 'fraud' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="addBlock" checked={addToBlocklist} onChange={e => setAddToBlocklist(e.target.checked)} className="rounded" />
                  <Label htmlFor="addBlock">Add to blocklist</Label>
                </div>
                {addToBlocklist && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Block Type</Label>
                      <Select value={blocklistType} onValueChange={setBlocklistType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="ip">IP Address</SelectItem>
                          <SelectItem value="device_fingerprint">Device Fingerprint</SelectItem>
                          <SelectItem value="card_bin">Card BIN</SelectItem>
                          <SelectItem value="card_signature">Card Signature</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Value</Label>
                      <Input value={blocklistValue} onChange={e => setBlocklistValue(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModal({ open: false, order: null, action: null })}>Cancel</Button>
            <Button
              variant={reviewModal.action === 'safe' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewing}
            >
              {reviewing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {reviewModal.action === 'safe' ? 'Mark Safe' : 'Confirm Fraud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Blocklist Modal */}
      <Dialog open={addBlockModal} onOpenChange={setAddBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Blocklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Block Type</Label>
              <Select value={newBlock.block_type} onValueChange={v => setNewBlock(prev => ({ ...prev, block_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="device_fingerprint">Device Fingerprint</SelectItem>
                  <SelectItem value="card_bin">Card BIN</SelectItem>
                  <SelectItem value="card_signature">Card Signature</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input value={newBlock.block_value} onChange={e => setNewBlock(prev => ({ ...prev, block_value: e.target.value }))} placeholder="e.g., fraud@example.com" />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={newBlock.reason} onChange={e => setNewBlock(prev => ({ ...prev, reason: e.target.value }))} placeholder="Why is this being blocked?" />
            </div>
            <div>
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" value={newBlock.expires_at} onChange={e => setNewBlock(prev => ({ ...prev, expires_at: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBlockModal(false)}>Cancel</Button>
            <Button onClick={handleAddBlock} disabled={!newBlock.block_value}>Add to Blocklist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
