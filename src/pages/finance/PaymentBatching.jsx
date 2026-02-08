import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Play, Pause, CheckCircle, XCircle, Package,
  Clock, DollarSign, RefreshCw, Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PaymentBatching() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [batches, setBatches] = useState([]);
  const [eligiblePayouts, setEligiblePayouts] = useState([]);
  const [selectedPayouts, setSelectedPayouts] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBatch, setNewBatch] = useState({
    provider: 'stripe',
    currency: 'USD'
  });
  const [stats, setStats] = useState({
    pendingBatches: 0,
    processingBatches: 0,
    completedBatches: 0,
    pendingAmountByCurrency: {}
  });

  useEffect(() => {
    loadBatches();
    logFinanceAction('view_payment_batching');
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_batches')
        .select(`
          *,
          payout_batch_items (id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);

      // Calculate stats
      const pending = data?.filter(b => b.status === 'pending').length || 0;
      const processingCount = data?.filter(b => b.status === 'processing').length || 0;
      const completed = data?.filter(b => b.status === 'completed').length || 0;

      // Group pending amount by currency
      const pendingAmountByCurrency = {};
      data?.filter(b => ['pending', 'processing'].includes(b.status))
        .forEach(b => {
          const currency = b.currency || 'USD';
          pendingAmountByCurrency[currency] = (pendingAmountByCurrency[currency] || 0) + parseFloat(b.total_amount || 0);
        });

      setStats({
        pendingBatches: pending,
        processingBatches: processingCount,
        completedBatches: completed,
        pendingAmountByCurrency
      });
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEligiblePayouts = async (provider, currency) => {
    try {
      const { data } = await supabase
        .from('payout_queue')
        .select(`
          *,
          organizers (id, business_name)
        `)
        .eq('status', 'queued')
        .eq('payment_provider', provider)
        .eq('currency', currency)
        .is('batch_id', null)
        .order('created_at', { ascending: true });

      setEligiblePayouts(data || []);
    } catch (error) {
      console.error('Error loading eligible payouts:', error);
    }
  };

  const handleOpenCreateDialog = () => {
    setSelectedPayouts([]);
    loadEligiblePayouts(newBatch.provider, newBatch.currency);
    setCreateDialogOpen(true);
  };

  const handleCreateBatch = async () => {
    if (selectedPayouts.length === 0) return;

    setProcessing(true);
    try {
      const selectedItems = eligiblePayouts.filter(p => selectedPayouts.includes(p.id));
      const totalAmount = selectedItems.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      // Create batch
      const { data: batch, error: batchError } = await supabase
        .from('payout_batches')
        .insert({
          batch_number: `BATCH-${Date.now()}`,
          provider: newBatch.provider,
          currency: newBatch.currency,
          payout_count: selectedPayouts.length,
          total_amount: totalAmount,
          status: 'pending'
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create batch items
      const batchItems = selectedItems.map(p => ({
        batch_id: batch.id,
        organizer_id: p.organizer_id,
        payout_queue_id: p.id,
        amount: p.amount,
        status: 'pending'
      }));

      await supabase.from('payout_batch_items').insert(batchItems);

      // Update payout queue
      await supabase
        .from('payout_queue')
        .update({ batch_id: batch.id })
        .in('id', selectedPayouts);

      logFinanceAction('create_payout_batch', {
        batch_id: batch.id,
        count: selectedPayouts.length,
        total: totalAmount
      });

      setCreateDialogOpen(false);
      loadBatches();
    } catch (error) {
      console.error('Error creating batch:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessBatch = async (batchId) => {
    if (!confirm('Process this batch? Payouts will be initiated with the payment provider.')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await supabase.functions.invoke('process-payout-batch', {
        body: { batch_id: batchId }
      });

      if (response.error) throw response.error;

      logFinanceAction('process_payout_batch', { batch_id: batchId });
      loadBatches();
    } catch (error) {
      console.error('Error processing batch:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelBatch = async (batchId) => {
    if (!confirm('Cancel this batch? All payouts will be returned to the queue.')) {
      return;
    }

    try {
      // Get batch items
      const { data: items } = await supabase
        .from('payout_batch_items')
        .select('payout_queue_id')
        .eq('batch_id', batchId);

      const queueIds = items?.map(i => i.payout_queue_id) || [];

      // Update payout queue
      if (queueIds.length > 0) {
        await supabase
          .from('payout_queue')
          .update({ batch_id: null })
          .in('id', queueIds);
      }

      // Update batch status
      await supabase
        .from('payout_batches')
        .update({ status: 'cancelled' })
        .eq('id', batchId);

      logFinanceAction('cancel_payout_batch', { batch_id: batchId });
      loadBatches();
    } catch (error) {
      console.error('Error cancelling batch:', error);
    }
  };

  const togglePayoutSelection = (payoutId) => {
    setSelectedPayouts(prev =>
      prev.includes(payoutId)
        ? prev.filter(id => id !== payoutId)
        : [...prev, payoutId]
    );
  };

  const selectAllPayouts = () => {
    if (selectedPayouts.length === eligiblePayouts.length) {
      setSelectedPayouts([]);
    } else {
      setSelectedPayouts(eligiblePayouts.map(p => p.id));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-muted text-foreground'
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  const getProviderColor = (provider) => {
    const colors = {
      paystack: 'bg-blue-100 text-blue-800',
      stripe: 'bg-purple-100 text-purple-800',
      flutterwave: 'bg-orange-100 text-orange-800'
    };
    return colors[provider] || 'bg-muted text-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Batching</h1>
          <p className="text-muted-foreground">Process multiple payouts efficiently in batches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBatches} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleOpenCreateDialog}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Batch
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pendingBatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{stats.processingBatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completedBatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
                <p className="text-2xl font-bold">
                  {formatMultiCurrencyCompact(stats.pendingAmountByCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batches Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Payout Batches ({batches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const completedItems = batch.payout_batch_items?.filter(
                  i => i.status === 'completed'
                ).length || 0;
                const totalItems = batch.payout_batch_items?.length || 0;

                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono">
                      {batch.batch_number}
                    </TableCell>
                    <TableCell>
                      <Badge className={getProviderColor(batch.provider)}>
                        {batch.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>{batch.currency}</TableCell>
                    <TableCell className="text-right">
                      {batch.status === 'processing' || batch.status === 'completed' ? (
                        <span>{completedItems}/{totalItems}</span>
                      ) : (
                        <span>{batch.payout_count}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatPrice(batch.total_amount, batch.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(batch.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {batch.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleProcessBatch(batch.id)}
                              disabled={processing}
                              className="bg-green-600 hover:bg-green-700 rounded-lg"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelBatch(batch.id)}
                              className="rounded-lg"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {batch.status === 'processing' && (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No batches created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Payout Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium">Payment Provider</label>
                <Select
                  value={newBatch.provider}
                  onValueChange={(v) => {
                    setNewBatch({ ...newBatch, provider: v });
                    loadEligiblePayouts(v, newBatch.currency);
                    setSelectedPayouts([]);
                  }}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paystack">Paystack</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="flutterwave">Flutterwave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Currency</label>
                <Select
                  value={newBatch.currency}
                  onValueChange={(v) => {
                    setNewBatch({ ...newBatch, currency: v });
                    loadEligiblePayouts(newBatch.provider, v);
                    setSelectedPayouts([]);
                  }}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GHS">GHS</SelectItem>
                    <SelectItem value="KES">KES</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border rounded-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Eligible Payouts ({eligiblePayouts.length})</CardTitle>
                  {eligiblePayouts.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={selectAllPayouts}>
                      {selectedPayouts.length === eligiblePayouts.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="max-h-[300px] overflow-y-auto">
                {eligiblePayouts.length > 0 ? (
                  <div className="space-y-2">
                    {eligiblePayouts.map((payout) => (
                      <div
                        key={payout.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPayouts.includes(payout.id)
                            ? 'border-[#2969FF] bg-blue-50'
                            : 'hover:bg-background'
                        }`}
                        onClick={() => togglePayoutSelection(payout.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => togglePayoutSelection(payout.id)}
                          />
                          <div>
                            <p className="font-medium">{payout.organizers?.business_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Queued {new Date(payout.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold">
                          {formatPrice(payout.amount, payout.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No eligible payouts for selected provider and currency
                  </p>
                )}
              </CardContent>
            </Card>

            {selectedPayouts.length > 0 && (
              <Card className="border-green-200 bg-green-50 rounded-xl">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-800">
                      {selectedPayouts.length} payout{selectedPayouts.length > 1 ? 's' : ''} selected
                    </p>
                    <p className="text-sm text-green-600">
                      Total: {formatPrice(
                        eligiblePayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
                        newBatch.currency
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateBatch}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700 rounded-xl"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4 mr-2" />
                    )}
                    Create Batch
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
