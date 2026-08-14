/**
 * gif-creator.js — Advanced GIF Creator module.
 *
 * Exported interface:
 *   init(rootEl: HTMLElement): void
 *   classifyFiles(files): string                     — exported for testing
 *   validateGifDimensions(w, h): string|null         — exported for testing
 *   validateGifDuration(d): string|null              — exported for testing
 */

import {
  validateUrl,
  deriveFilenameFromUrl,
  downloadBlob,
  showError,
  clearError,
  ERR_MIXED_SOURCES,
  ERR_GIF_NO_SOURCE,
  ERR_GIF_DURATION,
  ERR_GIF_WIDTH,
  ERR_GIF_HEIGHT,
  ERR_GIF_TIMEOUT,
  ERR_PROCESSING,
  ERR_INVALID_URL,
  ERR_FETCH_FAILED,
  ERR_FETCH_SIZE,
  ERR_UNSUPPORTED_FORMAT
} from './utils.js';
import './libs/gif.js';

// Constants
export const GIF_FRAME_ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
export const GIF_VIDEO_ACCEPTED = ['video/mp4', 'video/webm'];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const GIF_PRESETS = {
  original: null,
  '720p':   { width: 1280, height: 720  },
  '480p':   { width: 854,  height: 480  },
  '360p':   { width: 640,  height: 360  },
  '240p':   { width: 426,  height: 240  },
  custom:   null,
};

// Pure helpers exported for testing
export function classifyFiles(files) {
  let hasImage = false;
  let hasVideo = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_BYTES) return 'invalid';
    if (GIF_FRAME_ACCEPTED.includes(file.type)) {
      hasImage = true;
    } else if (GIF_VIDEO_ACCEPTED.includes(file.type)) {
      hasVideo = true;
    } else {
      return 'invalid';
    }
  }

  if (hasImage && hasVideo) return 'mixed';
  if (hasImage) return 'frames';
  if (hasVideo) return 'video';
  return 'invalid';
}

export function validateGifDimensions(w, h) {
  const wNum = Number(w);
  const hNum = Number(h);
  if (!Number.isInteger(wNum) || wNum < 1 || wNum > 3840) return ERR_GIF_WIDTH;
  if (!Number.isInteger(hNum) || hNum < 1 || hNum > 3840) return ERR_GIF_HEIGHT;
  return null;
}

export function validateGifDuration(d) {
  const dNum = Number(d);
  if (Number.isNaN(dNum) || dNum < 0.1 || dNum > 300) return ERR_GIF_DURATION;
  return null;
}

// Internal helpers
export async function extractVideoFrames(videoFile, fps, duration) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(videoFile);
    
    video.onloadedmetadata = () => {
      const actualDuration = Math.min(duration, video.duration);
      const frameCount = Math.max(1, Math.round(fps * actualDuration));
      const frames = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      let frameIdx = 0;
      
      const captureFrame = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = canvas.width;
          frameCanvas.height = canvas.height;
          frameCanvas.getContext('2d').drawImage(canvas, 0, 0);
          frames.push(frameCanvas);
          
          frameIdx++;
          if (frameIdx < frameCount) {
            video.currentTime = (frameIdx / fps);
          } else {
            URL.revokeObjectURL(url);
            resolve(frames);
          }
        } catch(e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      
      video.onseeked = captureFrame;
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Video seek error'));
      };
      
      // Some browsers don't fire 'seeked' if setting currentTime to exactly its current value
      if (video.currentTime === 0) {
        captureFrame();
      } else {
        video.currentTime = 0;
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Video load error'));
    };
    
    video.src = url;
  });
}

