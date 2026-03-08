/**
 * VideoObserver — detects video elements on Netflix pages using MutationObserver.
 * Handles dynamic DOM changes, SPA navigation, and player reloads.
 */

var VideoObserver = (function () {
  'use strict';

  var _observer = null;
  var _videoCallback = null;
  var _currentVideos = new Set();
  var _observing = false;
  var _debounceTimer = null;

  function findVideos() {
    return Array.from(document.querySelectorAll('video'));
  }

  function checkForVideos() {
    if (!_videoCallback) return;

    var currentVideoElements = findVideos();
    var currentSet = new Set(currentVideoElements);

    currentVideoElements.forEach(function (video) {
      if (!_currentVideos.has(video)) {
        _videoCallback('added', video);
      }
    });

    _currentVideos.forEach(function (video) {
      if (!currentSet.has(video)) {
        _videoCallback('removed', video);
      }
    });

    _currentVideos = currentSet;
  }

  function debouncedCheck() {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
    }
    _debounceTimer = setTimeout(function () {
      checkForVideos();
      _debounceTimer = null;
    }, 200);
  }

  function handleMutations(mutations) {
    var shouldCheck = false;

    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];

      if (mutation.addedNodes.length > 0) {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
              shouldCheck = true;
              break;
            }
          }
        }
      }

      if (!shouldCheck && mutation.removedNodes.length > 0) {
        for (var j = 0; j < mutation.removedNodes.length; j++) {
          var node = mutation.removedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
              shouldCheck = true;
              break;
            }
          }
        }
      }

      if (shouldCheck) break;
    }

    if (shouldCheck) {
      debouncedCheck();
    }
  }

  function start(callback) {
    if (_observing) return;

    _videoCallback = callback;
    checkForVideos();

    _observer = new MutationObserver(handleMutations);
    _observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    _observing = true;
  }

  function stop() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    _currentVideos.clear();
    _videoCallback = null;
    _observing = false;
  }

  function recheck() {
    checkForVideos();
  }

  function getTrackedVideos() {
    return new Set(_currentVideos);
  }

  return {
    start: start,
    stop: stop,
    recheck: recheck,
    findVideos: findVideos,
    getTrackedVideos: getTrackedVideos
  };
})();