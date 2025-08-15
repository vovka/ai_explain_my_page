(function() {
  'use strict';

  var GLOBAL_NAME = 'ElementCapture';
  if (typeof window !== 'undefined' && window[GLOBAL_NAME]) {
    // Already loaded
    return;
  }

  var isCapturing = false;
  var lastCapturedElement = null;
  var clickHandler = null;
  var keydownHandler = null;
  var pendingPromise = null;
  var pendingResolve = null;
  var pendingReject = null;

  function resetPromiseState() {
    pendingResolve = null;
    pendingReject = null;
    pendingPromise = null;
  }

  function getEventTarget(event) {
    if (typeof event.composedPath === 'function') {
      var path = event.composedPath();
      for (var i = 0; i < path.length; i++) {
        var node = path[i];
        if (node && node.nodeType === 1) {
          return node;
        }
      }
    }
    var target = event.target || event.srcElement;
    if (target && target.nodeType !== 1 && target.parentElement) {
      return target.parentElement;
    }
    return target;
  }

  function installListeners() {
    clickHandler = function(event) {
      if (!isCapturing) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      var target = getEventTarget(event);
      lastCapturedElement = target || null;

      // Debug output as requested
      try {
        console.log('[ElementCapture] Captured element:', lastCapturedElement);
      } catch (e) {}

      teardownListeners();

      if (typeof pendingResolve === 'function') {
        pendingResolve({ element: lastCapturedElement, eventType: event.type });
      }
      resetPromiseState();
    };

    keydownHandler = function(event) {
      if (!isCapturing) return;
      var key = event.key || event.keyCode;
      if (key === 'Escape' || key === 'Esc' || key === 27) {
        event.preventDefault();
        teardownListeners();
        if (typeof pendingReject === 'function') {
          pendingReject(new Error('Capture cancelled'));
        }
        resetPromiseState();
      }
    };

    // Use capture phase to intercept early
    window.addEventListener('click', clickHandler, true);
    window.addEventListener('auxclick', clickHandler, true);
    window.addEventListener('keydown', keydownHandler, true);
  }

  function teardownListeners() {
    isCapturing = false;
    window.removeEventListener('click', clickHandler, true);
    window.removeEventListener('auxclick', clickHandler, true);
    window.removeEventListener('keydown', keydownHandler, true);
    clickHandler = null;
    keydownHandler = null;
  }

  function start() {
    if (isCapturing && pendingPromise) {
      return pendingPromise;
    }

    isCapturing = true;
    installListeners();

    pendingPromise = new Promise(function(resolve, reject) {
      pendingResolve = resolve;
      pendingReject = reject;
    });

    return pendingPromise;
  }

  function stop() {
    if (!isCapturing) return;
    teardownListeners();
    if (typeof pendingReject === 'function') {
      pendingReject(new Error('Capture stopped'));
    }
    resetPromiseState();
  }

  function getLastCapturedElement() {
    return lastCapturedElement || null;
  }

  function isActive() {
    return !!isCapturing;
  }

  var api = {
    start: start,
    stop: stop,
    isCapturing: isActive,
    getLastCapturedElement: getLastCapturedElement,
    version: '0.1.0'
  };

  if (typeof window !== 'undefined') {
    window[GLOBAL_NAME] = api;
  }
})();