/**
 * Internationalization utility.
 *
 * Translations live in /locales/{code}.json (NOT in _locales/).
 * Chrome restricts _locales/ access, so we use a separate directory
 * declared in web_accessible_resources.
 *
 * The _locales/ directory still exists for Chrome's manifest-level
 * __MSG_extName__ / __MSG_extDescription__ substitutions.
 *
 * To add a new language:
 *   1. Add entry to SUPPORTED_LOCALES below
 *   2. Create locales/{code}.json with translations
 *   3. Optionally create _locales/{code}/messages.json for manifest strings
 *   4. Language appears automatically in the options dropdown
 *
 * Usage:
 *   HTML: <span data-i18n="messageKey"></span>
 *         <span data-i18n="messageKey" data-i18n-attr="title"></span>
 *   JS:   I18n.get('messageKey')
 *         I18n.get('messageKey', ['sub1', 'sub2'])
 *         I18n.translatePage()
 */

var I18n = (function () {
  'use strict';

  /**
   * Registry of all supported locales.
   * Add new languages here — the options page dropdown auto-generates from this list.
   *
   * code:       BCP 47 language tag / filename (locales/{code}.json)
   * name:       English name (for fallback display)
   * nativeName: Name in its own script (shown in dropdown)
   * dir:        Text direction — 'ltr' or 'rtl' (default 'ltr')
   */
  var SUPPORTED_LOCALES = [
    // Latin script — Western European
    { code: 'en',    name: 'English',              nativeName: 'English' },
    { code: 'de',    name: 'German',               nativeName: 'Deutsch' },
    { code: 'fr',    name: 'French',               nativeName: 'Français' },
    { code: 'es',    name: 'Spanish',              nativeName: 'Español' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)',   nativeName: 'Português (Brasil)' },
    { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)' },
    { code: 'it',    name: 'Italian',              nativeName: 'Italiano' },
    { code: 'nl',    name: 'Dutch',                nativeName: 'Nederlands' },
    { code: 'ca',    name: 'Catalan',              nativeName: 'Català' },

    // Latin script — Northern European
    { code: 'da',    name: 'Danish',               nativeName: 'Dansk' },
    { code: 'nb',    name: 'Norwegian',            nativeName: 'Norsk' },
    { code: 'sv',    name: 'Swedish',              nativeName: 'Svenska' },
    { code: 'fi',    name: 'Finnish',              nativeName: 'Suomi' },
    { code: 'et',    name: 'Estonian',             nativeName: 'Eesti' },
    { code: 'lv',    name: 'Latvian',              nativeName: 'Latviešu' },
    { code: 'lt',    name: 'Lithuanian',           nativeName: 'Lietuvių' },

    // Latin script — Central/Eastern European
    { code: 'pl',    name: 'Polish',               nativeName: 'Polski' },
    { code: 'cs',    name: 'Czech',                nativeName: 'Čeština' },
    { code: 'sk',    name: 'Slovak',               nativeName: 'Slovenčina' },
    { code: 'sl',    name: 'Slovenian',            nativeName: 'Slovenščina' },
    { code: 'hr',    name: 'Croatian',             nativeName: 'Hrvatski' },
    { code: 'hu',    name: 'Hungarian',            nativeName: 'Magyar' },
    { code: 'ro',    name: 'Romanian',             nativeName: 'Română' },

    // Latin script — Turkic
    { code: 'tr',    name: 'Turkish',              nativeName: 'Türkçe' },
    { code: 'uz',    name: 'Uzbek',                nativeName: "O'zbek" },
    { code: 'tk',    name: 'Turkmen',              nativeName: 'Türkmen' },
    { code: 'tt',    name: 'Tatar',                nativeName: 'Татар' },

    // Latin script — Southeast Asian & Pacific
    { code: 'id',    name: 'Indonesian',           nativeName: 'Indonesia' },
    { code: 'ms',    name: 'Malay',                nativeName: 'Melayu' },
    { code: 'fil',   name: 'Filipino',             nativeName: 'Filipino' },
    { code: 'vi',    name: 'Vietnamese',           nativeName: 'Tiếng Việt' },

    // Latin script — African
    { code: 'sw',    name: 'Swahili',              nativeName: 'Kiswahili' },

    // Cyrillic script
    { code: 'ru',    name: 'Russian',              nativeName: 'Русский' },
    { code: 'uk',    name: 'Ukrainian',            nativeName: 'Українська' },
    { code: 'bg',    name: 'Bulgarian',            nativeName: 'Български' },
    { code: 'sr',    name: 'Serbian',              nativeName: 'Српски' },

    // Greek
    { code: 'el',    name: 'Greek',                nativeName: 'Ελληνικά' },

    // RTL scripts
    { code: 'he',    name: 'Hebrew',               nativeName: 'עברית',    dir: 'rtl' },
    { code: 'ar',    name: 'Arabic',               nativeName: 'العربية',   dir: 'rtl' },
    { code: 'fa',    name: 'Persian',              nativeName: 'فارسی',    dir: 'rtl' },

    // Indic scripts
    { code: 'hi',    name: 'Hindi',                nativeName: 'हिन्दी' },
    { code: 'mr',    name: 'Marathi',              nativeName: 'मराठी' },
    { code: 'bn',    name: 'Bengali',              nativeName: 'বাংলা' },
    { code: 'gu',    name: 'Gujarati',             nativeName: 'ગુજરાતી' },
    { code: 'ta',    name: 'Tamil',                nativeName: 'தமிழ்' },
    { code: 'te',    name: 'Telugu',               nativeName: 'తెలుగు' },
    { code: 'kn',    name: 'Kannada',              nativeName: 'ಕನ್ನಡ' },
    { code: 'ml',    name: 'Malayalam',            nativeName: 'മലയാളം' },

    // Thai
    { code: 'th',    name: 'Thai',                 nativeName: 'ไทย' },

    // Ethiopic
    { code: 'am',    name: 'Amharic',              nativeName: 'አማርኛ' },

    // CJK
    { code: 'zh-CN', name: 'Chinese (Simplified)',  nativeName: '中文（中国）' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文（台灣）' },
    { code: 'ja',    name: 'Japanese',             nativeName: '日本語' },
    { code: 'ko',    name: 'Korean',               nativeName: '한국어' }
  ];

  /**
   * English fallback messages — used when a key is missing from the
   * loaded locale or when no locale file could be loaded.
   */
  var FALLBACK = {
    extName: 'Netflix Speed Controller',
    extDescription: 'Control Netflix playback speed with custom values, keyboard shortcuts, and on-screen overlay.',
    popupTitle: 'Speed Controller',
    currentSpeed: 'Current Speed',
    quickSpeeds: 'Quick Speeds',
    customSpeed: 'Custom Speed',
    customSpeedPlaceholder: 'e.g., 1.85',
    applyBtn: 'Apply',
    resetBtn: 'Reset',
    settingsBtn: 'Settings',
    connecting: 'Connecting...',
    connected: 'Connected to Netflix',
    notOnNetflix: 'Not on Netflix',
    invalidNumber: 'Invalid number',
    speedRange: 'Speed must be between $1 and $2',
    speedSetTo: 'Speed set to $1x',
    enterSpeed: 'Please enter a speed value',
    decreaseSpeed: 'Decrease speed',
    increaseSpeed: 'Increase speed',
    resetToDefault: 'Reset to 1.0x',
    optionsTitle: 'Netflix Speed Controller',
    optionsSubtitle: 'Customize your playback experience',
    speedSettings: 'Speed Settings',
    defaultSpeedLabel: 'Default Speed',
    defaultSpeedDesc: 'Speed applied when you start watching',
    speedStepLabel: 'Speed Step',
    speedStepDesc: 'Amount to increase/decrease per step',
    quickSpeedPresetsLabel: 'Quick Speed Presets',
    quickSpeedPresetsDesc: 'Comma-separated list of preset speeds',
    quickSpeedExample: 'Example: 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0',
    overlaySettings: 'Overlay Settings',
    speedOverlayLabel: 'Speed Overlay',
    speedOverlayDesc: 'Show speed indicator on video',
    overlayControlsLabel: 'Overlay Controls',
    overlayControlsDesc: 'Show mini speed buttons on video',
    overlayPositionLabel: 'Overlay Position',
    overlayPositionDesc: 'Where to display the speed indicator',
    posTopLeft: 'Top Left',
    posTopRight: 'Top Right',
    posBottomLeft: 'Bottom Left',
    posBottomRight: 'Bottom Right',
    overlayOpacityLabel: 'Overlay Opacity',
    overlayOpacityDesc: 'Transparency of the overlay',
    keyboardSettings: 'Keyboard Shortcuts',
    enableShortcutsLabel: 'Enable Shortcuts',
    enableShortcutsDesc: 'Use keyboard to control speed',
    increaseShortcutLabel: 'Increase Speed',
    increaseShortcutDesc: 'Shortcut to speed up',
    decreaseShortcutLabel: 'Decrease Speed',
    decreaseShortcutDesc: 'Shortcut to slow down',
    pressKeys: 'Press keys...',
    appearanceSettings: 'Appearance',
    themeLabel: 'Theme',
    themeDesc: 'Popup color scheme',
    themeDark: 'Dark',
    themeLight: 'Light',
    languageLabel: 'Language',
    languageDesc: 'Extension display language',
    saveBtn: 'Save Settings',
    resetDefaultsBtn: 'Reset to Defaults',
    settingsSaved: 'Settings saved successfully!',
    settingsReset: 'Settings reset to defaults',
    saveFailed: 'Failed to save settings',
    resetFailed: 'Failed to reset settings',
    resetConfirm: 'Reset all settings to defaults? This cannot be undone.',
    validationDefaultSpeed: 'Default speed must be between $1 and $2',
    validationSpeedStep: 'Speed step must be between 0.05 and 5',
    validationQuickSpeeds: 'At least one valid quick speed is required'
  };

  var _currentLocale = 'en';
  var _loadedMessages = null;  // The currently loaded locale's messages
  var _localeCache = {};       // Cache of previously loaded locales

  /**
   * Get a translated string.
   *
   * @param {string} key
   * @param {string|string[]} [substitutions]
   * @returns {string}
   */
  function get(key, substitutions) {
    // Try loaded locale first
    var result = _loadedMessages ? _loadedMessages[key] : null;

    // Fall back to English
    if (!result) {
      result = FALLBACK[key];
    }

    // Last resort
    if (!result) {
      return key;
    }

    // Apply substitutions
    if (substitutions) {
      var subs = Array.isArray(substitutions) ? substitutions : [substitutions];
      for (var i = 0; i < subs.length; i++) {
        result = result.replace('$' + (i + 1), subs[i]);
      }
    }

    return result;
  }

  /**
   * Translate all elements with data-i18n attributes.
   *
   * @param {HTMLElement} [root=document]
   */
  function translatePage(root) {
    var container = root || document;
    var elements = container.querySelectorAll('[data-i18n]');

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-i18n');
      var attr = el.getAttribute('data-i18n-attr');
      var subsStr = el.getAttribute('data-i18n-subs');
      var subs = subsStr ? subsStr.split(',') : undefined;

      var translated = get(key, subs);

      if (attr) {
        el.setAttribute(attr, translated);
      } else {
        el.textContent = translated;
      }
    }

    // Apply text direction for RTL languages
    var localeInfo = getLocaleInfo(_currentLocale);
    if (localeInfo && localeInfo.dir === 'rtl') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }

  /**
   * Load a locale's translation file.
   * Files are at /locales/{code}.json — a plain JSON object of key:value pairs.
   *
   * @param {string} locale
   * @returns {Promise<boolean>}
   */
  function loadLocale(locale) {
    return new Promise(function (resolve) {
      // English uses embedded fallback — no file needed
      if (locale === 'en') {
        _currentLocale = 'en';
        _loadedMessages = null; // Will use FALLBACK
        resolve(true);
        return;
      }

      // Check cache first
      if (_localeCache[locale]) {
        _currentLocale = locale;
        _loadedMessages = _localeCache[locale];
        resolve(true);
        return;
      }

      // Fetch the locale file from /locales/ directory
      var url = chrome.runtime.getURL('locales/' + locale + '.json');

      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (messages) {
          _localeCache[locale] = messages;
          _loadedMessages = messages;
          _currentLocale = locale;
          resolve(true);
        })
        .catch(function (err) {
          console.warn('[NSC i18n] Could not load locale "' + locale + '":', err.message);
          // Stay on current locale, or fall back to English
          if (!_loadedMessages) {
            _currentLocale = 'en';
          }
          resolve(false);
        });
    });
  }

  /**
   * Get locale metadata from the registry.
   * @param {string} code
   * @returns {Object|null}
   */
  function getLocaleInfo(code) {
    for (var i = 0; i < SUPPORTED_LOCALES.length; i++) {
      if (SUPPORTED_LOCALES[i].code === code) return SUPPORTED_LOCALES[i];
    }
    return null;
  }

  function getCurrentLocale() {
    return _currentLocale;
  }

  function getUILocale() {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        return chrome.i18n.getUILanguage().split('-')[0];
      }
    } catch (e) {}
    return 'en';
  }

  function getSupportedLocales() {
    return SUPPORTED_LOCALES.slice();
  }

  function isSupported(code) {
    return !!getLocaleInfo(code);
  }

  /**
   * Initialize with stored language preference.
   * @returns {Promise<void>}
   */
  function initialize() {
    return StorageUtil.get('language').then(function (result) {
      var lang = result.language;
      if (!lang) {
        // Try to match browser locale
        var uiLang = getUILocale();
        if (isSupported(uiLang)) {
          lang = uiLang;
        } else {
          lang = 'en';
        }
      }
      if (!isSupported(lang)) {
        lang = 'en';
      }
      return loadLocale(lang);
    });
  }

  return {
    get: get,
    translatePage: translatePage,
    loadLocale: loadLocale,
    getCurrentLocale: getCurrentLocale,
    getLocaleInfo: getLocaleInfo,
    getUILocale: getUILocale,
    getSupportedLocales: getSupportedLocales,
    isSupported: isSupported,
    initialize: initialize,
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    FALLBACK: FALLBACK
  };
})();