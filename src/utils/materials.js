/**
 * Material System
 * Defines realistic materials for venue objects (wood, fabric, metal, glass, etc.)
 */

// =============================================================================
// MATERIAL TYPES
// =============================================================================

export const MATERIAL_TYPES = {
  WOOD: 'wood',
  FABRIC: 'fabric',
  METAL: 'metal',
  GLASS: 'glass',
  PLASTIC: 'plastic',
  CARPET: 'carpet',
  MARBLE: 'marble',
  STONE: 'stone',
}

// =============================================================================
// MATERIAL DEFINITIONS
// =============================================================================

export const MATERIALS = {
  // Wood materials
  wood_oak: {
    type: MATERIAL_TYPES.WOOD,
    name: 'Oak',
    baseColor: '#D4A574',
    grainColor: '#B8956A',
    darkColor: '#8B6B42',
    shininess: 0.3,
    pattern: 'grain',
  },
  wood_walnut: {
    type: MATERIAL_TYPES.WOOD,
    name: 'Walnut',
    baseColor: '#5D4037',
    grainColor: '#4E342E',
    darkColor: '#3E2723',
    shininess: 0.4,
    pattern: 'grain',
  },
  wood_pine: {
    type: MATERIAL_TYPES.WOOD,
    name: 'Pine',
    baseColor: '#F5DEB3',
    grainColor: '#E6D3A3',
    darkColor: '#D4AF7A',
    shininess: 0.2,
    pattern: 'grain',
  },
  wood_cherry: {
    type: MATERIAL_TYPES.WOOD,
    name: 'Cherry',
    baseColor: '#CD5C5C',
    grainColor: '#B74747',
    darkColor: '#8B3A3A',
    shininess: 0.35,
    pattern: 'grain',
  },

  // Fabric materials
  fabric_cotton: {
    type: MATERIAL_TYPES.FABRIC,
    name: 'Cotton',
    baseColor: '#FFFFFF',
    patternColor: '#F5F5F5',
    shininess: 0.1,
    pattern: 'weave',
    roughness: 0.8,
  },
  fabric_silk: {
    type: MATERIAL_TYPES.FABRIC,
    name: 'Silk',
    baseColor: '#FFE4E1',
    patternColor: '#FFC0CB',
    shininess: 0.6,
    pattern: 'smooth',
    roughness: 0.2,
  },
  fabric_linen: {
    type: MATERIAL_TYPES.FABRIC,
    name: 'Linen',
    baseColor: '#FAF0E6',
    patternColor: '#E6D5B8',
    shininess: 0.15,
    pattern: 'weave',
    roughness: 0.9,
  },
  fabric_velvet: {
    type: MATERIAL_TYPES.FABRIC,
    name: 'Velvet',
    baseColor: '#1C1C1C',
    patternColor: '#2C2C2C',
    shininess: 0.5,
    pattern: 'plush',
    roughness: 0.7,
  },

  // Metal materials
  metal_steel: {
    type: MATERIAL_TYPES.METAL,
    name: 'Steel',
    baseColor: '#9E9E9E',
    highlightColor: '#CFD8DC',
    darkColor: '#616161',
    shininess: 0.7,
    reflectivity: 0.3,
  },
  metal_chrome: {
    type: MATERIAL_TYPES.METAL,
    name: 'Chrome',
    baseColor: '#CFD8DC',
    highlightColor: '#FFFFFF',
    darkColor: '#90A4AE',
    shininess: 0.9,
    reflectivity: 0.8,
  },
  metal_brushed: {
    type: MATERIAL_TYPES.METAL,
    name: 'Brushed Aluminum',
    baseColor: '#B0BEC5',
    highlightColor: '#ECEFF1',
    darkColor: '#78909C',
    shininess: 0.4,
    reflectivity: 0.2,
    pattern: 'brushed',
  },

  // Glass materials
  glass_clear: {
    type: MATERIAL_TYPES.GLASS,
    name: 'Clear Glass',
    baseColor: '#E3F2FD',
    opacity: 0.3,
    shininess: 0.95,
    reflectivity: 0.9,
    refraction: 1.5,
  },
  glass_tinted: {
    type: MATERIAL_TYPES.GLASS,
    name: 'Tinted Glass',
    baseColor: '#263238',
    opacity: 0.7,
    shininess: 0.9,
    reflectivity: 0.8,
    refraction: 1.5,
  },

  // Plastic materials
  plastic_mat: {
    type: MATERIAL_TYPES.PLASTIC,
    name: 'Matte Plastic',
    baseColor: '#E0E0E0',
    shininess: 0.1,
    reflectivity: 0.05,
  },
  plastic_gloss: {
    type: MATERIAL_TYPES.PLASTIC,
    name: 'Glossy Plastic',
    baseColor: '#F5F5F5',
    shininess: 0.8,
    reflectivity: 0.4,
  },
}

// =============================================================================
// MATERIAL UTILITIES
// =============================================================================

/**
 * Get material by name or type
 * @param {string} materialName - Material name (e.g., 'wood_oak')
 * @param {string} fallbackType - Fallback material type
 * @returns {Object} - Material definition
 */
