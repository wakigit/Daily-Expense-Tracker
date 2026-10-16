/**
 * Turns a photo off the camera roll into something small enough to send.
 *
 * Browser-only — canvas, createImageBitmap, FileReader. Nothing here is
 * imported by the backend.
 *
 * A phone photo is 3–8 MB and about 4000px on its long edge. None of that
 * helps: the text on a receipt is legible to a vision model at around 1200px,
 * and the rest is upload time on a hall wifi plus tokens. Downscaling first
 * takes a typical receipt to 100–250 KB, which is the difference between a scan
 * that feels instant and one that looks broken.
 *
 * Two details that are easy to miss and both show up as "the model couldn't
 * read it":
 *
 *   - EXIF orientation. A photo taken in portrait is usually stored landscape
 *     with a rotation flag. Canvas ignores the flag unless asked, so the model
 *     gets a receipt lying on its side. `imageOrientation: 'from-image'` fixes
 *     it; the FileReader fallback cannot, which is one more reason the bitmap
 *     path is tried first.
 *   - JPEG, never PNG. A photograph re-encoded as PNG is several times larger
 *     for no gain in legibility.
 */

/** The long edge after downscaling. Enough for receipt print, not more. */
export const MAX_EDGE = 1280;

/** Encoder quality. Below ~0.6, thermal-printer text starts to mush. */
const QUALITY = 0.72;

/** Refuse before decoding rather than after. A 30 MB RAW is not a receipt. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export class ImageTooLarge extends Error {
  constructor() {
    super('That image is too large to read.');
    this.code = 'image_too_large';
  }
}

export class ImageUnreadable extends Error {
  constructor(message = 'That file could not be read as an image.') {
    super(message);
    this.code = 'image_unreadable';
  }
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{base64: string, mimeType: string, bytes: number, width: number, height: number}>}
 *   Base64 WITHOUT the data: prefix — the wire format the backend expects.
 */
export async function prepareImage(file) {
  if (!file) throw new ImageUnreadable('No file was chosen.');
  if (file.size > MAX_SOURCE_BYTES) throw new ImageTooLarge();

  const source = await decode(file);
  const { width, height } = fit(source.width, source.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageUnreadable('This browser cannot process images.');
  // White underneath: a transparent source would otherwise flatten to black on
  // a JPEG, and black-on-black is unreadable.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source.image, 0, 0, width, height);

  if (typeof source.close === 'function') source.close();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) throw new ImageUnreadable();

  return {
    base64,
    mimeType: 'image/jpeg',
    // The decoded size, which is what the request body costs — base64 is 4
    // bytes per 3, so this is the figure worth checking against a limit.
    bytes: Math.ceil((base64.length * 3) / 4),
    width,
    height,
  };
}

/** Scale the long edge down to MAX_EDGE. Never scales a small image up. */
export function fit(w, h, max = MAX_EDGE) {
  const longest = Math.max(w, h);
  if (!longest || longest <= max) return { width: w || 1, height: h || 1 };
  const scale = max / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * createImageBitmap where it exists, an <img> where it does not. Safari below
 * 17 has no options-bag support, hence the two-step attempt.
 */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch {
        /* fall through to the <img> path */
      }
    }
  }
  return decodeViaImg(file);
}

function decodeViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      });
    };
    // Revoked here as well as on success: the error path leaks the object URL
    // otherwise, and a few rejected HEICs is a real amount of memory.
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ImageUnreadable()); };
    img.src = url;
  });
}
