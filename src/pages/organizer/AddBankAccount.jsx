import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, CreditCard, AlertCircle, CheckCircle, Loader2, Trash2, Star, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

export function AddBankAccount() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankCode: '',
    bankName: '',
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBanks();
    if (organizer?.id) {
      loadBankAccounts();
    }
  }, [organizer?.id]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-banks');
      if (error) throw error;
      if (data?.status && data?.data) {
        setBanks(data.data);
      } else {
        setBanks(fallbackBanks);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      setBanks(fallbackBanks);
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadBankAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleAccountNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, accountNumber: value, accountName: '' }));
    setIsVerified(false);
    setError('');
  };

  const handleBankChange = (bankCode) => {
    const selectedBank = banks.find(b => b.code === bankCode);
    setFormData({ 
      ...formData, 
      bankCode, 
      bankName: selectedBank?.name || '',
      accountName: ''
    });
    setIsVerified(false);
    setError('');
  };

  const verifyAccount = async () => {
    if (formData.accountNumber.length !== 10 || !formData.bankCode) {
      setError('Please enter a valid 10-digit account number and select a bank');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-bank-account', {
        body: { account_number: formData.accountNumber, bank_code: formData.bankCode },
      });
      if (error) throw error;
      if (data?.status && data?.data) {
        setIsVerified(true);
        setFormData({ ...formData, accountName: data.data.account_name });
      } else {
        setError(data?.message || 'Could not verify account. Please check the details and try again.');
      }
    } catch (error) {
      console.error('Error verifying account:', error);
      setError(error.message || 'Failed to verify account. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isVerified) {
      setError('Please verify your account details first');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('add_bank_account', {
        p_organizer_id: organizer.id,
        p_bank_name: formData.bankName,
        p_bank_code: formData.bankCode,
        p_account_number: formData.accountNumber,
        p_account_name: formData.accountName,
      });
      if (rpcError) throw rpcError;
      setFormData({ accountName: '', accountNumber: '', bankCode: '', bankName: '' });
      setIsVerified(false);
      await loadBankAccounts();
      alert('Bank account added successfully!');
    } catch (error) {
      console.error('Error saving bank account:', error);
      setError(error.message || 'Failed to save bank account. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const setDefaultAccount = async (accountId) => {
    try {
      await supabase.from('bank_accounts').update({ is_default: false }).eq('organizer_id', organizer.id);
      await supabase.from('bank_accounts').update({ is_default: true }).eq('id', accountId);
      await loadBankAccounts();
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const deleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', accountId);
      if (error) throw error;
      await loadBankAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete bank account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/finance')} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Bank Accounts</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage your bank accounts for payouts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
                <Plus className="w-5 h-5" />Add New Bank Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  {loadingBanks ? (
                    <div className="h-12 rounded-xl bg-[#F4F6FA] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0F0F0F]/40" />
                    </div>
                  ) : (
                    <Select value={formData.bankCode} onValueChange={handleBankChange}>
                      <SelectTrigger className="rounded-xl border-[#0F0F0F]/10 h-12">
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-64">
                        {banks.map((bank) => (
                          <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <div className="flex gap-2">
                    <Input id="accountNumber" placeholder="Enter 10-digit account number" value={formData.accountNumber} onChange={handleAccountNumberChange} maxLength={10} className="rounded-xl border-[#0F0F0F]/10 h-12" />
                    <Button type="button" onClick={verifyAccount} disabled={isVerifying || formData.accountNumber.length !== 10 || !formData.bankCode} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-6">
                      {isVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying</> : 'Verify'}
                    </Button>
                  </div>
                  <p className="text-sm text-[#0F0F0F]/60">{formData.accountNumber.length}/10 digits</p>
                </div>

                {isVerified && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div><p className="font-medium text-green-800">Account Verified</p><p className="text-sm text-green-700 mt-1">{formData.accountName}</p></div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /><p className="text-red-800">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input id="accountName" value={formData.accountName} disabled placeholder="Will be filled after verification" className="rounded-xl border-[#0F0F0F]/10 bg-[#F4F6FA] h-12" />
                </div>

                <Button type="submit" disabled={!isVerified || isSaving} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Plus className="w-4 h-4 mr-2" />Add Bank Account</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F] flex items-center gap-2"><Building className="w-5 h-5" />Why verify?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><p className="font-medium text-[#0F0F0F]">Instant Verification</p><p className="text-sm text-[#0F0F0F]/60">We verify your account details instantly using Paystack to ensure accurate payouts</p></div>
              <div className="space-y-2"><p className="font-medium text-[#0F0F0F]">Secure Payments</p><p className="text-sm text-[#0F0F0F]/60">Your bank details are encrypted and stored securely</p></div>
              <div className="space-y-2"><p className="font-medium text-[#0F0F0F]">Fast Payouts</p><p className="text-sm text-[#0F0F0F]/60">Verified accounts receive payouts within 24-48 hours</p></div>
            </CardContent>
          </Card>
          <Card className="border-[#0F0F0F]/10 rounded-2xl bg-[#2969FF]/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-[#2969FF] mt-0.5" />
                <div className="space-y-2"><p className="font-medium text-[#0F0F0F]">Need Help?</p><p className="text-sm text-[#0F0F0F]/60">Having trouble adding your bank account? Contact our support team.</p>
                  <Button variant="outline" onClick={() => navigate('/contact')} className="rounded-xl border-[#2969FF] text-[#2969FF] w-full mt-2">Contact Support</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle className="text-[#0F0F0F]">Your Bank Accounts</CardTitle></CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" /></div>
          ) : bankAccounts.length === 0 ? (
            <div className="text-center py-8"><Building className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" /><p className="text-[#0F0F0F]/60">No bank accounts added yet</p><p className="text-sm text-[#0F0F0F]/40">Add your first bank account above</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map((account) => (
                <div key={account.id} className={`p-4 rounded-xl border ${account.is_default ? 'border-[#2969FF] bg-[#2969FF]/5' : 'border-[#0F0F0F]/10 bg-[#F4F6FA]'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2"><Building className="w-5 h-5 text-[#0F0F0F]/60" /><span className="font-medium text-[#0F0F0F]">{account.bank_name}</span></div>
                    {account.is_default && <Badge className="bg-[#2969FF] text-white">Default</Badge>}
                  </div>
                  <p className="text-[#0F0F0F]/60 text-sm mb-1">{account.account_name}</p>
                  <p className="text-[#0F0F0F] font-mono text-sm">••••••••••</p>
                  {account.is_verified && <div className="flex items-center gap-1 mt-2 text-green-600"><CheckCircle className="w-3 h-3" /><span className="text-xs">Verified</span></div>}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#0F0F0F]/10">
                    {!account.is_default && <Button variant="ghost" size="sm" onClick={() => setDefaultAccount(account.id)} className="text-[#2969FF] rounded-lg text-xs"><Star className="w-3 h-3 mr-1" />Set Default</Button>}
                    <Button variant="ghost" size="sm" onClick={() => deleteAccount(account.id)} className="text-red-600 rounded-lg text-xs ml-auto"><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const fallbackBanks = [
  { code: '044', name: 'Access Bank' },{ code: '023', name: 'Citibank Nigeria' },{ code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },{ code: '011', name: 'First Bank of Nigeria' },{ code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },{ code: '030', name: 'Heritage Bank' },{ code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },{ code: '101', name: 'Providus Bank' },{ code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },{ code: '232', name: 'Sterling Bank' },{ code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },{ code: '215', name: 'Unity Bank' },{ code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },{ code: '090267', name: 'Kuda Bank' },{ code: '999992', name: 'Opay' },
  { code: '50515', name: 'Moniepoint' },{ code: '999991', name: 'PalmPay' },
];
