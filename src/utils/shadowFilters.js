/**
 * Advanced Shadow Filters
 * Creates SVG filters for realistic shadows, ambient occlusion, and depth effects
 */

// =============================================================================
// SHADOW FILTERS
// =============================================================================

/**
 * Generate all shadow filters for the scene
 * @returns {string} - SVG filters definition
 */
export function generateShadowFilters() {
  return `
    <defs>
      <!-- Drop Shadow - Standard -->
      <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
        <feOffset dx="2" dy="4" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.4"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Drop Shadow - Soft -->
      <filter id="dropShadowSoft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
        <feOffset dx="3" dy="6" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.3"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Drop Shadow - Hard -->
      <filter id="dropShadowHard" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
        <feOffset dx="1" dy="2" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Ambient Occlusion -->
      <filter id="ambientOcclusion" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
        <feOffset dx="0" dy="2" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.2"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Contact Shadow -->
      <filter id="contactShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
        <feOffset dx="0" dy="0" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.15"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- 3D Depth Shadow -->
      <filter id="depthShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
        <feOffset dx="4" dy="8" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="gamma" exponent="0.5" amplitude="0.6"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Inner Shadow -->
      <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
        <feOffset dx="0" dy="2" result="offsetblur"/>
        <feComponentTransfer result="inner">
          <feFuncA type="linear" slope="-0.3" intercept="0.3"/>
        </feComponentTransfer>
        <feComposite in="inner" in2="SourceGraphic" operator="arithmetic" k2="-1" k3="1"/>
      </filter>

      <!-- Multiple Shadows (for layered depth) -->
      <filter id="multiShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur1"/>
        <feOffset in="blur1" dx="1" dy="2" result="shadow1"/>
        <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur2"/>
        <feOffset in="blur2" dx="2" dy="4" result="shadow2"/>
        <feMerge>
          <feMergeNode in="shadow2" />
          <feMergeNode in="shadow1" />
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Glow Effect (for highlights) -->
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Bevel Effect (for 3D edges) -->
      <filter id="bevel" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1"/>
        <feOffset dx="-1" dy="-1" result="offset1"/>
        <feOffset dx="1" dy="1" result="offset2"/>
        <feComposite in="offset1" in2="offset2" operator="xor" result="edges"/>
        <feComponentTransfer result="edges-highlight">
          <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="SourceGraphic"/>
          <feMergeNode in="edges-highlight"/>
        </feMerge>
      </filter>
    </defs>
  `
}

/**
 * Get appropriate shadow filter ID based on object type
 * @param {string} objectType - Object type
 * @param {number} height - Object height (affects shadow size)
 * @returns {string} - Filter ID
 */
export function getShadowFilter(objectType, height = 0) {
  const shadowMap = {
    table: height > 30 ? 'dropShadowSoft' : 'dropShadow',
    chair: 'dropShadow',
    stage: 'depthShadow',
    speaker: 'dropShadowHard',
    bar: 'dropShadowSoft',
    podium: 'dropShadow',
    truss: 'contactShadow',
    light: 'glow',
  }

  return shadowMap[objectType] || 'dropShadow'
}

/**
 * Create custom shadow filter dynamically
 * @param {string} filterId - Unique filter ID
 * @param {Object} config - Shadow configuration
 * @returns {string} - SVG filter definition
 */
export function createCustomShadowFilter(filterId, config = {}) {
  const {
    blur = 4,
    offsetX = 2,
    offsetY = 4,
    opacity = 0.4,
    color = '#000000',
    spread = 0, // Shadow spread (0 = no spread)
  } = config

  return `
    <defs>
      <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
        ${spread > 0 ? `<feMorphology operator="dilate" radius="${spread}" in="SourceAlpha" result="spread"/>` : ''}
        <feGaussianBlur in="${spread > 0 ? 'spread' : 'SourceAlpha'}" stdDeviation="${blur}"/>
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
