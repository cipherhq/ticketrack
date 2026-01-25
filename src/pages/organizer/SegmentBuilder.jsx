import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Target, Users, Plus, Trash2, Save, ArrowLeft, CheckCircle,
  Loader2, Eye, Tag, Calendar, DollarSign, Ticket, Heart,
  Mail, Phone, MessageSquare, RefreshCw, Copy, MoreVertical,
  Filter, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

// Condition field types
const CONDITION_FIELDS = [
  { 
    id: 'source_type', 
    label: 'Source Type', 
    type: 'select',
    options: [
      { value: 'ticket', label: 'Ticket Purchase' },
      { value: 'follower', label: 'Follower' },
      { value: 'imported', label: 'Imported' },
      { value: 'manual', label: 'Manual Entry' },
    ],
    icon: Users,
  },
  { 
    id: 'total_events_attended', 
    label: 'Events Attended', 
    type: 'number',
    icon: Ticket,
  },
  { 
    id: 'total_spent', 
    label: 'Total Spent', 
    type: 'currency',
    icon: DollarSign,
  },
  { 
    id: 'last_contact_days', 
    label: 'Last Contact (days ago)', 
    type: 'number',
    icon: Calendar,
  },
  { 
    id: 'email_opt_in', 
    label: 'Email Subscribed', 
    type: 'boolean',
    icon: Mail,
  },
  { 
    id: 'sms_opt_in', 
    label: 'SMS Subscribed', 
    type: 'boolean',
    icon: Phone,
  },
  { 
    id: 'whatsapp_opt_in', 
    label: 'WhatsApp Subscribed', 
    type: 'boolean',
    icon: MessageSquare,
  },
  { 
    id: 'tags', 
    label: 'Has Tag', 
    type: 'tag',
    icon: Tag,
  },
];

// Operators based on type
const OPERATORS = {
  select: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' },
    { value: 'greater_or_equal', label: 'is at least' },
    { value: 'less_or_equal', label: 'is at most' },
  ],
  currency: [
    { value: 'greater_than', label: 'more than' },
    { value: 'less_than', label: 'less than' },
    { value: 'greater_or_equal', label: 'at least' },
    { value: 'less_or_equal', label: 'at most' },
  ],
  boolean: [
    { value: 'equals', label: 'is' },
  ],
  tag: [
    { value: 'contains', label: 'includes' },
    { value: 'not_contains', label: 'does not include' },
  ],
};

