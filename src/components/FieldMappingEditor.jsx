import { useState, useEffect } from 'react'
import { 
  ArrowRight, Check, X, AlertCircle, HelpCircle, 
  Plus, Trash2, Settings, RefreshCw, Merge
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================================
// TICKETRACK STANDARD FIELDS
// ============================================================================

export const TICKETRACK_CONTACT_FIELDS = [
  { id: 'email', label: 'Email', required: true, type: 'email', icon: '📧' },
  { id: 'full_name', label: 'Full Name', required: false, type: 'string', icon: '👤' },
  { id: 'first_name', label: 'First Name', required: false, type: 'string', icon: '👤' },
  { id: 'last_name', label: 'Last Name', required: false, type: 'string', icon: '👤' },
  { id: 'phone', label: 'Phone Number', required: false, type: 'phone', icon: '📱' },
  { id: 'date_of_birth', label: 'Date of Birth', required: false, type: 'date', icon: '🎂' },
  { id: 'gender', label: 'Gender', required: false, type: 'string', icon: '⚧' },
  { id: 'city', label: 'City', required: false, type: 'string', icon: '🏙️' },
  { id: 'country', label: 'Country', required: false, type: 'string', icon: '🌍' },
  { id: 'instagram', label: 'Instagram Handle', required: false, type: 'string', icon: '📸' },
  { id: 'twitter', label: 'Twitter/X Handle', required: false, type: 'string', icon: '🐦' },
  { id: 'company', label: 'Company', required: false, type: 'string', icon: '🏢' },
  { id: 'job_title', label: 'Job Title', required: false, type: 'string', icon: '💼' },
  { id: 'notes', label: 'Notes', required: false, type: 'text', icon: '📝' },
  { id: 'tags', label: 'Tags', required: false, type: 'array', icon: '🏷️' },
]

export const TICKETRACK_ATTENDEE_FIELDS = [
  ...TICKETRACK_CONTACT_FIELDS,
  { id: 'ticket_type', label: 'Ticket Type', required: false, type: 'string', icon: '🎫' },
  { id: 'order_id', label: 'Order ID', required: false, type: 'string', icon: '🔢' },
  { id: 'order_date', label: 'Order Date', required: false, type: 'date', icon: '📅' },
  { id: 'amount_paid', label: 'Amount Paid', required: false, type: 'number', icon: '💰' },
  { id: 'currency', label: 'Currency', required: false, type: 'string', icon: '💱' },
  { id: 'checked_in', label: 'Checked In', required: false, type: 'boolean', icon: '✅' },
  { id: 'check_in_time', label: 'Check-in Time', required: false, type: 'datetime', icon: '⏰' },
]

export const TICKETRACK_EVENT_FIELDS = [
  { id: 'title', label: 'Event Title', required: true, type: 'string', icon: '📌' },
  { id: 'description', label: 'Description', required: false, type: 'text', icon: '📝' },
  { id: 'start_date', label: 'Start Date/Time', required: true, type: 'datetime', icon: '🗓️' },
  { id: 'end_date', label: 'End Date/Time', required: false, type: 'datetime', icon: '🗓️' },
  { id: 'venue_name', label: 'Venue Name', required: false, type: 'string', icon: '🏟️' },
  { id: 'venue_address', label: 'Venue Address', required: false, type: 'string', icon: '📍' },
  { id: 'city', label: 'City', required: false, type: 'string', icon: '🏙️' },
  { id: 'country_code', label: 'Country Code', required: false, type: 'string', icon: '🌍' },
  { id: 'image_url', label: 'Event Image URL', required: false, type: 'url', icon: '🖼️' },
  { id: 'is_virtual', label: 'Virtual/Online Event', required: false, type: 'boolean', icon: '💻' },
  { id: 'is_free', label: 'Free Event', required: false, type: 'boolean', icon: '🆓' },
  { id: 'currency', label: 'Currency', required: false, type: 'string', icon: '💱' },
  { id: 'external_url', label: 'External URL', required: false, type: 'url', icon: '🔗' },
]

// ============================================================================
// FIELD TRANSFORMATION OPTIONS
// ============================================================================

const TRANSFORMATIONS = [
  { id: 'none', label: 'No transformation', description: 'Use value as-is' },
  { id: 'combine', label: 'Combine fields', description: 'Merge multiple fields (e.g., First + Last name)' },
  { id: 'split_first', label: 'Split - First part', description: 'Take first part before space' },
  { id: 'split_last', label: 'Split - Last part', description: 'Take last part after space' },
  { id: 'lowercase', label: 'Lowercase', description: 'Convert to lowercase' },
  { id: 'uppercase', label: 'Uppercase', description: 'Convert to uppercase' },
  { id: 'trim', label: 'Trim whitespace', description: 'Remove leading/trailing spaces' },
  { id: 'parse_date', label: 'Parse date', description: 'Convert to date format' },
  { id: 'parse_phone', label: 'Format phone', description: 'Normalize phone number format' },
  { id: 'boolean', label: 'Convert to Yes/No', description: 'Convert truthy values to boolean' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FieldMappingEditor({
  sourceFields = [],       // Fields available from external source
  fieldType = 'contact',   // 'contact', 'attendee', or 'event'
  existingMappings = {},   // Previously saved mappings
  onMappingsChange,        // Callback when mappings change
  platform = 'custom',     // Platform name for context
  showAdvanced = true,     // Show transformation options
}) {
  const [mappings, setMappings] = useState({})
  const [showTransformations, setShowTransformations] = useState(false)

  // Get target fields based on type
  const targetFields = fieldType === 'event' 
    ? TICKETRACK_EVENT_FIELDS 
    : fieldType === 'attendee' 
      ? TICKETRACK_ATTENDEE_FIELDS 
      : TICKETRACK_CONTACT_FIELDS

  // Initialize with existing or auto-detected mappings
  useEffect(() => {
    if (Object.keys(existingMappings).length > 0) {
      setMappings(existingMappings)
    } else {
      // Auto-detect mappings based on field names
      const autoMappings = autoDetectMappings(sourceFields, targetFields)
      setMappings(autoMappings)
    }
  }, [sourceFields, existingMappings])

  // Notify parent of changes
  useEffect(() => {
    onMappingsChange?.(mappings)
  }, [mappings, onMappingsChange])

  // Auto-detect mappings based on common field name patterns
  function autoDetectMappings(source, target) {
    const detected = {}
    const normalizeFieldName = (name) => 
      name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '')

    // Common aliases for each target field
    const fieldAliases = {
      email: ['email', 'emailaddress', 'mail', 'e-mail', 'emailid'],
      full_name: ['fullname', 'name', 'attendeename', 'guestname', 'customername', 'buyername'],
      first_name: ['firstname', 'fname', 'givenname', 'forename'],
      last_name: ['lastname', 'lname', 'surname', 'familyname'],
      phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'cell', 'cellphone', 'telephone', 'tel'],
      date_of_birth: ['dateofbirth', 'dob', 'birthday', 'birthdate'],
      city: ['city', 'town', 'location'],
      country: ['country', 'nation', 'countryname'],
      ticket_type: ['tickettype', 'ticketname', 'ticket', 'tier', 'category', 'ticketclass'],
      order_id: ['orderid', 'ordernumber', 'order', 'orderref', 'reference', 'transactionid'],
      order_date: ['orderdate', 'purchasedate', 'dateordered', 'transactiondate', 'datepurchased'],
      amount_paid: ['amountpaid', 'amount', 'price', 'total', 'cost', 'ticketprice', 'saleprice'],
      title: ['title', 'eventname', 'name', 'eventtitle'],
      description: ['description', 'desc', 'about', 'details', 'summary'],
      start_date: ['startdate', 'datetime', 'eventdate', 'date', 'starttime', 'start'],
      end_date: ['enddate', 'endtime', 'end'],
      venue_name: ['venuename', 'venue', 'location', 'place'],
      venue_address: ['venueaddress', 'address', 'streetaddress', 'fulladdress'],
      image_url: ['imageurl', 'image', 'logo', 'banner', 'thumbnail', 'photo', 'flyer'],
      instagram: ['instagram', 'ig', 'instagramhandle', 'insta'],
      twitter: ['twitter', 'x', 'twitterhandle'],
    }

    for (const sourceField of source) {
      const normalizedSource = normalizeFieldName(sourceField)
      
      for (const targetField of target) {
        const aliases = fieldAliases[targetField.id] || [normalizeFieldName(targetField.id)]
        
        if (aliases.includes(normalizedSource)) {
          detected[targetField.id] = {
            sourceField: sourceField,
            transformation: 'none',
            combineWith: null,
          }
          break
        }
      }
    }

    return detected
  }

  // Update a single mapping
  const updateMapping = (targetFieldId, update) => {
    setMappings(prev => ({
      ...prev,
      [targetFieldId]: {
        ...prev[targetFieldId],
        ...update,
      }
    }))
  }

  // Remove a mapping
  const removeMapping = (targetFieldId) => {
    setMappings(prev => {
      const next = { ...prev }
      delete next[targetFieldId]
      return next
    })
  }

  // Add combine field
  const addCombineField = (targetFieldId, field) => {
    const current = mappings[targetFieldId]
    if (!current) return
    
    const combineWith = current.combineWith || []
    if (!combineWith.includes(field)) {
      updateMapping(targetFieldId, {
        transformation: 'combine',
        combineWith: [...combineWith, field],
      })
    }
  }

  // Reset to auto-detected mappings
  const resetMappings = () => {
    const autoMappings = autoDetectMappings(sourceFields, targetFields)
    setMappings(autoMappings)
  }

  // Get unmapped source fields
  const mappedSourceFields = Object.values(mappings)
    .map(m => m.sourceField)
    .filter(Boolean)
  const unmappedSourceFields = sourceFields.filter(f => !mappedSourceFields.includes(f))

  // Get mapping status
  const requiredFields = targetFields.filter(f => f.required)
  const mappedRequiredCount = requiredFields.filter(f => mappings[f.id]?.sourceField).length
  const allRequiredMapped = mappedRequiredCount === requiredFields.length

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge 
            variant={allRequiredMapped ? 'default' : 'destructive'}
            className={allRequiredMapped ? 'bg-green-100 text-green-800' : ''}
          >
            {Object.keys(mappings).length} fields mapped
          </Badge>
          {!allRequiredMapped && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {requiredFields.length - mappedRequiredCount} required field(s) not mapped
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showAdvanced && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTransformations(!showTransformations)}
            >
              <Settings className="w-4 h-4 mr-1" />
              {showTransformations ? 'Hide' : 'Show'} Advanced
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetMappings}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Auto-detect
          </Button>
        </div>
      </div>

      {/* Mapping Grid */}
      <div className="space-y-3">
        {targetFields.map((targetField) => {
          const mapping = mappings[targetField.id]
          const isRequired = targetField.required
          const isMapped = !!mapping?.sourceField

          return (
            <div 
              key={targetField.id}
              className={`p-4 border rounded-lg ${
                isRequired && !isMapped 
                  ? 'border-red-200 bg-red-50' 
                  : isMapped 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-border/20'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Source Field Select */}
                <div className="flex-1">
                  <Select
                    value={mapping?.sourceField || ''}
                    onValueChange={(value) => {
                      if (value === '_none') {
                        removeMapping(targetField.id)
                      } else {
                        updateMapping(targetField.id, { 
                          sourceField: value,
                          transformation: mapping?.transformation || 'none',
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">
                        <span className="text-muted-foreground">-- Don't import --</span>
                      </SelectItem>
                      {sourceFields.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                          {mappedSourceFields.includes(field) && field !== mapping?.sourceField && (
                            <span className="text-muted-foreground ml-2">(already mapped)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                {/* Target Field */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-lg">{targetField.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{targetField.label}</span>
                      {isRequired && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{targetField.type}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="w-8 flex justify-center">
                  {isMapped ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : isRequired ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <div className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Advanced: Transformations */}
              {showTransformations && isMapped && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm text-muted-foreground w-24">Transform:</Label>
                    <Select
                      value={mapping.transformation || 'none'}
                      onValueChange={(value) => updateMapping(targetField.id, { transformation: value })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFORMATIONS.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Combine fields option */}
                    {mapping.transformation === 'combine' && (
                      <div className="flex items-center gap-2">
                        <Merge className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">+ </span>
                        <Select
                          onValueChange={(field) => addCombineField(targetField.id, field)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Add field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFields
                              .filter(f => f !== mapping.sourceField && !mapping.combineWith?.includes(f))
                              .map((field) => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        {mapping.combineWith?.map((field, i) => (
                          <Badge key={i} variant="secondary" className="flex items-center gap-1">
                            {field}
                            <X 
                              className="w-3 h-3 cursor-pointer" 
                              onClick={() => {
                                const updated = mapping.combineWith.filter(f => f !== field)
                                updateMapping(targetField.id, { 
                                  combineWith: updated,
                                  transformation: updated.length > 0 ? 'combine' : 'none',
                                })
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unmapped Source Fields */}
      {unmappedSourceFields.length > 0 && (
        <Card className="bg-background">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unmapped Source Fields ({unmappedSourceFields.length})
            </CardTitle>
            <CardDescription className="text-xs">
              These fields from {platform} won't be imported
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2">
              {unmappedSourceFields.map((field) => (
                <Badge key={field} variant="outline" className="text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// UTILITY: Apply transformations
// ============================================================================

export function applyFieldTransformation(value, mapping) {
  if (!value || !mapping) return value
  
  const { transformation, combineWith } = mapping
  
  switch (transformation) {
    case 'combine':
      // Value should be an object with multiple fields
      if (typeof value === 'object' && combineWith) {
        const parts = [value.primary, ...combineWith.map(f => value[f])].filter(Boolean)
        return parts.join(' ').trim()
      }
      return value
      
    case 'split_first':
      return String(value).split(/\s+/)[0] || value
      
    case 'split_last':
      const parts = String(value).split(/\s+/)
      return parts[parts.length - 1] || value
      
    case 'lowercase':
      return String(value).toLowerCase()
      
    case 'uppercase':
      return String(value).toUpperCase()
      
    case 'trim':
      return String(value).trim()
      
    case 'parse_date':
      try {
        return new Date(value).toISOString()
      } catch {
        return value
      }
      
    case 'parse_phone':
      // Remove non-numeric characters, keep + prefix
      return String(value).replace(/[^\d+]/g, '')
      
    case 'boolean':
      const truthy = ['yes', 'true', '1', 'y', 'checked', 'active']
      return truthy.includes(String(value).toLowerCase())
      
    default:
      return value
  }
}

// ============================================================================
// UTILITY: Transform a record using mappings
// ============================================================================

export function transformRecord(sourceRecord, mappings) {
  const result = {}
  
  for (const [targetField, mapping] of Object.entries(mappings)) {
    if (!mapping.sourceField) continue
    
    let value = sourceRecord[mapping.sourceField]
    
    // Handle combine transformation
    if (mapping.transformation === 'combine' && mapping.combineWith) {
      value = {
        primary: sourceRecord[mapping.sourceField],
        ...mapping.combineWith.reduce((acc, field) => {
          acc[field] = sourceRecord[field]
          return acc
        }, {})
      }
    }
    
    result[targetField] = applyFieldTransformation(value, mapping)
  }
  
  return result
}

export default FieldMappingEditor
