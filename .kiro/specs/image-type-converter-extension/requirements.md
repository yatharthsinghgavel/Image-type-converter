# Requirements Document

## Introduction

A Chrome extension (Manifest V3) that provides client-side image type conversion through a clean, tabbed popup UI. The extension has two distinct functional areas: a Standard Converter for converting static images between popular formats with optional resolution scaling, and an Advanced GIF Creator for producing animated GIFs from sequential frame images or short video clips. All processing runs entirely in the browser using the Canvas API and supporting libraries — no server-side calls are made.

## Glossary

- **Extension**: The Chrome browser extension built on Manifest V3.
- **Popup**: The browser popup rendered when the user clicks the extension icon, containing `popup.html` and loaded by `popup.js`.
- **Tab_Bar**: The sticky navigation bar at the top of the Popup that toggles between the Standard Converter view and the Advanced GIF Creator view.
- **Standard_Converter**: The UI module (Tab 1) that handles static image conversion, implemented in `standard-converter.js`.
- **GIF_Creator**: The UI module (Tab 2) that handles animated GIF creation, implemented in `gif-creator.js`.
- **Drop_Zone**: The drag-and-drop target area within the Standard_Converter or GIF_Creator that accepts file drops.
- **Format_Selector**: The set of buttons or chips in the Standard_Converter that let the user choose the output image format.
- **Resolution_Selector**: A dropdown control present in both the Standard_Converter and GIF_Creator that exposes preset resolution options and a Custom option.
- **Canvas_API**: The browser-native HTML5 Canvas API used for client-side image rendering and pixel manipulation.
- **GIF_Library**: A client-side JavaScript library (e.g., gif.js) used by the GIF_Creator to encode animated GIFs.
- **Frame**: A single still image used as one frame in an animated GIF.
- **FPS**: Frames per second — the playback rate of the generated animated GIF.
- **Input_Format**: An image format accepted as input by the Extension (PNG, JPG/JPEG, WEBP, BMP, TIFF, SVG, ICO, AVIF, GIF, HEIC).
- **Output_Format**: An image format produced by the Standard_Converter (PNG, JPG/JPEG, WEBP, BMP, ICO, GIF, AVIF).
- **Video_Input**: A short video file (MP4 or WEBM) accepted by the GIF_Creator as a source for frame extraction.
- **URL_Input**: A publicly accessible HTTP or HTTPS URL pointing to an image resource, accepted by both the Standard_Converter and the GIF_Creator as an alternative to file upload.

---

## Requirements

### Requirement 1: Tabbed Navigation

**User Story:** As a user, I want a sticky tab bar at the top of the extension popup, so that I can switch between the Standard Converter and the Advanced GIF Creator without losing my current configuration.

#### Acceptance Criteria

1. THE Popup SHALL render a Tab_Bar that is always visible at the top of the popup regardless of scroll position.
2. THE Tab_Bar SHALL contain exactly two tab controls: "Standard Converter" and "Advanced GIF Creator".
3. WHEN the user activates the "Standard Converter" tab, THE Popup SHALL display the Standard_Converter view and hide the GIF_Creator view within 100 milliseconds.
4. WHEN the user activates the "Advanced GIF Creator" tab, THE Popup SHALL display the GIF_Creator view and hide the Standard_Converter view within 100 milliseconds.
5. THE Tab_Bar SHALL visually indicate the currently active tab by applying a distinct style that differs from inactive tabs on at least one observable property (border, background, or font weight).
6. WHEN the Popup is first opened, THE Popup SHALL display the Standard_Converter view as the default active tab with the "Standard Converter" tab control marked as active.
7. WHILE a view is active, THE Popup SHALL preserve all user-entered configuration values in that view when the user switches to the other tab and switches back.

---

### Requirement 2: Standard Converter — File Input

**User Story:** As a user, I want to provide an image file via drag-and-drop or a file picker, so that I can easily load any supported static image for conversion.

#### Acceptance Criteria

