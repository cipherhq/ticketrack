/**
 * Client-side image compression utility.
 * Resizes and converts images to WebP (or JPEG fallback) before upload.
 */

export async function compressImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = {}) {
  // Only compress image files
  if (!file.type.startsWith('image/')) return file;

  // Skip if already small enough (under 500KB and no resize needed)
  const skipThreshold = 500 * 1024;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // If already under threshold and within max dimensions, skip
    if (file.size <= skipThreshold && width <= maxWidth && height <= maxHeight) {
      bitmap.close();
      return file;
    }

    // Calculate scaled dimensions preserving aspect ratio
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      targetWidth = Math.round(width * ratio);
      targetHeight = Math.round(height * ratio);
    }

    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    // Try WebP first, fall back to JPEG
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    let ext = 'webp';

    if (!blob || blob.size === 0) {
      // WebP not supported (e.g. Safari < 16), fall back to JPEG
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      ext = 'jpg';
    }

    if (!blob) return file; // Fallback: return original

    // Build new filename
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.${ext}`;

    return new File([blob], newName, { type: blob.type });
  } catch {
    // If anything fails, return original file
    return file;
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      type,
      quality
    );
  });
}
