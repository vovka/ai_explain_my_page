(function() {
  'use strict';

  // ---- ElementCapture (as-is) ----
  (function() {
    var GLOBAL_NAME = 'ElementCapture';
    if (typeof window !== 'undefined' && window[GLOBAL_NAME]) {
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

  // ---- ElementMeaning (as-is) ----
  (function(root, factory) {
    if (typeof module === 'object' && module.exports) {
      module.exports = factory();
    } else {
      root.ElementMeaning = factory();
    }
  })(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    var DEFAULT_MODEL = 'gemini-2.5-flash-lite';
    var ERRORS = {
      MISSING_API_KEY: 'MISSING_API_KEY',
      INVALID_API_KEY: 'INVALID_API_KEY',
      RATE_LIMITED: 'RATE_LIMITED',
      FORBIDDEN: 'FORBIDDEN',
      BAD_REQUEST: 'BAD_REQUEST',
      NOT_FOUND: 'NOT_FOUND',
      SERVER_ERROR: 'SERVER_ERROR',
      NETWORK_ERROR: 'NETWORK_ERROR',
      UNKNOWN: 'UNKNOWN'
    };

    // Named constants for readability
    var TEXT_CONTENT_LIMIT = 4000;
    var OUTER_HTML_LIMIT = 100000;
    var DEFAULT_TIMEOUT_MS = 30000;

    function isDomElement(value) {
      if (!value) return false;
      return typeof value === 'object' && (
        value.nodeType === 1 ||
        (typeof value.tagName === 'string' && typeof value.outerHTML === 'string')
      );
    }

    function safeString(value) {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      try { return String(value); } catch (_e) { return ''; }
    }

    function collectElementContext(elementOrInfo) {
      if (!elementOrInfo) return {};

      if (isDomElement(elementOrInfo)) {
        var el = elementOrInfo;
        var attributes = {};
        if (el.attributes && el.attributes.length) {
          for (var i = 0; i < el.attributes.length; i++) {
            var attr = el.attributes[i];
            attributes[attr.name] = attr.value;
          }
        }

        return {
          type: 'dom-element',
          tagName: safeString(el.tagName),
          id: safeString(el.id),
          classList: el.classList ? Array.prototype.slice.call(el.classList) : [],
          role: el.getAttribute ? safeString(el.getAttribute('role')) : '',
          ariaLabel: el.getAttribute ? safeString(el.getAttribute('aria-label')) : '',
          name: el.getAttribute ? safeString(el.getAttribute('name')) : '',
          value: el.getAttribute ? safeString(el.getAttribute('value')) : '',
          title: el.getAttribute ? safeString(el.getAttribute('title')) : '',
          href: el.getAttribute ? safeString(el.getAttribute('href')) : '',
          src: el.getAttribute ? safeString(el.getAttribute('src')) : '',
          text: safeString(el.textContent).trim().slice(0, TEXT_CONTENT_LIMIT),
          outerHTML: safeString(el.outerHTML).slice(0, OUTER_HTML_LIMIT),
          attributes: attributes
        };
      }

      var info = elementOrInfo;
      var context = {
        type: safeString(info.type) || 'element-info',
        tagName: safeString(info.tagName),
        id: safeString(info.id),
        classList: Array.isArray(info.classList) ? info.classList : [],
        role: safeString(info.role),
        ariaLabel: safeString(info.ariaLabel),
        name: safeString(info.name),
        value: safeString(info.value),
        title: safeString(info.title),
        href: safeString(info.href),
        src: safeString(info.src),
        text: safeString(info.text).slice(0, TEXT_CONTENT_LIMIT),
        outerHTML: safeString(info.outerHTML).slice(0, OUTER_HTML_LIMIT),
        selector: safeString(info.selector),
        attributes: info.attributes && typeof info.attributes === 'object' ? info.attributes : {}
      };
      return context;
    }

    function buildUserPrompt(applicationDescription, pageHtml, elementContext, extraContext) {
      var appDesc = safeString(applicationDescription).trim();
      var html = safeString(pageHtml);
      var elementJson;
      try {
        elementJson = JSON.stringify(elementContext, null, 2);
      } catch (_e) {
        elementJson = '{}';
      }
      var extra = '';
      if (extraContext && typeof extraContext === 'object') {
        try { extra = JSON.stringify(extraContext, null, 2); } catch (_e2) { extra = ''; }
      } else if (typeof extraContext === 'string') {
        extra = extraContext;
      }

      var instructions = [
        'You are given:',
        '- A high-level description of the application.',
        '- The full HTML of the current page.',
        "- A specific target element's context and representation.",
        '',
        'Task:',
        'Explain what this target element means within the context of the entire page and the application.',
        'Be concise and specific to the business/user meaning. Focus on purpose, role, and likely user action.',
        'Respond in 2-4 sentences, no preamble, no lists, no markdown.'
      ].join('\n');

      var parts = [
        'Application Description:\n' + appDesc,
        '',
        'Target Element Context (JSON):\n' + elementJson,
        '',
        'Full Page HTML:\n' + html
      ];

      if (extra) {
        parts.push('', 'Additional Context:\n' + extra);
      }

      return [instructions, '', parts.join('\n\n')].join('\n');
    }

    function buildRequestBody(model, prompt, generationConfig) {
      var body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      };

      if (generationConfig && typeof generationConfig === 'object') {
        body.generationConfig = {};
        if (typeof generationConfig.temperature === 'number') body.generationConfig.temperature = generationConfig.temperature;
        if (typeof generationConfig.topP === 'number') body.generationConfig.topP = generationConfig.topP;
        if (typeof generationConfig.topK === 'number') body.generationConfig.topK = generationConfig.topK;
        if (typeof generationConfig.maxOutputTokens === 'number') body.generationConfig.maxOutputTokens = generationConfig.maxOutputTokens;
      } else {
        body.generationConfig = {
          temperature: 0.2,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 256
        };
      }

      return body;
    }

    function textFromResponse(data) {
      try {
        if (!data) return '';
        var candidates = data.candidates || [];
        if (!candidates.length) return '';
        var candidate = candidates[0];
        var parts = (candidate.content && candidate.content.parts) || [];
        var texts = [];
        for (var i = 0; i < parts.length; i++) {
          if (typeof parts[i].text === 'string') texts.push(parts[i].text);
        }
        return texts.join(' ').trim();
      } catch (_e) {
        return '';
      }
    }

    function mapHttpError(status) {
      if (status === 400) return ERRORS.BAD_REQUEST;
      if (status === 401) return ERRORS.INVALID_API_KEY;
      if (status === 403) return ERRORS.FORBIDDEN;
      if (status === 404) return ERRORS.NOT_FOUND;
      if (status === 429) return ERRORS.RATE_LIMITED;
      if (status >= 500) return ERRORS.SERVER_ERROR;
      return ERRORS.UNKNOWN;
    }

    async function callGemini(params) {
      var apiKey = params.apiKey;
      var model = params.model || DEFAULT_MODEL;
      var applicationDescription = params.applicationDescription;
      var pageHtml = params.pageHtml;
      var element = params.element || null;
      var elementInfo = params.elementInfo || null;
      var extraContext = params.extraContext || null;
      var generationConfig = params.generationConfig || null;
      var timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS;

      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return { ok: false, code: ERRORS.MISSING_API_KEY, message: 'API key is required.' };
      }

      var elementContext = collectElementContext(element || elementInfo);
      var prompt = buildUserPrompt(applicationDescription, pageHtml, elementContext, extraContext);

      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent' + '?key=' + encodeURIComponent(apiKey);
      var headers = { 'Content-Type': 'application/json' };
      var body = buildRequestBody(model, prompt, generationConfig);

      var response;
      try {
        if (typeof fetch !== 'function') {
          return { ok: false, code: ERRORS.NETWORK_ERROR, message: 'fetch is not available in this environment.' };
        }

        var controller = (typeof AbortController !== 'undefined' && timeoutMs > 0) ? new AbortController() : null;
        var timeoutId = null;

        if (controller) {
          timeoutId = setTimeout(function() {
            try { controller.abort(); } catch (_e) {}
          }, timeoutMs);

          response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            signal: controller.signal
          });

          if (timeoutId) clearTimeout(timeoutId);
        } else if (timeoutMs > 0) {
          var fetchPromise = fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) });
          response = await Promise.race([
            fetchPromise,
            new Promise(function(_resolve, reject) { setTimeout(function() { reject({ timeout: true }); }, timeoutMs); })
          ]);
        } else {
          response = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) });
        }
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.timeout)) {
          return { ok: false, code: ERRORS.NETWORK_ERROR, message: 'Request timed out.' };
        }
        return { ok: false, code: ERRORS.NETWORK_ERROR, message: 'Network error.', error: err };
      }

      var json;
      if (!response || !response.ok) {
        var status = response && typeof response.status === 'number' ? response.status : 0;
        try {
          json = response ? await response.json() : null;
        } catch (_e) {
          json = null;
        }
        var mapped = mapHttpError(status);
        return {
          ok: false,
          code: mapped,
          status: status,
          message: (json && (json.error && (json.error.message || json.error.status))) || 'Request failed.'
        };
      }

      try {
        json = await response.json();
      } catch (_e2) {
        return { ok: false, code: ERRORS.UNKNOWN, message: 'Invalid JSON response.' };
      }

      var answerText = textFromResponse(json);
      return {
        ok: true,
        model: model,
        answerText: answerText,
        raw: json
      };
    }

    return {
      analyze: callGemini,
      errors: ERRORS,
      constants: { DEFAULT_MODEL: DEFAULT_MODEL, TEXT_CONTENT_LIMIT: TEXT_CONTENT_LIMIT, OUTER_HTML_LIMIT: OUTER_HTML_LIMIT, DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS }
    };
  });

  // ---- ElementInspector (orchestrator) ----
  (function(root) {
    if (root.ElementInspector) return;

    // Default timeout for inspector operations
    var DEFAULT_TIMEOUT_MS = (root.ElementMeaning && root.ElementMeaning.constants && root.ElementMeaning.constants.DEFAULT_TIMEOUT_MS) || 30000;

    var defaults = {
      apiKey: '',
      model: (root.ElementMeaning && root.ElementMeaning.constants && root.ElementMeaning.constants.DEFAULT_MODEL) || 'gemini-2.5-flash-lite',
      applicationDescription: '',
      generationConfig: null,
      timeoutMs: DEFAULT_TIMEOUT_MS
    };

    function configure(options) {
      options = options || {};
      if (typeof options.apiKey === 'string') defaults.apiKey = options.apiKey;
      if (typeof options.model === 'string') defaults.model = options.model;
      if (typeof options.applicationDescription === 'string') defaults.applicationDescription = options.applicationDescription;
      if (options.generationConfig && typeof options.generationConfig === 'object') defaults.generationConfig = options.generationConfig;
      if (typeof options.timeoutMs === 'number') defaults.timeoutMs = options.timeoutMs;
      return Object.assign({}, defaults);
    }

    function getPageHtmlOrEmpty(overrides) {
      if (overrides && typeof overrides.pageHtml === 'string') return overrides.pageHtml;
      try {
        if (typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.outerHTML === 'string') {
          return document.documentElement.outerHTML;
        }
      } catch (_e) {}
      return '';
    }

    function captureOnce() {
      if (!root.ElementCapture || typeof root.ElementCapture.start !== 'function') {
        return Promise.reject(new Error('ElementCapture is not available'));
      }
      return root.ElementCapture.start();
    }

    async function explainElement(element, overrides) {
      overrides = overrides || {};
      var apiKey = overrides.apiKey || defaults.apiKey;
      var model = overrides.model || defaults.model;
      var applicationDescription = typeof overrides.applicationDescription === 'string' ? overrides.applicationDescription : defaults.applicationDescription;
      var pageHtml = getPageHtmlOrEmpty(overrides);
      var generationConfig = overrides.generationConfig || defaults.generationConfig;
      var timeoutMs = typeof overrides.timeoutMs === 'number' ? overrides.timeoutMs : defaults.timeoutMs;
      var extraContext = overrides.extraContext || null;

      if (!root.ElementMeaning || typeof root.ElementMeaning.analyze !== 'function') {
        return { ok: false, code: 'NOT_AVAILABLE', message: 'ElementMeaning is not available' };
      }

      return root.ElementMeaning.analyze({
        apiKey: apiKey,
        model: model,
        applicationDescription: applicationDescription,
        pageHtml: pageHtml,
        element: element,
        generationConfig: generationConfig,
        timeoutMs: timeoutMs,
        extraContext: extraContext
      });
    }

    async function captureAndExplain(overrides) {
      var cap = await captureOnce();
      var res = await explainElement(cap.element, overrides);
      return { element: cap.element, eventType: cap.eventType, result: res };
    }

    root.ElementInspector = {
      configure: configure,
      captureOnce: captureOnce,
      explainElement: explainElement,
      captureAndExplain: captureAndExplain,
      stop: function() {
        if (root.ElementCapture && typeof root.ElementCapture.stop === 'function') {
          root.ElementCapture.stop();
        }
      },
      defaults: defaults,
      version: '0.1.0'
    };
  })(typeof globalThis !== 'undefined' ? globalThis : window);
})();