1. THE Standard_Converter SHALL render a Drop_Zone that accepts file drag-and-drop interactions.
2. THE Standard_Converter SHALL render a file upload button that opens the operating system file picker when clicked.
3. WHEN a file is dragged over the Drop_Zone, THE Standard_Converter SHALL apply a visually distinct border or background change to the Drop_Zone to indicate it is a valid drop target.
4. WHEN a valid file is dropped onto the Drop_Zone, THE Standard_Converter SHALL display a preview of the image scaled to fit within a 400×400 pixel area while preserving aspect ratio.
5. WHEN the user selects a valid file via the file upload button, THE Standard_Converter SHALL display a preview of the image scaled to fit within a 400×400 pixel area while preserving aspect ratio.
6. THE Standard_Converter SHALL accept input files in the following formats: PNG, JPG, JPEG, WEBP, BMP, TIFF, SVG, ICO, AVIF, GIF, HEIC, and shall reject any file exceeding 10 MB in size.
7. IF a dropped or selected file is not one of the accepted Input_Formats or exceeds 10 MB, THEN THE Standard_Converter SHALL display an error message identifying the reason for rejection and reject the file without attempting conversion.
8. IF a dropped or selected file matches an accepted Input_Format and does not exceed 10 MB but cannot be read or decoded, THEN THE Standard_Converter SHALL display an error message indicating the file is unreadable and reject the file without attempting conversion.
9. THE Standard_Converter SHALL render a text input field labelled "Or paste image URL" alongside the Drop_Zone and file upload button.
10. WHEN the user enters a URL into the URL input field and activates a "Load from URL" button, THE Standard_Converter SHALL fetch the image from that URL, validate it against the same Input_Format and 10 MB constraints as file uploads, and load it identically to a file drop (displaying the preview).
11. IF the URL entered is not a valid HTTP or HTTPS URL, THEN THE Standard_Converter SHALL display an error message stating "Please enter a valid http:// or https:// URL" and SHALL prevent the fetch attempt.
12. IF the fetch request fails (network error, 4xx/5xx response, CORS rejection), THEN THE Standard_Converter SHALL display an error message stating "Could not load image from URL: {reason}" and SHALL not alter the currently loaded file or settings.
13. IF the fetched resource's MIME type is not an accepted Input_Format or its size exceeds 10 MB, THEN THE Standard_Converter SHALL display the same rejection messages as for invalid file uploads.
14. WHILE a URL fetch is in progress, THE Standard_Converter SHALL display a loading indicator on the "Load from URL" button and disable it to prevent duplicate requests.
15. WHEN the source of a loaded image is a URL_Input, THE Standard_Converter SHALL derive the download filename stem from the last path segment of the URL (e.g., `https://example.com/images/photo.jpg` → stem `photo`); IF no usable filename can be derived from the URL path, THE Standard_Converter SHALL default the stem to `image`.

---

### Requirement 3: Standard Converter — Output Format Selection

**User Story:** As a user, I want to choose my target output format from a clear set of options, so that I can convert the loaded image to exactly the format I need.

#### Acceptance Criteria

1. THE Standard_Converter SHALL render a Format_Selector that presents the available Output_Formats as interactive buttons or chips.
2. THE Standard_Converter SHALL support the following Output_Formats: PNG, JPG, WEBP, BMP, ICO, GIF, AVIF.
3. WHEN the user selects an Output_Format, THE Format_Selector SHALL visually mark that format as selected and deselect any previously selected format.
4. WHEN a file is loaded, THE Standard_Converter SHALL default the selected Output_Format to PNG unless the loaded file is already PNG, in which case the default SHALL be JPG.
5. WHEN no file has been loaded, THE Standard_Converter SHALL render the Format_Selector in a disabled state that prevents selection.
6. WHEN a file is loaded, THE Standard_Converter SHALL disable the Format_Selector button corresponding to the loaded file's format to prevent same-format conversion.
7. IF the Convert button is activated and no Output_Format is selected, THEN THE Standard_Converter SHALL display an error message indicating that an output format must be selected and SHALL prevent conversion.

---

### Requirement 4: Standard Converter — Resolution Control

**User Story:** As a user, I want to choose a target resolution from preset options or enter custom dimensions, so that I can resize the image during conversion without using a separate tool.

#### Acceptance Criteria

1. THE Standard_Converter SHALL render a Resolution_Selector dropdown with the following preset options: Original, 4K (3840×2160), 1080p (1920×1080), 720p (1280×720), 480p (854×480), Custom.
2. WHEN the user selects "Original" from the Resolution_Selector, THE Standard_Converter SHALL preserve the source image's pixel dimensions during conversion.
3. WHEN the user selects a named preset (4K, 1080p, 720p, or 480p), THE Standard_Converter SHALL scale the output image to match the preset's target width and height in pixels, applying letterboxing or cropping if the source aspect ratio differs from the preset's aspect ratio.
4. WHEN the user selects "Custom" from the Resolution_Selector, THE Standard_Converter SHALL reveal two numeric input fields labelled "Width" and "Height" that accept positive integer values in pixels, each accepting values between 1 and 7680.
5. WHILE the "Custom" option is selected, THE Standard_Converter SHALL use the values entered in the Width and Height fields as the output image dimensions.
6. IF the user activates the Convert button while the "Custom" option is selected and the Width or Height field is empty, zero, or contains a non-integer value, THEN THE Standard_Converter SHALL display an error message indicating which field is invalid and SHALL prevent conversion without discarding any other user-configured settings.
7. THE Standard_Converter SHALL default the Resolution_Selector to "Original" when a file is first loaded.
8. WHEN the user selects a named preset (4K, 1080p, 720p, or 480p), THE Standard_Converter SHALL hide the Width and Height input fields.
9. IF the user enters a Width or Height value greater than 7680 in the Custom fields, THEN THE Standard_Converter SHALL display an error message indicating the maximum allowed value is 7680 pixels and SHALL prevent conversion.

