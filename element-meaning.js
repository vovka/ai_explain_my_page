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

  function isDomElement(value) {
    if (!value) return false;
    // Duck-typing to avoid depending on window/Node types
    return typeof value === 'object' && (
      value.nodeType === 1 || // Element
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

    // If caller passed a DOM Element, derive a compact summary
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
        text: safeString(el.textContent).trim().slice(0, 4000),
        outerHTML: safeString(el.outerHTML).slice(0, 100000),
        attributes: attributes
      };
    }

    // Otherwise assume caller passed a plain object with context
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
      text: safeString(info.text).slice(0, 4000),
      outerHTML: safeString(info.outerHTML).slice(0, 100000),
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
      '- A specific target element\'s context and representation.',
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

    body.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ];

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

  function withTimeout(promise, timeoutMs) {
    if (!timeoutMs || timeoutMs <= 0) return promise;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (!controller) return promise; // environment without AbortController

    var timeoutId;
    var timeoutPromise = new Promise(function(_resolve, reject) {
      timeoutId = setTimeout(function() {
        controller.abort();
        reject({ timeout: true });
      }, timeoutMs);
    });

    var wrapped = fetchPromiseWithSignal(promise, controller.signal);

    return Promise.race([wrapped, timeoutPromise]).finally(function() {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  function fetchPromiseWithSignal(original, signal) {
    // Helper in case original is a fetch; if not, just return original
    // We cannot reliably inject a signal into a promise, so just return original
    return original;
  }

  async function callGemini(params) {
    var apiKey = params.apiKey;
    var model = params.model || DEFAULT_MODEL;
    var applicationDescription = params.applicationDescription;
    var pageHtml = params.pageHtml;
    var element = params.element || null;
    var elementInfo = params.elementInfo || null; // alternative to element
    var extraContext = params.extraContext || null;
    var generationConfig = params.generationConfig || null;
    var timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 30000;

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
    constants: { DEFAULT_MODEL: DEFAULT_MODEL }
  };
});