export function encodeGif(frames, opts) {
  return new Promise((resolve, reject) => {
    const gif = new window.GIF({
      workers: 2,
      quality: 10,
      width: opts.width,
      height: opts.height,
      workerScript: '/libs/gif.worker.js'
    });

    if (opts.onInstance) opts.onInstance(gif);
    if (opts.onProgress) gif.on('progress', opts.onProgress);

    frames.forEach(frame => {
      gif.addFrame(frame, { delay: opts.delay, copy: true });
    });

    gif.on('finished', (blob) => {
      resolve(blob);
    });
    
    gif.on('error', (err) => reject(err));

    gif.render();
  });
}

export function init(rootEl) {
  const state = {
    sourceType: null, // 'frames' | 'video' | null
    videoFile: null,
    frames: [], // Array of { file, url, img }
    settings: {
      duration: 2, // preset value or custom number
      resolutionPreset: 'original',
      customWidth: null,
      customHeight: null,
      fps: 15
    }
  };

  rootEl.innerHTML = `
    <div class="gc-root">
      <div class="drop-zone" id="gc-drop-zone" role="button" tabindex="0"
           aria-label="Drop images or video here or click to upload">
        <div class="drop-zone-icon">🎞️</div>
        <p class="drop-zone-text">Drag &amp; drop frames or a video here</p>
        <p class="drop-zone-sub">PNG, JPG, WEBP, MP4, WEBM — up to 10 MB each</p>
      </div>
      <p class="error-msg" id="gc-drop-zone-error" hidden></p>

      <div class="upload-row">
        <button class="btn btn-secondary" id="gc-pick-btn" type="button">📂 Choose Files</button>
        <input type="file" id="gc-file-input" hidden multiple
               accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" />
        <span style="color:#606080;font-size:12px">or</span>
        <input type="text" class="url-input" id="gc-url-input"
               placeholder="Paste image URL (http:// or https://)" aria-label="Image URL" />
        <button class="btn btn-secondary" id="gc-url-btn" type="button">
          <span class="spinner spinner-sm" id="gc-url-spinner"></span>
          Add URL
        </button>
      </div>
      <p class="error-msg" id="gc-url-input-error" hidden></p>

      <div id="gc-frames-container" style="display:none; margin-bottom: 12px;">
        <p class="frame-count" id="gc-frame-count"></p>
        <ul class="frame-list" id="gc-frame-list"></ul>
      </div>

      <hr class="divider" />

      <p class="section-title">Settings</p>
      
      <div class="control-row">
        <span class="control-label">Duration</span>
        <div id="gc-duration-selector">
          <button class="preset-btn" data-val="1" type="button">1s</button>
          <button class="preset-btn selected" data-val="2" type="button">2s</button>
          <button class="preset-btn" data-val="3" type="button">3s</button>
          <button class="preset-btn" data-val="5" type="button">5s</button>
          <button class="preset-btn" data-val="10" type="button">10s</button>
          <button class="preset-btn" data-val="custom" type="button">Custom</button>
        </div>
        <input type="number" class="custom-duration-input" id="gc-custom-duration" min="0.1" max="300" step="0.1" placeholder="Sec" hidden />
      </div>
      <p class="error-msg" id="gc-custom-duration-error" hidden></p>

      <div class="control-row">
        <span class="control-label">Resolution</span>
        <select class="resolution-select" id="gc-resolution-select" aria-label="Output resolution">
          <option value="original" selected>Original</option>
          <option value="720p">720p (1280×720)</option>
          <option value="480p">480p (854×480)</option>
          <option value="360p">360p (640×360)</option>
          <option value="240p">240p (426×240)</option>
          <option value="custom">Custom</option>
        </select>
        <div class="custom-dims" id="gc-custom-dims" aria-label="Custom dimensions">
          <input type="number" class="dim-input" id="gc-custom-width" min="1" max="3840" placeholder="W" />
          <span class="dim-separator">×</span>
          <input type="number" class="dim-input" id="gc-custom-height" min="1" max="3840" placeholder="H" />
          <span class="dim-separator" style="font-size:11px;color:#606080">px</span>
        </div>
      </div>
      <p class="error-msg" id="gc-custom-width-error" hidden></p>
      <p class="error-msg" id="gc-custom-height-error" hidden></p>

      <div class="control-row">
        <span class="control-label">Frame Rate</span>
        <div id="gc-fps-selector">
          <button class="preset-btn" data-val="10" type="button">10 FPS</button>
          <button class="preset-btn selected" data-val="15" type="button">15 FPS</button>
          <button class="preset-btn" data-val="24" type="button">24 FPS</button>
          <button class="preset-btn" data-val="30" type="button">30 FPS</button>
        </div>
      </div>

      <div class="action-row">
        <button class="btn-action" id="gc-generate-btn" type="button">
          <span class="spinner" id="gc-generate-spinner"></span>
          Generate GIF
        </button>
        <div class="progress-wrap" id="gc-progress-wrap">
          <span id="gc-progress-text">Processing...</span>
        </div>
      </div>
      <p class="error-msg" id="gc-generate-btn-error" hidden></p>
    </div>
  `;

  const dropZone = rootEl.querySelector('#gc-drop-zone');
  const fileInput = rootEl.querySelector('#gc-file-input');
  const pickBtn = rootEl.querySelector('#gc-pick-btn');
  const urlInput = rootEl.querySelector('#gc-url-input');
  const urlBtn = rootEl.querySelector('#gc-url-btn');
  const urlSpinner = rootEl.querySelector('#gc-url-spinner');
  
  const framesContainer = rootEl.querySelector('#gc-frames-container');
  const frameCountEl = rootEl.querySelector('#gc-frame-count');
  const frameList = rootEl.querySelector('#gc-frame-list');

  const durationBtns = rootEl.querySelectorAll('#gc-duration-selector .preset-btn');
  const customDurationInput = rootEl.querySelector('#gc-custom-duration');
  const resolutionSelect = rootEl.querySelector('#gc-resolution-select');
  const customDims = rootEl.querySelector('#gc-custom-dims');
  const customWidthInput = rootEl.querySelector('#gc-custom-width');
  const customHeightInput = rootEl.querySelector('#gc-custom-height');
  const fpsBtns = rootEl.querySelectorAll('#gc-fps-selector .preset-btn');

  const generateBtn = rootEl.querySelector('#gc-generate-btn');
  const generateSpinner = rootEl.querySelector('#gc-generate-spinner');
  const progressWrap = rootEl.querySelector('#gc-progress-wrap');
  const progressText = rootEl.querySelector('#gc-progress-text');

  // Drag and drop
  dropZone.addEventListener('dragenter', (e) => e.preventDefault());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
  });
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  pickBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  urlInput.addEventListener('input', () => clearError('gc-url-input'));
  urlBtn.addEventListener('click', () => handleUrlAdd());

  // Duration
  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durationBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const val = btn.dataset.val;
      if (val === 'custom') {
        customDurationInput.removeAttribute('hidden');
      } else {
        customDurationInput.setAttribute('hidden', '');
        state.settings.duration = Number(val);
        clearError('gc-custom-duration');
      }
    });
  });
  customDurationInput.addEventListener('input', () => {
    state.settings.duration = customDurationInput.value;
    clearError('gc-custom-duration');
  });

  // Resolution
  resolutionSelect.addEventListener('change', () => {
    const preset = resolutionSelect.value;
    state.settings.resolutionPreset = preset;
    if (preset === 'custom') {
      customDims.classList.add('visible');
    } else {
      customDims.classList.remove('visible');
      clearError('gc-custom-width');
      clearError('gc-custom-height');
    }
  });
  customWidthInput.addEventListener('input', () => {
    state.settings.customWidth = customWidthInput.value;
    clearError('gc-custom-width');
  });
  customHeightInput.addEventListener('input', () => {
    state.settings.customHeight = customHeightInput.value;
    clearError('gc-custom-height');
  });

  // FPS
  fpsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fpsBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.settings.fps = Number(btn.dataset.val);
    });
  });

  // Generate
  generateBtn.addEventListener('click', handleGenerate);

  function handleFiles(files) {
    clearError('gc-drop-zone');
    const classification = classifyFiles(files);

    if (classification === 'invalid') {
      showError('gc-drop-zone', ERR_UNSUPPORTED_FORMAT);
      return;
    }

    if (classification === 'mixed') {
      showError('gc-drop-zone', ERR_MIXED_SOURCES);
      return;
    }

    if (state.sourceType && state.sourceType !== classification) {
      showError('gc-drop-zone', ERR_MIXED_SOURCES);
      return;
    }

    state.sourceType = classification;

    if (classification === 'video') {
      if (state.videoFile || files.length > 1) {
        showError('gc-drop-zone', ERR_MIXED_SOURCES);
        return;
      }
      state.videoFile = files[0];
      renderVideoPreview();
    } else {
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        state.frames.push({ file, url, img });
      });
      renderFrames();
    }
  }

  function renderVideoPreview() {
    framesContainer.style.display = 'block';
    frameCountEl.textContent = 'Video loaded (frames will be extracted during generation)';
    frameList.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'frame-item';
    const thumb = document.createElement('video');
    thumb.className = 'frame-thumb';
    thumb.src = URL.createObjectURL(state.videoFile);
    thumb.muted = true;
    thumb.currentTime = 0;
    li.appendChild(thumb);
    frameList.appendChild(li);
  }

  function renderFrames() {
    // Sort lexicographically
    state.frames.sort((a, b) => a.file.name.localeCompare(b.file.name));
    
    framesContainer.style.display = 'block';
    frameCountEl.textContent = `${state.frames.length} frame(s) loaded`;
    frameList.innerHTML = '';
    
    state.frames.forEach((f, idx) => {
      const li = document.createElement('li');
      li.className = 'frame-item';
      const img = document.createElement('img');
      img.className = 'frame-thumb';
      img.src = f.url;
      const indexEl = document.createElement('span');
      indexEl.className = 'frame-index';
      indexEl.textContent = idx + 1;
      li.appendChild(img);
      li.appendChild(indexEl);
      frameList.appendChild(li);
    });
  }

  async function handleUrlAdd() {
    const url = urlInput.value.trim();
    clearError('gc-url-input');

    if (!validateUrl(url)) {
      showError('gc-url-input', ERR_INVALID_URL);
      return;
    }

    if (state.sourceType === 'video') {
      showError('gc-url-input', ERR_MIXED_SOURCES);
      return;
    }

    urlBtn.disabled = true;
    urlSpinner.classList.add('visible');

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        showError('gc-url-input', `${ERR_FETCH_FAILED} (HTTP ${response.status})`);
        return;
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!GIF_FRAME_ACCEPTED.includes(contentType)) {
        showError('gc-url-input', ERR_UNSUPPORTED_FORMAT);
        return;
      }

      const blob = await response.blob();
      if (blob.size > MAX_FILE_BYTES) {
        showError('gc-url-input', ERR_FETCH_SIZE);
        return;
      }

      const stem = deriveFilenameFromUrl(url);
      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
      const filename = `${stem}.${ext}`;
      const syntheticFile = new File([blob], filename, { type: contentType });

      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objUrl;
      
      state.sourceType = 'frames';
      state.frames.push({ file: syntheticFile, url: objUrl, img });
      renderFrames();
      
      urlInput.value = '';
    } catch {
      showError('gc-url-input', ERR_FETCH_FAILED);
    } finally {
      urlBtn.disabled = false;
      urlSpinner.classList.remove('visible');
    }
  }

  async function handleGenerate() {
    clearError('gc-generate-btn');
    clearError('gc-custom-duration');
    clearError('gc-custom-width');
    clearError('gc-custom-height');

    if (!state.sourceType) {
      showError('gc-generate-btn', ERR_GIF_NO_SOURCE);
      return;
    }

    // Validate duration
    let duration = state.settings.duration;
    if (!customDurationInput.hasAttribute('hidden')) {
      const err = validateGifDuration(state.settings.duration);
      if (err) {
        showError('gc-custom-duration', err);
        return;
      }
      duration = Number(state.settings.duration);
    }

    // Validate resolution
    let outW, outH;
    if (state.settings.resolutionPreset === 'custom') {
      const err = validateGifDimensions(state.settings.customWidth, state.settings.customHeight);
      if (err === ERR_GIF_WIDTH) {
        showError('gc-custom-width', err);
        return;
      } else if (err === ERR_GIF_HEIGHT) {
        showError('gc-custom-height', err);
        return;
      }
      outW = Number(state.settings.customWidth);
      outH = Number(state.settings.customHeight);
    }

    generateBtn.disabled = true;
    generateSpinner.classList.add('visible');
    progressWrap.classList.add('visible');
    progressText.textContent = 'Preparing...';

    let gifInstance = null;
    let timeoutId = null;

    try {
      let rawFrames = [];
      if (state.sourceType === 'video') {
        progressText.textContent = 'Extracting frames...';
        rawFrames = await extractVideoFrames(state.videoFile, state.settings.fps, duration);
      } else {
        progressText.textContent = 'Loading frames...';
        rawFrames = await Promise.all(state.frames.map(async f => {
          try { await f.img.decode(); } catch (e) { /* ignore jsdom/mock errors */ }
          return f.img;
        }));
      }

      // Determine output dimensions
      const firstSource = rawFrames[0];
      const srcW = firstSource.naturalWidth || firstSource.width || firstSource.videoWidth || 400;
      const srcH = firstSource.naturalHeight || firstSource.height || firstSource.videoHeight || 400;
      
      if (state.settings.resolutionPreset === 'original') {
        outW = srcW;
        outH = srcH;
      } else if (state.settings.resolutionPreset !== 'custom') {
        const preset = GIF_PRESETS[state.settings.resolutionPreset];
        outW = preset.width;
        outH = preset.height;
      }

      // Resize frames
      progressText.textContent = 'Resizing...';
      const canvasFrames = rawFrames.map(src => {
        const c = document.createElement('canvas');
        c.width = outW;
        c.height = outH;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outW, outH);
        
        const sW = src.naturalWidth || src.width || src.videoWidth;
        const sH = src.naturalHeight || src.height || src.videoHeight;
        const sAR = sW / sH;
        const dAR = outW / outH;
        let dW, dH;
        if (sAR > dAR) {
          dH = outH; dW = outH * sAR;
        } else {
          dW = outW; dH = outW / sAR;
        }
        const dX = (outW - dW) / 2;
        const dY = (outH - dH) / 2;
        
        ctx.drawImage(src, dX, dY, dW, dH);
        return c;
      });

      // Calculate delay
      const frameCount = canvasFrames.length;
      const delay = Math.round((duration * 1000) / frameCount);

      progressText.textContent = 'Encoding GIF...';
      
      const encodePromise = encodeGif(canvasFrames, {
        width: outW,
        height: outH,
        delay,
        onInstance: (inst) => { gifInstance = inst; },
        onProgress: (p) => { progressText.textContent = `Encoding... ${Math.round(p * 100)}%`; }
      });

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 120000);
      });

      const blob = await Promise.race([encodePromise, timeoutPromise]);
      
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadBlob(blob, `animated-gif-${ts}.gif`);
      
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        if (gifInstance) gifInstance.abort();
        showError('gc-generate-btn', ERR_GIF_TIMEOUT);
      } else {
        showError('gc-generate-btn', ERR_PROCESSING);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      generateBtn.disabled = false;
      generateSpinner.classList.remove('visible');
      progressWrap.classList.remove('visible');
    }
  }
}
