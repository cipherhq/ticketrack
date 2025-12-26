import { useState, useEffect } from 'react';
import { Globe, Link2, Lock, Ticket, Mail, Plus, Trash2, Copy, RefreshCw, Check, Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';

/**
 * EventAccessSettings Component
 * 
 * Allows organizers to configure event visibility and access controls.
 * Fields are shown INLINE within each selected option for better UX.
 */

// Visibility options with icons and descriptions
const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    icon: Globe,
    description: 'Anyone can discover and purchase tickets',
    color: 'green',
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    icon: Link2,
    description: 'Only people with the direct link can access',
    color: 'blue',
  },
  {
    value: 'password',
    label: 'Password Protected',
    icon: Lock,
    description: 'Requires a password to view event details',
    color: 'orange',
  },
  {
    value: 'invite_only',
    label: 'Invite Code Only',
    icon: Ticket,
    description: 'Requires a unique invite code to purchase',
    color: 'purple',
  },
  {
    value: 'email_whitelist',
    label: 'Email Whitelist',
    icon: Mail,
    description: 'Only approved email addresses can purchase',
    color: 'pink',
  },
];

export function EventAccessSettings({
  visibility = 'public',
  accessPassword = '',
  accessSettings = {},
  onVisibilityChange,
  onPasswordChange,
  onSettingsChange,
  eventId = null,
  isEditMode = false,
}) {
  // Local state for UI
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCodes, setInviteCodes] = useState([]);
  const [emailWhitelist, setEmailWhitelist] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  
  // New code form
  const [newCode, setNewCode] = useState({
    code: '',
    name: '',
    maxUses: '',
    expiresAt: '',
  });
  
  // New email form
  const [newEmails, setNewEmails] = useState('');
  
  // Load existing invite codes and whitelist in edit mode
  useEffect(() => {
    if (isEditMode && eventId) {
      if (visibility === 'invite_only') {
        loadInviteCodes();
      }
      if (visibility === 'email_whitelist') {
        loadEmailWhitelist();
      }
    }
  }, [isEditMode, eventId, visibility]);
  
  // Load invite codes from database
  const loadInviteCodes = async () => {
    if (!eventId) return;
    setLoadingCodes(true);
    try {
      const { data, error } = await supabase
        .from('event_invite_codes')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInviteCodes(data || []);
    } catch (err) {
      console.error('Error loading invite codes:', err);
    } finally {
      setLoadingCodes(false);
    }
  };
  
  // Load email whitelist from database
  const loadEmailWhitelist = async () => {
    if (!eventId) return;
    setLoadingEmails(true);
    try {
      const { data, error } = await supabase
        .from('event_email_whitelist')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEmailWhitelist(data || []);
    } catch (err) {
      console.error('Error loading email whitelist:', err);
    } finally {
      setLoadingEmails(false);
    }
  };
  
  // Generate random invite code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(prev => ({ ...prev, code }));
  };
  
  // Add new invite code
  const addInviteCode = async () => {
    if (!newCode.code.trim()) {
      generateCode();
      return;
    }
    
    const codeData = {
      code: newCode.code.toUpperCase().trim(),
      name: newCode.name.trim() || null,
      maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
      expiresAt: newCode.expiresAt || null,
    };
    
    if (isEditMode && eventId) {
      try {
        const { data, error } = await supabase
          .from('event_invite_codes')
          .insert({
            event_id: eventId,
            code: codeData.code,
            name: codeData.name,
            max_uses: codeData.maxUses,
            expires_at: codeData.expiresAt,
          })
          .select()
          .single();
        
        if (error) throw error;
        setInviteCodes(prev => [data, ...prev]);
      } catch (err) {
        console.error('Error adding invite code:', err);
        alert('Failed to add invite code. It may already exist.');
        return;
      }
    } else {
      setInviteCodes(prev => [
        { id: Date.now(), ...codeData, current_uses: 0, is_active: true },
        ...prev,
      ]);
    }
    
    setNewCode({ code: '', name: '', maxUses: '', expiresAt: '' });
    onSettingsChange?.({ ...accessSettings, inviteCodes: [...inviteCodes, codeData] });
  };
  
  // Remove invite code
  const removeInviteCode = async (codeId) => {
    if (isEditMode && eventId) {
      try {
        const { error } = await supabase
          .from('event_invite_codes')
          .delete()
          .eq('id', codeId);
        if (error) throw error;
      } catch (err) {
        console.error('Error removing invite code:', err);
        return;
      }
    }
    setInviteCodes(prev => prev.filter(c => c.id !== codeId));
  };
  
  // Copy code to clipboard
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  
  // Add emails to whitelist
  const addEmails = async () => {
    const emails = newEmails
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes('@'));
    
    if (emails.length === 0) return;
    
    if (isEditMode && eventId) {
      try {
        const { data, error } = await supabase
          .from('event_email_whitelist')
          .insert(emails.map(email => ({ event_id: eventId, email })))
          .select();
        if (error) throw error;
        setEmailWhitelist(prev => [...(data || []), ...prev]);
      } catch (err) {
        console.error('Error adding emails:', err);
      }
    } else {
      const newEntries = emails.map(email => ({
        id: Date.now() + Math.random(),
        email,
        has_accessed: false,
      }));
      setEmailWhitelist(prev => [...newEntries, ...prev]);
    }
    
    setNewEmails('');
    onSettingsChange?.({ ...accessSettings, emailWhitelist: [...emailWhitelist, ...emails.map(email => ({ email }))] });
  };
  
  // Remove email from whitelist
  const removeEmail = async (emailId) => {
    if (isEditMode && eventId) {
      try {
        const { error } = await supabase
          .from('event_email_whitelist')
          .delete()
          .eq('id', emailId);
        if (error) throw error;
      } catch (err) {
        console.error('Error removing email:', err);
        return;
      }
    }
    setEmailWhitelist(prev => prev.filter(e => e.id !== emailId));
  };

  // Get color classes
  const getColorClasses = (color, isSelected) => {
    const colors = {
      green: { bg: 'bg-green-50', border: 'border-green-500', icon: 'bg-green-100 text-green-600' },
      blue: { bg: 'bg-blue-50', border: 'border-blue-500', icon: 'bg-blue-100 text-blue-600' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-500', icon: 'bg-orange-100 text-orange-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-500', icon: 'bg-purple-100 text-purple-600' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-500', icon: 'bg-pink-100 text-pink-600' },
    };
    return colors[color] || colors.blue;
  };
  
  return (
    <div className="space-y-3">
      <div className="mb-2">
        <Label className="text-base font-medium">Event Visibility</Label>
        <p className="text-sm text-[#0F0F0F]/60">Control who can discover and access your event</p>
      </div>
      
      {VISIBILITY_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = visibility === option.value;
        const colorClasses = getColorClasses(option.color, isSelected);
        
        return (
          <div
            key={option.value}
            onClick={() => onVisibilityChange(option.value)}
            className={`
              relative rounded-xl border-2 cursor-pointer transition-all overflow-hidden
              ${isSelected ? `${colorClasses.border} ${colorClasses.bg}` : 'border-[#0F0F0F]/10 bg-white hover:border-[#0F0F0F]/20'}
            `}
          >
            {/* Option Header */}
            <div className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? colorClasses.icon : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-[#0F0F0F]">{option.label}</h4>
                  {isSelected && <Badge className="bg-[#2969FF] text-white text-xs">Selected</Badge>}
                </div>
                <p className="text-sm text-[#0F0F0F]/60">{option.description}</p>
              </div>
              
              {/* Radio indicator */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-[#2969FF] bg-[#2969FF]' : 'border-[#0F0F0F]/20'}`}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
            
            {/* INLINE Fields - Password */}
            {isSelected && option.value === 'password' && (
              <div className="px-4 pb-4 pt-2 border-t border-[#0F0F0F]/10 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label className="text-sm">Event Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={accessPassword}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      placeholder="Enter a password for this event"
                      className="rounded-xl pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]/60"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[#0F0F0F]/50 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Share this password with your intended guests
                  </p>
                </div>
              </div>
            )}
            
            {/* INLINE Fields - Unlisted Info */}
            {isSelected && option.value === 'unlisted' && (
              <div className="px-4 pb-4 pt-2 border-t border-[#0F0F0F]/10" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-2 p-3 bg-blue-100/50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    This event won't appear in search or browse pages. Only people with the direct link can view and purchase tickets.
                  </p>
                </div>
              </div>
            )}
            
            {/* INLINE Fields - Invite Codes */}
            {isSelected && option.value === 'invite_only' && (
              <div className="px-4 pb-4 pt-2 border-t border-[#0F0F0F]/10 space-y-4" onClick={(e) => e.stopPropagation()}>
                {/* Add new code form */}
                <div className="p-3 bg-white rounded-lg border border-[#0F0F0F]/10 space-y-3">
                  <Label className="text-sm font-medium">Add Invite Code</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={newCode.code}
                        onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        placeholder="CODE"
                        className="rounded-lg font-mono uppercase text-sm"
                        maxLength={20}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={generateCode} title="Generate" className="shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      value={newCode.name}
                      onChange={(e) => setNewCode(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Label (optional)"
                      className="rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={newCode.maxUses}
                      onChange={(e) => setNewCode(prev => ({ ...prev, maxUses: e.target.value }))}
                      placeholder="Max uses (blank=unlimited)"
                      className="rounded-lg text-sm"
                      min="1"
                    />
                    <Input
                      type="datetime-local"
                      value={newCode.expiresAt}
                      onChange={(e) => setNewCode(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="rounded-lg text-sm"
                      title="Expiry date (optional)"
                    />
                  </div>
                  <Button type="button" onClick={addInviteCode} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-lg text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    {newCode.code ? 'Add Code' : 'Generate & Add'}
                  </Button>
                </div>
                
                {/* List of codes */}
                {inviteCodes.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {inviteCodes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#0F0F0F]/10">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-[#2969FF] text-sm">{code.code}</code>
                          {code.name && <Badge variant="outline" className="text-xs">{code.name}</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#0F0F0F]/50">{code.current_uses || 0}{code.max_uses ? `/${code.max_uses}` : ''}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => copyCode(code.code)} className="h-7 w-7">
                            {copiedCode === code.code ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeInviteCode(code.id)} className="h-7 w-7 text-red-500">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {inviteCodes.length === 0 && (
                  <p className="text-xs text-[#0F0F0F]/50 text-center py-2">No codes yet. Add one above.</p>
                )}
              </div>
            )}
            
            {/* INLINE Fields - Email Whitelist */}
            {isSelected && option.value === 'email_whitelist' && (
              <div className="px-4 pb-4 pt-2 border-t border-[#0F0F0F]/10 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label className="text-sm">Add Email Addresses</Label>
                  <Textarea
                    value={newEmails}
                    onChange={(e) => setNewEmails(e.target.value)}
                    placeholder="Enter emails (one per line or comma-separated)"
                    className="rounded-lg min-h-[80px] font-mono text-sm bg-white"
                  />
                  <Button type="button" onClick={addEmails} disabled={!newEmails.trim()} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-lg text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add to Whitelist
                  </Button>
                </div>
                
                {/* List of emails */}
                {emailWhitelist.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <Label className="text-xs text-[#0F0F0F]/60">{emailWhitelist.length} email{emailWhitelist.length !== 1 ? 's' : ''}</Label>
                    {emailWhitelist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-[#0F0F0F]/10">
                        <span className="text-sm font-mono truncate">{item.email}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEmail(item.id)} className="h-6 w-6 text-red-500 shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {emailWhitelist.length === 0 && (
                  <p className="text-xs text-[#0F0F0F]/50 text-center py-2">No emails yet. Add some above.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EventAccessSettings;
