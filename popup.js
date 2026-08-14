/**
 * popup.js — Entry point for the Image Type Converter extension popup.
 *
 * Responsibilities:
 *  - Mount the tab bar and handle tab switching (activateTab / getActiveTab)
 *  - Import and initialise the Standard Converter and GIF Creator modules
 *  - Default active tab: Standard Converter
 */

import { init as initStandardConverter } from './standard-converter.js';
import { init as initGifCreator } from './gif-creator.js';

// Initialize Theme
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
  document.body.classList.add('light-theme');
}

/**
 * Activates the specified tab by:
 *  - Toggling aria-selected and the `active` CSS class on the two tab buttons
 *  - Showing the active section and hiding the inactive one via the `hidden` attribute
 *
 * This function is entirely synchronous — it performs no async work.
 *
 * @param {'standard' | 'gif'} tabId - The tab to activate.
 */
export function activateTab(tabId) {
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const standardView = document.getElementById('standard-view');
  const gifView = document.getElementById('gif-view');

  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (tabId === 'standard') {
    if (standardView) standardView.removeAttribute('hidden');
    if (gifView) gifView.setAttribute('hidden', '');
  } else if (tabId === 'gif') {
    if (standardView) standardView.setAttribute('hidden', '');
    if (gifView) gifView.removeAttribute('hidden');
  }
}

/**
 * Returns the currently active tab id.
 *
 * @returns {'standard' | 'gif'}
 */
export function getActiveTab() {
  const activeBtn = document.querySelector('.tab-btn[data-tab].active');
  return activeBtn ? activeBtn.dataset.tab : 'standard';
}

// Wire everything up once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const standardView = document.getElementById('standard-view');
  const gifView = document.getElementById('gif-view');

  // Initialise feature modules with their root elements
  initStandardConverter(standardView);
  initGifCreator(gifView);

  // Set the default active tab (or from URL)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab') || 'standard';
  activateTab(targetTab);

  // Auto-load URL if passed via context menu
  const loadUrl = urlParams.get('url');
  if (loadUrl) {
    // Small timeout to allow module DOM to settle
    setTimeout(() => {
      if (targetTab === 'standard') {
        const urlInput = document.getElementById('sc-url-input');
        const urlBtn = document.getElementById('sc-url-btn');
        if (urlInput && urlBtn) {
          urlInput.value = loadUrl;
          // dispatch input event so state updates
          urlInput.dispatchEvent(new Event('input'));
          urlBtn.click();
        }
      } else if (targetTab === 'gif') {
        const urlInput = document.getElementById('gc-url-input');
        const urlBtn = document.getElementById('gc-url-btn');
        if (urlInput && urlBtn) {
          urlInput.value = loadUrl;
          urlInput.dispatchEvent(new Event('input'));
          urlBtn.click();
        }
      }
    }, 50);
  }

  // Attach tab-switching click handlers
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });

  // Theme Toggle Logic
  const themeToggle = document.getElementById('theme-toggle');
  
  function updateThemeIcon() {
    const isLight = document.body.classList.contains('light-theme');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
  }
  updateThemeIcon();

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
  });
});
