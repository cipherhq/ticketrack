/**
 * Properties Panel
 * Right sidebar for editing selected object properties with visual polish.
 */

import { useState, useEffect } from 'react';
import { Trash2, Copy, RotateCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLayoutStore } from '../../stores/layoutStore';
import { OBJECT_COLORS, renderMiniPreview } from './objectRenderers';

// Preset color swatches
const COLOR_PRESETS = [
  '#1F2937', '#3B82F6', '#A855F7', '#8B5CF6', '#10B981',
  '#EC4899', '#22C55E', '#EF4444', '#F59E0B', '#06B6D4',
];

// Quick size presets
const TABLE_PRESETS = [
  { label: '6-top', capacity: 6, width: 50, height: 50 },
  { label: '8-top', capacity: 8, width: 60, height: 60 },
  { label: '10-top', capacity: 10, width: 70, height: 70 },
  { label: '12-top', capacity: 12, width: 80, height: 80 },
];

const SECTION_PRESETS = [
  { label: 'Small (50)', capacity: 50, width: 120, height: 100 },
  { label: 'Medium (100)', capacity: 100, width: 200, height: 150 },
  { label: 'Large (250)', capacity: 250, width: 300, height: 200 },
];

export function PropertiesPanel() {
  const {
    objects,
    selectedIds,
    updateObject,
    deleteSelected,
    duplicateSelected,
  } = useLayoutStore();

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const [localValues, setLocalValues] = useState({});

  // Sync local values when selection changes
  useEffect(() => {
    if (selectedObject) {
      setLocalValues({
        name: selectedObject.name || '',
        x: Math.round(selectedObject.x),
        y: Math.round(selectedObject.y),
        width: Math.round(selectedObject.width),
        height: Math.round(selectedObject.height),
        rotation: selectedObject.rotation || 0,
        capacity: selectedObject.capacity || '',
        color: selectedObject.color || OBJECT_COLORS[selectedObject.object_type] || '#3B82F6',
      });
    }
  }, [selectedObject?.id, selectedObject?.x, selectedObject?.y, selectedObject?.width, selectedObject?.height, selectedObject?.rotation, selectedObject?.capacity, selectedObject?.color, selectedObject?.object_type]);

  const handleChange = (field, value) => {
    setLocalValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field) => {
    if (!selectedObject) return;

    let value = localValues[field];

    // Convert numeric fields
    if (['x', 'y', 'width', 'height', 'rotation', 'capacity'].includes(field)) {
      value = parseFloat(value) || 0;
    }

    updateObject(selectedObject.id, { [field]: value });
  };

  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      handleBlur(field);
      e.target.blur();
    }
  };

  const applyPreset = (preset) => {
    if (!selectedObject) return;
    const updates = { capacity: preset.capacity, width: preset.width, height: preset.height };
    updateObject(selectedObject.id, updates);
    setLocalValues((prev) => ({ ...prev, ...updates }));
  };

  if (selectedObjects.length === 0) {
    return (
      <div className="w-64 bg-card border-l border-border/20 p-4">
        <h3 className="font-semibold text-foreground text-sm mb-2">Properties</h3>
        <p className="text-sm text-muted-foreground">
          Select an object to view and edit its properties
        </p>
      </div>
    );
  }

  if (selectedObjects.length > 1) {
    return (
      <div className="w-64 bg-card border-l border-border/20 p-4">
        <h3 className="font-semibold text-foreground text-sm mb-2">Properties</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {selectedObjects.length} objects selected
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={duplicateSelected}
          >
            <Copy className="w-4 h-4 mr-1" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={deleteSelected}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  const typeLabel = selectedObject.object_type?.replace(/_/g, ' ');
  const hasCapacity = ['section', 'vip_section', 'zone', 'table', 'dance_floor', 'standing', 'food_stall'].includes(selectedObject.object_type);
  const isTable = selectedObject.object_type === 'table';
  const isSection = ['section', 'vip_section'].includes(selectedObject.object_type);

  return (
    <div className="w-64 bg-card border-l border-border/20 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">Properties</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={duplicateSelected}
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700"
              onClick={deleteSelected}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Object type header with mini preview */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-muted/50">
              {renderMiniPreview({
                type: selectedObject.object_type,
                color: localValues.color,
                capacity: selectedObject.capacity,
              })}
            </div>
            <div>
              <span className="text-sm font-medium text-foreground capitalize">{typeLabel}</span>
              <p className="text-[10px] text-muted-foreground">
                {Math.round(selectedObject.width)} × {Math.round(selectedObject.height)} px
              </p>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-xs">
              Name
            </Label>
            <Input
              id="name"
              value={localValues.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              onKeyDown={(e) => handleKeyDown(e, 'name')}
              placeholder="Object name"
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Position */}
          <div>
            <Label className="text-xs">Position</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <Label htmlFor="x" className="text-xs text-muted-foreground">
                  X
                </Label>
                <Input
                  id="x"
                  type="number"
                  value={localValues.x}
                  onChange={(e) => handleChange('x', e.target.value)}
                  onBlur={() => handleBlur('x')}
                  onKeyDown={(e) => handleKeyDown(e, 'x')}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="y" className="text-xs text-muted-foreground">
                  Y
                </Label>
                <Input
                  id="y"
                  type="number"
                  value={localValues.y}
                  onChange={(e) => handleChange('y', e.target.value)}
                  onBlur={() => handleBlur('y')}
                  onKeyDown={(e) => handleKeyDown(e, 'y')}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <Label className="text-xs">Size</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <Label htmlFor="width" className="text-xs text-muted-foreground">
                  Width
                </Label>
                <Input
                  id="width"
                  type="number"
                  value={localValues.width}
                  onChange={(e) => handleChange('width', e.target.value)}
                  onBlur={() => handleBlur('width')}
                  onKeyDown={(e) => handleKeyDown(e, 'width')}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-xs text-muted-foreground">
                  Height
                </Label>
                <Input
                  id="height"
                  type="number"
                  value={localValues.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  onBlur={() => handleBlur('height')}
                  onKeyDown={(e) => handleKeyDown(e, 'height')}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Quick size presets */}
            {isTable && (
              <div className="flex flex-wrap gap-1 mt-2">
                {TABLE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className="px-2 py-0.5 text-[10px] rounded border border-border/30 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {isSection && (
              <div className="flex flex-wrap gap-1 mt-2">
                {SECTION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className="px-2 py-0.5 text-[10px] rounded border border-border/30 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rotation slider */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              Rotation
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={localValues.rotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleChange('rotation', val);
                  updateObject(selectedObject.id, { rotation: val });
                }}
                className="flex-1 h-1.5 accent-blue-600"
              />
              <Input
                type="number"
                min="0"
                max="360"
                value={localValues.rotation}
                onChange={(e) => handleChange('rotation', e.target.value)}
                onBlur={() => handleBlur('rotation')}
                onKeyDown={(e) => handleKeyDown(e, 'rotation')}
                className="h-7 text-xs w-14 text-center"
              />
            </div>
          </div>

          <Separator />

          {/* Color */}
          <div>
            <Label htmlFor="color" className="text-xs">
              Color
            </Label>
            {/* Preset swatches */}
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: localValues.color === c ? '#2969FF' : 'transparent',
                  }}
                  onClick={() => {
                    handleChange('color', c);
                    updateObject(selectedObject.id, { color: c });
                  }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="color"
                id="color"
                value={localValues.color}
                onChange={(e) => {
                  handleChange('color', e.target.value);
                  updateObject(selectedObject.id, { color: e.target.value });
                }}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={localValues.color}
                onChange={(e) => handleChange('color', e.target.value)}
                onBlur={() => handleBlur('color')}
                className="h-8 text-sm flex-1"
              />
            </div>
          </div>

          {/* Capacity */}
          {hasCapacity && (
            <>
              <Separator />
              <div>
                <Label htmlFor="capacity" className="text-xs">
                  Capacity
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  value={localValues.capacity}
                  onChange={(e) => handleChange('capacity', e.target.value)}
                  onBlur={() => handleBlur('capacity')}
                  onKeyDown={(e) => handleKeyDown(e, 'capacity')}
                  placeholder="Max capacity"
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