---

### Requirement 5: Standard Converter — Conversion and Download

**User Story:** As a user, I want to trigger conversion with a single button click and immediately receive the converted file as a download, so that the process is fast and requires minimal steps.

#### Acceptance Criteria

1. THE Standard_Converter SHALL render a "Convert" button.
2. WHEN the "Convert" button is activated, THE Standard_Converter SHALL convert the loaded image to the selected Output_Format at the selected resolution using the Canvas_API.
3. WHEN conversion completes successfully, THE Standard_Converter SHALL initiate a browser file download of the converted image with a filename composed of the original file's stem (filename excluding extension) followed by a period and the lowercase Output_Format extension (e.g., `photo.webp`).
4. IF no file has been loaded when the "Convert" button is activated, THEN THE Standard_Converter SHALL display an error message stating that a source file must be loaded and SHALL prevent conversion.
5. IF no Output_Format has been selected when the "Convert" button is activated, THEN THE Standard_Converter SHALL display an error message stating that an output format must be selected and SHALL prevent conversion.
6. IF conversion fails due to a processing error, THEN THE Standard_Converter SHALL display an error message describing the failure cause and SHALL preserve all current user-configured settings without resetting the loaded file or selected options.
7. WHILE conversion is in progress, THE Standard_Converter SHALL display a loading indicator and disable the "Convert" button to prevent duplicate submissions.
8. IF the Canvas_API is unavailable in the current browser context, THEN THE Standard_Converter SHALL display an error message stating that image conversion is not supported in this environment and SHALL prevent the Convert button from being activated.
9. THE Standard_Converter SHALL perform all conversion processing client-side without transmitting image data to any external server.

---

### Requirement 6: GIF Creator — File Input

**User Story:** As a user, I want to upload sequential frame images or a short video file to use as the source for my animated GIF, so that I can create GIFs from either existing frame sequences or video clips.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a Drop_Zone that accepts file drag-and-drop interactions.
2. THE GIF_Creator SHALL render a file upload button that opens the operating system file picker when clicked.
3. WHEN frame image files are dropped onto the Drop_Zone, THE GIF_Creator SHALL load all dropped files as a Frame sequence ordered by ascending filename and display a thumbnail preview for each Frame alongside its 1-based index in the sequence.
4. WHEN a Video_Input file is dropped onto the Drop_Zone, THE GIF_Creator SHALL accept the file for frame extraction and display a preview image of the first extracted frame.
5. WHEN the user selects files via the file upload button, THE GIF_Creator SHALL load the selected files identically to the drag-and-drop behavior described in criteria 3 and 4.
6. THE GIF_Creator SHALL accept the following frame image formats: PNG, JPG, JPEG, WEBP.
7. THE GIF_Creator SHALL accept the following Video_Input formats: MP4, WEBM.
8. IF a dropped or selected file is not one of the accepted frame image formats or Video_Input formats, THEN THE GIF_Creator SHALL display an error message identifying the rejected filename and its unsupported format, and SHALL reject that file without loading it.
9. IF the user attempts to load both frame image files and a Video_Input file in the same session, THEN THE GIF_Creator SHALL display an error message stating that image frames and video files cannot be mixed, and SHALL reject the conflicting file type without clearing the already-loaded files.
10. WHEN multiple frame images are loaded, THE GIF_Creator SHALL display the total frame count and the filename-sorted index of each Frame in the sequence.

---

### Requirement 7: GIF Creator — Duration Configuration

