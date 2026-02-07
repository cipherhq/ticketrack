import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building, CreditCard, AlertCircle, CheckCircle, 
  Loader2, Trash2, Star, Plus, Globe, Info, Eye, EyeOff 
} from 'lucide-react';
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

// ==================== BANK DATA ====================

const nigerianBanks = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '090267', name: 'Kuda Bank' },
  { code: '999992', name: 'Opay' },
  { code: '50515', name: 'Moniepoint' },
  { code: '999991', name: 'PalmPay' },
];

const ghanaBanks = [
  { code: 'GCB', name: 'GCB Bank' },
  { code: 'ECOBANK', name: 'Ecobank Ghana' },
  { code: 'STANBIC', name: 'Stanbic Bank Ghana' },
  { code: 'ABSA', name: 'Absa Bank Ghana' },
  { code: 'SCB', name: 'Standard Chartered Bank Ghana' },
  { code: 'ZENITH', name: 'Zenith Bank Ghana' },
  { code: 'UBA', name: 'United Bank for Africa Ghana' },
  { code: 'FIDELITY', name: 'Fidelity Bank Ghana' },
  { code: 'CAL', name: 'CAL Bank' },
  { code: 'ACCESS', name: 'Access Bank Ghana' },
  { code: 'GT', name: 'GT Bank Ghana' },
  { code: 'REPUBLIC', name: 'Republic Bank Ghana' },
  { code: 'ADB', name: 'Agricultural Development Bank' },
  { code: 'SOCIETE', name: 'Societe Generale Ghana' },
  { code: 'FIRSTATLANTIC', name: 'First Atlantic Bank' },
  { code: 'PRUDENTIAL', name: 'Prudential Bank' },
  { code: 'NIB', name: 'National Investment Bank' },
  { code: 'CONSOLIDATED', name: 'Consolidated Bank Ghana' },
  { code: 'FBN', name: 'First Bank Nigeria Ghana' },
  { code: 'BOA', name: 'Bank of Africa Ghana' },
];

const usBanks = [
  { name: 'Bank of America', routing: '026009593' },
  { name: 'Chase Bank', routing: '021000021' },
  { name: 'Wells Fargo', routing: '121000248' },
  { name: 'Citibank', routing: '021000089' },
  { name: 'US Bank', routing: '122105155' },
  { name: 'PNC Bank', routing: '043000096' },
  { name: 'Capital One', routing: '056073502' },
  { name: 'TD Bank', routing: '031101266' },
  { name: 'Truist Bank', routing: '061000104' },
  { name: 'Fifth Third Bank', routing: '042000314' },
  { name: 'Ally Bank', routing: '124003116' },
  { name: 'Discover Bank', routing: '031100649' },
  { name: 'Navy Federal Credit Union', routing: '256074974' },
  { name: 'USAA', routing: '314074269' },
  { name: 'Charles Schwab', routing: '121202211' },
  { name: 'Mercury', routing: '021214891' },
  { name: 'Relay', routing: '091311229' },
  { name: 'Other', routing: '' },
];

const ukBanks = [
  { name: 'Barclays', sortPrefix: '20' },
  { name: 'HSBC UK', sortPrefix: '40' },
  { name: 'Lloyds Bank', sortPrefix: '30' },
  { name: 'NatWest', sortPrefix: '60' },
  { name: 'Santander UK', sortPrefix: '09' },
  { name: 'Halifax', sortPrefix: '11' },
  { name: 'Royal Bank of Scotland', sortPrefix: '83' },
  { name: 'Nationwide', sortPrefix: '07' },
  { name: 'TSB', sortPrefix: '77' },
  { name: 'Metro Bank', sortPrefix: '23' },
  { name: 'Monzo', sortPrefix: '04' },
  { name: 'Starling Bank', sortPrefix: '60' },
  { name: 'Revolut', sortPrefix: '04' },
  { name: 'Other', sortPrefix: '' },
];

