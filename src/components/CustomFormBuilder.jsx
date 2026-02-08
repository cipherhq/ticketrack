import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Type, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';

/**
 * CustomFormBuilder Component
 * 
 * Allows organizers to create custom checkout questions.
 * Supports: Text input, Dropdown (select)
 * Each field can be required or optional.
 */

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input', icon: Type, description: 'Short text answer' },
  { value: 'dropdown', label: 'Dropdown', icon: List, description: 'Select from options' },
];

export function CustomFormBuilder({ fields = [], onChange }) {
  const [expandedField, setExpandedField] = useState(null);

  // Add a new field
  const addField = () => {
    const newField = {
      id: `temp-${Date.now()}`,
      field_label: '',
      field_type: 'text',
      field_options: [],
      is_required: false,
      display_order: fields.length,
    };
    onChange([...fields, newField]);
    setExpandedField(newField.id);
  };

  // Update a field
  const updateField = (fieldId, updates) => {
    onChange(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  // Remove a field
  const removeField = (fieldId) => {
    onChange(fields.filter(f => f.id !== fieldId));
    if (expandedField === fieldId) setExpandedField(null);
  };

  // Move field up/down
  const moveField = (index, direction) => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    newFields.forEach((f, i) => f.display_order = i);
    onChange(newFields);
  };

  // Add option to dropdown
  const addOption = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    const options = field.field_options || [];
    updateField(fieldId, { field_options: [...options, ''] });
  };

  // Update dropdown option
  const updateOption = (fieldId, optionIndex, value) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    const options = [...(field.field_options || [])];
    options[optionIndex] = value;
    updateField(fieldId, { field_options: options });
  };

  // Remove dropdown option
  const removeOption = (fieldId, optionIndex) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    const options = (field.field_options || []).filter((_, i) => i !== optionIndex);
    updateField(fieldId, { field_options: options });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Custom Form</Label>
          <p className="text-sm text-muted-foreground">
            Collect additional information from attendees at checkout
          </p>
        </div>
      </div>

      {/* Fields List */}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields
            .sort((a, b) => a.display_order - b.display_order)
            .map((field, index) => (
              <Card 
                key={field.id} 
                className={`border transition-all ${expandedField === field.id ? 'border-[#2969FF] shadow-md' : 'border-border/10'}`}
              >
                <CardContent className="p-4">
                  {/* Collapsed View */}
                  <div 
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
                  >
                    {/* Drag Handle */}
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }}
                        disabled={index === 0}
                        className="p-0.5 text-foreground/30 hover:text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }}
                        disabled={index === fields.length - 1}
                        className="p-0.5 text-foreground/30 hover:text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Field Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {field.field_label || 'Untitled Question'}
                        </span>
                        {field.is_required && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Required</span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground capitalize">{field.field_type}</span>
                    </div>

                    {/* Actions */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Expanded View */}
                  {expandedField === field.id && (
                    <div className="mt-4 pt-4 border-t border-border/10 space-y-4">
                      {/* Question Label */}
                      <div className="space-y-2">
                        <Label>Question <span className="text-red-500">*</span></Label>
                        <Input
                          value={field.field_label}
                          onChange={(e) => updateField(field.id, { field_label: e.target.value })}
                          placeholder="e.g., What is your T-shirt size?"
                          className="rounded-xl"
                        />
                      </div>

                      {/* Field Type */}
                      <div className="space-y-2">
                        <Label>Answer Type</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {FIELD_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => updateField(field.id, { field_type: type.value })}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  field.field_type === type.value
                                    ? 'border-[#2969FF] bg-[#2969FF]/5'
                                    : 'border-border/10 hover:border-border/20'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${field.field_type === type.value ? 'text-[#2969FF]' : 'text-muted-foreground'}`} />
                                  <span className={`font-medium ${field.field_type === type.value ? 'text-[#2969FF]' : 'text-foreground'}`}>
                                    {type.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Dropdown Options */}
                      {field.field_type === 'dropdown' && (
                        <div className="space-y-2">
                          <Label>Options</Label>
                          <div className="space-y-2">
                            {(field.field_options || []).map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="rounded-xl"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(field.id, optIndex)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(field.id)}
                              className="rounded-xl"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Option
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Required Toggle */}
                      <div className="flex items-center gap-3 pt-2">
                        <Checkbox
                          id={`required-${field.id}`}
                          checked={field.is_required}
                          onCheckedChange={(checked) => updateField(field.id, { is_required: checked })}
                        />
                        <Label htmlFor={`required-${field.id}`} className="cursor-pointer">
                          Required field
                        </Label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Add Field Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addField}
        className="w-full rounded-xl border-dashed border-2 h-12"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Question
      </Button>

      {/* Helper Text */}
      {fields.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Add questions to collect extra information like meal preferences, t-shirt sizes, etc.
        </p>
      )}
    </div>
  );
}

export default CustomFormBuilder;