**User Story:** As a user, I want to set the total duration of the generated GIF from preset options or a custom value, so that I can control how long one loop of the animation plays.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a duration control that presents the following preset options: 1s, 2s, 3s, 5s, 10s, Custom.
2. WHEN the user selects a duration preset, THE GIF_Creator SHALL use that value in seconds as the total playback duration of the generated GIF.
3. WHEN the user selects "Custom", THE GIF_Creator SHALL reveal a numeric input field that accepts a positive decimal value between 0.1 and 300 seconds.
4. WHILE the "Custom" duration option is selected, THE GIF_Creator SHALL use the value entered in the custom duration field as the total GIF duration.
5. IF the user selects "Custom" duration and the custom duration field is empty, zero, negative, non-numeric, or greater than 300 when the "Generate GIF" button is activated, THEN THE GIF_Creator SHALL display an error message stating the valid range is 0.1–300 seconds and SHALL prevent GIF generation.
6. WHEN files are first loaded, THE GIF_Creator SHALL default the duration control to "2s".

---

### Requirement 8: GIF Creator — Resolution Configuration

**User Story:** As a user, I want to set the resolution of the generated GIF from preset options or custom dimensions, so that I can balance file size against visual quality.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a Resolution_Selector dropdown with the following preset options: Original, 720p (1280×720), 480p (854×480), 360p (640×360), 240p (426×240), Custom.
2. WHEN the user selects "Original" from the Resolution_Selector, THE GIF_Creator SHALL use the pixel dimensions of the first loaded frame as the output GIF frame dimensions.
3. WHEN the user selects a named preset (720p, 480p, 360p, or 240p), THE GIF_Creator SHALL scale the output GIF frames to the corresponding pixel dimensions.
4. WHEN the user selects "Custom" from the Resolution_Selector, THE GIF_Creator SHALL reveal two numeric input fields labelled "Width" and "Height" that accept positive integer values between 1 and 3840 pixels.
5. WHILE the "Custom" option is selected, THE GIF_Creator SHALL use the values entered in the Width and Height fields as the output GIF frame dimensions.
6. IF the user selects "Custom" resolution and the Width or Height field is empty, zero, negative, non-integer, or greater than 3840 when the "Generate GIF" button is activated, THEN THE GIF_Creator SHALL display an error message stating the valid range is 1–3840 pixels and SHALL prevent GIF generation.
7. WHEN files are first loaded, THE GIF_Creator SHALL default the Resolution_Selector to "Original".

---

### Requirement 9: GIF Creator — Frame Rate Configuration

**User Story:** As a user, I want to select the frame rate for the animated GIF, so that I can control the smoothness of the animation.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a frame rate selector that presents the following options: 10 FPS, 15 FPS, 24 FPS, 30 FPS.
2. WHEN the user selects a frame rate option, THE GIF_Creator SHALL use the selected FPS value when computing per-frame delay during GIF encoding.
3. WHEN files are first loaded, THE GIF_Creator SHALL default the frame rate selector to 15 FPS.
4. THE GIF_Creator SHALL visually distinguish the active frame rate selection from inactive options using at least one observable style difference (border, background, or font weight).

---

### Requirement 10: GIF Creator — GIF Generation and Download

**User Story:** As a user, I want to generate and download the animated GIF with a single button click after configuring all settings, so that the process is straightforward and requires no additional steps.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a "Generate GIF" button.
2. WHEN the "Generate GIF" button is activated, THE GIF_Creator SHALL encode the loaded Frames or extracted video frames into an animated GIF using the GIF_Library, applying the selected duration, resolution, and FPS settings.
3. WHEN GIF generation completes successfully, THE GIF_Creator SHALL initiate a browser file download of the generated GIF with a filename in the format `animated-gif-{timestamp}.gif` where `{timestamp}` is a UTC ISO-8601 date-time string with colons replaced by hyphens.
4. IF no source files have been loaded when the "Generate GIF" button is activated, THEN THE GIF_Creator SHALL display an error message stating that source files must be loaded before generation and SHALL prevent GIF generation.
5. IF any required configuration field (duration, resolution Width/Height when Custom is selected) contains an invalid value when the "Generate GIF" button is activated, THEN THE GIF_Creator SHALL display error messages for each invalid field and SHALL prevent GIF generation without resetting any user-configured settings.
6. IF GIF generation fails due to a processing error, THEN THE GIF_Creator SHALL display an error message describing the failure cause and SHALL preserve all current user-configured settings.
7. WHILE GIF generation is in progress, THE GIF_Creator SHALL display a progress indicator and disable the "Generate GIF" button to prevent duplicate submissions.
8. IF GIF generation has not completed within 120 seconds, THE GIF_Creator SHALL cancel the operation, display an error message indicating a timeout occurred, re-enable the "Generate GIF" button, and preserve all user-configured settings.
9. THE GIF_Creator SHALL perform all frame extraction and GIF encoding client-side without transmitting image or video data to any external server.

---

### Requirement 11: Extension Architecture and Manifest

**User Story:** As a developer, I want the extension to follow Chrome Manifest V3 conventions with a modular JS structure, so that the codebase is maintainable and compliant with current Chrome extension platform requirements.

