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
import { ZipBuilder } from './zip-builder.js';

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
export const OUTPUT_FORMATS = ['png', 'jpg', 'webp', 'bmp', 'ico', 'gif', 'avif', 'pdf'];

/** Map from chip format key to MIME type */
export const FORMAT_MIME = {
  png:  'image/png',
  jpg:  'image/jpeg',
  webp: 'image/webp',
  bmp:  'image/bmp',
  ico:  'image/x-icon',
  gif:  'image/gif',
  avif: 'image/avif',
  pdf:  'application/pdf',
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
    loadedImages:   [],     // Array of { file, img, stem }
    selectedFormat: null,   // OutputFormat | null
    resolution: { preset: 'original', customWidth: '', customHeight: '' },
    urlInput: '',
    quality: 92,
    debounceTimer: null,
    previewUrl: null,
    transforms: {
      rotation: 0,
      flipH: false,
      flipV: false,
      crop: null, // {x, y, w, h} normalized [0-1]
    },
    cropMode: false,
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
        <button class="btn btn-secondary" id="sc-pick-btn" type="button">📂 Choose Files</button>
        <input type="file" id="sc-file-input" hidden multiple
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
        <p class="preview-filename" id="sc-preview-count"></p>
        <ul class="frame-list" id="sc-preview-list" style="justify-content: center;"></ul>
        
        <!-- Edit Toolbar (Single File Only) -->
        <div class="edit-toolbar" id="sc-edit-toolbar" hidden>
          <button class="btn btn-secondary btn-sm" id="sc-rotate-left" title="Rotate Left">↺</button>
          <button class="btn btn-secondary btn-sm" id="sc-rotate-right" title="Rotate Right">↻</button>
          <button class="btn btn-secondary btn-sm" id="sc-flip-h" title="Flip Horizontal">⇔</button>
          <button class="btn btn-secondary btn-sm" id="sc-flip-v" title="Flip Vertical">⇕</button>
          <button class="btn btn-secondary btn-sm" id="sc-crop-btn" title="Crop">✂ Crop</button>
          <button class="btn btn-secondary btn-sm" id="sc-reset-edit" title="Reset">↩ Reset</button>
        </div>

        <!-- Crop UI Container -->
        <div id="sc-crop-container" class="crop-container" hidden>
          <img id="sc-crop-img" class="crop-img" />
          <div class="crop-overlay top"></div>
          <div class="crop-overlay bottom"></div>
          <div class="crop-overlay left"></div>
          <div class="crop-overlay right"></div>
          <div class="crop-selection" id="sc-crop-box"></div>
          <div class="crop-actions">
            <button class="btn btn-primary btn-sm" id="sc-crop-apply">Apply Crop</button>
            <button class="btn btn-secondary btn-sm" id="sc-crop-cancel">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Before & After Comparison -->
      <div class="comparison-container" id="sc-comparison" hidden>
        <div class="comparison-panel">
          <p class="comparison-label">Original</p>
          <img class="comparison-img" id="sc-original-img" />
          <p class="comparison-size" id="sc-original-size"></p>
        </div>
        <div class="comparison-divider">→</div>
        <div class="comparison-panel">
          <p class="comparison-label">Converted</p>
          <img class="comparison-img" id="sc-converted-img" />
          <p class="comparison-size" id="sc-converted-size"></p>
        </div>
      </div>

      <hr class="divider" />

      <!-- Format selector -->
      <p class="section-title">Output Format</p>
      <div class="format-selector" id="sc-format-selector" role="group" aria-label="Output format"></div>
      <p class="error-msg" id="sc-format-selector-error" hidden></p>

      <!-- Quality control -->
      <div class="quality-row" id="sc-quality-row" hidden>
        <span class="control-label">Quality</span>
        <input type="range" class="quality-slider" id="sc-quality-slider"
               min="1" max="100" value="92" aria-label="Output quality" />
        <span class="quality-value" id="sc-quality-value">92%</span>
      </div>

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
        <span id="sc-batch-progress" style="color: #a0a0b0; font-size: 12px;" hidden></span>
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
  const previewCount    = rootEl.querySelector('#sc-preview-count');
  const previewList     = rootEl.querySelector('#sc-preview-list');
  const formatSelector  = rootEl.querySelector('#sc-format-selector');
  const qualityRow      = rootEl.querySelector('#sc-quality-row');
  const qualitySlider   = rootEl.querySelector('#sc-quality-slider');
  const qualityValue    = rootEl.querySelector('#sc-quality-value');
  const resolutionSelect= rootEl.querySelector('#sc-resolution-select');
  const customDims      = rootEl.querySelector('#sc-custom-dims');
  const customWidthInput= rootEl.querySelector('#sc-custom-width');
  const customHeightInput=rootEl.querySelector('#sc-custom-height');
  const convertBtn      = rootEl.querySelector('#sc-convert-btn');
  const convertSpinner  = rootEl.querySelector('#sc-convert-spinner');
  const batchProgress   = rootEl.querySelector('#sc-batch-progress');
  
  const comparisonCont  = rootEl.querySelector('#sc-comparison');
  const origImg         = rootEl.querySelector('#sc-original-img');
  const origSize        = rootEl.querySelector('#sc-original-size');
  const convImg         = rootEl.querySelector('#sc-converted-img');
  const convSize        = rootEl.querySelector('#sc-converted-size');

  const editToolbar     = rootEl.querySelector('#sc-edit-toolbar');
  const cropContainer   = rootEl.querySelector('#sc-crop-container');
  const cropImg         = rootEl.querySelector('#sc-crop-img');
  const cropBox         = rootEl.querySelector('#sc-crop-box');
  const overlays        = {
    top: rootEl.querySelector('.crop-overlay.top'),
    bottom: rootEl.querySelector('.crop-overlay.bottom'),
    left: rootEl.querySelector('.crop-overlay.left'),
    right: rootEl.querySelector('.crop-overlay.right')
  };

  rootEl.querySelector('#sc-rotate-left').addEventListener('click', () => applyTransform('rotation', -90));
  rootEl.querySelector('#sc-rotate-right').addEventListener('click', () => applyTransform('rotation', 90));
  rootEl.querySelector('#sc-flip-h').addEventListener('click', () => applyTransform('flipH', true));
  rootEl.querySelector('#sc-flip-v').addEventListener('click', () => applyTransform('flipV', true));
  rootEl.querySelector('#sc-reset-edit').addEventListener('click', resetTransforms);
  
  rootEl.querySelector('#sc-crop-btn').addEventListener('click', startCrop);
  rootEl.querySelector('#sc-crop-cancel').addEventListener('click', cancelCrop);
  rootEl.querySelector('#sc-crop-apply').addEventListener('click', applyCropSelection);

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

  qualitySlider.addEventListener('input', () => {
    state.quality = parseInt(qualitySlider.value, 10);
    qualityValue.textContent = `${state.quality}%`;
    triggerComparison();
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
      triggerComparison();
    }
  });

  customWidthInput.addEventListener('input', () => {
    state.resolution.customWidth = customWidthInput.value;
    clearError('sc-custom-width');
    triggerComparison();
  });
  customHeightInput.addEventListener('input', () => {
    state.resolution.customHeight = customHeightInput.value;
    clearError('sc-custom-height');
    triggerComparison();
  });

  // ── Convert button ────────────────────────────────────────────────────────
  convertBtn.addEventListener('click', () => handleConvert());

  // ── Internal handlers ─────────────────────────────────────────────────────

  function handleFiles(files) {
    clearError('sc-drop-zone');
    
    // Process new files
    Array.from(files).forEach((file) => {
      const result = validateFile(file);
      if (!result.valid) {
        showError('sc-drop-zone', `${file.name}: ${result.message}`);
        return;
      }
      loadImageFile(file, file.name);
    });
  }

  function loadImageFile(file, displayName) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.loadedImages.push({
          file,
          img,
          stem: extractStem(displayName)
        });
        onImagesUpdated();
      };
      img.onerror = () => {
        showError('sc-drop-zone', `${displayName}: ${ERR_DECODE_ERROR}`);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => showError('sc-drop-zone', `${displayName}: ${ERR_DECODE_ERROR}`);
    reader.readAsDataURL(file);
  }

  function loadBlobAsImage(blob, stem) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      state.loadedImages.push({
        file: blob,
        img,
        stem
      });
      onImagesUpdated();
      // clean up blob url
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    img.onerror = () => {
      showError('sc-url-input', ERR_DECODE_ERROR);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function onImagesUpdated() {
    if (state.loadedImages.length === 0) return;
    
    // Just use the first image for format logic
    const firstType = state.loadedImages[0].file.type || 'image/jpeg';
    const loadedFormat = MIME_TO_FORMAT[firstType] || 'jpg';
    
    renderPreview();
    enableChips(loadedFormat);
    triggerComparison();
  }

  function renderPreview() {
    previewList.innerHTML = '';
    
    if (state.loadedImages.length === 0) {
      previewContainer.classList.remove('visible');
      editToolbar.setAttribute('hidden', '');
      return;
    }

    if (state.loadedImages.length === 1) {
      editToolbar.removeAttribute('hidden');
    } else {
      editToolbar.setAttribute('hidden', '');
    }

    state.loadedImages.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'frame-item';
      const img = document.createElement('img');
      img.className = 'frame-thumb';
      img.src = item.img.src;
      img.alt = item.stem;
      
      // Apply transforms visually to thumbnail if it's a single file
      if (state.loadedImages.length === 1) {
        const { rotation, flipH, flipV } = state.transforms;
        const scaleX = flipH ? -1 : 1;
        const scaleY = flipV ? -1 : 1;
        img.style.transform = `rotate(${rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
      }
      
      const title = document.createElement('span');
      title.className = 'frame-index';
      title.textContent = item.stem.length > 8 ? item.stem.substring(0, 6) + '...' : item.stem;
      li.appendChild(img);
      li.appendChild(title);
      previewList.appendChild(li);
    });

    previewCount.textContent = `${state.loadedImages.length} image${state.loadedImages.length > 1 ? 's' : ''} loaded`;
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

    handleFormatSelect(defaultFormat);
  }

  function handleFormatSelect(fmt) {
    state.selectedFormat = fmt;
    clearError('sc-format-selector');
    formatSelector.querySelectorAll('.format-chip').forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.format === fmt);
    });

    const isLossy = ['jpg', 'webp', 'avif'].includes(fmt);
    if (isLossy) {
      qualityRow.removeAttribute('hidden');
    } else {
      qualityRow.setAttribute('hidden', '');
    }
    
    triggerComparison();
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

  // ── Comparison logic ──────────────────────────────────────────────────────

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function triggerComparison() {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    
    // Only show comparison for single file
    if (state.loadedImages.length !== 1 || !state.selectedFormat) {
      comparisonCont.setAttribute('hidden', '');
      return;
    }

    state.debounceTimer = setTimeout(updateComparison, 300);
  }

  async function updateComparison() {
    const item = state.loadedImages[0];
    const originalBytes = item.file.size || 0;
    
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }

    try {
      const blob = await convertImage(item.img, state.selectedFormat, state.resolution);
      state.previewUrl = URL.createObjectURL(blob);
      
      origImg.src = item.img.src;
      convImg.src = state.previewUrl;

      origSize.textContent = originalBytes ? formatBytes(originalBytes) : 'Unknown';
      convSize.textContent = formatBytes(blob.size);

      if (originalBytes && blob.size !== originalBytes) {
        const diff = originalBytes - blob.size;
        const pct = Math.abs((diff / originalBytes) * 100).toFixed(0);
        if (diff > 0) {
          convSize.textContent += ` (↓ ${pct}%)`;
          convSize.style.color = '#4ade80';
        } else {
          convSize.textContent += ` (↑ ${pct}%)`;
          convSize.style.color = '#f87171';
        }
      } else {
        convSize.style.color = '';
      }

      comparisonCont.removeAttribute('hidden');
    } catch (err) {
      comparisonCont.setAttribute('hidden', '');
    }
  }

  async function handleConvert() {
    if (state.loadedImages.length === 0) {
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

    clearError('sc-convert-btn');
    convertBtn.disabled = true;
    convertSpinner.classList.add('visible');
    
    if (state.loadedImages.length > 1) {
      batchProgress.removeAttribute('hidden');
      batchProgress.textContent = `Processing 0 of ${state.loadedImages.length}...`;
    }

    try {
      const isBatch = state.loadedImages.length > 1;
      const convertedFiles = [];

      for (let i = 0; i < state.loadedImages.length; i++) {
        const item = state.loadedImages[i];
        if (isBatch) batchProgress.textContent = `Processing ${i+1} of ${state.loadedImages.length}...`;
        
        // 1. Generate PNG blob for baseline
        const baseBlob = await convertImage(item.img, 'png', state.resolution);
        let finalBlob = baseBlob;
        
        // 2. Build custom binary if needed
        if (state.selectedFormat === 'ico') {
          finalBlob = await generateIco(baseBlob);
        } else if (state.selectedFormat === 'pdf') {
          // If PDF, we use a JPG payload to save space since uncompressed PDF text is large
          const jpgBlob = await convertImage(item.img, 'jpg', state.resolution);
          const outW = parseInt(state.resolution.customWidth || item.img.width, 10);
          const outH = parseInt(state.resolution.customHeight || item.img.height, 10);
          finalBlob = await generatePdf(jpgBlob, outW, outH);
        } else if (state.selectedFormat !== 'png') {
          // Normal formats handled by toBlob natively
          finalBlob = await convertImage(item.img, state.selectedFormat, state.resolution);
        }

        convertedFiles.push({
          name: `${item.stem}.${state.selectedFormat}`,
          blob: finalBlob
        });
      }

      if (isBatch) {
        batchProgress.textContent = 'Zipping...';
        const zip = new ZipBuilder();
        for (const file of convertedFiles) {
          const arrayBuffer = await file.blob.arrayBuffer();
          zip.addFile(file.name, new Uint8Array(arrayBuffer));
        }
        const zipBlob = zip.generate();
        downloadBlob(zipBlob, `converted_images.zip`);
      } else {
        downloadBlob(convertedFiles[0].blob, convertedFiles[0].name);
      }
    } catch (err) {
      console.error(err);
      showError('sc-convert-btn', ERR_PROCESSING);
    } finally {
      convertBtn.disabled = false;
      convertSpinner.classList.remove('visible');
      batchProgress.setAttribute('hidden', '');
    }
  }

  function convertImage(img, format, resolution) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      
      const { rotation, flipH, flipV, crop } = state.transforms;
      const isRotated = rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270;
      
      let srcX = 0, srcY = 0, srcW = img.naturalWidth || img.width, srcH = img.naturalHeight || img.height;
      if (crop) {
        srcX = srcW * crop.x;
        srcY = srcH * crop.y;
        srcW = srcW * crop.w;
        srcH = srcH * crop.h;
      }
      
      let baseW = isRotated ? srcH : srcW;
      let baseH = isRotated ? srcW : srcH;

      let outW = baseW;
      let outH = baseH;

      const preset = resolution.preset;
      if (preset === 'custom') {
        outW = parseInt(resolution.customWidth, 10);
        outH = parseInt(resolution.customHeight, 10);
      } else if (preset && preset !== 'original') {
        outW = STANDARD_PRESETS[preset].width;
        outH = STANDARD_PRESETS[preset].height;
      }

      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      // Setup letterboxing for presets
      let drawW = outW, drawH = outH, drawX = 0, drawY = 0;
      if (preset && preset !== 'original' && preset !== 'custom') {
        const srcAR = baseW / baseH;
        const dstAR = outW / outH;
        if (srcAR > dstAR) {
          drawH = outH; drawW = outH * srcAR;
        } else {
          drawW = outW; drawH = outW / srcAR;
        }
        drawX = (outW - drawW) / 2;
        drawY = (outH - drawH) / 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outW, outH);
      }

      ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      
      // Draw considering rotation swap
      const sDrawW = isRotated ? drawH : drawW;
      const sDrawH = isRotated ? drawW : drawH;
      
      ctx.drawImage(img, srcX, srcY, srcW, srcH, -sDrawW / 2, -sDrawH / 2, sDrawW, sDrawH);

      const mimeType = FORMAT_MIME[format];
      const isLossy  = ['jpg', 'webp', 'avif'].includes(format);
      const quality  = isLossy ? state.quality / 100 : undefined;
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

  // ── Binary Builders (ICO & PDF) ─────────────────────────────────────────

  async function generateIco(pngBlob) {
    const pngBuffer = await pngBlob.arrayBuffer();
    const pngBytes = new Uint8Array(pngBuffer);
    
    // Minimal ICO header: 6 bytes header + 16 bytes directory
    const icoSize = 6 + 16 + pngBytes.length;
    const buffer = new ArrayBuffer(icoSize);
    const view = new DataView(buffer);
    const array = new Uint8Array(buffer);

    // ICONDIR
    view.setUint16(0, 0, true); // reserved
    view.setUint16(2, 1, true); // image type (1 = icon)
    view.setUint16(4, 1, true); // num images

    // ICONDIRENTRY
    let width = 0; // 0 means 256
    let height = 0;
    view.setUint8(6, width);
    view.setUint8(7, height);
    view.setUint8(8, 0); // color count
    view.setUint8(9, 0); // reserved
    view.setUint16(10, 1, true); // planes
    view.setUint16(12, 32, true); // bpp
    view.setUint32(14, pngBytes.length, true); // size in bytes
    view.setUint32(18, 22, true); // offset to image data

    array.set(pngBytes, 22);

    return new Blob([buffer], { type: 'image/x-icon' });
  }

  async function generatePdf(jpgBlob, width, height) {
    const jpgBuffer = await jpgBlob.arrayBuffer();
    const jpgBytes = new Uint8Array(jpgBuffer);
    
    const wPt = width;
    const hPt = height;
    
    const parts = [];
    parts.push("%PDF-1.4\n%âãÏÓ\n");
    
    const objOffsets = [];
    
    function addObj(content) {
      const offset = parts.map(p => typeof p === 'string' ? p.length : p.byteLength).reduce((a,b)=>a+b, 0);
      objOffsets.push(offset);
      const objNum = objOffsets.length;
      parts.push(`${objNum} 0 obj\n${content}\nendobj\n`);
      return objNum;
    }

    addObj("<< /Type /Catalog /Pages 2 0 R >>");
    addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`);
    
    const contentStream = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im1 Do Q`;
    addObj(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    
    const imgDict = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>`;
    const obj5Offset = parts.map(p => typeof p === 'string' ? p.length : p.byteLength).reduce((a,b)=>a+b, 0);
    objOffsets.push(obj5Offset);
    const obj5Num = objOffsets.length;
    parts.push(`${obj5Num} 0 obj\n${imgDict}\nstream\n`);
    parts.push(jpgBytes);
    parts.push("\nendstream\nendobj\n");
    
    const xrefOffset = parts.map(p => typeof p === 'string' ? p.length : p.byteLength).reduce((a,b)=>a+b, 0);
    let xref = "xref\n0 " + (objOffsets.length + 1) + "\n0000000000 65535 f \n";
    for (const off of objOffsets) {
      xref += off.toString().padStart(10, '0') + " 00000 n \n";
    }
    parts.push(xref);
    
    parts.push(`trailer\n<< /Size ${objOffsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    
    return new Blob(parts, { type: 'application/pdf' });
  }
}
