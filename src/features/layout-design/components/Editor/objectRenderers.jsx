/**
 * Object Renderers
 * Shared SVG rendering logic for venue layout objects.
 * Used by EditorCanvas (full render) and ObjectPalette (mini preview).
 */

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

// ─── Inline SVG icons (simple paths) ────────────────────────────────
// All icons render at origin; caller wraps with translate.
// s = scale factor relative to a 16x16 viewBox

function IconMic({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="5.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="white" strokeWidth="1.5" />
      <path d="M4 9a4 4 0 008 0" fill="none" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="13" x2="8" y2="15" stroke="white" strokeWidth="1.5" />
    </g>
  );
}

function IconRows({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="2" y="2" width="12" height="2" rx="0.5" fill="white" opacity="0.9" />
      <rect x="2" y="7" width="12" height="2" rx="0.5" fill="white" opacity="0.9" />
      <rect x="2" y="12" width="12" height="2" rx="0.5" fill="white" opacity="0.9" />
    </g>
  );
}

function IconStar({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <polygon
        points="8,1 10,6 15,6 11,9.5 12.5,14.5 8,11.5 3.5,14.5 5,9.5 1,6 6,6"
        fill="white"
        opacity="0.9"
      />
    </g>
  );
}

function IconPerson({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx="8" cy="4" r="2.5" fill="white" opacity="0.9" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="white" opacity="0.9" />
    </g>
  );
}

function IconMusic({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M6 12V3l8-2v9" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="4" cy="12" r="2" fill="white" opacity="0.9" />
      <circle cx="12" cy="10" r="2" fill="white" opacity="0.9" />
    </g>
  );
}

function IconArrowIn({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M2 8h10M8 4l4 4-4 4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="2" x2="14" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function IconArrowOut({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M14 8H4M8 4l-4 4 4 4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2" y1="2" x2="2" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function IconCocktail({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M3 2h10l-5 6v4h4" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="5" y1="14" x2="11" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function IconHeadphones({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M2 10a6 6 0 0112 0" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x="1" y="9" width="3" height="5" rx="1" fill="white" opacity="0.9" />
      <rect x="12" y="9" width="3" height="5" rx="1" fill="white" opacity="0.9" />
    </g>
  );
}

function IconCamera({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M5 4l1-2h4l1 2h2a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h2z" fill="none" stroke="white" strokeWidth="1.3" />
      <circle cx="8" cy="8.5" r="2.5" fill="none" stroke="white" strokeWidth="1.3" />
    </g>
  );
}

function IconUtensils({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <line x1="5" y1="2" x2="5" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2v4c0 1.1.9 2 2 2s2-.9 2-2V2" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 2v4a3 3 0 003 0V2" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="12.5" y1="8" x2="12.5" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function IconBag({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="2" y="5" width="12" height="9" rx="1" fill="none" stroke="white" strokeWidth="1.3" />
      <path d="M5 5V3a3 3 0 016 0v2" fill="none" stroke="white" strokeWidth="1.3" />
    </g>
  );
}

function IconShield({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M8 1L2 4v4c0 3.5 2.6 6.5 6 7.5 3.4-1 6-4 6-7.5V4L8 1z" fill="none" stroke="white" strokeWidth="1.3" />
    </g>
  );
}

function IconCross({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="5.5" y="1" width="5" height="14" rx="1" fill="white" opacity="0.9" />
      <rect x="1" y="5" width="14" height="5" rx="1" fill="white" opacity="0.9" />
    </g>
  );
}

function IconLock({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x="3" y="7" width="10" height="7" rx="1" fill="none" stroke="white" strokeWidth="1.3" />
      <path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="white" strokeWidth="1.3" />
    </g>
  );
}

function IconTicket({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M2 5h12v2a1.5 1.5 0 000 3v2H2v-2a1.5 1.5 0 000-3V5z" fill="none" stroke="white" strokeWidth="1.3" />
      <line x1="8" y1="5" x2="8" y2="12" stroke="white" strokeWidth="1" strokeDasharray="1.5 1.5" />
    </g>
  );
}

// ─── Type → icon mapping ────────────────────────────────────────────
const TYPE_ICON = {
  stage: IconMic,
  section: IconRows,
  vip_section: IconStar,
  table: null, // table draws chairs procedurally
  zone: IconPerson,
  dance_floor: IconMusic,
  entrance: IconArrowIn,
  exit: IconArrowOut,
  bar: IconCocktail,
  restroom: null, // uses bold WC text
  barrier: null, // no icon
  restricted: null, // draws X cross
  dj_booth: IconHeadphones,
  photo_booth: IconCamera,
  food_stall: IconUtensils,
  merchandise: IconBag,
  security: IconShield,
  first_aid: IconCross,
  backstage: IconLock,
  ticket_booth: IconTicket,
  smoking_area: IconPerson, // reuse person with dashed outline
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
  const iconX = w / 2 - 8 * iconScale;
  const iconY = showLabel ? h / 2 - 14 * iconScale : h / 2 - 8 * iconScale;

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
          {showIcon && <IconMic x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconRows x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconStar x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconPerson x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconMusic x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconArrowIn x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconArrowOut x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconCocktail x={iconX} y={iconY} s={iconScale} />}
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
          <line x1={w * 0.2} y1={h * 0.2} x2={w * 0.8} y2={h * 0.8} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <line x1={w * 0.8} y1={h * 0.2} x2={w * 0.2} y2={h * 0.8} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {showLabel && (
            <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={fontSize} fontWeight="700" pointerEvents="none">
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
          {showIcon && <IconHeadphones x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconCamera x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconUtensils x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconBag x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconShield x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconCross x={w / 2 - 8 * iconScale} y={h / 2 - 8 * iconScale} s={iconScale} />}
          {/* Override cross fill to red */}
          {showIcon && (
            <g transform={`translate(${w / 2 - 8 * iconScale},${h / 2 - 8 * iconScale}) scale(${iconScale})`}>
              <rect x="5.5" y="1" width="5" height="14" rx="1" fill={color} />
              <rect x="1" y="5" width="14" height="5" rx="1" fill={color} />
            </g>
          )}
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
          {showIcon && <IconLock x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconTicket x={iconX} y={iconY} s={iconScale} />}
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
          {showIcon && <IconPerson x={iconX} y={iconY} s={iconScale} />}
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
