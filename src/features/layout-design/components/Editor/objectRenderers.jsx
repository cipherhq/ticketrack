/**
 * Object Renderers
 * Shared SVG rendering logic for venue layout objects.
 * Used by EditorCanvas (full render) and ObjectPalette (mini preview).
 */
import {
  Mic2, Rows, Crown, Users, Music,
  LogIn, LogOut, Wine, Headphones,
  Camera, UtensilsCrossed, ShoppingBag,
  ShieldCheck, Plus, Lock, Ticket,
  Cigarette, Ban,
} from 'lucide-react';

// ─── Color map ──────────────────────────────────────────────────────
export const OBJECT_COLORS = {
  stage: '#1F2937',
  section: '#3B82F6',
  vip_section: '#A855F7',
  table: '#8B5CF6',
  zone: '#10B981',
  dance_floor: '#EC4899',
  entrance: '#22C55E',
  exit: '#EF4444',
  bar: '#F59E0B',
  restroom: '#6B7280',
  barrier: '#9CA3AF',
  restricted: '#DC2626',
  dj_booth: '#7C3AED',
  photo_booth: '#06B6D4',
  food_stall: '#F97316',
  merchandise: '#84CC16',
  security: '#1E40AF',
  first_aid: '#DC2626',
  backstage: '#374151',
  ticket_booth: '#0EA5E9',
  smoking_area: '#78716C',
};

// ─── SVG Defs (patterns & filters) ─────────────────────────────────
export function SVG_DEFS() {
  return (
    <defs>
      {/* Drop shadow */}
      <filter id="obj-shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
      </filter>

      {/* Seat rows pattern */}
      <pattern id="pattern-seat-rows" width="20" height="10" patternUnits="userSpaceOnUse">
        <rect width="20" height="10" fill="none" />
        <line x1="0" y1="8" x2="20" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      </pattern>

      {/* Dance floor stripes */}
      <pattern id="pattern-dance-stripes" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="none" />
        <rect x="0" y="0" width="10" height="10" fill="rgba(255,255,255,0.1)" />
        <rect x="10" y="10" width="10" height="10" fill="rgba(255,255,255,0.1)" />
      </pattern>

      {/* Standing dots */}
      <pattern id="pattern-standing-dots" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="none" />
        <circle cx="8" cy="8" r="1.5" fill="rgba(255,255,255,0.25)" />
      </pattern>

      {/* Restricted hatching */}
      <pattern id="pattern-hatching" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="none" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      </pattern>

      {/* Dot grid for canvas background */}
      <pattern id="pattern-dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.8" fill="#D1D5DB" />
      </pattern>
    </defs>
  );
}

