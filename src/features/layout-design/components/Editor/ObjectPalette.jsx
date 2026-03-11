/**
 * Object Palette
 * Left sidebar with visual grid of draggable objects, organized by category.
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Music,
  Armchair,
  MapPin,
  Building,
  ShieldAlert,
} from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { OBJECT_COLORS, renderMiniPreview } from './objectRenderers';

// ─── Categories with visual previews ────────────────────────────────
const OBJECT_CATEGORIES = [
  {
    id: 'performance',
    label: 'Performance',
    icon: Music,
    objects: [
      { type: 'stage', name: 'Stage', color: OBJECT_COLORS.stage, width: 300, height: 100, height_3d: 1.2 },
      { type: 'dj_booth', name: 'DJ Booth', color: OBJECT_COLORS.dj_booth, width: 100, height: 80 },
    ],
  },
  {
    id: 'seating',
    label: 'Seating & Tables',
    icon: Armchair,
    objects: [
      { type: 'section', name: 'Section', color: OBJECT_COLORS.section, width: 200, height: 150, capacity: 100 },
      { type: 'vip_section', name: 'VIP Section', color: OBJECT_COLORS.vip_section, width: 150, height: 100, capacity: 50 },
      { type: 'table', name: '8-Top Table', color: OBJECT_COLORS.table, width: 60, height: 60, capacity: 8, shape: 'circle' },
      { type: 'table', name: '10-Top Table', color: OBJECT_COLORS.table, width: 70, height: 70, capacity: 10, shape: 'circle' },
    ],
  },
  {
    id: 'zones',
    label: 'Zones & Areas',
    icon: MapPin,
    objects: [
      { type: 'zone', name: 'Standing Zone', color: OBJECT_COLORS.zone, width: 200, height: 150, capacity: 100 },
      { type: 'dance_floor', name: 'Dance Floor', color: OBJECT_COLORS.dance_floor, width: 150, height: 150, capacity: 50 },
      { type: 'backstage', name: 'Backstage', color: OBJECT_COLORS.backstage, width: 150, height: 100 },
      { type: 'smoking_area', name: 'Smoking Area', color: OBJECT_COLORS.smoking_area, width: 100, height: 80 },
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    icon: Building,
    objects: [
      { type: 'bar', name: 'Bar', color: OBJECT_COLORS.bar, width: 80, height: 40 },
      { type: 'food_stall', name: 'Food Stall', color: OBJECT_COLORS.food_stall, width: 80, height: 60 },
      { type: 'restroom', name: 'Restroom', color: OBJECT_COLORS.restroom, width: 50, height: 50 },
      { type: 'merchandise', name: 'Merchandise', color: OBJECT_COLORS.merchandise, width: 80, height: 60 },
      { type: 'photo_booth', name: 'Photo Booth', color: OBJECT_COLORS.photo_booth, width: 70, height: 70 },
    ],
  },
  {
    id: 'access',
    label: 'Access & Safety',
    icon: ShieldAlert,
    objects: [
      { type: 'entrance', name: 'Entrance', color: OBJECT_COLORS.entrance, width: 60, height: 30 },
      { type: 'exit', name: 'Exit', color: OBJECT_COLORS.exit, width: 60, height: 30 },
      { type: 'ticket_booth', name: 'Ticket Booth', color: OBJECT_COLORS.ticket_booth, width: 60, height: 50 },
      { type: 'security', name: 'Security', color: OBJECT_COLORS.security, width: 60, height: 50 },
      { type: 'first_aid', name: 'First Aid', color: OBJECT_COLORS.first_aid, width: 60, height: 50 },
      { type: 'barrier', name: 'Barrier', color: OBJECT_COLORS.barrier, width: 100, height: 10 },
      { type: 'restricted', name: 'Restricted', color: OBJECT_COLORS.restricted, width: 100, height: 100 },
    ],
  },
];

// ─── Smart placement: spiral outward from center to avoid overlap ───
function findOpenPosition(objects, canvasW, canvasH, objW, objH) {
  const cx = (canvasW - objW) / 2;
  const cy = (canvasH - objH) / 2;
  const step = 30;
  const maxRings = 20;

  for (let ring = 0; ring <= maxRings; ring++) {
    const offsets = ring === 0
      ? [{ dx: 0, dy: 0 }]
      : generateRingOffsets(ring, step);

    for (const { dx, dy } of offsets) {
      const x = cx + dx;
      const y = cy + dy;
      // Stay in bounds
      if (x < 0 || y < 0 || x + objW > canvasW || y + objH > canvasH) continue;
      // Check overlap
      const overlaps = objects.some((o) => {
        return !(x + objW <= o.x || x >= o.x + o.width || y + objH <= o.y || y >= o.y + o.height);
      });
      if (!overlaps) return { x, y };
    }
  }
  // Fallback: center
  return { x: cx, y: cy };
}

function generateRingOffsets(ring, step) {
  const offsets = [];
  const d = ring * step;
  // Top/bottom edges
  for (let x = -d; x <= d; x += step) {
    offsets.push({ dx: x, dy: -d });
    offsets.push({ dx: x, dy: d });
  }
  // Left/right edges (skip corners already added)
  for (let y = -d + step; y < d; y += step) {
    offsets.push({ dx: -d, dy: y });
    offsets.push({ dx: d, dy: y });
  }
  return offsets;
}

export function ObjectPalette() {
  const [expandedCategories, setExpandedCategories] = useState(
    OBJECT_CATEGORIES.map((c) => c.id)
  );
  const { addObject, objects, layout } = useLayoutStore();

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddObject = (objectDef) => {
    const canvasWidth = layout?.canvas_width || 800;
    const canvasHeight = layout?.canvas_height || 600;

    const { x, y } = findOpenPosition(objects, canvasWidth, canvasHeight, objectDef.width, objectDef.height);

    addObject({
      object_type: objectDef.type,
      name: objectDef.name,
      x,
      y,
      width: objectDef.width,
      height: objectDef.height,
      color: objectDef.color,
      capacity: objectDef.capacity,
      height_3d: objectDef.height_3d || 0.5,
      shape: objectDef.shape || 'rectangle',
    });
  };

  return (
    <div className="w-60 bg-card border-r border-border/20 overflow-y-auto">
      <div className="p-3 border-b border-border/20">
        <h3 className="font-semibold text-foreground text-sm">Objects</h3>
        <p className="text-xs text-muted-foreground mt-1">Click to add to canvas</p>
      </div>

      <div className="p-2">
        {OBJECT_CATEGORIES.map((category) => {
          const CatIcon = category.icon;
          const isExpanded = expandedCategories.includes(category.id);

          return (
            <div key={category.id} className="mb-1">
              {/* Category Header */}
              <button
                className="w-full flex items-center gap-2 p-2 text-sm font-medium text-foreground/80 hover:bg-background rounded"
                onClick={() => toggleCategory(category.id)}
              >
                <CatIcon className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-left">{category.label}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* 2-column visual grid */}
              {isExpanded && (
                <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                  {category.objects.map((obj, index) => (
                    <button
                      key={`${obj.type}-${index}`}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:ring-1 hover:ring-blue-200 transition-all"
                      onClick={() => handleAddObject(obj)}
                      title={obj.name}
                    >
                      <div className="w-12 h-12 flex items-center justify-center">
                        {renderMiniPreview(obj)}
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight text-center truncate w-full">
                        {obj.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
