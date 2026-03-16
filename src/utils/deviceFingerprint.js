/**
 * Lightweight device fingerprinting utility.
 * Generates a SHA-256 hex string from browser-specific signals.
 * No external dependencies.
 */

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Ticketrack', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Ticketrack', 4, 17);

    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function getWebGLRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';

    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
  } catch {
    return '';
  }
}

/**
 * Generates a device fingerprint from multiple browser signals.
 * Returns a SHA-256 hex string.
 */
export async function getDeviceFingerprint() {
  const signals = [
    getCanvasFingerprint(),
    getWebGLRenderer(),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.language || '',
    navigator.platform || '',
    String(navigator.hardwareConcurrency || ''),
    String(navigator.maxTouchPoints || 0),
  ];

  const raw = signals.join('|||');
  return sha256(raw);
}
