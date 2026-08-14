/**
 * popup.test.js — Unit tests for the tab bar (popup.js)
 *
 * Tests:
 *  - Activating "Standard Converter" tab shows #standard-view and hides #gif-view
 *  - Activating "Advanced GIF Creator" tab shows #gif-view and hides #standard-view
 *  - Default active tab on popup open is Standard Converter
 *  - The active tab button has the `active` CSS class; the inactive one does not
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { activateTab, getActiveTab } from '../popup.js';

// ── DOM fixture ────────────────────────────────────────────────────────────────

/**
 * Sets up a minimal popup DOM that mirrors popup.html in jsdom.
 * Called before each test to ensure a clean slate.
 */
function setupDom() {
  document.body.innerHTML = `
    <nav class="tab-bar" role="tablist">
      <button class="tab-btn" role="tab" data-tab="standard"
              aria-selected="false" aria-controls="standard-view"
              id="tab-standard">
        Standard Converter
      </button>
      <button class="tab-btn" role="tab" data-tab="gif"
              aria-selected="false" aria-controls="gif-view"
              id="tab-gif">
        Advanced GIF Creator
      </button>
    </nav>
    <main>
      <section id="standard-view" role="tabpanel"></section>
      <section id="gif-view" role="tabpanel" hidden></section>
    </main>
  `;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function standardBtn() { return document.getElementById('tab-standard'); }
function gifBtn()      { return document.getElementById('tab-gif'); }
function standardView(){ return document.getElementById('standard-view'); }
function gifView()     { return document.getElementById('gif-view'); }

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('activateTab("standard")', () => {
  beforeEach(setupDom);

  it('shows #standard-view', () => {
    activateTab('standard');
    expect(standardView().hasAttribute('hidden')).toBe(false);
  });

  it('hides #gif-view', () => {
    activateTab('standard');
    expect(gifView().hasAttribute('hidden')).toBe(true);
  });

  it('marks the standard tab button as active', () => {
    activateTab('standard');
    expect(standardBtn().classList.contains('active')).toBe(true);
    expect(standardBtn().getAttribute('aria-selected')).toBe('true');
  });

  it('marks the gif tab button as inactive', () => {
    activateTab('standard');
    expect(gifBtn().classList.contains('active')).toBe(false);
    expect(gifBtn().getAttribute('aria-selected')).toBe('false');
  });
});

describe('activateTab("gif")', () => {
  beforeEach(setupDom);

  it('shows #gif-view', () => {
    activateTab('gif');
    expect(gifView().hasAttribute('hidden')).toBe(false);
  });

  it('hides #standard-view', () => {
    activateTab('gif');
    expect(standardView().hasAttribute('hidden')).toBe(true);
  });

  it('marks the gif tab button as active', () => {
    activateTab('gif');
    expect(gifBtn().classList.contains('active')).toBe(true);
    expect(gifBtn().getAttribute('aria-selected')).toBe('true');
  });

  it('marks the standard tab button as inactive', () => {
    activateTab('gif');
    expect(standardBtn().classList.contains('active')).toBe(false);
    expect(standardBtn().getAttribute('aria-selected')).toBe('false');
  });
});

describe('default tab state (Standard Converter is default)', () => {
  beforeEach(() => {
    setupDom();
    // Simulate what DOMContentLoaded does: activate standard tab
    activateTab('standard');
  });

  it('standard-view is visible by default', () => {
    expect(standardView().hasAttribute('hidden')).toBe(false);
  });

  it('gif-view is hidden by default', () => {
    expect(gifView().hasAttribute('hidden')).toBe(true);
  });

  it('standard tab button has `active` class by default', () => {
    expect(standardBtn().classList.contains('active')).toBe(true);
  });

  it('gif tab button does not have `active` class by default', () => {
    expect(gifBtn().classList.contains('active')).toBe(false);
  });
});

describe('getActiveTab()', () => {
  beforeEach(setupDom);

  it('returns "standard" after activating the standard tab', () => {
    activateTab('standard');
    expect(getActiveTab()).toBe('standard');
  });

  it('returns "gif" after activating the gif tab', () => {
    activateTab('gif');
    expect(getActiveTab()).toBe('gif');
  });
});

describe('tab switching preserves views (round-trip)', () => {
  beforeEach(() => {
    setupDom();
    activateTab('standard');
  });

  it('switching to gif then back to standard restores standard view', () => {
    activateTab('gif');
    activateTab('standard');
    expect(standardView().hasAttribute('hidden')).toBe(false);
    expect(gifView().hasAttribute('hidden')).toBe(true);
    expect(standardBtn().classList.contains('active')).toBe(true);
    expect(gifBtn().classList.contains('active')).toBe(false);
  });
});

describe('activateTab is synchronous', () => {
  beforeEach(setupDom);

  it('completes state change without yielding to the event loop', () => {
    // If activateTab were async the DOM changes would not be visible yet
    activateTab('gif');
    // Immediately after the call — no await — gif view must already be visible
    expect(gifView().hasAttribute('hidden')).toBe(false);
  });
});