export function getMaterial(materialName, fallbackType = MATERIAL_TYPES.WOOD) {
  if (materialName && MATERIALS[materialName]) {
    return MATERIALS[materialName]
  }

  // Fallback to first material of the requested type
  const fallback = Object.values(MATERIALS).find(
    (m) => m.type === fallbackType
  )
  return fallback || MATERIALS.wood_oak
}

/**
 * Generate gradient stops for a material
 * @param {Object} material - Material definition
 * @param {Object} options - Gradient options
 * @returns {Array} - Array of gradient stop objects
 */
export function getMaterialGradientStops(material, options = {}) {
  const {
    direction = 'radial', // 'radial' or 'linear'
    intensity = 1.0, // Light intensity (0-1)
    angle = 45, // Light angle in degrees
  } = options

  const stops = []

  switch (material.type) {
    case MATERIAL_TYPES.WOOD:
      stops.push({ offset: '0%', color: material.baseColor, opacity: 0.9 })
      stops.push({ offset: '30%', color: material.grainColor, opacity: 0.95 })
      stops.push({ offset: '60%', color: material.darkColor, opacity: 1.0 })
      stops.push({ offset: '85%', color: material.darkColor, opacity: 0.95 })
      stops.push({ offset: '100%', color: material.darkColor, opacity: 0.9 })
      break

    case MATERIAL_TYPES.FABRIC:
      stops.push({ offset: '0%', color: material.baseColor, opacity: 1.0 })
      stops.push({ offset: '50%', color: material.patternColor, opacity: 0.95 })
      stops.push({ offset: '100%', color: material.baseColor, opacity: 0.85 })
      break

    case MATERIAL_TYPES.METAL:
      const highlightOpacity = material.shininess * intensity
      stops.push({ offset: '0%', color: material.highlightColor, opacity: highlightOpacity })
      stops.push({ offset: '30%', color: material.baseColor, opacity: 1.0 })
      stops.push({ offset: '70%', color: material.baseColor, opacity: 1.0 })
      stops.push({ offset: '100%', color: material.darkColor, opacity: 0.8 })
      break

    case MATERIAL_TYPES.GLASS:
      stops.push({ offset: '0%', color: material.baseColor, opacity: material.opacity * 0.5 })
      stops.push({ offset: '50%', color: material.baseColor, opacity: material.opacity })
      stops.push({ offset: '100%', color: material.baseColor, opacity: material.opacity * 0.8 })
      break

    default:
      stops.push({ offset: '0%', color: material.baseColor || '#CCCCCC', opacity: 1.0 })
      stops.push({ offset: '100%', color: material.darkColor || '#999999', opacity: 0.9 })
  }

  return stops
}

/**
 * Generate SVG gradient definition for a material
 * @param {Object} material - Material definition
 * @param {string} gradientId - Unique gradient ID
 * @param {Object} options - Gradient options
 * @returns {string} - SVG gradient definition
 */
export function generateMaterialGradient(material, gradientId, options = {}) {
  const stops = getMaterialGradientStops(material, options)
  const { direction = 'radial' } = options

  if (direction === 'radial') {
    return `
      <defs>
        <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">
          ${stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity}" />`).join('\n')}
        </radialGradient>
      </defs>
    `
  } else {
    const { angle = 45 } = options
    const rad = (angle * Math.PI) / 180
    const x1 = 50 - 50 * Math.cos(rad)
    const y1 = 50 - 50 * Math.sin(rad)
    const x2 = 50 + 50 * Math.cos(rad)
    const y2 = 50 + 50 * Math.sin(rad)

    return `
      <defs>
        <linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
          ${stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity}" />`).join('\n')}
        </linearGradient>
      </defs>
    `
  }
}

/**
 * Get appropriate material for an object type
 * @param {string} objectType - Object type (table, chair, stage, etc.)
 * @param {string} color - Optional color override
 * @returns {Object} - Material definition
 */
export function getMaterialForObjectType(objectType, color = null) {
  // Map object types to default materials
  const typeMaterialMap = {
    table: MATERIALS.wood_oak,
    chair: MATERIALS.wood_walnut,
    stage: MATERIALS.wood_pine,
    speaker: MATERIALS.metal_steel,
    bar: MATERIALS.wood_cherry,
    podium: MATERIALS.wood_walnut,
    truss: MATERIALS.metal_steel,
    light: MATERIALS.metal_chrome,
    buffet: MATERIALS.wood_oak,
    'tablecloth': MATERIALS.fabric_cotton,
    'chair-cushion': MATERIALS.fabric_silk,
  }

  const defaultMaterial = typeMaterialMap[objectType] || MATERIALS.wood_oak

  // If color is provided, create a custom material based on default
  if (color) {
    return {
      ...defaultMaterial,
      baseColor: color,
      grainColor: darkenColor(color, 0.2),
      darkColor: darkenColor(color, 0.4),
    }
  }

  return defaultMaterial
}

/**
 * Darken a color by a percentage
 * @param {string} color - Hex color string
 * @param {number} amount - Amount to darken (0-1)
 * @returns {string} - Darkened hex color
 */
function darkenColor(color, amount) {
  if (!color || !color.startsWith('#')) return color

  const num = parseInt(color.replace('#', ''), 16)
  const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)))
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - amount)))
  const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - amount)))

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
