const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'popup.css');
let css = fs.readFileSync(cssPath, 'utf8');

const replacements = {
  '#0d1117': 'var(--bg-main)',
  '#161b22': 'var(--bg-panel)',
  '#1a1a2e': 'var(--border-dark)',
  '#0f3460': 'var(--border-light)',
  'rgba(15, 52, 96, 0.15)': 'var(--bg-overlay)',
  'rgba(15, 52, 96, 0.2)': 'var(--bg-overlay-hover)',
  'rgba(15, 52, 96, 0.4)': 'var(--bg-overlay-active)',
  'rgba(15, 52, 96, 0.9)': 'var(--bg-panel-translucent)',
  '#e94560': 'var(--accent-primary)',
  '#ff4b6b': 'var(--accent-hover)',
  '#e0e0e0': 'var(--text-primary)',
  '#a0a0b0': 'var(--text-secondary)',
  '#606080': 'var(--text-muted)',
  '#f87171': 'var(--text-error)',
  'rgba(233, 69, 96, 0.1)': 'var(--accent-bg)',
  'rgba(255, 255, 255, 0.1)': 'var(--border-translucent)'
};

for (const [hex, variable] of Object.entries(replacements)) {
  css = css.split(hex).join(variable);
}

const rootDef = `
:root {
  --bg-main: #0d1117;
  --bg-panel: #161b22;
  --border-dark: #1a1a2e;
  --border-light: #0f3460;
  --bg-overlay: rgba(15, 52, 96, 0.15);
  --bg-overlay-hover: rgba(15, 52, 96, 0.2);
  --bg-overlay-active: rgba(15, 52, 96, 0.4);
  --bg-panel-translucent: rgba(15, 52, 96, 0.9);
  --accent-primary: #e94560;
  --accent-hover: #ff4b6b;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0b0;
  --text-muted: #606080;
  --text-error: #f87171;
  --accent-bg: rgba(233, 69, 96, 0.1);
  --border-translucent: rgba(255, 255, 255, 0.1);
}

.light-theme {
  --bg-main: #f9f9fb;
  --bg-panel: #ffffff;
  --border-dark: #d0d0e0;
  --border-light: #e0e0f0;
  --bg-overlay: rgba(0, 0, 0, 0.05);
  --bg-overlay-hover: rgba(0, 0, 0, 0.08);
  --bg-overlay-active: rgba(0, 0, 0, 0.15);
  --bg-panel-translucent: rgba(255, 255, 255, 0.9);
  --accent-primary: #0066cc;
  --accent-hover: #005bb5;
  --text-primary: #1a1a1a;
  --text-secondary: #505060;
  --text-muted: #808090;
  --text-error: #dc2626;
  --accent-bg: rgba(0, 102, 204, 0.1);
  --border-translucent: rgba(0, 0, 0, 0.1);
}

`;

css = rootDef + css;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS refactored');
