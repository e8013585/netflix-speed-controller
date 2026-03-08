/**
 * Netflix Speed Controller — main content script.
 *
 * KEY FIX: Netflix's Cadmium player actively resets playbackRate via its own
 * internal loop.  Simply setting video.playbackRate gets overridden within
 * the same frame or on the next requestAnimationFrame tick.
 *
 * Solution: We intercept the playbackRate property descriptor on the
 * HTMLVideoElement prototype so Netflix's writes are captured and our
 * desired rate is always enforced.
 *
 * KEYBOARD FIX: Uses e.code (physical key position) instead of e.key
 * (character produced) so shortcuts work regardless of Shift state or
 * keyboard layout. Stored combos use code-based identifiers like
 * "BracketRight" and "BracketLeft".
 */

(function () {
  'use strict';

  if (window.__nscInitialized) return;
  window.__nscInitialized = true;

  var _currentSpeed = 1.0;
  var _settings = {};
  var _activeVideo = null;
  var _videoListeners = new Map();
  var _initialized = false;
  var _prototypePatched = false;
  var _enforcementRAF = null;
  var _originalPlaybackRateDescriptor = null;

  /* ------------------------------------------------------------------ */
  /*  Playback-rate enforcement                                         */
  /* ------------------------------------------------------------------ */

  function patchPlaybackRatePrototype() {
    if (_prototypePatched) return;

    var proto = HTMLVideoElement.prototype;
    _originalPlaybackRateDescriptor =
      Object.getOwnPropertyDescriptor(proto, 'playbackRate') ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');

    if (!_originalPlaybackRateDescriptor) return;

    var originalSet = _originalPlaybackRateDescriptor.set;
    var originalGet = _originalPlaybackRateDescriptor.get;

    Object.defineProperty(proto, 'playbackRate', {
      configurable: true,
      enumerable: true,
      get: function () {
        return originalGet.call(this);
      },
      set: function (value) {
        if (this.__nscManaged && Math.abs(value - _currentSpeed) > 0.001) {
          originalSet.call(this, _currentSpeed);
          return;
        }
        originalSet.call(this, value);
      }
    });

    _prototypePatched = true;
  }

  function rawSetPlaybackRate(video, speed) {
    if (!video) return;
    try {
      if (_originalPlaybackRateDescriptor && _originalPlaybackRateDescriptor.set) {
        _originalPlaybackRateDescriptor.set.call(video, speed);
      } else {
        video.playbackRate = speed;
      }
    } catch (e) {}
  }

  function enforceSpeedBurst(video, speed, durationMs) {
    if (_enforcementRAF) cancelAnimationFrame(_enforcementRAF);

    var start = performance.now();
    var dur = durationMs || 600;

    function tick() {
      if (performance.now() - start > dur) {
        _enforcementRAF = null;
        return;
      }
      rawSetPlaybackRate(video, speed);
      _enforcementRAF = requestAnimationFrame(tick);
    }

    _enforcementRAF = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------ */
  /*  Key combo utilities                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Map of e.code values to human-readable labels.
   * Used for display in the UI while storing the code internally.
   */
  var CODE_LABELS = {
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Space: 'Space',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Tab: 'Tab',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown'
  };

  /**
   * Build a shortcut combo string from a KeyboardEvent using e.code.
   * This produces layout-independent identifiers.
   *
   * Examples:
   *   Pressing ] key            → "BracketRight"
   *   Pressing Shift + ] key   → "Shift+BracketRight"
   *   Pressing Ctrl + S        → "Ctrl+KeyS"
   *
   * @param {KeyboardEvent} e
   * @returns {string} Combo string using e.code
   */
  function buildKeyCombo(e) {
    var parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');

    var code = e.code;

    // Don't add bare modifier codes as the main key
    if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
         'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].indexOf(code) === -1) {
      parts.push(code);
    }

    return parts.join('+');
  }

  /**
   * Convert a stored combo string to a human-readable label for display.
   *
   * "Ctrl+BracketRight" → "Ctrl + ]"
   * "BracketLeft"       → "["
   * "Shift+KeyA"        → "Shift + A"
   *
   * @param {string} combo
   * @returns {string}
   */
  function comboToDisplayLabel(combo) {
    if (!combo) return '';

    var parts = combo.split('+');
    var labeled = parts.map(function (part) {
      // Modifier keys stay as-is
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(part) !== -1) {
        return part;
      }
      // Check our label map
      if (CODE_LABELS[part]) {
        return CODE_LABELS[part];
      }
      // KeyA → A, KeyZ → Z
      if (part.indexOf('Key') === 0 && part.length === 4) {
        return part.charAt(3);
      }
      // Digit0 → 0, Digit9 → 9
      if (part.indexOf('Digit') === 0 && part.length === 6) {
        return part.charAt(5);
      }
      // Numpad0 → Num0
      if (part.indexOf('Numpad') === 0) {
        return 'Num' + part.substring(6);
      }
      // F1-F12
      if (part.match(/^F\d{1,2}$/)) {
        return part;
      }
      // Fallback: return as-is
      return part;
    });

    return labeled.join(' + ');
  }

  /**
   * Migrate old key-character based shortcuts to code-based ones.
   * Handles legacy values like "Shift+]", "]", "[", "Shift+[".
   *
   * @param {string} oldCombo
   * @returns {string} Code-based combo
   */
  function migrateOldShortcut(oldCombo) {
    if (!oldCombo) return oldCombo;

    // Already in code format (contains "Key", "Bracket", "Digit", etc.)
    if (oldCombo.indexOf('Key') !== -1 ||
        oldCombo.indexOf('Bracket') !== -1 ||
        oldCombo.indexOf('Digit') !== -1 ||
        oldCombo.indexOf('Arrow') !== -1) {
      return oldCombo;
    }

    // Character-to-code mapping for common legacy values
    var charToCode = {
      '[': 'BracketLeft',
      ']': 'BracketRight',
      '\\': 'Backslash',
      ';': 'Semicolon',
      "'": 'Quote',
      ',': 'Comma',
      '.': 'Period',
      '/': 'Slash',
      '`': 'Backquote',
      '-': 'Minus',
      '=': 'Equal',
      '{': 'BracketLeft',
      '}': 'BracketRight',
      'Space': 'Space',
      'Enter': 'Enter',
      'Backspace': 'Backspace',
      'Tab': 'Tab',
      'Escape': 'Escape',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight'
    };

    var parts = oldCombo.split('+');
    var migrated = parts.map(function (part) {
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(part) !== -1) {
        return part;
      }
      if (charToCode[part]) {
        return charToCode[part];
      }
      // Single letter → KeyX
      if (part.length === 1 && part.match(/[a-zA-Z]/)) {
        return 'Key' + part.toUpperCase();
      }
      // Single digit → DigitX
      if (part.length === 1 && part.match(/[0-9]/)) {
        return 'Digit' + part;
      }
      return part;
    });

    return migrated.join('+');
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                    */
  /* ------------------------------------------------------------------ */

  async function init() {
    if (_initialized) return;
    _initialized = true;

    _settings = await StorageUtil.getAllSettings();
    _currentSpeed = _settings.currentSpeed || _settings.defaultSpeed || 1.0;

    // Migrate old shortcuts to code-based format
    var needsSave = false;
    var migrated = {};

    var migratedIncrease = migrateOldShortcut(_settings.keyIncrease);
    if (migratedIncrease !== _settings.keyIncrease) {
      _settings.keyIncrease = migratedIncrease;
      migrated.keyIncrease = migratedIncrease;
      needsSave = true;
    }

    var migratedDecrease = migrateOldShortcut(_settings.keyDecrease);
    if (migratedDecrease !== _settings.keyDecrease) {
      _settings.keyDecrease = migratedDecrease;
      migrated.keyDecrease = migratedDecrease;
      needsSave = true;
    }

    if (needsSave) {
      StorageUtil.set(migrated);
    }

    patchPlaybackRatePrototype();

    SpeedOverlay.onSpeedChange(function (direction) {
      if (direction === 'increase') {
        changeSpeed(_currentSpeed + (_settings.speedStep || 0.25));
      } else {
        changeSpeed(_currentSpeed - (_settings.speedStep || 0.25));
      }
    });

    SpeedOverlay.updateSettings({
      enabled: _settings.overlayEnabled,
      position: _settings.overlayPosition,
      opacity: _settings.overlayOpacity,
      controlsEnabled: _settings.overlayControlsEnabled
    });

    VideoObserver.start(handleVideoChange);

    if (_settings.keyboardEnabled) {
      document.addEventListener('keydown', handleKeydown, true);
    }

    StorageUtil.onChange(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleMessage);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && _activeVideo) {
        rawSetPlaybackRate(_activeVideo, _currentSpeed);
        enforceSpeedBurst(_activeVideo, _currentSpeed, 400);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Video lifecycle                                                   */
  /* ------------------------------------------------------------------ */

  function handleVideoChange(eventType, video) {
    if (eventType === 'added') {
      attachToVideo(video);
    } else if (eventType === 'removed') {
      detachFromVideo(video);
    }
  }

  function attachToVideo(video) {
    if (_videoListeners.has(video)) return;

    _activeVideo = video;
    video.__nscManaged = true;

    rawSetPlaybackRate(video, _currentSpeed);
    enforceSpeedBurst(video, _currentSpeed, 800);

    var listeners = {};

    listeners.playing = function () {
      rawSetPlaybackRate(video, _currentSpeed);
      enforceSpeedBurst(video, _currentSpeed, 600);
    };

    listeners.loadeddata = function () {
      rawSetPlaybackRate(video, _currentSpeed);
      enforceSpeedBurst(video, _currentSpeed, 800);
    };

    listeners.seeked = function () {
      rawSetPlaybackRate(video, _currentSpeed);
      enforceSpeedBurst(video, _currentSpeed, 400);
    };

    listeners.canplay = function () {
      rawSetPlaybackRate(video, _currentSpeed);
    };

    Object.keys(listeners).forEach(function (event) {
      video.addEventListener(event, listeners[event]);
    });

    _videoListeners.set(video, listeners);

    SpeedOverlay.attach(video);
    SpeedOverlay.showSpeed(_currentSpeed, _currentSpeed !== 1.0);

    if (_settings.overlayControlsEnabled) {
      SpeedOverlay.showControls(true);
    }

    setupHoverControls(video);
  }

  function detachFromVideo(video) {
    video.__nscManaged = false;

    var listeners = _videoListeners.get(video);
    if (listeners) {
      Object.keys(listeners).forEach(function (event) {
        video.removeEventListener(event, listeners[event]);
      });
      _videoListeners.delete(video);
    }

    if (_activeVideo === video) {
      _activeVideo = null;
      var videos = VideoObserver.findVideos();
      if (videos.length > 0) {
        attachToVideo(videos[0]);
      } else {
        SpeedOverlay.removeAll();
      }
    }
  }

  function setupHoverControls(video) {
    var container = video.closest('.watch-video--player-view') || video.parentElement;
    if (!container || container.__nscHoverSetup) return;
    container.__nscHoverSetup = true;

    container.addEventListener('mouseenter', function () {
      if (_settings.overlayControlsEnabled) SpeedOverlay.showControls(true);
    });
    container.addEventListener('mouseleave', function () {
      if (_settings.overlayControlsEnabled) SpeedOverlay.showControls(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Speed management                                                  */
  /* ------------------------------------------------------------------ */

  function applySpeedToAll(speed) {
    var videos = VideoObserver.getTrackedVideos();
    videos.forEach(function (video) {
      rawSetPlaybackRate(video, speed);
      enforceSpeedBurst(video, speed, 600);
    });
  }

  async function changeSpeed(newSpeed) {
    var clamped = StorageUtil.clampSpeed(newSpeed);
    _currentSpeed = clamped;

    applySpeedToAll(clamped);
    SpeedOverlay.showSpeed(clamped, clamped !== 1.0);
    await StorageUtil.set({ currentSpeed: clamped });
  }

  /* ------------------------------------------------------------------ */
  /*  Keyboard                                                          */
  /* ------------------------------------------------------------------ */

  function handleKeydown(e) {
    if (!_settings.keyboardEnabled) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    var combo = buildKeyCombo(e);

    // Also build with migrated versions for safety
    var increaseKey = _settings.keyIncrease || 'BracketRight';
    var decreaseKey = _settings.keyDecrease || 'BracketLeft';

    if (combo === increaseKey) {
      e.preventDefault();
      e.stopPropagation();
      changeSpeed(_currentSpeed + (_settings.speedStep || 0.25));
    } else if (combo === decreaseKey) {
      e.preventDefault();
      e.stopPropagation();
      changeSpeed(_currentSpeed - (_settings.speedStep || 0.25));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Storage / message handling                                        */
  /* ------------------------------------------------------------------ */

  function handleStorageChange(changes, areaName) {
    if (areaName !== 'sync' && areaName !== 'local') return;

    if (changes.currentSpeed) {
      var newSpeed = changes.currentSpeed.newValue;
      if (newSpeed !== undefined && Math.abs(newSpeed - _currentSpeed) > 0.001) {
        _currentSpeed = newSpeed;
        applySpeedToAll(_currentSpeed);
        SpeedOverlay.showSpeed(_currentSpeed, _currentSpeed !== 1.0);
      }
    }

    if (changes.overlayEnabled || changes.overlayPosition || changes.overlayOpacity || changes.overlayControlsEnabled) {
      var os = {};
      if (changes.overlayEnabled) { _settings.overlayEnabled = changes.overlayEnabled.newValue; os.enabled = _settings.overlayEnabled; }
      if (changes.overlayPosition) { _settings.overlayPosition = changes.overlayPosition.newValue; os.position = _settings.overlayPosition; }
      if (changes.overlayOpacity) { _settings.overlayOpacity = changes.overlayOpacity.newValue; os.opacity = _settings.overlayOpacity; }
      if (changes.overlayControlsEnabled) { _settings.overlayControlsEnabled = changes.overlayControlsEnabled.newValue; os.controlsEnabled = _settings.overlayControlsEnabled; }
      SpeedOverlay.updateSettings(os);
      if (_activeVideo && !SpeedOverlay.isAttached()) {
        SpeedOverlay.attach(_activeVideo);
        SpeedOverlay.showSpeed(_currentSpeed, _currentSpeed !== 1.0);
      }
    }

    if (changes.speedStep) _settings.speedStep = changes.speedStep.newValue;
    if (changes.keyboardEnabled) {
      _settings.keyboardEnabled = changes.keyboardEnabled.newValue;
      if (_settings.keyboardEnabled) {
        document.addEventListener('keydown', handleKeydown, true);
      } else {
        document.removeEventListener('keydown', handleKeydown, true);
      }
    }
    if (changes.keyIncrease) _settings.keyIncrease = changes.keyIncrease.newValue;
    if (changes.keyDecrease) _settings.keyDecrease = changes.keyDecrease.newValue;
    if (changes.quickSpeeds) _settings.quickSpeeds = changes.quickSpeeds.newValue;
  }

  function handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'getSpeed':
        sendResponse({ speed: _currentSpeed });
        break;
      case 'setSpeed':
        if (StorageUtil.isValidSpeed(message.speed)) {
          changeSpeed(message.speed);
          sendResponse({ success: true, speed: _currentSpeed });
        } else {
          sendResponse({ success: false, error: 'Invalid speed value' });
        }
        break;
      case 'increaseSpeed':
        changeSpeed(_currentSpeed + (_settings.speedStep || 0.25));
        sendResponse({ success: true, speed: _currentSpeed });
        break;
      case 'decreaseSpeed':
        changeSpeed(_currentSpeed - (_settings.speedStep || 0.25));
        sendResponse({ success: true, speed: _currentSpeed });
        break;
      case 'resetSpeed':
        changeSpeed(1.0);
        sendResponse({ success: true, speed: 1.0 });
        break;
      case 'getStatus':
        sendResponse({
          active: !!_activeVideo,
          speed: _currentSpeed,
          videoCount: VideoObserver.getTrackedVideos().size
        });
        break;
      case 'ping':
        sendResponse({ alive: true });
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  }

  // Export helpers for use by options page via messaging
  window.__nscComboToLabel = comboToDisplayLabel;
  window.__nscMigrateShortcut = migrateOldShortcut;

  init();
})();