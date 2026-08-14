# 🌟 Image Type Converter & GIF Studio

A powerful, privacy-first Google Chrome extension that lets you convert image formats and create animated GIFs entirely on your device. **Zero servers, zero uploads, 100% private.**

---

## ✨ Features

- **⚡ Instant Format Conversion:** Convert between PNG, JPG, WEBP, AVIF, HEIC, HEIF, and GIF instantly.
- **🎬 Animated GIF Creator:** Generate custom animated GIFs from static images or directly extract frames from videos (MP4, WEBM).
- **🔒 100% Client-Side:** All processing happens securely in your browser using HTML5 Canvas and Web Workers. No data ever leaves your machine.
- **🌐 URL Loading:** Fetch images directly from the web using URLs to convert or animate them on the fly.
- **🎛️ Advanced Controls:** Customize GIF frame rates, duration (0.1s to 300s), and output resolution.
- **🚀 Blazing Fast:** Leverages `gif.js` multi-threaded web workers for rapid GIF encoding.

## 🛠️ Installation

Since this extension processes everything locally, you can easily install it as an "Unpacked Extension" in Chrome:

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/yatharthsinghgavel/Image-type-converter.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** by toggling the switch in the top right corner.
4. Click the **"Load unpacked"** button in the top left.
5. Select the downloaded `Image-type-converter` folder.
6. The extension is now installed! Pin it to your toolbar for easy access.

## 🧪 Testing

This project features a comprehensive suite of 145 property-based and unit tests using **Vitest** and **fast-check** to ensure robust performance across all edge cases.

To run the tests locally:

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the test suite:
   ```bash
   npm test
   ```

## 🏗️ Tech Stack

- **Core:** Vanilla JavaScript (ES Modules), HTML5, CSS3
- **GIF Encoding:** [gif.js](https://github.com/jnordberg/gif.js) (Web Worker based)
- **Testing:** [Vitest](https://vitest.dev/), jsdom, fast-check, jest-canvas-mock

## 📜 License

This project is open-source and available under the MIT License.
