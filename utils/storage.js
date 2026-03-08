/**
 * Storage utility — abstraction over chrome.storage.sync with local fallback.
 * Provides get, set, and default settings management.
 */

var StorageUtil = (function () {
  'use strict';

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
    keyIncrease: ']',
    keyDecrease: '[',
    overlayControlsEnabled: false,
    language: 'en'
  };

  var MIN_SPEED = 0.1;
  var MAX_SPEED = 16.0;

  function get(keys) {
    return new Promise(function (resolve) {
      var keysToFetch = keys || Object.keys(DEFAULT_SETTINGS);
      var defaults = {};

      if (Array.isArray(keysToFetch)) {
        keysToFetch.forEach(function (k) {
          if (DEFAULT_SETTINGS.hasOwnProperty(k)) {
            defaults[k] = DEFAULT_SETTINGS[k];
          }
        });
      } else if (typeof keysToFetch === 'string') {
        if (DEFAULT_SETTINGS.hasOwnProperty(keysToFetch)) {
          defaults[keysToFetch] = DEFAULT_SETTINGS[keysToFetch];
        }
      }

      try {
        chrome.storage.sync.get(defaults, function (result) {
          if (chrome.runtime.lastError) {
            chrome.storage.local.get(defaults, function (localResult) {
              if (chrome.runtime.lastError) {
                resolve(defaults);
              } else {
                resolve(localResult);
              }
            });
          } else {
            resolve(result);
          }
        });
      } catch (e) {
        resolve(defaults);
      }
    });
  }

  function set(data) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.set(data, function () {
          if (chrome.runtime.lastError) {
            chrome.storage.local.set(data, function () {
              resolve();
            });
          } else {
            chrome.storage.local.set(data, function () {
              resolve();
            });
          }
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function getAllSettings() {
    return get(null);
  }

  function resetToDefaults() {
    return set(Object.assign({}, DEFAULT_SETTINGS));
  }

  function clampSpeed(speed) {
    var num = parseFloat(speed);
    if (isNaN(num)) return 1.0;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(num * 100) / 100));
  }

  function isValidSpeed(speed) {
    var num = parseFloat(speed);
    return !isNaN(num) && num >= MIN_SPEED && num <= MAX_SPEED;
  }

  function onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  return {
    get: get,
    set: set,
    getAllSettings: getAllSettings,
    resetToDefaults: resetToDefaults,
    clampSpeed: clampSpeed,
    isValidSpeed: isValidSpeed,
    onChange: onChange,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    MIN_SPEED: MIN_SPEED,
    MAX_SPEED: MAX_SPEED
  };
})();