// Color options
const COLORS = [
  '#2969FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export function SegmentBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { organizer } = useOrganizer();
  const isEditing = !!id;

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [matchingCount, setMatchingCount] = useState(null);
  const [previewContacts, setPreviewContacts] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    conditions: [],
    logic: 'and', // 'and' or 'or'
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id, id]);

  useEffect(() => {
    if (organizer?.id && form.conditions.length > 0) {
      calculateMatchingCount();
    } else {
      setMatchingCount(null);
    }
  }, [form.conditions, form.logic, organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSegments(),
        loadTags(),
      ]);

      if (isEditing) {
        await loadSegment();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    const { data } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('name');

    setSegments(data || []);
  };

  const loadTags = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('tags')
      .eq('organizer_id', organizer.id)
      .eq('is_active', true);

    const tags = new Set();
    (data || []).forEach(c => {
      (c.tags || []).forEach(t => tags.add(t));
    });
    setAllTags(Array.from(tags));
  };

  const loadSegment = async () => {
    const { data, error } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      alert('Segment not found');
      navigate('/organizer/segments');
      return;
    }

    // Parse conditions from criteria
    const conditions = [];
    const criteria = data.criteria || {};
    
    Object.entries(criteria).forEach(([key, value]) => {
      if (key === 'all') return; // Skip "all contacts" flag
      
      const field = CONDITION_FIELDS.find(f => f.id === key);
      if (field) {
        if (typeof value === 'object') {
          // Handle operators like { min: 3 }
          const operator = Object.keys(value)[0];
          conditions.push({
            id: Date.now() + Math.random(),
            field: key,
            operator: operator === 'min' ? 'greater_or_equal' : operator === 'max' ? 'less_or_equal' : 'equals',
            value: value[operator],
          });
        } else {
          conditions.push({
            id: Date.now() + Math.random(),
            field: key,
            operator: 'equals',
            value: value,
          });
        }
      }
    });

    setForm({
      name: data.name,
      description: data.description || '',
      color: data.color || COLORS[0],
      conditions,
      logic: 'and',
    });
  };

  const calculateMatchingCount = async () => {
    try {
      let query = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id)
        .eq('is_active', true);

      // Apply conditions
      for (const condition of form.conditions) {
        const field = CONDITION_FIELDS.find(f => f.id === condition.field);
        if (!field) continue;

        switch (condition.operator) {
          case 'equals':
            if (field.type === 'boolean') {
              query = query.eq(condition.field, condition.value === 'true');
            } else {
              query = query.eq(condition.field, condition.value);
            }
            break;
          case 'not_equals':
            query = query.neq(condition.field, condition.value);
            break;
          case 'greater_than':
            query = query.gt(condition.field, condition.value);
            break;
          case 'less_than':
            query = query.lt(condition.field, condition.value);
            break;
          case 'greater_or_equal':
            query = query.gte(condition.field, condition.value);
            break;
          case 'less_or_equal':
            query = query.lte(condition.field, condition.value);
            break;
          case 'contains':
            query = query.contains(condition.field, [condition.value]);
            break;
          case 'not_contains':
            // This is trickier - would need to use NOT
            break;
        }
      }

      const { count, error } = await query;
      if (!error) {
        setMatchingCount(count || 0);
      }
    } catch (error) {
      console.error('Error calculating count:', error);
    }
  };

  const loadPreview = async () => {
    try {
      let query = supabase
        .from('contacts')
        .select('id, full_name, email, phone, source_type, tags, total_events_attended, total_spent')
        .eq('organizer_id', organizer.id)
        .eq('is_active', true)
        .limit(10);

      // Apply same conditions as calculateMatchingCount
      for (const condition of form.conditions) {
        const field = CONDITION_FIELDS.find(f => f.id === condition.field);
        if (!field) continue;

        switch (condition.operator) {
          case 'equals':
            if (field.type === 'boolean') {
              query = query.eq(condition.field, condition.value === 'true');
            } else {
              query = query.eq(condition.field, condition.value);
            }
            break;
          case 'not_equals':
            query = query.neq(condition.field, condition.value);
            break;
          case 'greater_than':
            query = query.gt(condition.field, condition.value);
            break;
          case 'less_than':
            query = query.lt(condition.field, condition.value);
            break;
          case 'greater_or_equal':
            query = query.gte(condition.field, condition.value);
            break;
          case 'less_or_equal':
            query = query.lte(condition.field, condition.value);
            break;
          case 'contains':
            query = query.contains(condition.field, [condition.value]);
            break;
        }
      }

      const { data } = await query;
      setPreviewContacts(data || []);
      setShowPreview(true);
    } catch (error) {
      console.error('Error loading preview:', error);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const addCondition = () => {
    setForm(f => ({
      ...f,
      conditions: [
        ...f.conditions,
        {
          id: Date.now(),
          field: 'source_type',
          operator: 'equals',
          value: '',
        },
      ],
    }));
  };

  const updateCondition = (id, updates) => {
    setForm(f => ({
      ...f,
      conditions: f.conditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  };

  const removeCondition = (id) => {
    setForm(f => ({
      ...f,
      conditions: f.conditions.filter(c => c.id !== id),
    }));
  };

  const saveSegment = async () => {
    if (!form.name.trim()) {
      alert('Please enter a segment name');
      return;
    }

    setSaving(true);
    try {
      // Build criteria from conditions
      const criteria = {};
      form.conditions.forEach(condition => {
        const field = CONDITION_FIELDS.find(f => f.id === condition.field);
        if (!field || !condition.value) return;

        switch (condition.operator) {
          case 'equals':
            criteria[condition.field] = condition.value;
            break;
          case 'greater_than':
          case 'greater_or_equal':
            criteria[condition.field] = { min: parseFloat(condition.value) };
            break;
          case 'less_than':
          case 'less_or_equal':
            criteria[condition.field] = { max: parseFloat(condition.value) };
            break;
          case 'contains':
            criteria[condition.field] = { includes: condition.value };
            break;
          default:
            criteria[condition.field] = condition.value;
        }
      });

      const segmentData = {
        organizer_id: organizer.id,
        name: form.name,
        description: form.description,
        criteria,
        color: form.color,
        is_dynamic: true,
        contact_count: matchingCount || 0,
        last_calculated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase
          .from('contact_segments')
          .update(segmentData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_segments')
          .insert(segmentData);

        if (error) throw error;
      }

      navigate('/organizer/segments');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save segment: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSegment = async (segmentId) => {
    if (!confirm('Delete this segment?')) return;

    try {
      const { error } = await supabase
        .from('contact_segments')
        .delete()
        .eq('id', segmentId);

      if (error) throw error;
      loadSegments();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderConditionValue = (condition) => {
    const field = CONDITION_FIELDS.find(f => f.id === condition.field);
    if (!field) return null;

    switch (field.type) {
      case 'select':
        return (
          <Select
            value={condition.value}
            onValueChange={(v) => updateCondition(condition.id, { value: v })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            className="w-[120px]"
            placeholder="0"
          />
        );

      case 'boolean':
        return (
          <Select
            value={condition.value}
            onValueChange={(v) => updateCondition(condition.id, { value: v })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'tag':
        return (
          <Select
            value={condition.value}
            onValueChange={(v) => updateCondition(condition.id, { value: v })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select tag" />
            </SelectTrigger>
            <SelectContent>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            className="w-[180px]"
            placeholder="Value"
          />
        );
    }
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/organizer/contacts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0F0F0F]">
            {isEditing ? 'Edit Segment' : 'Create Segment'}
          </h1>
          <p className="text-[#0F0F0F]/60">Define audience segments for targeted campaigns</p>
        </div>
        <Button onClick={saveSegment} disabled={saving} className="bg-[#2969FF] text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Segment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader>
              <CardTitle>Segment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Segment Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., VIP Customers, Recent Buyers"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe who this segment includes..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setForm(f => ({ ...f, color }))}
                      className={`w-8 h-8 rounded-full transition-all ${
                        form.color === color ? 'ring-2 ring-offset-2 ring-[#0F0F0F]' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Conditions</CardTitle>
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="w-4 h-4 mr-1" />
                Add Condition
              </Button>
            </CardHeader>
            <CardContent>
              {form.conditions.length === 0 ? (
                <div className="text-center py-8 text-[#0F0F0F]/40">
                  <Filter className="w-12 h-12 mx-auto mb-2" />
                  <p>No conditions yet</p>
                  <p className="text-sm">Add conditions to filter contacts</p>
                  <Button variant="outline" onClick={addCondition} className="mt-4">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Condition
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.conditions.map((condition, index) => {
                    const field = CONDITION_FIELDS.find(f => f.id === condition.field);
                    const operators = field ? OPERATORS[field.type] : [];

                    return (
                      <div key={condition.id} className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-lg">
                        {index > 0 && (
                          <Badge variant="secondary" className="mr-2">
                            {form.logic.toUpperCase()}
                          </Badge>
                        )}

                        {/* Field Select */}
                        <Select
                          value={condition.field}
                          onValueChange={(v) => {
                            const newField = CONDITION_FIELDS.find(f => f.id === v);
                            const newOperator = OPERATORS[newField?.type]?.[0]?.value || 'equals';
                            updateCondition(condition.id, { field: v, operator: newOperator, value: '' });
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITION_FIELDS.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                <div className="flex items-center gap-2">
                                  <f.icon className="w-4 h-4" />
                                  {f.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator Select */}
                        <Select
                          value={condition.operator}
                          onValueChange={(v) => updateCondition(condition.id, { operator: v })}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Value Input */}
                        {renderConditionValue(condition)}

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(condition.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    );
                  })}

                  {form.conditions.length > 1 && (
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm text-[#0F0F0F]/60">Match</span>
                      <Select value={form.logic} onValueChange={(v) => setForm(f => ({ ...f, logic: v }))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">ALL</SelectItem>
                          <SelectItem value="or">ANY</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[#0F0F0F]/60">of the conditions</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[#0F0F0F]/60">Matching Contacts</span>
                <Button variant="ghost" size="sm" onClick={calculateMatchingCount}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-4xl font-bold" style={{ color: form.color }}>
                {matchingCount !== null ? matchingCount.toLocaleString() : '—'}
              </p>
              {matchingCount !== null && matchingCount > 0 && (
                <Button variant="outline" className="w-full mt-4" onClick={loadPreview}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Contacts
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Existing Segments */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Your Segments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {segments.length === 0 ? (
                <div className="text-center py-8 text-[#0F0F0F]/40 px-4">
                  <Target className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No segments yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#0F0F0F]/5">
                  {segments.slice(0, 5).map((segment) => (
                    <div key={segment.id} className="flex items-center justify-between p-3 hover:bg-[#F4F6FA]/50">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: segment.color || COLORS[0] }}
                        />
                        <div>
                          <p className="text-sm font-medium">{segment.name}</p>
                          <p className="text-xs text-[#0F0F0F]/40">
                            {segment.contact_count || 0} contacts
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/organizer/segments/${segment.id}`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteSegment(segment.id)}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: Matching Contacts</DialogTitle>
            <DialogDescription>
              Showing first 10 contacts that match your segment criteria
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            {previewContacts.length === 0 ? (
              <div className="text-center py-8 text-[#0F0F0F]/40">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <p>No matching contacts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {previewContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-4 p-3 bg-[#F4F6FA] rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-[#2969FF]/10 flex items-center justify-center">
                      <span className="font-semibold text-[#2969FF]">
                        {(contact.full_name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.full_name || 'Unknown'}</p>
                      <p className="text-sm text-[#0F0F0F]/60 truncate">
                        {contact.email || contact.phone}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-[#0F0F0F]/60">{contact.total_events_attended || 0} events</p>
                      <p className="text-[#0F0F0F]/40">₦{(contact.total_spent || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            <Button onClick={() => navigate('/organizer/hub?create=true')} className="bg-[#2969FF] text-white">
              <Mail className="w-4 h-4 mr-2" />
              Send Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SegmentBuilder;
