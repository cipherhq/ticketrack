/**
 * Lighting System
 * Calculates lighting and shadows for 3D objects
 */

// =============================================================================
// LIGHT TYPES
// =============================================================================

export const LIGHT_TYPES = {
  AMBIENT: 'ambient',
  DIRECTIONAL: 'directional',
  POINT: 'point',
  AREA: 'area',
}

// =============================================================================
// DEFAULT LIGHTING SETUP
// =============================================================================

export const DEFAULT_LIGHTS = {
  ambient: {
    type: LIGHT_TYPES.AMBIENT,
    color: '#FFFFFF',
    intensity: 0.4, // 40% ambient light
  },
  main: {
    type: LIGHT_TYPES.DIRECTIONAL,
    direction: { x: 0.5, y: -1, z: 0.8 }, // Light from top-left-front
    color: '#FFFFFF',
    intensity: 0.8, // 80% main light
  },
  fill: {
    type: LIGHT_TYPES.DIRECTIONAL,
    direction: { x: -0.3, y: -0.5, z: 0.5 }, // Light from opposite side
    color: '#E0E0E0',
    intensity: 0.3, // 30% fill light
  },
}

// =============================================================================
// LIGHTING UTILITIES
// =============================================================================

/**
 * Calculate light contribution for a point in 3D space
 * @param {Object} point - 3D point {x, y, z}
 * @param {Object} normal - Surface normal vector {x, y, z}
 * @param {Object} light - Light configuration
 * @returns {number} - Light intensity (0-1)
 */
export function calculateLightIntensity(point, normal, light) {
  if (!normal || !light) return 0.5 // Default intensity

  switch (light.type) {
    case LIGHT_TYPES.AMBIENT:
      return light.intensity || 0.4

    case LIGHT_TYPES.DIRECTIONAL:
      // Dot product of normal and light direction
      const dotProduct = (
        normal.x * light.direction.x +
        normal.y * light.direction.y +
        normal.z * light.direction.z
      )
      // Clamp between 0 and 1, then multiply by intensity
      return Math.max(0, Math.min(1, dotProduct)) * (light.intensity || 0.8)

    case LIGHT_TYPES.POINT:
      // Calculate direction from point to light
      const dx = light.position.x - point.x
      const dy = light.position.y - point.y
      const dz = light.position.z - point.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Normalize direction
      const dirX = dx / distance
      const dirY = dy / distance
      const dirZ = dz / distance

      // Dot product with normal
      const dot = normal.x * dirX + normal.y * dirY + normal.z * dirZ

      // Distance attenuation (simple linear falloff)
      const attenuation = 1 / (1 + distance * light.attenuation || 0.001)
      return Math.max(0, dot) * (light.intensity || 1.0) * attenuation

    default:
      return 0.5
  }
}

/**
 * Calculate combined light intensity from all lights
 * @param {Object} point - 3D point {x, y, z}
 * @param {Object} normal - Surface normal vector {x, y, z}
 * @param {Array} lights - Array of light configurations
 * @returns {number} - Combined light intensity (0-1)
 */
export function calculateCombinedLight(point, normal, lights = []) {
  let totalIntensity = 0

  for (const light of lights) {
    totalIntensity += calculateLightIntensity(point, normal, light)
  }

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, totalIntensity))
}

/**
 * Generate surface normal for a flat surface
 * @param {string} face - Surface face ('top', 'front', 'side', etc.)
 * @param {number} rotation - Rotation angle in degrees
 * @returns {Object} - Normal vector {x, y, z}
 */
export function getSurfaceNormal(face, rotation = 0) {
  const normals = {
    top: { x: 0, y: 0, z: 1 }, // Facing up
    bottom: { x: 0, y: 0, z: -1 }, // Facing down
    front: { x: 0, y: 1, z: 0 }, // Facing forward
    back: { x: 0, y: -1, z: 0 }, // Facing back
    left: { x: -1, y: 0, z: 0 }, // Facing left
    right: { x: 1, y: 0, z: 0 }, // Facing right
  }

  let normal = normals[face] || normals.top

  // Apply rotation if provided
  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    normal = {
      x: normal.x * cos - normal.y * sin,
      y: normal.x * sin + normal.y * cos,
      z: normal.z,
    }
  }

  return normal
}

/**
 * Create SVG filter for realistic shadows
 * @param {string} filterId - Unique filter ID
 * @param {Object} options - Shadow options
 * @returns {string} - SVG filter definition
 */
export function createShadowFilter(filterId, options = {}) {
  const {
    blur = 4,
    offsetX = 2,
    offsetY = 4,
    opacity = 0.4,
    color = '#000000',
  } = options

  return `
    <defs>
      <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/>
        <feOffset dx="${offsetX}" dy="${offsetY}" result="offsetblur"/>
        <feFlood flood-color="${color}" flood-opacity="${opacity}"/>
        <feComposite in2="offsetblur" operator="in"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `
}

/**
 * Create SVG filter for ambient occlusion (soft shadows)
 * @param {string} filterId - Unique filter ID
 * @param {Object} options - AO options
 * @returns {string} - SVG filter definition
 */
export function createAmbientOcclusionFilter(filterId, options = {}) {
  const {
    blur = 8,
    offsetX = 0,
    offsetY = 2,
    opacity = 0.2,
    color = '#000000',
  } = options

  return `
    <defs>
      <filter id="${filterId}" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/>
        <feOffset dx="${offsetX}" dy="${offsetY}" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="${opacity}"/>
        </feComponentTransfer>
        <feFlood flood-color="${color}"/>
        <feComposite in2="offsetblur" operator="in"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `
}

/**
 * Create SVG filter for highlights/glow
 * @param {string} filterId - Unique filter ID
 * @param {Object} options - Highlight options
 * @returns {string} - SVG filter definition
 */
export function createHighlightFilter(filterId, options = {}) {
  const {
    blur = 3,
    intensity = 0.5,
    color = '#FFFFFF',
  } = options

  return `
    <defs>
      <filter id="${filterId}">
        <feGaussianBlur stdDeviation="${blur}" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `
}

/**
 * Apply lighting to a color
 * @param {string} baseColor - Base hex color
 * @param {number} intensity - Light intensity (0-1)
 * @returns {string} - Adjusted hex color
 */
export function applyLighting(baseColor, intensity) {
  if (!baseColor || !baseColor.startsWith('#')) return baseColor

  const num = parseInt(baseColor.replace('#', ''), 16)
  const r = Math.min(255, Math.floor(((num >> 16) & 0xff) * intensity + 255 * (1 - intensity)))
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) * intensity + 255 * (1 - intensity)))
  const b = Math.min(255, Math.floor((num & 0x0000ff) * intensity + 255 * (1 - intensity)))

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
