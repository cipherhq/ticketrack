import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Workflow, Plus, Play, Pause, Trash2, Edit, MoreVertical,
  Mail, Phone, MessageSquare, Tag, Clock, Users, TrendingUp,
  CheckCircle, XCircle, ArrowRight, Loader2, ChevronDown,
  Copy, Archive, Zap, Target, GitBranch
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const TRIGGER_TYPES = [
  { value: 'signup', label: 'New Signup', icon: Users, description: 'When a new contact is added' },
  { value: 'purchase', label: 'Ticket Purchase', icon: CheckCircle, description: 'After buying a ticket' },
  { value: 'event_registration', label: 'Event Registration', icon: Calendar, description: 'When registered for an event' },
  { value: 'tag_added', label: 'Tag Added', icon: Tag, description: 'When a specific tag is added' },
  { value: 'manual', label: 'Manual Enrollment', icon: Play, description: 'Manually add contacts' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail, color: 'blue' },
  { value: 'send_sms', label: 'Send SMS', icon: Phone, color: 'green' },
  { value: 'send_whatsapp', label: 'Send WhatsApp', icon: MessageSquare, color: 'emerald' },
  { value: 'add_tag', label: 'Add Tag', icon: Tag, color: 'purple' },
  { value: 'remove_tag', label: 'Remove Tag', icon: Tag, color: 'red' },
];

const DELAY_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

