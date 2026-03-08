/**
 * SpeedOverlay — manages the on-screen speed indicator and optional mini controls.
 * Positioned relative to the video player container.
 */

var SpeedOverlay = (function () {
  'use strict';

  var _overlayElement = null;
  var _controlsElement = null;
  var _fadeTimer = null;
  var _settings = {
    enabled: true,
    position: 'top-right',
    opacity: 0.85,
    controlsEnabled: false
  };
  var _currentSpeed = 1.0;
  var _onSpeedChange = null;
  var _videoContainer = null;

  var OVERLAY_ID = 'nsc-speed-overlay';
  var CONTROLS_ID = 'nsc-speed-controls';
  var STYLE_ID = 'nsc-overlay-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#' + OVERLAY_ID + '{' +
        'position:absolute;z-index:2147483647;' +
        'background:rgba(0,0,0,0.7);color:#e50914;' +
        'font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif;' +
        'font-size:14px;font-weight:700;padding:6px 12px;border-radius:4px;' +
        'pointer-events:none;transition:opacity 0.3s ease-in-out;opacity:0;' +
        'user-select:none;line-height:1;letter-spacing:0.5px;' +
        'border:1px solid rgba(229,9,20,0.3);' +
      '}' +
      '#' + OVERLAY_ID + '.nsc-visible{opacity:var(--nsc-opacity,0.85);}' +
      '#' + OVERLAY_ID + '.nsc-flash{' +
        'opacity:var(--nsc-opacity,0.85);animation:nsc-flash-anim 1.5s ease-in-out;' +
      '}' +
      '@keyframes nsc-flash-anim{' +
        '0%{opacity:var(--nsc-opacity,0.85);transform:scale(1.1)}' +
        '20%{opacity:var(--nsc-opacity,0.85);transform:scale(1)}' +
        '80%{opacity:var(--nsc-opacity,0.85)}' +
        '100%{opacity:0}' +
      '}' +
      '#' + OVERLAY_ID + '.nsc-persist{opacity:var(--nsc-opacity,0.85);animation:none}' +
      '#' + OVERLAY_ID + '.nsc-top-left{top:12px;left:12px}' +
      '#' + OVERLAY_ID + '.nsc-top-right{top:12px;right:12px}' +
      '#' + OVERLAY_ID + '.nsc-bottom-left{bottom:60px;left:12px}' +
      '#' + OVERLAY_ID + '.nsc-bottom-right{bottom:60px;right:12px}' +
      '#' + CONTROLS_ID + '{' +
        'position:absolute;z-index:2147483647;' +
        'background:rgba(0,0,0,0.75);border-radius:6px;padding:4px 8px;' +
        'display:flex;align-items:center;gap:8px;user-select:none;' +
        'border:1px solid rgba(229,9,20,0.3);opacity:0;transition:opacity 0.3s ease;' +
      '}' +
      '#' + CONTROLS_ID + '.nsc-controls-visible{opacity:var(--nsc-opacity,0.85)}' +
      '#' + CONTROLS_ID + ' .nsc-ctrl-btn{' +
        'background:rgba(229,9,20,0.8);color:#fff;border:none;border-radius:3px;' +
        'width:26px;height:26px;font-size:16px;font-weight:700;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;pointer-events:auto;' +
        'transition:background 0.2s;line-height:1;padding:0;' +
      '}' +
      '#' + CONTROLS_ID + ' .nsc-ctrl-btn:hover{background:rgba(229,9,20,1)}' +
      '#' + CONTROLS_ID + ' .nsc-ctrl-speed{' +
        'color:#e50914;font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif;' +
        'font-size:13px;font-weight:700;min-width:38px;text-align:center;pointer-events:none;' +
      '}' +
      '#' + CONTROLS_ID + '.nsc-top-left{top:12px;left:12px}' +
      '#' + CONTROLS_ID + '.nsc-top-right{top:12px;right:12px}' +
      '#' + CONTROLS_ID + '.nsc-bottom-left{bottom:60px;left:12px}' +
      '#' + CONTROLS_ID + '.nsc-bottom-right{bottom:60px;right:12px}';

    document.head.appendChild(style);
  }

  function findVideoContainer(video) {
    var container = video.closest('.watch-video--player-view');
    if (container) return container;

    container = video.closest('.VideoContainer');
    if (container) return container;

    container = video.closest('[data-uia="video-canvas"]');
    if (container) return container;

    var parent = video.parentElement;
    while (parent && parent !== document.body) {
      var style = window.getComputedStyle(parent);
      if (style.position === 'relative' || style.position === 'absolute' || style.position === 'fixed') {
        return parent;
      }
      parent = parent.parentElement;
    }

    return video.parentElement || document.body;
  }

  function ensureRelativePosition(container) {
    var style = window.getComputedStyle(container);
    if (style.position === 'static') {
      container.style.position = 'relative';
    }
  }

  function formatSpeed(speed) {
    var rounded = Math.round(speed * 100) / 100;
    if (rounded === Math.floor(rounded)) {
      return rounded.toFixed(1) + 'x';
    }
    if (Math.round(rounded * 10) === rounded * 10) {
      return rounded.toFixed(1) + 'x';
    }
    return rounded.toFixed(2) + 'x';
  }

  function updatePositionClass(el) {
    if (!el) return;
    el.classList.remove('nsc-top-left', 'nsc-top-right', 'nsc-bottom-left', 'nsc-bottom-right');
    el.classList.add('nsc-' + _settings.position);
  }

  function createOverlay() {
    removeOverlay();
    _overlayElement = document.createElement('div');
    _overlayElement.id = OVERLAY_ID;
    _overlayElement.textContent = formatSpeed(_currentSpeed);
    updatePositionClass(_overlayElement);
    _overlayElement.style.setProperty('--nsc-opacity', _settings.opacity);
    return _overlayElement;
  }

  function createControls() {
    removeControls();

    _controlsElement = document.createElement('div');
    _controlsElement.id = CONTROLS_ID;
    updatePositionClass(_controlsElement);
    _controlsElement.style.setProperty('--nsc-opacity', _settings.opacity);

    var decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'nsc-ctrl-btn';
    decreaseBtn.textContent = '\u2212';
    decreaseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (_onSpeedChange) _onSpeedChange('decrease');
    });

    var speedDisplay = document.createElement('span');
    speedDisplay.className = 'nsc-ctrl-speed';
    speedDisplay.textContent = formatSpeed(_currentSpeed);

    var increaseBtn = document.createElement('button');
    increaseBtn.className = 'nsc-ctrl-btn';
    increaseBtn.textContent = '+';
    increaseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (_onSpeedChange) _onSpeedChange('increase');
    });

    _controlsElement.appendChild(decreaseBtn);
    _controlsElement.appendChild(speedDisplay);
    _controlsElement.appendChild(increaseBtn);

    return _controlsElement;
  }

  function removeOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
    _overlayElement = null;
  }

  function removeControls() {
    var existing = document.getElementById(CONTROLS_ID);
    if (existing) existing.remove();
    _controlsElement = null;
  }

  function removeAll() {
    removeOverlay();
    removeControls();
    _videoContainer = null;
  }

  function adjustControlsPosition() {
    if (!_controlsElement) return;
    updatePositionClass(_controlsElement);
    if (_settings.enabled && _overlayElement) {
      if (_settings.position.indexOf('top') === 0) {
        _controlsElement.style.top = '38px';
      } else {
        _controlsElement.style.bottom = '86px';
      }
    }
  }

  function attach(video) {
    if (!video) return;
    injectStyles();

    _videoContainer = findVideoContainer(video);
    ensureRelativePosition(_videoContainer);

    if (_settings.enabled) {
      var overlay = createOverlay();
      _videoContainer.appendChild(overlay);
    }

    if (_settings.controlsEnabled) {
      var controls = createControls();
      _videoContainer.appendChild(controls);
      adjustControlsPosition();
    }
  }

  function showSpeed(speed, persist) {
    _currentSpeed = speed;
    var text = formatSpeed(speed);

    if (_overlayElement) {
      _overlayElement.textContent = text;
      _overlayElement.classList.remove('nsc-flash', 'nsc-visible', 'nsc-persist');
      void _overlayElement.offsetWidth;

      if (speed !== 1.0) {
        if (_fadeTimer) clearTimeout(_fadeTimer);
        _overlayElement.classList.add('nsc-persist');
        _fadeTimer = setTimeout(function () {
          if (_overlayElement) {
            _overlayElement.classList.remove('nsc-persist');
            _overlayElement.classList.add('nsc-flash');
          }
        }, 3000);
      } else if (persist) {
        _overlayElement.classList.add('nsc-flash');
      }
    }

    if (_controlsElement) {
      var speedEl = _controlsElement.querySelector('.nsc-ctrl-speed');
      if (speedEl) speedEl.textContent = text;
    }
  }

  function showControls(visible) {
    if (_controlsElement) {
      if (visible) {
        _controlsElement.classList.add('nsc-controls-visible');
      } else {
        _controlsElement.classList.remove('nsc-controls-visible');
      }
    }
  }

  function updateSettings(newSettings) {
    Object.assign(_settings, newSettings);
    if (_overlayElement) {
      _overlayElement.style.setProperty('--nsc-opacity', _settings.opacity);
      updatePositionClass(_overlayElement);
    }
    if (_controlsElement) {
      _controlsElement.style.setProperty('--nsc-opacity', _settings.opacity);
      updatePositionClass(_controlsElement);
      adjustControlsPosition();
    }
    if (!_settings.enabled) removeOverlay();
    if (!_settings.controlsEnabled) removeControls();
  }

  function onSpeedChange(callback) {
    _onSpeedChange = callback;
  }

  function isAttached() {
    return !!document.getElementById(OVERLAY_ID) || !!document.getElementById(CONTROLS_ID);
  }

  return {
    attach: attach,
    removeAll: removeAll,
    showSpeed: showSpeed,
    showControls: showControls,
    updateSettings: updateSettings,
    onSpeedChange: onSpeedChange,
    isAttached: isAttached,
    formatSpeed: formatSpeed
  };
})();