/**
 * utils.js — Shared validation, download, and error-display helpers.
 *
 * Exported functions:
 *   validateUrl(url)           — returns true only for http:// or https:// strings
 *   deriveFilenameFromUrl(url) — extracts last path segment stem, defaults to "image"
 *   downloadBlob(blob, filename) — triggers a browser download of a Blob
 *   showError(fieldId, message)  — shows/creates an error <p> adjacent to fieldId element
 *   clearError(fieldId)          — hides the error <p> for fieldId
 *
 * Exported constants:
 *   ERR_* — every user-facing error message string used by feature modules
 */

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Returns true only if `url` begins with "http://" or "https://".
 * Intentionally uses a simple startsWith check, not a full URL parse.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function validateUrl(url) {
  if (typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Extracts the last path segment of a URL and strips its file extension to
 * produce a filename stem suitable for use in a download.
 *
 * Examples:
 *   "https://example.com/images/photo.jpg" → "photo"
 *   "https://example.com/"                 → "image"
 *   "https://example.com"                  → "image"
 *   "https://example.com/path/"            → "image"
 *
 * Returns "image" whenever no usable segment exists.
 *
 * @param {string} url
 * @returns {string}
 */
export function deriveFilenameFromUrl(url) {
  try {
    // Use the URL constructor to reliably separate pathname from host.
    const parsed = new URL(url);
    // pathname is the path component only (e.g. "/images/photo.jpg", or "/" for bare domains).
    const pathname = parsed.pathname; // always starts with "/"

    // Split on "/" and get the last non-empty segment.
    const segments = pathname.split('/').filter((s) => s.length > 0);
    const lastSegment = segments[segments.length - 1];

    // Only treat a segment as a filename if it contains a dot (i.e. has an extension).
    // A bare path segment like "path" in "/path/" is a directory name, not a file.
    if (!lastSegment || !lastSegment.includes('.')) {
      return 'image';
    }

    // Strip the file extension (last dot and everything after).
    const dotIndex = lastSegment.lastIndexOf('.');
    const stem = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;

    return stem.trim() || 'image';
  } catch {
    // Fallback for non-parseable URLs: strip query/fragment and try manually.
    try {
      const withoutQuery = url.split('?')[0].split('#')[0];
      const parts = withoutQuery.split('/');
      // Skip if the last part looks like a hostname (no prior slash-segment means it's the host).
      const lastSegment = parts.length > 3 ? parts.pop() : '';
      if (!lastSegment) return 'image';
      const dotIndex = lastSegment.lastIndexOf('.');
      const stem = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
      return stem.trim() || 'image';
    } catch {
      return 'image';
    }
  }
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Creates a temporary <a> element to trigger a browser file download for the
 * given Blob, then cleans up the object URL.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Error display helpers
// ---------------------------------------------------------------------------

/**
 * Shows an error message adjacent to the element with id `fieldId`.
 *
 * Looks for an element with id `${fieldId}-error`. If it doesn't exist,
 * creates a <p class="error-msg" id="${fieldId}-error"> and inserts it
 * immediately after the element with id `fieldId`.
 *
 * Sets textContent to `message` and removes the `hidden` attribute.
 *
 * @param {string} fieldId
 * @param {string} message
 */
export function showError(fieldId, message) {
  const errorId = `${fieldId}-error`;
  let errorEl = document.getElementById(errorId);

  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'error-msg';
    errorEl.id = errorId;

    const anchor = document.getElementById(fieldId);
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(errorEl, anchor.nextSibling);
    } else {
      // Fallback: append to body if the anchor element doesn't exist yet.
      document.body.appendChild(errorEl);
    }
  }

  errorEl.textContent = message;
  errorEl.removeAttribute('hidden');
}

/**
 * Hides the error message element associated with `fieldId` by adding the
 * `hidden` attribute to it. Does nothing if the element doesn't exist.
 *
 * @param {string} fieldId
 */
export function clearError(fieldId) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.setAttribute('hidden', '');
  }
}

// ---------------------------------------------------------------------------
// Error message constants
// ---------------------------------------------------------------------------

// Standard Converter — file input errors
export const ERR_UNSUPPORTED_FORMAT =
  'Unsupported file format. Accepted: PNG, JPG, WEBP, BMP, TIFF, SVG, ICO, AVIF, GIF, HEIC.';

export const ERR_FILE_TOO_LARGE = 'File exceeds the 10 MB size limit.';

export const ERR_DECODE_ERROR = 'The file could not be read or decoded.';

// Standard Converter — conversion pre-flight errors
export const ERR_NO_FILE = 'Please load a source image before converting.';

export const OUTPUT_FORMATS = ['jpg', 'png', 'webp', 'bmp', 'avif', 'tiff', 'ico', 'pdf'];

export const ERR_NO_FORMAT = 'Please select an output format.';

// Standard Converter — custom resolution errors
export const ERR_INVALID_WIDTH = 'Width must be a whole number between 1 and 7680.';

export const ERR_INVALID_HEIGHT = 'Height must be a whole number between 1 and 7680.';

// GIF Creator — source type errors
export const ERR_MIXED_SOURCES =
  'Image frames and video files cannot be mixed. Clear your current files first.';

export const ERR_GIF_NO_SOURCE =
  'Please load source images or a video before generating.';

// GIF Creator — duration error
export const ERR_GIF_DURATION = 'Duration must be a number between 0.1 and 300 seconds.';

// GIF Creator — custom resolution errors
export const ERR_GIF_WIDTH = 'Width must be a whole number between 1 and 3840.';

export const ERR_GIF_HEIGHT = 'Height must be a whole number between 1 and 3840.';

// GIF Creator — generation errors
export const ERR_GIF_TIMEOUT =
  'GIF generation timed out. Try fewer frames or a lower resolution.';

export const ERR_PROCESSING =
  'Conversion failed. Please try again. Your settings have been preserved.';

// Canvas / browser capability error
export const ERR_CANVAS_UNAVAILABLE = 'Image conversion is not supported in this browser.';

// URL input errors
export const ERR_INVALID_URL = 'Please enter a valid http:// or https:// URL.';

export const ERR_FETCH_FAILED = 'Could not load image from URL.';

export const ERR_FETCH_SIZE = 'File exceeds the 10 MB size limit.';
