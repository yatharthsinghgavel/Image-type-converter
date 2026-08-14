/**
 * background.js — Service Worker for Image Type Converter
 * 
 * Handles context menu registration and click events.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'convert-image',
    title: 'Convert this Image',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'gif-frames',
    title: 'Send to GIF Studio',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'gif-video',
    title: 'Extract GIF from Video',
    contexts: ['video']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let targetTab = 'standard';
  
  if (info.menuItemId === 'gif-frames' || info.menuItemId === 'gif-video') {
    targetTab = 'gif';
  }

  // Open the extension in a new tab instead of trying to open the popup programmatically,
  // which provides more screen real estate and is more reliable.
  chrome.tabs.create({
    url: `popup.html?url=${encodeURIComponent(info.srcUrl)}&tab=${targetTab}`
  });
});
