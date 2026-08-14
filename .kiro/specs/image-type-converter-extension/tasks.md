# Implementation Plan: Image Type Converter Extension

## Overview

Build a Chrome Manifest V3 browser extension with a two-tab popup UI. Tab 1 (Standard Converter) converts static images between seven output formats with optional resolution scaling. Tab 2 (Advanced GIF Creator) encodes animated GIFs from frame images or video clips. All processing is fully client-side using the Canvas API and a bundled copy of gif.js. Both modules support loading images from user-supplied HTTP/HTTPS URLs. The codebase is covered by Vitest unit tests and fast-check property-based tests matching the 15 correctness properties defined in the design document.

---

## Tasks

- [x] 1. Scaffold the project structure and manifest
  - [x] 1.1 Create the extension file skeleton
    - Create the root directory layout: `manifest.json`, `popup.html`, `popup.js`, `popup.css`, `standard-converter.js`, `gif-creator.js`, and a `/libs` folder that will hold `gif.js` and `gif.worker.js`
    - Write `manifest.json` declaring `manifest_version: 3`, a popup action pointing to `popup.html`, `"host_permissions": ["<all_urls>"]`, and no background service worker
    - Write the shell `popup.html` with a `<nav>` tab bar containing exactly two `<button>` elements ("Standard Converter" / "Advanced GIF Creator"), two `<section>` containers (`#standard-view`, `#gif-view`), a `<link>` to `popup.css`, and a `<script type="module" src="popup.js">`
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 11.7, 11.8_

  - [x] 1.2 Set up the test framework
    - Initialise an npm project (`package.json`) at the workspace root with `vitest`, `jsdom`, `fast-check`, and `jest-canvas-mock` as dev dependencies (exact/pinned versions)
    - Add a `vitest.config.js` that sets `environment: 'jsdom'` and imports `jest-canvas-mock` as a global setup file
    - Add a `test` script in `package.json` pointing to `vitest --run`
    - _Requirements: none (infrastructure)_

  - [x] 1.3 Download and bundle gif.js
    - Obtain `gif.js` (v0.2.0) and its companion `gif.worker.js` from the official gif.js release and place both files in `/libs/`
    - Verify neither file contains any remote `import()`, `fetch()`, or `<script src>` that resolves outside the extension package
    - _Requirements: 12.3_