// For imports
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DripCampaigns() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const confirm = useConfirm();

  // State
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalEnrolled: 0,
    totalConverted: 0,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCampaigns(), loadStats()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('drip_campaigns')
      .select(`
        *,
        drip_campaign_steps(count)
      `)
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading campaigns:', error);
      return;
    }

    setCampaigns(data || []);
  };

  const loadStats = async () => {
    const { data } = await supabase
      .from('drip_campaigns')
      .select('status, total_enrolled, total_converted')
      .eq('organizer_id', organizer.id);

    if (data) {
      setStats({
        total: data.length,
        active: data.filter(c => c.status === 'active').length,
        totalEnrolled: data.reduce((sum, c) => sum + (c.total_enrolled || 0), 0),
        totalConverted: data.reduce((sum, c) => sum + (c.total_converted || 0), 0),
      });
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const toggleCampaignStatus = async (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    
    await supabase
      .from('drip_campaigns')
      .update({ 
        status: newStatus,
        activated_at: newStatus === 'active' ? new Date().toISOString() : campaign.activated_at,
      })
      .eq('id', campaign.id);

    loadData();
  };

  const deleteCampaign = async (id) => {
    if (!(await confirm('Delete Drip Campaign', 'Delete this drip campaign? This will also remove all enrollments.', { variant: 'destructive' }))) return;
    
    await supabase.from('drip_campaigns').delete().eq('id', id);
    loadData();
  };

  const duplicateCampaign = async (campaign) => {
    // Get steps
    const { data: steps } = await supabase
      .from('drip_campaign_steps')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('step_number');

    // Create new campaign
    const { data: newCampaign } = await supabase
      .from('drip_campaigns')
      .insert({
        organizer_id: organizer.id,
        name: `${campaign.name} (Copy)`,
        description: campaign.description,
        trigger_type: campaign.trigger_type,
        trigger_config: campaign.trigger_config,
        entry_criteria: campaign.entry_criteria,
        exit_criteria: campaign.exit_criteria,
        goal_type: campaign.goal_type,
        goal_config: campaign.goal_config,
        status: 'draft',
      })
      .select()
      .single();

    if (newCampaign && steps) {
      // Copy steps
      for (const step of steps) {
        await supabase
          .from('drip_campaign_steps')
          .insert({
            campaign_id: newCampaign.id,
            organizer_id: organizer.id,
            step_number: step.step_number,
            name: step.name,
            delay_type: step.delay_type,
            delay_value: step.delay_value,
            delay_unit: step.delay_unit,
            action_type: step.action_type,
            action_config: step.action_config,
          });
      }
    }

    loadData();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Drip Campaigns</h1>
          <p className="text-muted-foreground">Automated multi-step message sequences</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#2969FF] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Drip Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Workflow className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEnrolled}</p>
                <p className="text-xs text-muted-foreground">Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalConverted}</p>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-12 text-center">
            <Workflow className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Drip Campaigns Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create automated sequences to nurture your contacts
            </p>
            <Button onClick={() => setShowCreate(true)} className="bg-[#2969FF] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Drip Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onToggle={() => toggleCampaignStatus(campaign)}
              onEdit={() => {
                setSelectedCampaign(campaign);
                setShowBuilder(true);
              }}
              onDelete={() => deleteCampaign(campaign.id)}
              onDuplicate={() => duplicateCampaign(campaign)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateDripDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        organizerId={organizer?.id}
        onCreated={(campaign) => {
          setShowCreate(false);
          setSelectedCampaign(campaign);
          setShowBuilder(true);
          loadData();
        }}
      />

      {/* Builder Dialog */}
      {selectedCampaign && (
        <DripBuilder
          open={showBuilder}
          onClose={() => {
            setShowBuilder(false);
            setSelectedCampaign(null);
            loadData();
          }}
          campaign={selectedCampaign}
          organizerId={organizer?.id}
        />
      )}
    </div>
  );
}

// ============================================================================
// CAMPAIGN CARD COMPONENT
// ============================================================================

function CampaignCard({ campaign, onToggle, onEdit, onDelete, onDuplicate }) {
  const statusColors = {
    draft: 'bg-muted text-foreground/80',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  const triggerLabels = {
    signup: 'New Signup',
    purchase: 'Purchase',
    event_registration: 'Event Registration',
    tag_added: 'Tag Added',
    manual: 'Manual',
  };

  const stepCount = campaign.drip_campaign_steps?.[0]?.count || 0;
  const conversionRate = campaign.total_enrolled > 0
    ? ((campaign.total_converted / campaign.total_enrolled) * 100).toFixed(1)
    : 0;

  return (
    <Card className="border-border/10 rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              campaign.status === 'active' ? 'bg-green-100' : 'bg-muted'
            }`}>
              <Workflow className={`w-6 h-6 ${
                campaign.status === 'active' ? 'text-green-600' : 'text-muted-foreground'
              }`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
                <Badge className={statusColors[campaign.status]}>
                  {campaign.status}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {campaign.description || 'No description'}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  <span>{triggerLabels[campaign.trigger_type] || campaign.trigger_type}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <GitBranch className="w-4 h-4" />
                  <span>{stepCount} steps</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{campaign.total_enrolled || 0} enrolled</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <Target className="w-4 h-4" />
                  <span>{conversionRate}% converted</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className={campaign.status === 'active' ? 'text-yellow-600' : 'text-green-600'}
            >
              {campaign.status === 'active' ? (
                <><Pause className="w-4 h-4 mr-1" /> Pause</>
              ) : (
                <><Play className="w-4 h-4 mr-1" /> Activate</>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Steps
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE DIALOG
// ============================================================================

function CreateDripDialog({ open, onClose, organizerId, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('signup');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('drip_campaigns')
        .insert({
          organizer_id: organizerId,
          name,
          description,
          trigger_type: triggerType,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      setName('');
      setDescription('');
      setTriggerType('signup');
      onCreated(data);
    } catch (error) {
      toast.error('Failed to create campaign: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Drip Campaign</DialogTitle>
          <DialogDescription>
            Set up an automated message sequence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Campaign Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Series"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this campaign do?"
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Trigger</label>
            <p className="text-xs text-muted-foreground mb-2">When should contacts enter this campaign?</p>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map(trigger => (
                  <SelectItem key={trigger.value} value={trigger.value}>
                    <div className="flex items-center gap-2">
                      <trigger.icon className="w-4 h-4" />
                      <span>{trigger.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-[#2969FF] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create & Add Steps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DRIP BUILDER DIALOG
// ============================================================================

function DripBuilder({ open, onClose, campaign, organizerId }) {
  const confirm = useConfirm();
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStep, setEditingStep] = useState(null);

  useEffect(() => {
    if (open && campaign) {
      loadSteps();
    }
  }, [open, campaign]);

  const loadSteps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('drip_campaign_steps')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('step_number');

    setSteps(data || []);
    setLoading(false);
  };

  const addStep = async () => {
    const newStep = {
      campaign_id: campaign.id,
      organizer_id: organizerId,
      step_number: steps.length + 1,
      name: `Step ${steps.length + 1}`,
      delay_type: steps.length === 0 ? 'immediate' : 'delay',
      delay_value: 1,
      delay_unit: 'days',
      action_type: 'send_email',
      action_config: { subject: '', body: '' },
    };

    const { data, error } = await supabase
      .from('drip_campaign_steps')
      .insert(newStep)
      .select()
      .single();

    if (data) {
      setSteps([...steps, data]);
      setEditingStep(data);
    }
  };

  const updateStep = async (stepId, updates) => {
    await supabase
      .from('drip_campaign_steps')
      .update(updates)
      .eq('id', stepId);

    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  const deleteStep = async (stepId) => {
    if (!(await confirm('Delete Step', 'Delete this step?', { variant: 'destructive' }))) return;

    await supabase
      .from('drip_campaign_steps')
      .delete()
      .eq('id', stepId);

    // Renumber remaining steps
    const remaining = steps.filter(s => s.id !== stepId);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].step_number !== i + 1) {
        await supabase
          .from('drip_campaign_steps')
          .update({ step_number: i + 1 })
          .eq('id', remaining[i].id);
      }
    }

    loadSteps();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Build your automated sequence
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
          </div>
        ) : (
          <div className="py-4">
            {/* Steps Flow */}
            <div className="space-y-3">
              {/* Trigger */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">Trigger: {TRIGGER_TYPES.find(t => t.value === campaign.trigger_type)?.label}</p>
                  <p className="text-sm text-muted-foreground">Contact enters the sequence</p>
                </div>
              </div>

              {/* Steps */}
              {steps.map((step, index) => (
                <div key={step.id}>
                  {/* Connector */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 flex justify-center">
                      <div className="w-0.5 h-8 bg-[#0F0F0F]/20" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {step.delay_type === 'immediate' ? 'Immediately' : 
                       `Wait ${step.delay_value} ${step.delay_unit}`}
                    </div>
                  </div>

                  {/* Step Card */}
                  <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    editingStep?.id === step.id ? 'border-[#2969FF] bg-blue-50' : 'border-border/10 bg-card hover:border-border/20'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.action_type.includes('email') ? 'bg-blue-100 text-blue-600' :
                      step.action_type.includes('sms') ? 'bg-green-100 text-green-600' :
                      step.action_type.includes('whatsapp') ? 'bg-emerald-100 text-emerald-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {step.action_type.includes('email') ? <Mail className="w-5 h-5" /> :
                       step.action_type.includes('sms') ? <Phone className="w-5 h-5" /> :
                       step.action_type.includes('whatsapp') ? <MessageSquare className="w-5 h-5" /> :
                       <Tag className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{step.name}</p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStep(editingStep?.id === step.id ? null : step)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStep(step.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ACTION_TYPES.find(a => a.value === step.action_type)?.label}
                        {step.action_config?.subject && `: ${step.action_config.subject}`}
                      </p>
                    </div>
                  </div>

                  {/* Edit Panel */}
                  {editingStep?.id === step.id && (
                    <StepEditor
                      step={step}
                      onUpdate={(updates) => updateStep(step.id, updates)}
                      onClose={() => setEditingStep(null)}
                    />
                  )}
                </div>
              ))}

              {/* Add Step Button */}
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 flex justify-center">
                  {steps.length > 0 && <div className="w-0.5 h-8 bg-[#0F0F0F]/20" />}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={addStep}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// STEP EDITOR
// ============================================================================

function StepEditor({ step, onUpdate, onClose }) {
  const [name, setName] = useState(step.name || '');
  const [delayType, setDelayType] = useState(step.delay_type || 'delay');
  const [delayValue, setDelayValue] = useState(step.delay_value || 1);
  const [delayUnit, setDelayUnit] = useState(step.delay_unit || 'days');
  const [actionType, setActionType] = useState(step.action_type || 'send_email');
  const [actionConfig, setActionConfig] = useState(step.action_config || {});

  const handleSave = () => {
    onUpdate({
      name,
      delay_type: delayType,
      delay_value: delayValue,
      delay_unit: delayUnit,
      action_type: actionType,
      action_config: actionConfig,
    });
    onClose();
  };

  return (
    <div className="mt-3 p-4 bg-muted rounded-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Step Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Action Type</label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(action => (
                <SelectItem key={action.value} value={action.value}>
                  <div className="flex items-center gap-2">
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Timing</label>
        <div className="flex items-center gap-2 mt-1">
          <Select value={delayType} onValueChange={setDelayType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediately</SelectItem>
              <SelectItem value="delay">Wait</SelectItem>
            </SelectContent>
          </Select>

          {delayType === 'delay' && (
            <>
              <Input
                type="number"
                min={1}
                value={delayValue}
                onChange={(e) => setDelayValue(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-20"
              />
              <Select value={delayUnit} onValueChange={setDelayUnit}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_UNITS.map(unit => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* Action-specific config */}
      {actionType === 'send_email' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={actionConfig.subject || ''}
              onChange={(e) => setActionConfig({ ...actionConfig, subject: e.target.value })}
              placeholder="Email subject line"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Body</label>
            <Textarea
              value={actionConfig.body || ''}
              onChange={(e) => setActionConfig({ ...actionConfig, body: e.target.value })}
              placeholder="Email content... Use {{first_name}} for personalization"
              className="mt-1"
              rows={4}
            />
          </div>
        </div>
      )}

      {(actionType === 'send_sms' || actionType === 'send_whatsapp') && (
        <div>
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={actionConfig.message || ''}
            onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
            placeholder="Message content... Use {{first_name}} for personalization"
            className="mt-1"
            rows={3}
          />
        </div>
      )}

      {(actionType === 'add_tag' || actionType === 'remove_tag') && (
        <div>
          <label className="text-sm font-medium">Tag</label>
          <Input
            value={actionConfig.tag || ''}
            onChange={(e) => setActionConfig({ ...actionConfig, tag: e.target.value })}
            placeholder="Enter tag name"
            className="mt-1"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} className="bg-[#2969FF] text-white">
          Save Step
        </Button>
      </div>
    </div>
  );
}

export default DripCampaigns;
