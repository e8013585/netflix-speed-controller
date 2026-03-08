/**
 * Netflix Speed Controller — Options Page Script
 * Full settings management with i18n support and toast notifications.
 */

(function () {
  'use strict';

  var els = {
    toastContainer: document.getElementById('toastContainer'),
    body: document.body,
    defaultSpeed: document.getElementById('defaultSpeed'),
    speedStep: document.getElementById('speedStep'),
    quickSpeeds: document.getElementById('quickSpeeds'),
    overlayEnabled: document.getElementById('overlayEnabled'),
    overlayControlsEnabled: document.getElementById('overlayControlsEnabled'),
    overlayPosition: document.getElementById('overlayPosition'),
    overlayOpacity: document.getElementById('overlayOpacity'),
    opacityValue: document.getElementById('opacityValue'),
    keyboardEnabled: document.getElementById('keyboardEnabled'),
    keyIncreaseBtn: document.getElementById('keyIncreaseBtn'),
    keyDecreaseBtn: document.getElementById('keyDecreaseBtn'),
    theme: document.getElementById('theme'),
    language: document.getElementById('language'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    shortcutRow1: document.getElementById('shortcutRow1'),
    shortcutRow2: document.getElementById('shortcutRow2')
  };

  var currentSettings = {};
  var recordingKey = null;
  var toastIdCounter = 0;

  /* ===== Code-to-label mapping ===== */

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

  function comboToDisplayLabel(combo) {
    if (!combo) return '';
    var parts = combo.split('+');
    var labeled = parts.map(function (part) {
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(part) !== -1) return part;
      if (CODE_LABELS[part]) return CODE_LABELS[part];
      if (part.indexOf('Key') === 0 && part.length === 4) return part.charAt(3);
      if (part.indexOf('Digit') === 0 && part.length === 6) return part.charAt(5);
      if (part.indexOf('Numpad') === 0) return 'Num' + part.substring(6);
      if (part.match(/^F\d{1,2}$/)) return part;
      return part;
    });
    return labeled.join(' + ');
  }

  function buildKeyCombo(e) {
    var parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    var code = e.code;
    if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
         'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].indexOf(code) === -1) {
      parts.push(code);
    }
    return parts.join('+');
  }

  function migrateOldShortcut(oldCombo) {
    if (!oldCombo) return oldCombo;
    if (oldCombo.indexOf('Key') !== -1 || oldCombo.indexOf('Bracket') !== -1 ||
        oldCombo.indexOf('Digit') !== -1 || oldCombo.indexOf('Arrow') !== -1) {
      return oldCombo;
    }
    var charToCode = {
      '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
      ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period',
      '/': 'Slash', '`': 'Backquote', '-': 'Minus', '=': 'Equal',
      '{': 'BracketLeft', '}': 'BracketRight', 'Space': 'Space',
      'Enter': 'Enter', 'Backspace': 'Backspace', 'Tab': 'Tab',
      'Escape': 'Escape', 'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight'
    };
    var parts = oldCombo.split('+');
    var migrated = parts.map(function (part) {
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].indexOf(part) !== -1) return part;
      if (charToCode[part]) return charToCode[part];
      if (part.length === 1 && part.match(/[a-zA-Z]/)) return 'Key' + part.toUpperCase();
      if (part.length === 1 && part.match(/[0-9]/)) return 'Digit' + part;
      return part;
    });
    return migrated.join('+');
  }

  /* ===== Toast System ===== */

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    var id = 'toast-' + (++toastIdCounter);
    var icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.id = id;
    toast.style.position = 'relative';
    toast.style.overflow = 'hidden';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || 'ℹ';

    var msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { dismissToast(id); });

    var progress = document.createElement('div');
    progress.className = 'toast-progress';
    progress.style.animationDuration = duration + 'ms';

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    toast.appendChild(progress);
    els.toastContainer.appendChild(toast);

    setTimeout(function () { dismissToast(id); }, duration);
  }

  function dismissToast(id) {
    var toast = document.getElementById(id);
    if (!toast || toast.classList.contains('toast-out')) return;
    toast.classList.add('toast-out');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }

  /* ===== Theme ===== */

  function applyTheme(theme) {
    if (theme === 'light') {
      els.body.classList.add('light-theme');
      els.body.classList.remove('dark-theme');
    } else {
      els.body.classList.add('dark-theme');
      els.body.classList.remove('light-theme');
    }
  }

  /* ===== Init ===== */

  async function init() {
    currentSettings = await StorageUtil.getAllSettings();

    // Migrate shortcuts
    var needsSave = false;
    var migrated = {};
    var migratedInc = migrateOldShortcut(currentSettings.keyIncrease);
    if (migratedInc !== currentSettings.keyIncrease) {
      currentSettings.keyIncrease = migratedInc;
      migrated.keyIncrease = migratedInc;
      needsSave = true;
    }
    var migratedDec = migrateOldShortcut(currentSettings.keyDecrease);
    if (migratedDec !== currentSettings.keyDecrease) {
      currentSettings.keyDecrease = migratedDec;
      migrated.keyDecrease = migratedDec;
      needsSave = true;
    }
    if (needsSave) {
      await StorageUtil.set(migrated);
    }

    applyTheme(currentSettings.theme || 'dark');

    // Init i18n — this now uses embedded data, always succeeds
    await I18n.initialize();

    buildLanguageDropdown();
    populateFields(currentSettings);
    I18n.translatePage();

    setupEventListeners();
    StorageUtil.onChange(handleStorageChange);
  }

  function buildLanguageDropdown() {
    els.language.innerHTML = '';
    var locales = I18n.getSupportedLocales();
    for (var i = 0; i < locales.length; i++) {
      var opt = document.createElement('option');
      opt.value = locales[i].code;
      opt.textContent = locales[i].nativeName + ' (' + locales[i].name + ')';
      els.language.appendChild(opt);
    }
  }

  function populateFields(settings) {
    els.defaultSpeed.value = settings.defaultSpeed || 1.0;
    els.speedStep.value = settings.speedStep || 0.25;
    if (Array.isArray(settings.quickSpeeds)) {
      els.quickSpeeds.value = settings.quickSpeeds.join(', ');
    }
    els.overlayEnabled.checked = settings.overlayEnabled !== false;
    els.overlayControlsEnabled.checked = settings.overlayControlsEnabled === true;
    els.overlayPosition.value = settings.overlayPosition || 'top-right';
    els.overlayOpacity.value = settings.overlayOpacity || 0.85;
    els.opacityValue.textContent = Math.round((settings.overlayOpacity || 0.85) * 100) + '%';
    els.keyboardEnabled.checked = settings.keyboardEnabled !== false;

    var incCombo = settings.keyIncrease || 'BracketRight';
    els.keyIncreaseBtn.textContent = comboToDisplayLabel(incCombo);
    els.keyIncreaseBtn.dataset.combo = incCombo;

    var decCombo = settings.keyDecrease || 'BracketLeft';
    els.keyDecreaseBtn.textContent = comboToDisplayLabel(decCombo);
    els.keyDecreaseBtn.dataset.combo = decCombo;

    els.theme.value = settings.theme || 'dark';
    els.language.value = settings.language || 'en';

    updateShortcutVisibility();
  }

  function updateShortcutVisibility() {
    var enabled = els.keyboardEnabled.checked;
    els.shortcutRow1.style.opacity = enabled ? '1' : '0.4';
    els.shortcutRow1.style.pointerEvents = enabled ? 'auto' : 'none';
    els.shortcutRow2.style.opacity = enabled ? '1' : '0.4';
    els.shortcutRow2.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  function setupEventListeners() {
    els.overlayOpacity.addEventListener('input', function () {
      els.opacityValue.textContent = Math.round(this.value * 100) + '%';
    });

    els.keyboardEnabled.addEventListener('change', updateShortcutVisibility);

    els.keyIncreaseBtn.addEventListener('click', function () {
      startRecording('keyIncrease', this);
    });
    els.keyDecreaseBtn.addEventListener('click', function () {
      startRecording('keyDecrease', this);
    });

    document.addEventListener('keydown', handleShortcutRecording, true);

    document.addEventListener('click', function (e) {
      if (recordingKey && e.target !== recordingKey.button) {
        cancelRecording();
      }
    });

    els.theme.addEventListener('change', function () {
      applyTheme(els.theme.value);
    });

    // Live language preview — switch immediately on dropdown change
    els.language.addEventListener('change', function () {
      var lang = els.language.value;
      I18n.loadLocale(lang).then(function () {
        I18n.translatePage();
        // Re-display shortcut labels since they aren't data-i18n
        els.keyIncreaseBtn.textContent = comboToDisplayLabel(els.keyIncreaseBtn.dataset.combo);
        els.keyDecreaseBtn.textContent = comboToDisplayLabel(els.keyDecreaseBtn.dataset.combo);
      });
    });

    els.saveBtn.addEventListener('click', saveSettings);
    els.resetBtn.addEventListener('click', resetSettings);
  }

  function startRecording(key, button) {
    stopRecording();
    recordingKey = {
      key: key,
      button: button,
      originalText: button.textContent,
      originalCombo: button.dataset.combo
    };
    button.classList.add('recording');
    button.textContent = I18n.get('pressKeys');
  }

  function stopRecording() {
    if (recordingKey) {
      recordingKey.button.classList.remove('recording');
      recordingKey = null;
    }
  }

  function cancelRecording() {
    if (recordingKey) {
      recordingKey.button.classList.remove('recording');
      recordingKey.button.textContent = recordingKey.originalText;
      recordingKey.button.dataset.combo = recordingKey.originalCombo;
      recordingKey = null;
    }
  }

  function handleShortcutRecording(e) {
    if (!recordingKey) return;
    e.preventDefault();
    e.stopPropagation();

    if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
         'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].indexOf(e.code) !== -1) {
      return;
    }
    if (e.code === 'Escape') { cancelRecording(); return; }

    var combo = buildKeyCombo(e);
    var label = comboToDisplayLabel(combo);

    recordingKey.button.textContent = label;
    recordingKey.button.dataset.combo = combo;
    recordingKey.button.classList.remove('recording');
    recordingKey = null;
  }

  function parseQuickSpeeds(input) {
    return input.split(',')
      .map(function (s) { return parseFloat(s.trim()); })
      .filter(function (n) { return !isNaN(n) && n >= StorageUtil.MIN_SPEED && n <= StorageUtil.MAX_SPEED; })
      .sort(function (a, b) { return a - b; });
  }

  function validateSettings() {
    var errors = [];
    var defaultSpeed = parseFloat(els.defaultSpeed.value);
    if (isNaN(defaultSpeed) || !StorageUtil.isValidSpeed(defaultSpeed)) {
      errors.push(I18n.get('validationDefaultSpeed', [String(StorageUtil.MIN_SPEED), String(StorageUtil.MAX_SPEED)]));
    }
    var speedStep = parseFloat(els.speedStep.value);
    if (isNaN(speedStep) || speedStep < 0.05 || speedStep > 5) {
      errors.push(I18n.get('validationSpeedStep'));
    }
    var quickSpeeds = parseQuickSpeeds(els.quickSpeeds.value);
    if (quickSpeeds.length === 0) {
      errors.push(I18n.get('validationQuickSpeeds'));
    }
    if (errors.length > 0) {
      errors.forEach(function (err) { showToast(err, 'error', 5000); });
      return null;
    }
    return {
      defaultSpeed: StorageUtil.clampSpeed(defaultSpeed),
      speedStep: speedStep,
      quickSpeeds: quickSpeeds,
      overlayEnabled: els.overlayEnabled.checked,
      overlayControlsEnabled: els.overlayControlsEnabled.checked,
      overlayPosition: els.overlayPosition.value,
      overlayOpacity: parseFloat(els.overlayOpacity.value),
      keyboardEnabled: els.keyboardEnabled.checked,
      keyIncrease: els.keyIncreaseBtn.dataset.combo || 'BracketRight',
      keyDecrease: els.keyDecreaseBtn.dataset.combo || 'BracketLeft',
      theme: els.theme.value,
      language: els.language.value
    };
  }

  async function saveSettings() {
    stopRecording();
    var settings = validateSettings();
    if (!settings) return;
    try {
      await StorageUtil.set(settings);
      currentSettings = Object.assign(currentSettings, settings);
      applyTheme(settings.theme);
      showToast(I18n.get('settingsSaved'), 'success');
    } catch (e) {
      showToast(I18n.get('saveFailed'), 'error');
    }
  }

  async function resetSettings() {
    stopRecording();
    if (!confirm(I18n.get('resetConfirm'))) return;
    try {
      await StorageUtil.resetToDefaults();
      currentSettings = Object.assign({}, StorageUtil.DEFAULT_SETTINGS);
      currentSettings.keyIncrease = migrateOldShortcut(currentSettings.keyIncrease);
      currentSettings.keyDecrease = migrateOldShortcut(currentSettings.keyDecrease);

      applyTheme(currentSettings.theme || 'dark');
      await I18n.loadLocale(currentSettings.language || 'en');

      buildLanguageDropdown();
      populateFields(currentSettings);
      I18n.translatePage();

      showToast(I18n.get('settingsReset'), 'success');
    } catch (e) {
      showToast(I18n.get('resetFailed'), 'error');
    }
  }

  function handleStorageChange(changes) {
    if (changes.theme) {
      els.theme.value = changes.theme.newValue;
      applyTheme(changes.theme.newValue);
    }
    if (changes.language) {
      els.language.value = changes.language.newValue;
      I18n.loadLocale(changes.language.newValue).then(function () {
        I18n.translatePage();
      });
    }
  }

  init();
})();