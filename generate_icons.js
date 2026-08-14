const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'logo.svg');
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

// Clean up old SVG fallbacks
fs.readdirSync(iconsDir).forEach(f => {
  if (f.endsWith('.svg')) fs.unlinkSync(path.join(iconsDir, f));
});

const sizes = [16, 32, 48, 128];
const svgBuffer = fs.readFileSync(svgPath);

Promise.all(
  sizes.map(size =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon${size}.png`))
      .then(() => console.log(`✓ icon${size}.png`))
  )
).then(() => {
  console.log('All icons generated successfully!');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
