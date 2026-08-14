/**
 * standard-converter.js — Standard Converter module.
 *
 * Exported interface:
 *   init(rootEl: HTMLElement): void
 *   validateFile(file): ValidationResult           — exported for testing
 *   computePreviewDimensions(srcW, srcH): {w, h}   — exported for testing
 *   validateCustomDimensions(w, h): string|null    — exported for testing (returns error msg or null)
 *   extractStem(filename): string                  — exported for testing
 *
 * Requirements covered: 2.1–2.8, 2.9–2.15, 3.1–3.7, 4.1–4.9, 5.1–5.9
 */

import {
  validateUrl,
  deriveFilenameFromUrl,
  downloadBlob,
  showError,
  clearError,
  ERR_UNSUPPORTED_FORMAT,
  ERR_FILE_TOO_LARGE,
  ERR_DECODE_ERROR,
  ERR_NO_FILE,
  ERR_NO_FORMAT,
  ERR_INVALID_WIDTH,
  ERR_INVALID_HEIGHT,
  ERR_PROCESSING,
  ERR_CANVAS_UNAVAILABLE,
  ERR_INVALID_URL,
  ERR_FETCH_FAILED,
  ERR_FETCH_SIZE,
} from './utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STANDARD_ACCEPTED = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/x-icon',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
];

/** Map from file MIME type to chip format key */
const MIME_TO_FORMAT = {
  'image/png':    'png',
  'image/jpeg':   'jpg',
  'image/webp':   'webp',
  'image/bmp':    'bmp',
  'image/x-icon': 'ico',
  'image/gif':    'gif',
  'image/avif':   'avif',
};

/** Output formats available as chips */
export const OUTPUT_FORMATS = ['png', 'jpg', 'webp', 'bmp', 'ico', 'gif', 'avif'];

/** Map from chip format key to MIME type */
export const FORMAT_MIME = {
  png:  'image/png',
  jpg:  'image/jpeg',
  webp: 'image/webp',
  bmp:  'image/bmp',
  ico:  'image/x-icon',
  gif:  'image/gif',
  avif: 'image/avif',
};

/** Resolution presets: null means "use source dimensions" */
export const STANDARD_PRESETS = {
  original: null,
  '4k':     { width: 3840, height: 2160 },
  '1080p':  { width: 1920, height: 1080 },
  '720p':   { width: 1280, height: 720  },
  '480p':   { width: 854,  height: 480  },
  custom:   null,
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const PREVIEW_MAX = 400;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Validates a File object against accepted formats and size limit.
 *
 * @param {File} file
 * @returns {{ valid: boolean, reason?: string, message: string }}
 */
export function validateFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, reason: 'file_too_large', message: ERR_FILE_TOO_LARGE };
  }
  if (!STANDARD_ACCEPTED.includes(file.type)) {
    return { valid: false, reason: 'unsupported_format', message: ERR_UNSUPPORTED_FORMAT };
  }
  return { valid: true, message: '' };
}

/**
 * Computes the display dimensions for a preview image that must fit within
 * PREVIEW_MAX × PREVIEW_MAX while preserving aspect ratio.
 *
 * @param {number} srcW
 * @param {number} srcH
 * @returns {{ w: number, h: number }}
 */
export function computePreviewDimensions(srcW, srcH) {
  if (srcW <= PREVIEW_MAX && srcH <= PREVIEW_MAX) {
    return { w: srcW, h: srcH };
  }
  const scale = Math.min(PREVIEW_MAX / srcW, PREVIEW_MAX / srcH);
  // Use Math.max(1, ...) so neither dimension rounds down to 0.
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return { w, h };
}

/**
 * Validates custom width/height inputs.
 * Returns null if both are valid, or an error message string if not.
 *
 * @param {number|string} w
 * @param {number|string} h
 * @returns {string|null}
 */
export function validateCustomDimensions(w, h) {
  const wNum = Number(w);
  const hNum = Number(h);
  if (!Number.isInteger(wNum) || wNum < 1 || wNum > 7680) return ERR_INVALID_WIDTH;
  if (!Number.isInteger(hNum) || hNum < 1 || hNum > 7680) return ERR_INVALID_HEIGHT;
  return null;
}

/**
 * Strips the last extension from a filename to produce a stem.
 * e.g.  "photo.jpg"  → "photo"
 *       "banner"     → "banner"
 *
 * @param {string} filename
 * @returns {string}
 */
