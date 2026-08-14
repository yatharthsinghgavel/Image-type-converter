/**
 * utils.test.js — Unit + property tests for utils.js
 *
 * Tasks 3.2 (unit tests) and 3.3 (property test P14)
 * Requirements: 2.11, 2.15, 13.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateUrl,
  deriveFilenameFromUrl,
  ERR_UNSUPPORTED_FORMAT,
  ERR_FILE_TOO_LARGE,
  ERR_DECODE_ERROR,
  ERR_NO_FILE,
  ERR_NO_FORMAT,
  ERR_INVALID_WIDTH,
  ERR_INVALID_HEIGHT,
  ERR_MIXED_SOURCES,
  ERR_GIF_NO_SOURCE,
  ERR_GIF_DURATION,
  ERR_GIF_WIDTH,
  ERR_GIF_HEIGHT,
  ERR_GIF_TIMEOUT,
  ERR_PROCESSING,
  ERR_CANVAS_UNAVAILABLE,
  ERR_INVALID_URL,
  ERR_FETCH_FAILED,
  ERR_FETCH_SIZE,
} from '../utils.js';

// ── Task 3.2: validateUrl unit tests ─────────────────────────────────────────

describe('validateUrl — rejects non-http/https', () => {
  it('returns false for empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('returns false for relative path', () => {
    expect(validateUrl('/images/photo.jpg')).toBe(false);
  });

  it('returns false for ftp:// prefix', () => {
    expect(validateUrl('ftp://example.com/file.jpg')).toBe(false);
  });

  it('returns false for bare hostname', () => {
    expect(validateUrl('example.com/file.jpg')).toBe(false);
  });

  it('returns false for null', () => {
    expect(validateUrl(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(validateUrl(undefined)).toBe(false);
  });

  it('returns false for data: URI', () => {
    expect(validateUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('returns false for blob: URI', () => {
    expect(validateUrl('blob:http://localhost/uuid')).toBe(false);
  });
});

describe('validateUrl — accepts http/https', () => {
  it('returns true for http:// URL', () => {
    expect(validateUrl('http://example.com/photo.jpg')).toBe(true);
  });

  it('returns true for https:// URL', () => {
    expect(validateUrl('https://example.com/photo.jpg')).toBe(true);
  });

  it('returns true for https:// URL with query string', () => {
    expect(validateUrl('https://cdn.example.com/img?w=800')).toBe(true);
  });

  it('returns true for http:// URL with port', () => {
    expect(validateUrl('http://localhost:3000/image.png')).toBe(true);
  });
});

// ── Task 3.2: deriveFilenameFromUrl unit tests ────────────────────────────────

describe('deriveFilenameFromUrl', () => {
  it('extracts stem from URL with extension', () => {
    expect(deriveFilenameFromUrl('https://example.com/images/photo.jpg')).toBe('photo');
  });

  it('extracts stem from URL with .png extension', () => {
    expect(deriveFilenameFromUrl('https://example.com/banner.png')).toBe('banner');
  });

  it('returns "image" for URL ending with slash', () => {
    expect(deriveFilenameFromUrl('https://example.com/')).toBe('image');
  });

  it('returns "image" for bare domain URL', () => {
    expect(deriveFilenameFromUrl('https://example.com')).toBe('image');
  });

  it('returns "image" for path ending with slash', () => {
    expect(deriveFilenameFromUrl('https://example.com/path/')).toBe('image');
  });

  it('strips query string before extracting stem', () => {
    expect(deriveFilenameFromUrl('https://example.com/img/cat.webp?size=large')).toBe('cat');
  });

  it('strips fragment before extracting stem', () => {
    expect(deriveFilenameFromUrl('https://example.com/dog.gif#section')).toBe('dog');
  });

  it('handles nested path correctly', () => {
    expect(deriveFilenameFromUrl('https://cdn.example.com/a/b/c/file.avif')).toBe('file');
  });

  it('returns "image" when last segment has no extension (treated as directory)', () => {
    expect(deriveFilenameFromUrl('https://example.com/imagefile')).toBe('image');
  });
});

// ── Task 3.2: error constants unit tests ─────────────────────────────────────

describe('error message constants', () => {
  const STACK_TRACE_PATTERN = /at \w+ \(.*:\d+:\d+\)/;

  const constants = {
    ERR_UNSUPPORTED_FORMAT,
    ERR_FILE_TOO_LARGE,
    ERR_DECODE_ERROR,
    ERR_NO_FILE,
    ERR_NO_FORMAT,
    ERR_INVALID_WIDTH,
    ERR_INVALID_HEIGHT,
    ERR_MIXED_SOURCES,
    ERR_GIF_NO_SOURCE,
    ERR_GIF_DURATION,
    ERR_GIF_WIDTH,
    ERR_GIF_HEIGHT,
    ERR_GIF_TIMEOUT,
    ERR_PROCESSING,
    ERR_CANVAS_UNAVAILABLE,
    ERR_INVALID_URL,
    ERR_FETCH_FAILED,
    ERR_FETCH_SIZE,
  };

  for (const [name, value] of Object.entries(constants)) {
    it(`${name} is a non-empty string`, () => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });

    it(`${name} contains no stack trace pattern`, () => {
      expect(STACK_TRACE_PATTERN.test(value)).toBe(false);
    });

    it(`${name} contains no raw exception type names`, () => {
      expect(value).not.toMatch(/\bTypeError\b|\bDOMException\b|\bRangeError\b|\bSyntaxError\b/);
    });
  }
});

// ── Task 3.3: Property 14 — URL validation rejects non-HTTP/S strings ─────────
// Feature: image-type-converter-extension, Property 14: URL validation rejects non-HTTP/S strings

describe('Property 14: validateUrl rejects all non-http/https strings', () => {
  it('returns false for any string not starting with http:// or https://', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings, filter out any that accidentally start with http:// or https://
        fc.string().filter((s) => !s.startsWith('http://') && !s.startsWith('https://')),
        (s) => {
          expect(validateUrl(s)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