const canadianBanks = [
  { name: 'Royal Bank of Canada (RBC)', institution: '003' },
  { name: 'TD Canada Trust', institution: '004' },
  { name: 'Bank of Nova Scotia (Scotiabank)', institution: '002' },
  { name: 'Bank of Montreal (BMO)', institution: '001' },
  { name: 'Canadian Imperial Bank of Commerce (CIBC)', institution: '010' },
  { name: 'National Bank of Canada', institution: '006' },
  { name: 'HSBC Canada', institution: '016' },
  { name: 'Desjardins', institution: '815' },
  { name: 'Tangerine', institution: '614' },
  { name: 'Simplii Financial', institution: '010' },
  { name: 'EQ Bank', institution: '623' },
  { name: 'Wealthsimple Cash', institution: '935' },
  { name: 'Other', institution: '' },
];

// ==================== VALIDATION HELPERS ====================

// ABA Routing Number Checksum Validation
const validateUSRoutingNumber = (routing) => {
  if (!/^\d{9}$/.test(routing)) return false;
  const digits = routing.split('').map(Number);
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;
  return checksum === 0;
};

// UK Sort Code Validation (6 digits)
const validateUKSortCode = (sortCode) => {
  const cleaned = sortCode.replace(/[^0-9]/g, '');
  return /^\d{6}$/.test(cleaned);
};

// Format UK Sort Code as XX-XX-XX
const formatSortCode = (value) => {
  const cleaned = value.replace(/[^0-9]/g, '').slice(0, 6);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
};

// Canadian Transit Number Validation (5 digits)
const validateCATransitNumber = (transit) => {
  return /^\d{5}$/.test(transit);
};

// Canadian Institution Number Validation (3 digits)
const validateCAInstitutionNumber = (institution) => {
  return /^\d{3}$/.test(institution);
};

// ==================== MAIN COMPONENT ====================

