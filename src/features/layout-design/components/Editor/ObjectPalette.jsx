/**
 * Object Palette
 * Left sidebar with draggable objects
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Square,
  Circle,
  Users,
  DoorOpen,
  DoorClosed,
  Sofa,
  Wine,
  Accessibility,
  Ban,
  Minus,
} from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';

const OBJECT_CATEGORIES = [
  {
    id: 'stage',
    label: 'Stage',
    objects: [
      {
        type: 'stage',
        name: 'Stage',
        icon: Square,
        color: '#1F2937',
        width: 300,
        height: 100,
        height_3d: 1.2,
      },
    ],
  },
  {
    id: 'seating',
    label: 'Seating & Sections',
    objects: [
      {
        type: 'section',
        name: 'Seating Section',
        icon: Users,
        color: '#3B82F6',
        width: 200,
        height: 150,
        capacity: 100,
      },
      {
        type: 'vip_section',
        name: 'VIP Section',
        icon: Users,
        color: '#EF4444',
        width: 150,
        height: 100,
        capacity: 50,
      },
      {
        type: 'table',
        name: 'Round Table',
        icon: Circle,
        color: '#8B5CF6',
        width: 60,
        height: 60,
        capacity: 8,
        shape: 'circle',
      },
    ],
  },
  {
    id: 'zones',
    label: 'Zones',
    objects: [
      {
        type: 'zone',
        name: 'Standing Zone',
        icon: Users,
        color: '#10B981',
        width: 200,
        height: 150,
        capacity: 100,
      },
      {
        type: 'zone',
        name: 'Dance Floor',
        icon: Users,
        color: '#EC4899',
        width: 150,
        height: 150,
        capacity: 50,
      },
    ],
  },
  {
    id: 'markers',
    label: 'Markers',
    objects: [
      {
        type: 'entrance',
        name: 'Entrance',
        icon: DoorOpen,
        color: '#22C55E',
        width: 60,
        height: 30,
      },
      {
        type: 'exit',
        name: 'Exit',
        icon: DoorClosed,
        color: '#EF4444',
        width: 60,
        height: 30,
      },
      {
        type: 'bar',
        name: 'Bar',
        icon: Wine,
        color: '#F59E0B',
        width: 80,
        height: 40,
      },
      {
        type: 'restroom',
        name: 'Restroom',
        icon: Accessibility,
        color: '#6B7280',
        width: 50,
        height: 50,
      },
    ],
  },
  {
    id: 'barriers',
    label: 'Barriers & Aisles',
    objects: [
      {
        type: 'barrier',
        name: 'Barrier',
        icon: Minus,
        color: '#9CA3AF',
        width: 100,
        height: 10,
      },
      {
        type: 'restricted',
        name: 'Restricted Area',
        icon: Ban,
        color: '#DC2626',
        width: 100,
        height: 100,
      },
    ],
  },
];

export function ObjectPalette() {
  const [expandedCategories, setExpandedCategories] = useState(
    OBJECT_CATEGORIES.map((c) => c.id)
  );
  const { addObject, layout } = useLayoutStore();

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddObject = (objectDef) => {
    // Place in center of canvas
    const canvasWidth = layout?.canvas_width || 800;
    const canvasHeight = layout?.canvas_height || 600;

    addObject({
      object_type: objectDef.type,
      name: objectDef.name,
      x: (canvasWidth - objectDef.width) / 2,
      y: (canvasHeight - objectDef.height) / 2,
      width: objectDef.width,
      height: objectDef.height,
      color: objectDef.color,
      capacity: objectDef.capacity,
      height_3d: objectDef.height_3d || 0.5,
      shape: objectDef.shape || 'rectangle',
    });
  };

  return (
    <div className="w-56 bg-card border-r border-border/20 overflow-y-auto">
      <div className="p-3 border-b border-border/20">
        <h3 className="font-semibold text-foreground text-sm">Objects</h3>
        <p className="text-xs text-muted-foreground mt-1">Click to add to canvas</p>
      </div>

      <div className="p-2">
        {OBJECT_CATEGORIES.map((category) => (
          <div key={category.id} className="mb-2">
            {/* Category Header */}
            <button
              className="w-full flex items-center justify-between p-2 text-sm font-medium text-foreground/80 hover:bg-background rounded"
              onClick={() => toggleCategory(category.id)}
            >
              <span>{category.label}</span>
              {expandedCategories.includes(category.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Category Objects */}
            {expandedCategories.includes(category.id) && (
              <div className="ml-2 space-y-1">
                {category.objects.map((obj, index) => (
                  <button
                    key={`${obj.type}-${index}`}
                    className="w-full flex items-center gap-2 p-2 text-sm text-muted-foreground hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                    onClick={() => handleAddObject(obj)}
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: obj.color + '20' }}
                    >
                      <obj.icon
                        className="w-4 h-4"
                        style={{ color: obj.color }}
                      />
                    </div>
                    <span>{obj.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
