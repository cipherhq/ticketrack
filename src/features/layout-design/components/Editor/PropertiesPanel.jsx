/**
 * Properties Panel
 * Right sidebar for editing selected object properties
 */

import { useState, useEffect } from 'react';
import { Trash2, Copy, Lock, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLayoutStore } from '../../stores/layoutStore';

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
        color: selectedObject.color || '#3B82F6',
      });
    }
  }, [selectedObject?.id, selectedObject?.x, selectedObject?.y]);

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

  if (selectedObjects.length === 0) {
    return (
      <div className="w-64 bg-white border-l border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">Properties</h3>
        <p className="text-sm text-gray-500">
          Select an object to view and edit its properties
        </p>
      </div>
    );
  }

  if (selectedObjects.length > 1) {
    return (
      <div className="w-64 bg-white border-l border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">Properties</h3>
        <p className="text-sm text-gray-500 mb-4">
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

  return (
    <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">Properties</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={duplicateSelected}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700"
              onClick={deleteSelected}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Object Type Badge */}
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: localValues.color }}
            />
            <span className="text-sm text-gray-600 capitalize">
              {selectedObject.object_type?.replace('_', ' ')}
            </span>
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
                <Label htmlFor="x" className="text-xs text-gray-500">
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
                <Label htmlFor="y" className="text-xs text-gray-500">
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
                <Label htmlFor="width" className="text-xs text-gray-500">
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
                <Label htmlFor="height" className="text-xs text-gray-500">
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
          </div>

          {/* Rotation */}
          <div>
            <Label htmlFor="rotation" className="text-xs">
              Rotation (degrees)
            </Label>
            <Input
              id="rotation"
              type="number"
              value={localValues.rotation}
              onChange={(e) => handleChange('rotation', e.target.value)}
              onBlur={() => handleBlur('rotation')}
              onKeyDown={(e) => handleKeyDown(e, 'rotation')}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Color */}
          <div>
            <Label htmlFor="color" className="text-xs">
              Color
            </Label>
            <div className="flex gap-2 mt-1">
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

          {/* Capacity (for sections/zones) */}
          {['section', 'vip_section', 'zone', 'table'].includes(
            selectedObject.object_type
          ) && (
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
