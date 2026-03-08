/**
 * Service Worker — handles extension lifecycle, installation, and message routing.
 */

var DEFAULT_SETTINGS = {
  currentSpeed: 1.0,
  defaultSpeed: 1.0,
  quickSpeeds: [0.75, 1.0, 1.25, 1.5, 2.0, 3.0],
  speedStep: 0.25,
  overlayEnabled: true,
  overlayPosition: 'top-right',
  overlayOpacity: 0.85,
  theme: 'dark',
  keyboardEnabled: true,
  keyIncrease: 'BracketRight',
  keyDecrease: 'BracketLeft',
  overlayControlsEnabled: false,
  language: 'en'
};

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.storage.sync.set(DEFAULT_SETTINGS, function () {
      if (chrome.runtime.lastError) {
        chrome.storage.local.set(DEFAULT_SETTINGS);
      }
    });
  } else if (details.reason === 'update') {
    chrome.storage.sync.get(null, function (existing) {
      if (chrome.runtime.lastError) existing = {};

      // Migrate old character-based shortcuts to code-based
      var charToCode = {
        '[': 'BracketLeft',
        ']': 'BracketRight',
        '{': 'BracketLeft',
        '}': 'BracketRight'
      };

      if (existing.keyIncrease) {
        var parts = existing.keyIncrease.split('+');
        var needsMigration = false;
        var migrated = parts.map(function (p) {
          if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(p) !== -1) return p;
          if (charToCode[p]) { needsMigration = true; return charToCode[p]; }
          if (p.length === 1 && p.match(/[a-zA-Z]/)) { needsMigration = true; return 'Key' + p.toUpperCase(); }
          return p;
        });
        if (needsMigration) existing.keyIncrease = migrated.join('+');
      }

      if (existing.keyDecrease) {
        var parts = existing.keyDecrease.split('+');
        var needsMigration = false;
        var migrated = parts.map(function (p) {
          if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(p) !== -1) return p;
          if (charToCode[p]) { needsMigration = true; return charToCode[p]; }
          if (p.length === 1 && p.match(/[a-zA-Z]/)) { needsMigration = true; return 'Key' + p.toUpperCase(); }
          return p;
        });
        if (needsMigration) existing.keyDecrease = migrated.join('+');
      }

      var merged = Object.assign({}, DEFAULT_SETTINGS, existing);
      chrome.storage.sync.set(merged, function () {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(merged);
        }
      });
    });
  }

  // Inject into already-open Netflix tabs
  chrome.tabs.query({ url: 'https://www.netflix.com/*' }, function (tabs) {
    tabs.forEach(function (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'utils/storage.js',
          'utils/i18n.js',
          'content/observer.js',
          'content/overlay.js',
          'content/content.js'
        ]
      }).catch(function () {});
    });
  });
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.target === 'background') {
    switch (message.action) {
      case 'getActiveTab':
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          sendResponse({ tab: tabs[0] || null });
        });
        return true;

      case 'sendToContent':
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message.data, function (response) {
              if (chrome.runtime.lastError) {
                sendResponse({ error: 'Content script not available' });
              } else {
                sendResponse(response);
              }
            });
          } else {
            sendResponse({ error: 'No active tab' });
          }
        });
        return true;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  }
  return false;
});