export function AddBankAccount() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const countryCode = organizer?.country_code || 'NG';
  
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    accountNumberConfirm: '',
    bankCode: '',
    bankName: '',
    customBankName: '',
    // US fields
    routingNumber: '',
    accountType: 'checking',
    // UK fields
    sortCode: '',
    // CA fields
    transitNumber: '',
    institutionNumber: '',
  });
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const isPaystackCountry = ['NG', 'GH'].includes(countryCode);
  const isUSCountry = countryCode === 'US';
  const isUKCountry = countryCode === 'GB';
  const isCACountry = countryCode === 'CA';

  useEffect(() => {
    fetchBanks();
    if (organizer?.id) {
      loadBankAccounts();
    }
  }, [organizer?.id, countryCode]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      if (countryCode === 'NG') {
        const { data, error } = await supabase.functions.invoke('get-banks');
        if (error) throw error;
        if (data?.status && data?.data) {
          setBanks(data.data);
        } else {
          setBanks(nigerianBanks);
        }
      } else if (countryCode === 'GH') {
        // Try to fetch Ghana banks from Paystack, fallback to static list
        try {
          const { data, error } = await supabase.functions.invoke('get-banks', {
            body: { country: 'ghana' }
          });
          if (data?.status && data?.data) {
            setBanks(data.data);
          } else {
            setBanks(ghanaBanks);
          }
        } catch {
          setBanks(ghanaBanks);
        }
      } else if (countryCode === 'US') {
        setBanks(usBanks);
      } else if (countryCode === 'GB') {
        setBanks(ukBanks);
      } else if (countryCode === 'CA') {
        setBanks(canadianBanks);
      } else {
        setBanks([]);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      if (countryCode === 'NG') setBanks(nigerianBanks);
      else if (countryCode === 'GH') setBanks(ghanaBanks);
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadBankAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts_decrypted')
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
    let value = e.target.value.replace(/\D/g, '');
    
    // Different max lengths per country
    if (isPaystackCountry) value = value.slice(0, 10);
    else if (isUSCountry) value = value.slice(0, 17);
    else if (isUKCountry) value = value.slice(0, 8);
    else if (isCACountry) value = value.slice(0, 12);
    
    setFormData(prev => ({ ...prev, accountNumber: value, accountName: '' }));
    setIsVerified(false);
    setError('');
  };

  const handleAccountNumberConfirmChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (isPaystackCountry) value = value.slice(0, 10);
    else if (isUSCountry) value = value.slice(0, 17);
    else if (isUKCountry) value = value.slice(0, 8);
    else if (isCACountry) value = value.slice(0, 12);
    
    setFormData(prev => ({ ...prev, accountNumberConfirm: value }));
    setError('');
  };

  const handleBankChange = (value) => {
    if (isPaystackCountry) {
      const selectedBank = banks.find(b => b.code === value);
      setFormData(prev => ({ 
        ...prev, 
        bankCode: value, 
        bankName: selectedBank?.name || '',
        accountName: ''
      }));
    } else if (isUSCountry) {
      const selectedBank = usBanks.find(b => b.name === value);
      setFormData(prev => ({ 
        ...prev, 
        bankName: value,
        routingNumber: selectedBank?.routing || prev.routingNumber,
      }));
    } else if (isUKCountry) {
      setFormData(prev => ({ ...prev, bankName: value }));
    } else if (isCACountry) {
      const selectedBank = canadianBanks.find(b => b.name === value);
      setFormData(prev => ({ 
        ...prev, 
        bankName: value,
        institutionNumber: selectedBank?.institution || prev.institutionNumber,
      }));
    }
    setIsVerified(false);
    setError('');
  };

  const handleRoutingNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setFormData(prev => ({ ...prev, routingNumber: value }));
    setError('');
  };

  const handleSortCodeChange = (e) => {
    const formatted = formatSortCode(e.target.value);
    setFormData(prev => ({ ...prev, sortCode: formatted }));
    setError('');
  };

  const handleTransitNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setFormData(prev => ({ ...prev, transitNumber: value }));
    setError('');
  };

  const handleInstitutionNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
    setFormData(prev => ({ ...prev, institutionNumber: value }));
    setError('');
  };

  // Paystack verification for NG/GH
  const verifyAccount = async () => {
    if (formData.accountNumber.length !== 10 || !formData.bankCode) {
      setError('Please enter a valid 10-digit account number and select a bank');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-bank-account', {
        body: { 
          account_number: formData.accountNumber, 
          bank_code: formData.bankCode,
          country: countryCode === 'GH' ? 'ghana' : 'nigeria'
        },
      });
      if (error) throw error;
      if (data?.status && data?.data) {
        setIsVerified(true);
        setFormData(prev => ({ ...prev, accountName: data.data.account_name }));
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

  // Validation for international accounts
  const validateInternationalAccount = () => {
    // Check account numbers match
    if (formData.accountNumber !== formData.accountNumberConfirm) {
      setError('Account numbers do not match. Please re-enter.');
      return false;
    }

    if (!formData.accountName.trim()) {
      setError('Please enter the account holder name');
      return false;
    }

    if (!formData.bankName) {
      setError('Please select a bank');
      return false;
    }

    // If "Other" selected, must provide custom bank name
    if (formData.bankName === 'Other' && !formData.customBankName?.trim()) {
      setError('Please enter your bank name');
      return false;
    }

    if (isUSCountry) {
      if (!validateUSRoutingNumber(formData.routingNumber)) {
        setError('Invalid routing number. Please enter a valid 9-digit ABA routing number.');
        return false;
      }
      if (formData.accountNumber.length < 4) {
        setError('Please enter a valid account number');
        return false;
      }
    }

    if (isUKCountry) {
      if (!validateUKSortCode(formData.sortCode)) {
        setError('Invalid sort code. Please enter a valid 6-digit sort code.');
        return false;
      }
      if (formData.accountNumber.length !== 8) {
        setError('UK account numbers must be 8 digits');
        return false;
      }
    }

    if (isCACountry) {
      if (!validateCATransitNumber(formData.transitNumber)) {
        setError('Invalid transit number. Please enter a valid 5-digit transit number.');
        return false;
      }
      if (!validateCAInstitutionNumber(formData.institutionNumber)) {
        setError('Invalid institution number. Please enter a valid 3-digit institution number.');
        return false;
      }
      if (formData.accountNumber.length < 7) {
        setError('Please enter a valid account number (7-12 digits)');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isPaystackCountry && !isVerified) {
      setError('Please verify your account details first');
      return;
    }

    if (!isPaystackCountry && !validateInternationalAccount()) {
      return;
    }

    setIsSaving(true);
    try {
      // Determine final bank name (use custom if "Other" selected)
      const finalBankName = formData.bankName === 'Other' 
        ? formData.customBankName.trim() 
        : formData.bankName;

      // Build account data based on country
      const accountData = {
        organizer_id: organizer.id,
        country_code: countryCode,
        bank_name: finalBankName,
        account_name: formData.accountName,
        account_number_encrypted: formData.accountNumber, // Will be encrypted by RPC
        currency: getCurrency(),
        is_verified: true, // Paystack auto-verifies, others are trusted as entered
      };

      // Add country-specific fields
      if (isPaystackCountry) {
        accountData.bank_code = formData.bankCode;
      } else if (isUSCountry) {
        accountData.routing_number = formData.routingNumber;
        accountData.account_type = formData.accountType;
      } else if (isUKCountry) {
        accountData.sort_code = formData.sortCode.replace(/-/g, '');
      } else if (isCACountry) {
        accountData.transit_number = formData.transitNumber;
        accountData.institution_number = formData.institutionNumber;
      }

      const { data, error: insertError } = await supabase
        .from('bank_accounts')
        .insert(accountData)
        .select()
        .single();

      if (insertError) throw insertError;

      // If this is the first account, set as default
      const existingAccounts = bankAccounts.filter(a => a.country_code === countryCode);
      if (existingAccounts.length === 0 && data) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: true })
          .eq('id', data.id);
      }

      // Reset form
      setFormData({
        accountName: '',
        accountNumber: '',
        accountNumberConfirm: '',
        bankCode: '',
        bankName: '',
        customBankName: '',
        routingNumber: '',
        accountType: 'checking',
        sortCode: '',
        transitNumber: '',
        institutionNumber: '',
      });
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

  const getCurrency = () => {
    switch (countryCode) {
      case 'NG': return 'NGN';
      case 'GH': return 'GHS';
      case 'US': return 'USD';
      case 'GB': return 'GBP';
      case 'CA': return 'CAD';
      default: return 'USD';
    }
  };

  const getCountryFlag = () => {
    switch (countryCode) {
      case 'NG': return '🇳🇬';
      case 'GH': return '🇬🇭';
      case 'US': return '🇺🇸';
      case 'GB': return '🇬🇧';
      case 'CA': return '🇨🇦';
      default: return '🌍';
    }
  };

  const getCountryName = () => {
    switch (countryCode) {
      case 'NG': return 'Nigeria';
      case 'GH': return 'Ghana';
      case 'US': return 'United States';
      case 'GB': return 'United Kingdom';
      case 'CA': return 'Canada';
      default: return 'Unknown';
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

  const maskAccountNumber = (num) => {
    if (!num || num.length < 4) return '••••';
    return '••••' + num.slice(-4);
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/finance')} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Bank Accounts</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage your bank accounts for payouts</p>
        </div>
      </div>

      {/* Country indicator */}
      <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
        <Globe className="w-5 h-5 text-[#2969FF]" />
        <span className="text-2xl">{getCountryFlag()}</span>
        <span className="text-[#0F0F0F]">Adding bank account for <strong>{getCountryName()}</strong></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New Bank Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Bank Selection */}
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  {loadingBanks ? (
                    <div className="h-12 rounded-xl bg-[#F4F6FA] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0F0F0F]/40" />
                    </div>
                  ) : (
                    <Select 
                      value={isPaystackCountry ? formData.bankCode : formData.bankName} 
                      onValueChange={handleBankChange}
                    >
                      <SelectTrigger className="rounded-xl border-[#0F0F0F]/10 h-12">
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-64">
                        {isPaystackCountry ? (
                          banks.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                          ))
                        ) : (
                          banks.map((bank) => (
                            <SelectItem key={bank.name} value={bank.name}>{bank.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Custom Bank Name (when "Other" is selected) */}
                {!isPaystackCountry && formData.bankName === 'Other' && (
                  <div className="space-y-2">
                    <Label htmlFor="customBankName">Enter Bank Name</Label>
                    <Input
                      id="customBankName"
                      placeholder="Enter your bank's full name"
                      value={formData.customBankName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customBankName: e.target.value }))}
                      className="rounded-xl border-[#0F0F0F]/10 h-12"
                    />
                  </div>
                )}

                {/* US: Routing Number */}
                {isUSCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="routingNumber">Routing Number (ABA)</Label>
                    <Input
                      id="routingNumber"
                      placeholder="9-digit routing number"
                      value={formData.routingNumber}
                      onChange={handleRoutingNumberChange}
                      maxLength={9}
                      className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
                    />
                    <p className="text-sm text-[#0F0F0F]/60">
                      {formData.routingNumber.length}/9 digits
                      {formData.routingNumber.length === 9 && (
                        validateUSRoutingNumber(formData.routingNumber) 
                          ? <span className="text-green-600 ml-2">✓ Valid</span>
                          : <span className="text-red-600 ml-2">✗ Invalid checksum</span>
                      )}
                    </p>
                  </div>
                )}

                {/* UK: Sort Code */}
                {isUKCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="sortCode">Sort Code</Label>
                    <Input
                      id="sortCode"
                      placeholder="XX-XX-XX"
                      value={formData.sortCode}
                      onChange={handleSortCodeChange}
                      maxLength={8}
                      className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
                    />
                    <p className="text-sm text-[#0F0F0F]/60">6 digits in XX-XX-XX format</p>
                  </div>
                )}

                {/* CA: Transit & Institution Numbers */}
                {isCACountry && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transitNumber">Transit Number</Label>
                      <Input
                        id="transitNumber"
                        placeholder="5-digit branch number"
                        value={formData.transitNumber}
                        onChange={handleTransitNumberChange}
                        maxLength={5}
                        className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
                      />
                      <p className="text-sm text-[#0F0F0F]/60">{formData.transitNumber.length}/5 digits</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="institutionNumber">Institution Number</Label>
                      <Input
                        id="institutionNumber"
                        placeholder="3-digit bank ID"
                        value={formData.institutionNumber}
                        onChange={handleInstitutionNumberChange}
                        maxLength={3}
                        className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
                        disabled={formData.bankName && formData.bankName !== 'Other'}
                      />
                      <p className="text-sm text-[#0F0F0F]/60">{formData.institutionNumber.length}/3 digits</p>
                    </div>
                  </div>
                )}

                {/* Account Number */}
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="accountNumber"
                        type={showAccountNumber ? 'text' : 'password'}
                        placeholder={isPaystackCountry ? 'Enter 10-digit account number' : 'Enter account number'}
                        value={formData.accountNumber}
                        onChange={handleAccountNumberChange}
                        className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                      >
                        {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {isPaystackCountry && (
                      <Button
                        type="button"
                        onClick={verifyAccount}
                        disabled={isVerifying || formData.accountNumber.length !== 10 || !formData.bankCode}
                        className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-6"
                      >
                        {isVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying</> : 'Verify'}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-[#0F0F0F]/60">
                    {isPaystackCountry && `${formData.accountNumber.length}/10 digits`}
                    {isUSCountry && `${formData.accountNumber.length} digits (typically 10-17)`}
                    {isUKCountry && `${formData.accountNumber.length}/8 digits`}
                    {isCACountry && `${formData.accountNumber.length} digits (typically 7-12)`}
                  </p>
                </div>

                {/* Confirm Account Number (international only) */}
                {!isPaystackCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="accountNumberConfirm">Confirm Account Number</Label>
                    <Input
                      id="accountNumberConfirm"
                      type={showAccountNumber ? 'text' : 'password'}
                      placeholder="Re-enter account number"
                      value={formData.accountNumberConfirm}
                      onChange={handleAccountNumberConfirmChange}
                      className="rounded-xl border-[#0F0F0F]/10 h-12 font-mono"
                    />
                    {formData.accountNumber && formData.accountNumberConfirm && (
                      <p className={`text-sm ${formData.accountNumber === formData.accountNumberConfirm ? 'text-green-600' : 'text-red-600'}`}>
                        {formData.accountNumber === formData.accountNumberConfirm ? '✓ Account numbers match' : '✗ Account numbers do not match'}
                      </p>
                    )}
                  </div>
                )}

                {/* US: Account Type */}
                {isUSCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="accountType">Account Type</Label>
                    <Select value={formData.accountType} onValueChange={(value) => setFormData(prev => ({ ...prev, accountType: value }))}>
                      <SelectTrigger className="rounded-xl border-[#0F0F0F]/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="checking">Checking Account</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Verified Status (Paystack) */}
                {isPaystackCountry && isVerified && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Account Verified</p>
                      <p className="text-sm text-green-700 mt-1">{formData.accountName}</p>
                    </div>
                  </div>
                )}

                {/* Account Holder Name (international) */}
                {!isPaystackCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="accountName">Account Holder Name</Label>
                    <Input
                      id="accountName"
                      placeholder="Enter name exactly as it appears on your bank account"
                      value={formData.accountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                      className="rounded-xl border-[#0F0F0F]/10 h-12"
                    />
                    <p className="text-sm text-[#0F0F0F]/60">Must match the name on your bank account for verification</p>
                  </div>
                )}

                {/* Paystack verified account name (read-only) */}
                {isPaystackCountry && (
                  <div className="space-y-2">
                    <Label htmlFor="accountNameDisplay">Account Name</Label>
                    <Input
                      id="accountNameDisplay"
                      value={formData.accountName}
                      disabled
                      placeholder="Will be filled after verification"
                      className="rounded-xl border-[#0F0F0F]/10 bg-[#F4F6FA] h-12"
                    />
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {/* Info for international accounts */}
                {!isPaystackCountry && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Important</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Please double-check your bank details. Incorrect information may result in failed or delayed payouts.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={(isPaystackCountry && !isVerified) || isSaving}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12"
                >
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Add Bank Account</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
                <Building className="w-5 h-5" />
                {isPaystackCountry ? 'Instant Verification' : 'Bank Details Guide'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPaystackCountry ? (
                <>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">Instant Verification</p>
                    <p className="text-sm text-[#0F0F0F]/60">We verify your account details instantly using Paystack</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">Secure Payments</p>
                    <p className="text-sm text-[#0F0F0F]/60">Your bank details are encrypted and stored securely</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">Fast Payouts</p>
                    <p className="text-sm text-[#0F0F0F]/60">Verified accounts receive payouts within 24-48 hours</p>
                  </div>
                </>
              ) : isUSCountry ? (
                <>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🏦 Routing Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">9-digit ABA number, found at the bottom left of your checks or in your bank app</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🔢 Account Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">Your unique account number (10-17 digits)</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">📋 Account Type</p>
                    <p className="text-sm text-[#0F0F0F]/60">Most business payouts go to a Checking account</p>
                  </div>
                </>
              ) : isUKCountry ? (
                <>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🏦 Sort Code</p>
                    <p className="text-sm text-[#0F0F0F]/60">6-digit code in XX-XX-XX format, identifies your bank branch</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🔢 Account Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">8-digit UK bank account number</p>
                  </div>
                </>
              ) : isCACountry ? (
                <>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🏦 Institution Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">3-digit code that identifies your bank</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">📍 Transit Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">5-digit code that identifies your branch</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-[#0F0F0F]">🔢 Account Number</p>
                    <p className="text-sm text-[#0F0F0F]/60">Your unique account number (7-12 digits)</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[#0F0F0F]/10 rounded-2xl bg-[#2969FF]/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-[#2969FF] mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-[#0F0F0F]">Need Help?</p>
                  <p className="text-sm text-[#0F0F0F]/60">Having trouble adding your bank account? Contact our support team.</p>
                  <Button variant="outline" onClick={() => navigate('/contact')} className="rounded-xl border-[#2969FF] text-[#2969FF] w-full mt-2">
                    Contact Support
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Existing Bank Accounts */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Your Bank Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="text-center py-8">
              <Building className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No bank accounts added yet</p>
              <p className="text-sm text-[#0F0F0F]/40">Add your first bank account above</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 rounded-xl border ${
                    account.is_default
                      ? 'border-[#2969FF] bg-[#2969FF]/5'
                      : 'border-[#0F0F0F]/10 bg-[#F4F6FA]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-[#0F0F0F]/60" />
                      <span className="font-medium text-[#0F0F0F]">{account.bank_name}</span>
                    </div>
                    {account.is_default && (
                      <Badge className="bg-[#2969FF] text-white">Default</Badge>
                    )}
                  </div>
                  <p className="text-[#0F0F0F]/60 text-sm mb-1">{account.account_name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[#0F0F0F] font-mono text-sm">••••••{account.account_number?.slice(-4) || '••••'}</p>
                    <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                  </div>
                  

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#0F0F0F]/10">
                    {!account.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultAccount(account.id)}
                        className="text-[#2969FF] rounded-lg text-xs"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAccount(account.id)}
                      className="text-red-600 rounded-lg text-xs ml-auto"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
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