#### Acceptance Criteria

1. THE Extension SHALL include a `manifest.json` file declaring `manifest_version: 3`.
2. THE Extension SHALL define a popup action in `manifest.json` pointing to `popup.html`.
3. THE Popup SHALL load `popup.js` as its primary entry script.
4. THE Standard_Converter functionality SHALL be implemented in a dedicated `standard-converter.js` module imported by `popup.js`.
5. THE GIF_Creator functionality SHALL be implemented in a dedicated `gif-creator.js` module imported by `popup.js`.
6. THE Extension SHALL declare only the permissions in `manifest.json` that are directly required by a Chrome API invoked in the implementation; each declared permission SHALL correspond to a specific, identifiable API call in the codebase.
7. THE Extension SHALL NOT declare a background service worker in `manifest.json` unless a specific Chrome API used in the implementation explicitly requires one, in which case the service worker SHALL be documented with a comment identifying the requiring API.
8. THE Extension SHALL declare `"host_permissions": ["<all_urls>"]` in `manifest.json` to allow cross-origin image fetching from arbitrary URLs; this SHALL be the only permission added for URL fetching.

---

### Requirement 12: Client-Side Processing Constraint

**User Story:** As a user, I want all image and video processing to happen entirely in my browser, so that my files are never transmitted to a third-party server and my privacy is protected.

#### Acceptance Criteria

1. THE Extension SHALL perform all image decoding, encoding, scaling, and GIF encoding using browser-native APIs (Canvas_API) and bundled client-side libraries only.
2. THE Extension SHALL NOT make any network requests that include image binary data, video binary data, canvas pixel data (e.g., toDataURL or getImageData output), or any derivative encoding (base64, blob URL resolved to binary) in the request body, headers, or query parameters.
3. THE GIF_Library used by the GIF_Creator SHALL be bundled as a static file within the extension package directory and SHALL NOT use any `import()` call, `<script src>`, or `fetch()` that resolves to a remote URL at runtime.
4. THE Extension MAY make outbound `fetch()` requests to retrieve image data from user-supplied URLs; these requests SHALL only retrieve data (GET) and SHALL NOT transmit any locally-stored image data, canvas pixel data, or user file contents in the request body, headers, or query parameters.

---

### Requirement 13: Error Handling and User Feedback

**User Story:** As a user, I want clear, actionable error messages whenever something goes wrong, so that I understand what happened and how to correct it.

#### Acceptance Criteria

1. WHEN the Extension encounters a validation error (unsupported file format, missing required field, invalid dimension value), THE Extension SHALL display a human-readable error message in a visible element within 8px of the relevant control that caused the error.
2. WHEN the Extension encounters a processing error during conversion or GIF generation, THE Extension SHALL display a human-readable error message describing the failure cause without including raw JavaScript exception messages, stack traces, or internal variable names.
3. WHEN an error is displayed, THE Extension SHALL not clear or reset the user's current configuration inputs, preserving the loaded file reference, selected output format, selected resolution, and any custom dimension values.
4. WHEN the user corrects the input that caused a validation error (e.g., selects a valid format, enters a valid dimension, loads a valid file), THE Extension SHALL remove the associated error message within one user interaction event of the correcting action.

---

### Requirement 14: GIF Creator — URL Frame Input

**User Story:** As a user, I want to provide image URLs as frame sources for GIF creation, so that I can build animated GIFs from online images without downloading them first.

#### Acceptance Criteria

1. THE GIF_Creator SHALL render a text input field and an "Add URL" button that allows the user to add individual image URLs to the frame sequence.
2. WHEN the user enters a valid HTTP or HTTPS URL and activates the "Add URL" button, THE GIF_Creator SHALL fetch the image, validate it as a GIF frame (PNG, JPG, JPEG, or WEBP, subject to the same 10 MB limit), and append it to the frame sequence in the same way as a file drop.
3. IF the URL is not a valid HTTP or HTTPS URL, THEN THE GIF_Creator SHALL display an error message stating "Please enter a valid http:// or https:// URL" adjacent to the URL input field.
4. IF the fetch fails or the fetched resource is not an accepted frame format, THEN THE GIF_Creator SHALL display a descriptive error message and SHALL not alter the existing frame sequence.
5. WHILE a URL fetch is in progress, THE GIF_Creator SHALL display a loading indicator and disable the "Add URL" button to prevent duplicate requests.
6. IF the user attempts to add a URL-fetched image to a session that already contains a Video_Input, THEN THE GIF_Creator SHALL display the mixed-type error and reject the URL fetch.
