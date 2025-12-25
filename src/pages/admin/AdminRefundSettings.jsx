import { useState, useEffect } from 'react';
import { Loader2, Edit2, Save, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

export function AdminRefundSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [refundFees, setRefundFees] = useState([]);
  const [refundModal, setRefundModal] = useState({ open: false, data: null });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [countriesRes, currenciesRes, feesRes] = await Promise.all([
        supabase.from('countries').select('*').eq('is_active', true).order('name'),
        supabase.from('currencies').select('*').eq('is_active', true),
        supabase.from('country_features').select('*').eq('feature_id', 'refund_fee'),
      ]);
      setCountries(countriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setRefundFees(feesRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfig = (code) => {
    const fee = refundFees.find(f => f.country_code === code);
    if (fee && fee.config) {
      return { fee_type: fee.config.fee_type || 'percentage', fee_value: fee.config.fee_value, min_fee: fee.config.min_fee, max_fee: fee.config.max_fee };
    }
    return { fee_type: 'percentage', fee_value: 5, min_fee: 0, max_fee: 99999 };
  };

  const calcRefund = (amount, config) => {
    const feeValue = parseFloat(config.fee_value) || 0;
    const minFee = parseFloat(config.min_fee) || 0;
    const maxFee = parseFloat(config.max_fee) || 999999;
    let fee = config.fee_type === 'percentage' ? amount * (feeValue / 100) : feeValue;
    fee = Math.max(minFee, Math.min(maxFee, fee));
    return { fee: fee.toFixed(2), refund: (amount - fee).toFixed(2) };
  };

  const saveRefundFee = async () => {
    setSaving(true);
    try {
      const d = refundModal.data;
      await supabase.from('country_features').update({ config: { fee_type: d.fee_type, fee_value: parseFloat(d.fee_value) || 5, min_fee: d.min_fee !== '' && d.min_fee !== undefined ? parseFloat(d.min_fee) : 0, max_fee: d.max_fee !== '' && d.max_fee !== undefined ? parseFloat(d.max_fee) : 99999 }, is_enabled: true }).eq('country_code', d.country_code).eq('feature_id', 'refund_fee');
      setRefundModal({ open: false, data: null });
      loadData();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateModal = (field, value) => setRefundModal(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Refund Fee Settings</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Configure refund processing fees by country</p>
        </div>
        <Button variant="outline" onClick={loadData} className="rounded-xl"><RotateCcw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Refund Fee by Country</CardTitle>
          <p className="text-sm text-[#0F0F0F]/60">Fee deducted from refunds to cover payment gateway charges.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {countries.map(country => {
              const cur = currencies.find(c => c.code === country.default_currency);
              const cfg = getConfig(country.code);
              const sample = calcRefund(10000, cfg);
              const sym = cur?.symbol || '$';
              return (
                <div key={country.code} className="p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-sm">{country.code}</div>
                      <div><h4 className="font-medium text-[#0F0F0F]">{country.name}</h4><p className="text-sm text-[#0F0F0F]/60">{sym} {cur?.name}</p></div>
                    </div>
                    <Button variant="outline" onClick={() => setRefundModal({ open: true, data: { country_code: country.code, country_name: country.name, currency_symbol: sym, ...cfg }})} className="rounded-xl"><Edit2 className="w-4 h-4 mr-2" /> Configure</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Fee Type</p><p className="font-semibold capitalize">{cfg.fee_type}</p></div>
                    <div className="p-3 bg-white rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Fee Value</p><p className="font-semibold">{cfg.fee_type === 'percentage' ? cfg.fee_value + '%' : sym + cfg.fee_value}</p></div>
                    <div className="p-3 bg-white rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Min Fee</p><p className="font-semibold">{sym}{Number(cfg.min_fee || 0).toLocaleString()}</p></div>
                    <div className="p-3 bg-white rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Max Fee</p><p className="font-semibold">{sym}{Number(cfg.max_fee || 0).toLocaleString()}</p></div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">Example: {sym}10,000 refund</p>
                    <p className="text-sm text-blue-900">Fee: {sym}{parseFloat(sample.fee).toLocaleString()} → Customer gets: <strong>{sym}{parseFloat(sample.refund).toLocaleString()}</strong></p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Dialog open={refundModal.open} onOpenChange={(o) => { if(!o) setRefundModal({ open: false, data: null }); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>Configure Refund Fee - {refundModal.data?.country_name}</DialogTitle></DialogHeader>
          {refundModal.data && (
            <div className="space-y-4">
              <div><Label>Fee Type</Label><Select value={refundModal.data.fee_type} onValueChange={(v) => updateModal('fee_type', v)}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent></Select></div>
              <div><Label>{refundModal.data.fee_type === 'percentage' ? 'Fee %' : 'Fee Amount'}</Label><Input type="number" step="0.1" value={refundModal.data.fee_value} onChange={(e) => updateModal('fee_value', e.target.value)} className="rounded-xl mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Min Fee ({refundModal.data.currency_symbol})</Label><Input type="number" value={refundModal.data.min_fee} onChange={(e) => updateModal('min_fee', e.target.value)} className="rounded-xl mt-1" /></div>
                <div><Label>Max Fee ({refundModal.data.currency_symbol})</Label><Input type="number" value={refundModal.data.max_fee} onChange={(e) => updateModal('max_fee', e.target.value)} className="rounded-xl mt-1" /></div>
              </div>
              <div className="p-4 bg-[#F4F6FA] rounded-xl"><p className="text-sm font-medium mb-2">Preview</p>{[1000, 5000, 10000].map(amt => { const p = calcRefund(amt, refundModal.data); return <div key={amt} className="flex justify-between text-sm py-1"><span className="text-[#0F0F0F]/60">{refundModal.data.currency_symbol}{amt.toLocaleString()}:</span><span>Fee: {refundModal.data.currency_symbol}{parseFloat(p.fee).toLocaleString()} → <span className="text-green-600 font-medium">{refundModal.data.currency_symbol}{parseFloat(p.refund).toLocaleString()}</span></span></div>; })}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveRefundFee} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
