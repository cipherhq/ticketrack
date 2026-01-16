/**
 * 3D Transformation Utilities
 * Converts 2D canvas coordinates to 3D space with perspective/isometric projection
 */

// =============================================================================
// ISOMETRIC PROJECTION
// =============================================================================

/**
 * Converts 3D coordinates to isometric 2D projection
 * @param {number} x - X coordinate in 3D space
 * @param {number} y - Y coordinate in 3D space
 * @param {number} z - Z coordinate (height/depth) in 3D space
 * @param {Object} options - Transformation options
 * @returns {{x: number, y: number}} - 2D isometric coordinates
 */
export function toIsometric(x, y, z = 0, options = {}) {
  const {
    angle = 30, // Isometric angle in degrees (typically 30°)
    scale = 1,
    originX = 0,
    originY = 0,
  } = options

  // Convert angle to radians
  const rad = (angle * Math.PI) / 180

  // Isometric transformation (standard isometric uses 30°)
  // This creates a 2:1 ratio for x:y which is common in isometric views
  const isoX = (x - y) * Math.cos(rad) * scale + originX
  const isoY = ((x + y) / 2 - z) * Math.sin(rad) * scale + originY

  return { x: isoX, y: isoY }
}

/**
 * Converts 2D isometric coordinates back to 3D space
 * @param {number} isoX - Isometric X coordinate
 * @param {number} isoY - Isometric Y coordinate
 * @param {Object} options - Transformation options
 * @returns {{x: number, y: number, z: number}} - 3D coordinates
 */
export function fromIsometric(isoX, isoY, options = {}) {
  const {
    angle = 30,
    scale = 1,
    originX = 0,
    originY = 0,
  } = options

  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Reverse isometric transformation
  const x = ((isoX - originX) / cos + (isoY - originY) / sin) / 2 / scale
  const y = ((isoX - originX) / cos - (isoY - originY) / sin) / 2 / scale
  const z = 0 // Z depth would need to be tracked separately

  return { x, y, z }
}

// =============================================================================
// PERSPECTIVE PROJECTION
// =============================================================================

/**
 * Converts 3D coordinates to perspective 2D projection
 * @param {number} x - X coordinate in 3D space
 * @param {number} y - Y coordinate in 3D space
 * @param {number} z - Z coordinate (depth) in 3D space
 * @param {Object} camera - Camera configuration
 * @returns {{x: number, y: number, scale: number}} - 2D perspective coordinates
 */
export function toPerspective(x, y, z, camera = {}) {
  const {
    position = { x: 0, y: -1000, z: 1000 }, // Camera position in 3D space
    target = { x: 0, y: 0, z: 0 }, // What the camera is looking at
    fov = 60, // Field of view in degrees
    near = 100, // Near clipping plane
    far = 10000, // Far clipping plane
  } = camera

  // Calculate distance from camera to point
  const dx = x - position.x
  const dy = y - position.y
  const dz = z - position.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

  // If too close or too far, don't render
  if (distance < near || distance > far) {
    return { x: null, y: null, scale: 0 }
  }

  // Perspective projection
  const fovRad = (fov * Math.PI) / 180
  const f = 1 / Math.tan(fovRad / 2) // Focal length

  // Transform to camera space (simplified)
  const scale = f / distance

  const perspX = dx * scale
  const perspY = dy * scale

  return { x: perspX, y: perspY, scale }
}

// =============================================================================
// 3D ROTATION
// =============================================================================

/**
 * Rotates a 3D point around the Z axis (yaw)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} angle - Rotation angle in degrees
 * @returns {{x: number, y: number}} - Rotated coordinates
 */
export function rotateZ(x, y, angle) {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

/**
 * Rotates a 3D point around the X axis (pitch)
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @param {number} angle - Rotation angle in degrees
 * @returns {{y: number, z: number}} - Rotated coordinates
 */
export function rotateX(y, z, angle) {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    y: y * cos - z * sin,
    z: y * sin + z * cos,
  }
}

/**
 * Rotates a 3D point around the Y axis (roll)
 * @param {number} x - X coordinate
 * @param {number} z - Z coordinate
 * @param {number} angle - Rotation angle in degrees
 * @returns {{x: number, z: number}} - Rotated coordinates
 */
export function rotateY(x, z, angle) {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    x: x * cos + z * sin,
    z: -x * sin + z * cos,
  }
}

// =============================================================================
// VIEW MODE HELPERS
// =============================================================================

/**
 * Get the appropriate transformation function based on view mode
 * @param {string} viewMode - '2d', 'isometric', 'perspective'
 * @returns {Function} - Transformation function
 */
export function getTransformFunction(viewMode) {
  switch (viewMode) {
    case 'isometric':
      return toIsometric
    case 'perspective':
      return toPerspective
    case '2d':
    default:
      return (x, y, z = 0) => ({ x, y, scale: 1 }) // No transformation
  }
}

/**
 * Calculate height/depth for objects based on type
 * @param {string} type - Object type (table, chair, stage, etc.)
 * @param {number} width - Object width
 * @param {number} height - Object height
 * @returns {number} - Z height in 3D space
 */
export function getObjectHeight(type, width, height) {
  const heightMap = {
    'table': (w, h) => Math.max(w, h) * 0.3, // 30% of largest dimension
    'chair': (w, h) => h * 1.2, // 120% of height (includes backrest)
    'stage': (w, h) => Math.min(w, h) * 0.4, // 40% of smallest dimension
    'speaker': (w, h) => Math.max(w, h) * 0.8, // 80% (tall speakers)
    'bar': (w, h) => h * 1.5, // 150% (tall bar)
    'podium': (w, h) => h * 2, // 200% (tall podium)
    'truss': (w, h) => Math.max(w, h) * 0.3, // 30% (thin truss)
    'light': (w, h) => Math.max(w, h) * 0.5, // 50% (light fixture)
  }

  const getHeight = heightMap[type] || ((w, h) => Math.max(w, h) * 0.2)
  return getHeight(width, height)
}