export function extractStem(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

// ---------------------------------------------------------------------------
// Module init
// ---------------------------------------------------------------------------

/**
 * Initialises the Standard Converter UI inside rootEl.
 *
 * @param {HTMLElement} rootEl
 */
export function init(rootEl) {
  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    file:           null,   // File | null
    imageElement:   null,   // HTMLImageElement | null
    selectedFormat: null,   // OutputFormat | null
    sourceStem:     null,   // string | null  (derived from file.name or URL)
    resolution: {
      preset:       'original',
      customWidth:  null,
      customHeight: null,
    },
    urlInput: '',
  };

  // ── Canvas availability check (Requirement 5.8) ───────────────────────────
  const canvasAvailable = !!document.createElement('canvas').getContext('2d');

  // ── Build DOM ─────────────────────────────────────────────────────────────
  rootEl.innerHTML = `
    <div class="sc-root">
      <!-- Drop zone -->
      <div class="drop-zone" id="sc-drop-zone" role="button" tabindex="0"
           aria-label="Drop image here or click to upload">
        <div class="drop-zone-icon">🖼️</div>
        <p class="drop-zone-text">Drag &amp; drop an image here</p>
        <p class="drop-zone-sub">PNG, JPG, WEBP, BMP, TIFF, SVG, ICO, AVIF, GIF, HEIC — up to 10 MB</p>
      </div>
      <p class="error-msg" id="sc-drop-zone-error" hidden></p>

      <!-- File picker -->
      <div class="upload-row">
        <button class="btn btn-secondary" id="sc-pick-btn" type="button">📂 Choose File</button>
        <input type="file" id="sc-file-input" hidden
               accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,image/svg+xml,image/x-icon,image/avif,image/gif,image/heic" />
        <span style="color:#606080;font-size:12px">or</span>
        <input type="text" class="url-input" id="sc-url-input"
               placeholder="Paste image URL (http:// or https://)" aria-label="Image URL" />
        <button class="btn btn-secondary" id="sc-url-btn" type="button">
          <span class="spinner spinner-sm" id="sc-url-spinner"></span>
          Load from URL
        </button>
      </div>
      <p class="error-msg" id="sc-url-input-error" hidden></p>

      <!-- Preview -->
      <div class="preview-container" id="sc-preview-container">
        <img class="preview-img" id="sc-preview-img" alt="Preview" />
        <p class="preview-filename" id="sc-preview-filename"></p>
      </div>

      <hr class="divider" />

      <!-- Format selector -->
      <p class="section-title">Output Format</p>
      <div class="format-selector" id="sc-format-selector" role="group" aria-label="Output format"></div>
      <p class="error-msg" id="sc-format-selector-error" hidden></p>

      <hr class="divider" />

      <!-- Resolution selector -->
      <div class="resolution-row">
        <span class="resolution-label">Resolution</span>
        <select class="resolution-select" id="sc-resolution-select" aria-label="Output resolution">
          <option value="original">Original</option>
          <option value="4k">4K (3840×2160)</option>
          <option value="1080p">1080p (1920×1080)</option>
          <option value="720p">720p (1280×720)</option>
          <option value="480p">480p (854×480)</option>
          <option value="custom">Custom</option>
        </select>
        <div class="custom-dims" id="sc-custom-dims" aria-label="Custom dimensions">
          <input type="number" class="dim-input" id="sc-custom-width"
                 min="1" max="7680" placeholder="W" aria-label="Width in pixels" />
          <span class="dim-separator">×</span>
          <input type="number" class="dim-input" id="sc-custom-height"
                 min="1" max="7680" placeholder="H" aria-label="Height in pixels" />
          <span class="dim-separator" style="font-size:11px;color:#606080">px</span>
        </div>
      </div>
      <p class="error-msg" id="sc-custom-width-error" hidden></p>
      <p class="error-msg" id="sc-custom-height-error" hidden></p>

      <!-- Convert button -->
      <div class="action-row">
        <button class="btn-action" id="sc-convert-btn" type="button"
                ${canvasAvailable ? '' : 'disabled'}>
          <span class="spinner" id="sc-convert-spinner"></span>
          Convert &amp; Download
        </button>
      </div>
      <p class="error-msg" id="sc-convert-btn-error" hidden></p>
      ${!canvasAvailable ? `<p class="error-msg" id="sc-canvas-error">${ERR_CANVAS_UNAVAILABLE}</p>` : ''}
    </div>
  `;

  // ── Element refs ──────────────────────────────────────────────────────────
  const dropZone        = rootEl.querySelector('#sc-drop-zone');
  const fileInput       = rootEl.querySelector('#sc-file-input');
  const pickBtn         = rootEl.querySelector('#sc-pick-btn');
  const urlInput        = rootEl.querySelector('#sc-url-input');
  const urlBtn          = rootEl.querySelector('#sc-url-btn');
  const urlSpinner      = rootEl.querySelector('#sc-url-spinner');
  const previewContainer= rootEl.querySelector('#sc-preview-container');
  const previewImg      = rootEl.querySelector('#sc-preview-img');
  const previewFilename = rootEl.querySelector('#sc-preview-filename');
  const formatSelector  = rootEl.querySelector('#sc-format-selector');
  const resolutionSelect= rootEl.querySelector('#sc-resolution-select');
  const customDims      = rootEl.querySelector('#sc-custom-dims');
  const customWidthInput= rootEl.querySelector('#sc-custom-width');
  const customHeightInput=rootEl.querySelector('#sc-custom-height');
  const convertBtn      = rootEl.querySelector('#sc-convert-btn');
  const convertSpinner  = rootEl.querySelector('#sc-convert-spinner');

  // ── Build format chips ────────────────────────────────────────────────────
  OUTPUT_FORMATS.forEach((fmt) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'format-chip';
    chip.dataset.format = fmt;
    chip.textContent = fmt.toUpperCase();
    chip.disabled = true; // disabled until a file is loaded (Req 3.5)
    chip.addEventListener('click', () => handleFormatSelect(fmt));
    formatSelector.appendChild(chip);
  });

  // ── Drag and drop ─────────────────────────────────────────────────────────
  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); });
  dropZone.addEventListener('dragover',  (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  // ── File picker ───────────────────────────────────────────────────────────
  pickBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = ''; // reset so same file can be re-picked
  });

  // ── URL load ──────────────────────────────────────────────────────────────
  urlInput.addEventListener('input', () => {
    state.urlInput = urlInput.value;
    clearError('sc-url-input');
  });
  urlBtn.addEventListener('click', () => handleUrlLoad());

  // ── Resolution selector ───────────────────────────────────────────────────
  resolutionSelect.addEventListener('change', () => {
    const preset = resolutionSelect.value;
    state.resolution.preset = preset;
    if (preset === 'custom') {
      customDims.classList.add('visible');
    } else {
      customDims.classList.remove('visible');
      clearError('sc-custom-width');
      clearError('sc-custom-height');
    }
  });

  customWidthInput.addEventListener('input', () => {
    state.resolution.customWidth = customWidthInput.value;
    clearError('sc-custom-width');
  });
  customHeightInput.addEventListener('input', () => {
    state.resolution.customHeight = customHeightInput.value;
    clearError('sc-custom-height');
  });

  // ── Convert button ────────────────────────────────────────────────────────
  convertBtn.addEventListener('click', () => handleConvert());

  // ── Internal handlers ─────────────────────────────────────────────────────

  function handleFiles(files) {
    const file = files[0];
    clearError('sc-drop-zone');
    const result = validateFile(file);
    if (!result.valid) {
      showError('sc-drop-zone', result.message);
      return;
    }
    loadImageFile(file, file.name);
  }

  function loadImageFile(file, displayName) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.file         = file;
        state.imageElement = img;
        state.sourceStem   = extractStem(displayName);
        onFileLoaded(file.type, displayName);
      };
      img.onerror = () => {
        showError('sc-drop-zone', ERR_DECODE_ERROR);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => showError('sc-drop-zone', ERR_DECODE_ERROR);
    reader.readAsDataURL(file);
  }

  function loadBlobAsImage(blob, stem) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Create a synthetic File-like object so the rest of the pipeline is identical
      const syntheticFile = new File([blob], stem + '.' + (blob.type.split('/')[1] || 'jpg'), { type: blob.type });
      state.file         = syntheticFile;
      state.imageElement = img;
      state.sourceStem   = stem;
      URL.revokeObjectURL(url);
      onFileLoaded(blob.type, stem);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showError('sc-drop-zone', ERR_DECODE_ERROR);
    };
    img.src = url;
  }

  function onFileLoaded(mimeType, displayName) {
    // Show preview
    renderPreview(state.imageElement, displayName);

    // Enable chips and set defaults (Req 3.4, 3.5, 3.6)
    const loadedFormat = MIME_TO_FORMAT[mimeType] || null;
    enableChips(loadedFormat);

    // Default resolution to Original (Req 4.7)
    resolutionSelect.value = 'original';
    state.resolution.preset = 'original';
    customDims.classList.remove('visible');

    // Clear all previous errors
    clearError('sc-drop-zone');
    clearError('sc-format-selector');
    clearError('sc-convert-btn');
    clearError('sc-custom-width');
    clearError('sc-custom-height');
  }

  function renderPreview(img, displayName) {
    const { w, h } = computePreviewDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height);
    previewImg.src = img.src;
    previewImg.style.maxWidth  = `${w}px`;
    previewImg.style.maxHeight = `${h}px`;
    previewFilename.textContent = displayName;
    previewContainer.classList.add('visible');
  }

  function enableChips(loadedFormat) {
    const defaultFormat = loadedFormat === 'png' ? 'jpg' : 'png';
    state.selectedFormat = defaultFormat;

    formatSelector.querySelectorAll('.format-chip').forEach((chip) => {
      const fmt = chip.dataset.format;
      chip.disabled = (fmt === loadedFormat); // disable own format (Req 3.6)
      chip.classList.remove('selected');
      if (fmt === defaultFormat && fmt !== loadedFormat) {
        chip.classList.add('selected');
      }
    });
  }

  function handleFormatSelect(fmt) {
    state.selectedFormat = fmt;
    clearError('sc-format-selector');
    formatSelector.querySelectorAll('.format-chip').forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.format === fmt);
    });
  }

  async function handleUrlLoad() {
    const url = urlInput.value.trim();
    clearError('sc-url-input');

    if (!validateUrl(url)) {
      showError('sc-url-input', ERR_INVALID_URL);
      return;
    }

    urlBtn.disabled = true;
    urlSpinner.classList.add('visible');

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        showError('sc-url-input', `${ERR_FETCH_FAILED} (HTTP ${response.status})`);
        return;
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!STANDARD_ACCEPTED.includes(contentType)) {
        showError('sc-url-input', ERR_UNSUPPORTED_FORMAT);
        return;
      }

      const blob = await response.blob();
      if (blob.size > MAX_FILE_BYTES) {
        showError('sc-url-input', ERR_FETCH_SIZE);
        return;
      }

      const stem = deriveFilenameFromUrl(url);
      loadBlobAsImage(blob, stem);
      urlInput.value = '';
      state.urlInput = '';
    } catch {
      showError('sc-url-input', ERR_FETCH_FAILED);
    } finally {
      urlBtn.disabled = false;
      urlSpinner.classList.remove('visible');
    }
  }

  async function handleConvert() {
    clearError('sc-convert-btn');

    if (!canvasAvailable) return;

    if (!state.file || !state.imageElement) {
      showError('sc-convert-btn', ERR_NO_FILE);
      return;
    }
    if (!state.selectedFormat) {
      showError('sc-convert-btn', ERR_NO_FORMAT);
      return;
    }

    // Custom dimension validation (Req 4.6, 4.9)
    if (state.resolution.preset === 'custom') {
      const dimErr = validateCustomDimensions(
        state.resolution.customWidth,
        state.resolution.customHeight
      );
      if (dimErr === ERR_INVALID_WIDTH) {
        showError('sc-custom-width', ERR_INVALID_WIDTH);
        return;
      }
      if (dimErr === ERR_INVALID_HEIGHT) {
        showError('sc-custom-height', ERR_INVALID_HEIGHT);
        return;
      }
    }

    convertBtn.disabled = true;
    convertSpinner.classList.add('visible');

    try {
      const blob = await convertImage(
        state.imageElement,
        state.selectedFormat,
        state.resolution
      );
      const filename = `${state.sourceStem}.${state.selectedFormat}`;
      downloadBlob(blob, filename);
    } catch {
      showError('sc-convert-btn', ERR_PROCESSING);
    } finally {
      convertBtn.disabled = false;
      convertSpinner.classList.remove('visible');
    }
  }

  function convertImage(img, format, resolution) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      let outW, outH;

      const preset = STANDARD_PRESETS[resolution.preset];
      if (preset) {
        outW = preset.width;
        outH = preset.height;
      } else if (resolution.preset === 'custom') {
        outW = Number(resolution.customWidth);
        outH = Number(resolution.customHeight);
      } else {
        // 'original'
        outW = img.naturalWidth  || img.width;
        outH = img.naturalHeight || img.height;
      }

      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      // For named presets: letterbox/fit-cover by scaling to fill the box
      if (preset) {
        const srcAR = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
        const dstAR = outW / outH;
        let drawW, drawH, drawX, drawY;
        if (srcAR > dstAR) {
          drawH = outH; drawW = outH * srcAR;
        } else {
          drawW = outW; drawH = outW / srcAR;
        }
        drawX = (outW - drawW) / 2;
        drawY = (outH - drawH) / 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        ctx.drawImage(img, 0, 0, outW, outH);
      }

      const mimeType = FORMAT_MIME[format];
      const quality  = format === 'jpg' ? 0.92 : undefined;
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob returned null'));
        },
        mimeType,
        quality
      );
    });
  }
}