- [ ] 2. Implement the tab bar and popup entry point (`popup.js`)
  - [ ] 2.1 Implement tab switching logic
    - In `popup.js`, import `init` from `standard-converter.js` and `init` from `gif-creator.js`
    - On `DOMContentLoaded`, call both `init` functions with their respective `<section>` root elements, then activate the Standard Converter tab as the default
    - Implement `activateTab(tabId)`: toggle `aria-selected` and an `active` CSS class on the two tab buttons; set `display: block` / `display: none` on the two view `<section>` elements; the entire operation must be synchronous (no async work)
    - Attach `click` handlers to both tab buttons that call `activateTab`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.2 Write unit tests for the tab bar
    - Test: activating "Standard Converter" tab shows `#standard-view` and hides `#gif-view`
    - Test: activating "Advanced GIF Creator" tab shows `#gif-view` and hides `#standard-view`
    - Test: default active tab on popup open is Standard Converter
    - Test: the active tab button has the `active` CSS class; the inactive one does not
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [ ] 3. Implement shared utilities
  - [ ] 3.1 Write shared validation and download helpers
    - In a new `utils.js` module, implement and export:
      - `validateUrl(url: string): boolean` — returns `true` only if the string begins with `http://` or `https://`
      - `deriveFilenameFromUrl(url: string): string` — extracts the last path segment without extension; returns `"image"` if no usable segment exists
      - `downloadBlob(blob: Blob, filename: string): void` — creates an `<a>` with `href = URL.createObjectURL(blob)` and `download = filename`, triggers `.click()`, then revokes the object URL
      - `showError(container: HTMLElement, fieldId: string, message: string): void` — finds or creates a `<p class="error-msg">` adjacent to the control and sets its `textContent`
      - `clearError(container: HTMLElement, fieldId: string): void` — hides the error element for the given fieldId
      - Named string constants for every user-facing error message listed in the design's Error Categories table (no inline string literals in feature modules)
    - _Requirements: 2.11, 2.15, 5.3, 13.1, 13.2_

  - [ ]* 3.2 Write unit tests for shared utilities
    - Test: `validateUrl` returns `false` for empty string, relative path, `ftp://` prefix, bare hostname
    - Test: `validateUrl` returns `true` for `http://` and `https://` URLs
    - Test: `deriveFilenameFromUrl` extracts stem from `https://example.com/images/photo.jpg` → `"photo"`
    - Test: `deriveFilenameFromUrl` returns `"image"` for `https://example.com/` and `https://example.com`
    - Test: each error constant is a non-empty string with no substring matching `at \w+ \(.*:\d+:\d+\)`
    - _Requirements: 2.15, 13.2_

  - [ ]* 3.3 Write property test for URL validation (Property 14)
    - **Property 14: URL validation rejects non-HTTP/S strings**
    - **Validates: Requirements 2.11, 14.3**
    - Use `fc.string()` filtered to exclude strings starting with `http://` or `https://`; assert `validateUrl` returns `false` for all generated inputs (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 14: URL validation rejects non-HTTP/S strings_

- [ ] 4. Implement `popup.css` — all visual styles
  - [ ] 4.1 Write base layout and tab bar styles
    - Style the tab `<nav>` with `position: sticky; top: 0` and a visible background so it stays at the top regardless of scroll position
    - Add `.active` styles for tab buttons that differ from inactive tabs on at least one of: border, background, or font weight
    - Set popup `width: 520px; min-height: 400px`
    - _Requirements: 1.1, 1.5_

  - [ ] 4.2 Write Standard Converter and GIF Creator layout styles
    - Style the Drop_Zone: border, padding, hover/drag-over state (`.drag-over` class applies a distinct border/background)
    - Style Format_Selector chips: selected chip has a visually distinct state (border or background)
    - Style the FPS selector buttons (same selected-state pattern as format chips)
    - Style `.error-msg` elements: red text, `display: none` by default, positioned within 8px of their associated control
    - Style loading spinners/indicators for Convert, Generate GIF, Load from URL, and Add URL buttons
    - _Requirements: 2.3, 3.3, 9.4, 13.1_

- [ ] 5. Implement Standard Converter — file input and preview (`standard-converter.js`)
  - [ ] 5.1 Build the Standard Converter DOM and file-input logic
    - In `standard-converter.js`, export `init(rootEl)` that renders inside `rootEl`:
      - A Drop_Zone `<div>` with drag event handlers (`dragenter`, `dragover`, `dragleave`, `drop`) — add/remove a `drag-over` CSS class during `dragover`
      - A file `<input type="file">` and a styled upload button that triggers it; accepted MIME types: `image/png,image/jpeg,image/webp,image/bmp,image/tiff,image/svg+xml,image/x-icon,image/avif,image/gif,image/heic`
      - An `<img>` preview element, hidden until a file is loaded
    - Implement `validateFile(file: File): ValidationResult` using `STANDARD_ACCEPTED` MIME list and 10 MB size cap
    - Implement `renderPreview(imgEl)`: draw the image into a preview `<canvas>` (or set `<img> src`) scaled to fit within 400×400 while preserving aspect ratio
    - On valid file drop or file-picker selection: call `validateFile`, on pass display preview; on fail display error via `showError`
    - On image `<img>` decode error: display decode-error message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 5.2 Write property test for file validation — oversized files (Property 1)
    - **Property 1: File validation rejects all oversized files**
    - **Validates: Requirements 2.6, 2.7**
    - Generate `File` mocks with `size` between 10,485,761 and 50,000,000 and any MIME type; assert `validateFile` returns `{ valid: false, reason: 'file_too_large' }` (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 1: File validation rejects all oversized files_

  - [ ]* 5.3 Write property test for file validation — unsupported formats (Property 2)
    - **Property 2: File validation rejects all unsupported formats**
    - **Validates: Requirements 2.6, 2.7**
    - Generate `File` mocks with size ≤ 10 MB and MIME types drawn from `fc.string()` filtered to exclude every entry in `STANDARD_ACCEPTED`; assert `validateFile` returns `{ valid: false, reason: 'unsupported_format' }` (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 2: File validation rejects all unsupported formats_

  - [ ]* 5.4 Write property test for preview aspect ratio (Property 12)
    - **Property 12: Preview dimensions preserve aspect ratio and fit bounding box**
    - **Validates: Requirements 2.4, 2.5**
    - Generate `(srcW, srcH)` integer pairs (1–10,000); call the aspect-ratio calculation function extracted from `renderPreview`; assert `dstW ≤ 400`, `dstH ≤ 400`, and `|dstW/dstH − srcW/srcH| < 0.01` (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 12: Preview dimensions preserve aspect ratio and fit bounding box_

- [ ] 6. Implement Standard Converter — format and resolution controls
  - [ ] 6.1 Build the Format_Selector
    - Render seven chip buttons for the Output_Formats: PNG, JPG, WEBP, BMP, ICO, GIF, AVIF
    - Clicking a chip: apply selected style to clicked chip, remove from others, update `state.selectedFormat`
    - After a file loads: disable the chip matching the loaded file's format; set default selection (PNG unless loaded file is PNG, then JPG)
    - When no file is loaded: render all chips in a disabled state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 6.2 Write property test for format selector disables loaded format (Property 3)
    - **Property 3: Format selector disables the loaded file's own format**
    - **Validates: Requirements 3.6**
    - For each OutputFormat, simulate `init` + file-load with that format; assert the corresponding chip button has `disabled = true` and all others do not (`numRuns: 100` via `fc.constantFrom` over the 7 formats)
    - _Feature: image-type-converter-extension, Property 3: Format selector disables the loaded file's own format_

  - [ ]* 6.3 Write property test for default format selection (Property 4)
    - **Property 4: Default format selection correctness**
    - **Validates: Requirements 3.4**
    - For each InputFormat, simulate loading a file of that format; assert `state.selectedFormat === 'jpg'` when input is PNG, `=== 'png'` for all other inputs (`numRuns: 100` via `fc.constantFrom` over InputFormats)
    - _Feature: image-type-converter-extension, Property 4: Default format selection correctness_

  - [ ] 6.4 Build the Resolution_Selector
    - Render a `<select>` with options: Original, 4K (3840×2160), 1080p (1920×1080), 720p (1280×720), 480p (854×480), Custom
    - When "Custom" is selected: show Width and Height `<input type="number">` fields (range 1–7680); hide them for all other options
    - Default to "Original" when a file is first loaded
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [ ]* 6.5 Write property test for SC custom dimension bounds (Property 5)
    - **Property 5: Custom dimension bounds are always enforced (Standard Converter)**
    - **Validates: Requirements 4.4, 4.6, 4.9**
    - Generate `(w, h)` integer pairs (`fc.integer({min: -100, max: 10000})` × 2); call the dimension-validation function; assert conversion is rejected with an error message when `w < 1 || w > 7680 || h < 1 || h > 7680`, accepted otherwise; assert all other state fields are unchanged on rejection (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 5: Custom dimension bounds are always enforced (Standard Converter)_

- [ ] 7. Implement Standard Converter — conversion and download
  - [ ] 7.1 Implement `convertImage` and the Convert button
    - Check `document.createElement('canvas').getContext('2d')` availability on `init`; if null, show the canvas-unavailable error and keep Convert disabled
    - Implement `convertImage(img, format, res): Promise<Blob>`:
      - Create an offscreen `<canvas>` at computed output dimensions (apply preset or custom dimensions; for named presets apply letterboxing via `ctx.drawImage` with computed offset/scale to cover the target box)
      - Call `canvas.toBlob(cb, FORMAT_MIME[format], quality)` and wrap in a Promise
    - Implement the Convert button click handler:
      - Validate: file loaded, format selected, custom dims valid (if Custom preset)
      - Show loading indicator and disable button
      - Await `convertImage`; on success call `downloadBlob(blob, stem + '.' + format)`; on failure display processing-error message
      - Re-enable button regardless of outcome
    - Derive `stem` from `file.name` (strip last extension) or from `deriveFilenameFromUrl` when source is a URL
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [ ]* 7.2 Write property test for download filename stem preservation (Property 8)
    - **Property 8: Download filename stem preservation (Standard Converter)**
    - **Validates: Requirements 5.3**
    - Generate filenames as `fc.string({minLength:1})` + `'.' + fc.constantFrom(...extensions)`; call the stem-extraction function; assert the resulting download filename equals `stem + '.' + selectedFormat` (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 8: Download filename stem preservation (Standard Converter)_

  - [ ]* 7.3 Write property test for error state preserving configuration (Property 9)
    - **Property 9: Error state preserves all configuration**
    - **Validates: Requirements 5.6, 10.5, 10.6, 13.3**
    - Generate a composite `StandardConverterState` arbitrary; simulate a failed convert attempt (invalid custom dims, no file, canvas error); assert deep equality of the full state object before and after (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 9: Error state preserves all configuration_

  - [ ]* 7.4 Write property test for error messages containing no exception internals (Property 13)
    - **Property 13: Error messages contain no raw exception internals**
    - **Validates: Requirements 13.2**
    - Generate `Error` objects with varied messages and stacks (`fc.string()` × 2); pass through the error-sanitiser in the processing-error path; assert the displayed string contains no match for `/at \w+ \(.*:\d+:\d+\)/` and no raw exception type names (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 13: Error messages contain no raw exception internals_

- [ ] 8. Checkpoint — Standard Converter complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement GIF Creator — file input, frame management, and preview (`gif-creator.js`)
  - [ ] 9.1 Build the GIF Creator DOM and file-input logic
    - Export `init(rootEl)` that renders inside `rootEl`:
      - A Drop_Zone with drag event handlers and the `drag-over` CSS class toggled on `dragover`
      - A file `<input type="file" multiple>` and upload button; accepted types cover PNG, JPG, JPEG, WEBP, MP4, WEBM
      - A frame thumbnail list `<ul>` that displays each frame's index (1-based) and filename
    - Implement `classifyFiles(files: FileList): 'frames' | 'video' | 'mixed' | 'invalid'` by checking each file's MIME type against `GIF_FRAME_ACCEPTED` and `GIF_VIDEO_ACCEPTED`
    - On drop or file-picker selection: call `classifyFiles`; display the mixed-type error if 'mixed'; display the unsupported-format error per rejected file if 'invalid'; otherwise set `state.sourceType`, populate `state.frames` or `state.videoFile`, and render thumbnails sorted ascending by filename
    - When frame images are loaded: sort by filename (ascending lexicographic), render thumbnail + 1-based index for each; show total frame count
    - When a video is loaded: render a preview of the first extracted frame
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [ ]* 9.2 Write property test for mixed source type rejection (Property 10)
    - **Property 10: Mixed source type rejection**
    - **Validates: Requirements 6.9**
    - Generate sessions with frame images already loaded + a video file added (and vice versa); assert rejection with error message and that existing files remain unchanged (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 10: Mixed source type rejection_

  - [ ]* 9.3 Write property test for frame sequence order invariant (Property 11)
    - **Property 11: Frame sequence order invariant**
    - **Validates: Requirements 6.3, 6.10**
    - Generate arrays of File mocks with distinct filenames using `fc.shuffledSubarray`; call the filename-sort function; assert the resulting sequence is identical to `[...files].sort((a,b) => a.name.localeCompare(b.name))` regardless of drop order (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 11: Frame sequence order invariant_

- [ ] 10. Implement GIF Creator — duration, resolution, and FPS controls
  - [ ] 10.1 Build the duration control
    - Render a set of preset buttons (1s, 2s, 3s, 5s, 10s, Custom) with selected-state styling
    - When "Custom" is selected: reveal a `<input type="number" min="0.1" max="300" step="0.1">` field; hide for all other presets
    - Default to "2s" when files are first loaded
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 10.2 Build the GIF resolution selector
    - Render a `<select>` with: Original, 720p (1280×720), 480p (854×480), 360p (640×360), 240p (426×240), Custom
    - When "Custom" is selected: reveal Width and Height inputs (range 1–3840); hide for other presets
    - Default to "Original" when files are first loaded
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

  - [ ] 10.3 Build the FPS selector
    - Render four buttons: 10 FPS, 15 FPS, 24 FPS, 30 FPS
    - Selected button has a distinct style (at least one of: border, background, font weight)
    - Default to 15 FPS when files are first loaded
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 10.4 Write property test for custom GIF duration bounds (Property 7)
    - **Property 7: Custom GIF duration bounds are always enforced**
    - **Validates: Requirements 7.3, 7.5**
    - Generate random floats (`fc.float({min: -10, max: 400})`); call the duration-validation function; assert rejection when `d < 0.1 || d > 300`, acceptance otherwise; assert state is unchanged on rejection (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 7: Custom GIF duration bounds are always enforced_

  - [ ]* 10.5 Write property test for custom GIF dimension bounds (Property 6)
    - **Property 6: Custom dimension bounds are always enforced (GIF Creator)**
    - **Validates: Requirements 8.4, 8.6**
    - Generate `(w, h)` integer pairs (`fc.integer({min: -100, max: 5000})` × 2); assert rejection with error when `w < 1 || w > 3840 || h < 1 || h > 3840`, acceptance otherwise; assert state unchanged on rejection (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 6: Custom dimension bounds are always enforced (GIF Creator)_

- [ ] 11. Implement GIF Creator — frame extraction and GIF generation
  - [ ] 11.1 Implement video frame extraction
    - Implement `extractVideoFrames(videoFile, fps, duration): Promise<HTMLImageElement[]>`:
      - Create an `HTMLVideoElement`, set `src = URL.createObjectURL(videoFile)`
      - On `loadedmetadata`, compute `frameCount = Math.round(fps × duration)`
      - Iterate frame indices: set `video.currentTime = i / fps`, await the `seeked` event, draw each frame onto an offscreen canvas, collect canvas snapshots
      - Revoke the object URL after all frames are extracted
    - _Requirements: 6.4, 10.2_

  - [ ] 11.2 Implement `encodeGif` using gif.js and the Generate GIF button
    - Import `GIF` from `/libs/gif.js` with `workerScript` pointing to `/libs/gif.worker.js`
    - Implement `encodeGif(frames, opts: GifEncodeOptions): Promise<Blob>`:
      - Create a `GIF` instance with `opts.width`, `opts.height`, `workers: 2`, `quality: 10`, `repeat: 0`
      - For each frame `HTMLImageElement`, draw it scaled to `opts.width × opts.height` on a temporary canvas, call `gif.addFrame(canvas, {delay: Math.round(1000 / opts.fps)})`
      - Call `gif.render()`; resolve on `finished` event; reject on `error` event
    - Implement the Generate GIF button click handler:
      - Validate: source files loaded, duration valid, resolution valid
      - Disable button, show progress indicator
      - Start a 120,000 ms timeout that calls `gif.abort()` and displays the timeout error on expiry
      - Await frame extraction (video) or `loadFrameImages` (image files)
      - Await `encodeGif`; on success: clear timeout, call `downloadBlob(blob, 'animated-gif-' + new Date().toISOString().replace(/:/g, '-') + '.gif')`; on failure: display processing error
      - Re-enable button and preserve all settings regardless of outcome
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ]* 11.3 Write unit tests for GIF Creator defaults and filename
    - Test: after `init` + file load, `state.duration.preset === '2s'`, `state.fps === 15`, `state.resolution.preset === 'original'`
    - Test: `classifyFiles` returns `'frames'` for PNG/JPG/WEBP-only, `'video'` for MP4/WEBM-only, `'mixed'` for a combination
    - Test: download filename matches `/^animated-gif-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.gif$/`
    - _Requirements: 7.6, 8.7, 9.3, 10.3_

- [ ] 12. Implement URL fetching for Standard Converter
  - [ ] 12.1 Build the URL input and "Load from URL" flow in Standard Converter
    - Render a `<input type="text">` labelled "Or paste image URL" and a "Load from URL" `<button>` in the Standard Converter view
    - Implement `handleUrlLoad()`:
      - Call `validateUrl(url)`; if false display `"Please enter a valid http:// or https:// URL."` and return
      - Disable button, show loading indicator
      - `fetch(url, { method: 'GET' })`; handle network error (catch block), non-OK response (check `response.ok`), MIME type mismatch (check `response.headers.get('content-type')`), and size exceeded (check `blob.size > 10_485_760`)
      - On success: derive filename stem via `deriveFilenameFromUrl(url)`, pass `Blob` through the same file-load path as a file drop (validate, preview, update state)
      - Re-enable button regardless of outcome; preserve all existing state on any failure
    - _Requirements: 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15_

  - [ ]* 12.2 Write property test for URL fetch preserving state on failure (Property 15)
    - **Property 15: URL fetch preserves existing state on failure**
    - **Validates: Requirements 2.12, 14.4**
    - Generate a composite `StandardConverterState` arbitrary + a failure mode from `fc.constantFrom('invalid_url', 'fetch_failed', 'bad_mime', 'size_exceeded')`; mock `fetch` to simulate the chosen failure; assert deep state equality before and after the failed fetch (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 15: URL fetch preserves existing state on failure_

- [ ] 13. Implement URL fetching for GIF Creator
  - [ ] 13.1 Build the URL input and "Add URL" flow in GIF Creator
    - Render a `<input type="text">` and "Add URL" `<button>` in the GIF Creator view
    - Implement `handleUrlAdd()`:
      - Call `validateUrl(url)`; if false display `"Please enter a valid http:// or https:// URL."` adjacent to the URL input
      - If `state.sourceType === 'video'` display the mixed-type error and return
      - Disable button, show loading indicator
      - Fetch, validate MIME against `GIF_FRAME_ACCEPTED`, validate size ≤ 10 MB; on success append to frame sequence (resorted by filename, using URL last-segment as the filename for sort purposes) and render thumbnail
      - On any failure: display descriptive error, preserve existing frame sequence
      - Re-enable button regardless of outcome
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 14. Checkpoint — URL fetching complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Comprehensive property-based and integration tests
  - [ ]* 15.1 Write property test for GIF error preserving configuration (Property 9 — GIF side)
    - **Property 9: Error state preserves all configuration (GIF Creator)**
    - **Validates: Requirements 10.5, 10.6, 13.3**
    - Generate a composite `GifCreatorState` arbitrary; simulate a failed generation (invalid dims, invalid duration, no files, timeout path); assert deep equality of the full state object before and after (`numRuns: 100`)
    - _Feature: image-type-converter-extension, Property 9: Error state preserves all configuration_

  - [ ]* 15.2 Write integration tests for Standard Converter end-to-end
    - Load a PNG fixture file → select WEBP → click Convert → assert the resulting Blob has type `image/webp` and size > 0
    - Load a PNG fixture via mocked `fetch` URL → assert preview rendered, state updated identically to a file drop
    - Simulate `canvas.getContext('2d')` returning `null` → assert Convert button is disabled and the canvas-unavailable error is visible
    - _Requirements: 5.2, 5.8, 5.9_

  - [ ]* 15.3 Write integration tests for GIF Creator end-to-end
    - Load 3 JPEG frame fixtures → default settings → click Generate GIF → assert output Blob type is `image/gif` and size > 0
    - Simulate a 120 s timeout by advancing fake timers → assert button re-enabled, timeout error message displayed, state preserved
    - _Requirements: 10.2, 10.8_

  - [ ]* 15.4 Write smoke tests for manifest and package integrity
    - Assert `manifest.json` has `manifest_version === 3`
    - Assert `manifest.json` popup action points to `popup.html`
    - Assert `manifest.json` has no `background` key
    - Assert `manifest.json` `host_permissions` contains `"<all_urls>"`
    - Assert both `/libs/gif.js` and `/libs/gif.worker.js` exist in the filesystem
    - _Requirements: 11.1, 11.2, 11.7, 11.8, 12.3_

- [ ] 16. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Core implementation tasks must not be skipped.
- Every property test must use `numRuns: 100` and carry the annotation comment: `// Feature: image-type-converter-extension, Property N: <property_text>`
- `gif.js` and `gif.worker.js` must both be present in `/libs/` before Task 11.2 is attempted.
- The Canvas API availability check (Task 7.1) must run at module init time, not inside the Convert click handler, to disable the button proactively.
- No task in this list requires a network call during implementation — all external requests in tests use mocked `fetch`.
- `URL.createObjectURL` and `URL.revokeObjectURL` are available in jsdom via jest-canvas-mock or a manual stub; add a global polyfill in the Vitest setup file if needed.
- Error messages are defined as named constants in `utils.js`; feature modules import them rather than embedding inline string literals.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.2"] },
    { "id": 3, "tasks": ["5.1", "6.1", "6.4"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "6.2", "6.3", "6.5"] },
    { "id": 5, "tasks": ["7.1", "10.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4", "10.4", "10.5"] },
    { "id": 7, "tasks": ["9.1", "11.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "11.2"] },
    { "id": 9, "tasks": ["11.3", "12.1", "13.1"] },
    { "id": 10, "tasks": ["12.2", "15.1"] },
    { "id": 11, "tasks": ["15.2", "15.3", "15.4"] }
  ]
}
```