// ─── Lucide icon wrapper for use inside SVG ─────────────────────────
function LucideIcon({ icon: Icon, x, y, size, color = 'white' }) {
  return (
    <Icon
      x={x}
      y={y}
      width={size}
      height={size}
      color={color}
      strokeWidth={2}
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ─── Type → Lucide icon mapping ─────────────────────────────────────
const TYPE_ICON = {
  stage: Mic2,
  section: Rows,
  vip_section: Crown,
  table: null, // table draws chairs procedurally
  zone: Users,
  dance_floor: Music,
  entrance: LogIn,
  exit: LogOut,
  bar: Wine,
  restroom: null, // uses bold WC text
  barrier: null, // no icon
  restricted: Ban,
  dj_booth: Headphones,
  photo_booth: Camera,
  food_stall: UtensilsCrossed,
  merchandise: ShoppingBag,
  security: ShieldCheck,
  first_aid: Plus,
  backstage: Lock,
  ticket_booth: Ticket,
  smoking_area: Cigarette,
};

// ─── Main SVG renderer ──────────────────────────────────────────────
/**
 * Renders an object as SVG elements.
 * @param {object} obj - The layout object
 * @param {object} opts - { w, h, color, showLabel, showIcon, fontSize }
 * @returns JSX SVG elements (no wrapping <g> with transform — caller handles that)
 */
export function renderObjectSVG(obj, opts = {}) {
  const type = obj.object_type;
  const w = opts.w ?? obj.width;
  const h = opts.h ?? obj.height;
  const color = opts.color ?? obj.color ?? OBJECT_COLORS[type] ?? '#3B82F6';
  const showLabel = opts.showLabel !== false;
  const showIcon = opts.showIcon !== false;
  const fontSize = opts.fontSize ?? 13;
  const iconScale = opts.iconScale ?? Math.min(w, h) / 80;

  const IconComponent = TYPE_ICON[type];
  const iconSize = 16 * iconScale;
  const iconX = w / 2 - iconSize / 2;
  const iconY = showLabel ? h / 2 - iconSize - 2 * iconScale : h / 2 - iconSize / 2;

  switch (type) {
    // ── Stage ──
    case 'stage': {
      const r = Math.min(20, w * 0.08);
      return (
        <>
          <path
            d={`M0 ${h} V${r} Q0 0 ${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h} Z`}
            fill={color}
            fillOpacity={0.9}
            filter="url(#obj-shadow)"
          />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Stage'}
            </text>
          )}
        </>
      );
    }

    // ── Section ──
    case 'section':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.85} filter="url(#obj-shadow)" />
          <rect width={w} height={h} rx={4} fill="url(#pattern-seat-rows)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Section'}
            </text>
          )}
        </>
      );

    // ── VIP Section ──
    case 'vip_section': {
      const inset = 4;
      return (
        <>
          <rect width={w} height={h} rx={12} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={8} fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="6 3" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="700" pointerEvents="none">
              {obj.name || 'VIP'}
            </text>
          )}
        </>
      );
    }

    // ── Table (circle with chairs) ──
    case 'table': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;
      const chairCount = obj.capacity || 8;
      const chairR = Math.max(3, r * 0.15);
      const chairs = [];
      for (let i = 0; i < chairCount; i++) {
        const angle = (2 * Math.PI * i) / chairCount - Math.PI / 2;
        const chairX = cx + (r + chairR + 2) * Math.cos(angle);
        const chairY = cy + (r + chairR + 2) * Math.sin(angle);
        chairs.push(<circle key={i} cx={chairX} cy={chairY} r={chairR} fill={color} fillOpacity={0.6} />);
      }
      return (
        <>
          {chairs}
          <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showLabel && (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || `${chairCount}-top`}
            </text>
          )}
        </>
      );
    }

    // ── Zone / Standing ──
    case 'zone':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.7} stroke={color} strokeWidth="1.5" strokeDasharray="6 3" filter="url(#obj-shadow)" />
          <rect width={w} height={h} rx={4} fill="url(#pattern-standing-dots)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Zone'}
            </text>
          )}
        </>
      );

    // ── Dance Floor ──
    case 'dance_floor':
      return (
        <>
          <rect width={w} height={h} rx={8} fill={color} fillOpacity={0.85} filter="url(#obj-shadow)" />
          <rect width={w} height={h} rx={8} fill="url(#pattern-dance-stripes)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Dance Floor'}
            </text>
          )}
        </>
      );

    // ── Entrance ──
    case 'entrance':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + (showIcon ? 8 * iconScale : 0)} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Entrance'}
            </text>
          )}
        </>
      );

    // ── Exit ──
    case 'exit':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + (showIcon ? 8 * iconScale : 0)} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Exit'}
            </text>
          )}
        </>
      );

    // ── Bar ──
    case 'bar':
      return (
        <>
          <rect width={w} height={h} rx={8} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Bar'}
            </text>
          )}
        </>
      );

    // ── Restroom ──
    case 'restroom':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize * 1.3} fontWeight="800" pointerEvents="none">
            WC
          </text>
        </>
      );

    // ── Barrier ──
    case 'barrier':
      return (
        <>
          <rect width={w} height={h} fill={color} fillOpacity={0.7} />
          <rect width={w} height={h} fill="url(#pattern-hatching)" />
        </>
      );

    // ── Restricted ──
    case 'restricted':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.3} stroke={color} strokeWidth="2" />
          <rect width={w} height={h} rx={4} fill="url(#pattern-hatching)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={showLabel ? iconY : h / 2 - iconSize / 2} size={iconSize} color={color} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + (showIcon ? 8 * iconScale : 0)} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={fontSize} fontWeight="700" pointerEvents="none">
              {obj.name || 'Restricted'}
            </text>
          )}
        </>
      );

    // ── DJ Booth ──
    case 'dj_booth':
      return (
        <>
          <rect width={w} height={h} rx={8} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'DJ Booth'}
            </text>
          )}
        </>
      );

    // ── Photo Booth ──
    case 'photo_booth':
      return (
        <>
          <rect width={w} height={h} rx={8} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Photo Booth'}
            </text>
          )}
        </>
      );

    // ── Food Stall ──
    case 'food_stall':
      return (
        <>
          <rect width={w} height={h} rx={6} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Food Stall'}
            </text>
          )}
        </>
      );

    // ── Merchandise ──
    case 'merchandise':
      return (
        <>
          <rect width={w} height={h} rx={6} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Merch'}
            </text>
          )}
        </>
      );

    // ── Security ──
    case 'security':
      return (
        <>
          <rect width={w} height={h} rx={6} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Security'}
            </text>
          )}
        </>
      );

    // ── First Aid ──
    case 'first_aid':
      return (
        <>
          <rect width={w} height={h} rx={6} fill="white" fillOpacity={0.95} stroke={color} strokeWidth="2" filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={w / 2 - iconSize / 2} y={h / 2 - iconSize / 2 - (showLabel ? 4 : 0)} size={iconSize} color={color} />}
          {showLabel && (
            <text x={w / 2} y={h - 8} textAnchor="middle" fill={color} fontSize={fontSize * 0.85} fontWeight="700" pointerEvents="none">
              {obj.name || 'First Aid'}
            </text>
          )}
        </>
      );

    // ── Backstage ──
    case 'backstage':
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.85} filter="url(#obj-shadow)" />
          <rect width={w} height={h} rx={4} fill="url(#pattern-hatching)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Backstage'}
            </text>
          )}
        </>
      );

    // ── Ticket Booth ──
    case 'ticket_booth':
      return (
        <>
          <rect width={w} height={h} rx={6} fill={color} fillOpacity={0.9} filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Tickets'}
            </text>
          )}
        </>
      );

    // ── Smoking Area ──
    case 'smoking_area':
      return (
        <>
          <rect width={w} height={h} rx={6} fill={color} fillOpacity={0.5} stroke={color} strokeWidth="1.5" strokeDasharray="8 4" filter="url(#obj-shadow)" />
          {showIcon && IconComponent && <LucideIcon icon={IconComponent} x={iconX} y={iconY} size={iconSize} />}
          {showLabel && (
            <text x={w / 2} y={h / 2 + 8 * iconScale} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="600" pointerEvents="none">
              {obj.name || 'Smoking'}
            </text>
          )}
        </>
      );

    // ── Fallback (generic rect) ──
    default:
      return (
        <>
          <rect width={w} height={h} rx={4} fill={color} fillOpacity={0.8} filter="url(#obj-shadow)" />
          {showLabel && (
            <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight="500" pointerEvents="none">
              {obj.name || type}
            </text>
          )}
        </>
      );
  }
}

// ─── Mini preview for palette (48x48 SVG) ───────────────────────────
/**
 * Renders a 48×48 thumbnail for the object palette.
 * @param {object} objDef - Object definition { type, name, color, capacity, ... }
 */
export function renderMiniPreview(objDef) {
  const size = 48;
  const pad = 4;
  const inner = size - pad * 2;
  const color = objDef.color || OBJECT_COLORS[objDef.type] || '#3B82F6';

  const fakeObj = {
    object_type: objDef.type,
    name: '',
    width: inner,
    height: inner,
    capacity: objDef.capacity || 8,
    color,
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SVG_DEFS />
      <g transform={`translate(${pad},${pad})`}>
        {renderObjectSVG(fakeObj, {
          w: inner,
          h: inner,
          color,
          showLabel: false,
          showIcon: true,
          iconScale: inner / 48,
        })}
      </g>
    </svg>
  );
}
