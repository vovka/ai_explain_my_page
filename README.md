# Element Intelligence (Capture + Meaning)

![Demo](https://github.com/vovka/ai_explain_my_page/blob/42724b7fa4eadfe674ca92d7610917774926e8ff/ai-explain-my-webpage-demo.gif)

A zero-dependency drop-in script that lets you:
- Capture a DOM element by entering a temporary "capture mode" and clicking an element.
- Send compact context about that element, your app, and the page HTML to Gemini for a concise explanation of the element's meaning.

It ships as a single file and exposes three globals for flexibility:
- `ElementInspector` (recommended): high-level orchestrator for capture + explanation
- `ElementCapture`: low-level capture utility
- `ElementMeaning`: low-level Gemini client

## Install

Include the single script:

```html
<script src="/element-intelligence.js"></script>
```

This exposes global `ElementInspector`, `ElementCapture`, and `ElementMeaning` objects.

## Quick start

```html
<button id="start-capture">Start capture</button>
<button id="stop-capture">Stop capture</button>
<script>
  // Configure once at startup
  ElementInspector.configure({
    apiKey: '<YOUR_GEMINI_API_KEY>',
    applicationDescription: 'A SaaS dashboard for managing subscriptions and invoices'
  });

  // Start capture and auto-explain the clicked element
  document.getElementById('start-capture').addEventListener('click', function() {
    ElementInspector.captureAndExplain()
      .then(function(out) {
        console.log('Captured element:', out.element);
        if (out.result && out.result.ok) {
          console.log('[Explanation]', out.result.answerText);
        } else {
          console.warn('Explanation failed:', out.result && (out.result.message || out.result.code));
        }
      })
      .catch(function(err) {
        console.warn('Capture or explanation error:', err && err.message);
      });
  });

  // Stop capture programmatically
  document.getElementById('stop-capture').addEventListener('click', function() {
    ElementInspector.stop();
  });
</script>
```

- Press `Esc` to cancel capture.
- While active, the next click is intercepted with `preventDefault()` and `stopImmediatePropagation()`.

## Demo

Open the included demo with your API key provided via URL parameter:

```
/demo.html?api_key=YOUR_GEMINI_API_KEY
```

The demo logs both the captured element and the explanation to the browser console.

## API

### ElementInspector (recommended)
- `ElementInspector.configure(options): Defaults` — sets defaults and returns the current defaults snapshot
  - `apiKey?: string` — Gemini API key
  - `model?: string` — defaults to `gemini-2.5-flash-lite`
  - `applicationDescription?: string` — high-level description of your app
  - `generationConfig?: { temperature?: number, topP?: number, topK?: number, maxOutputTokens?: number }`
  - `timeoutMs?: number` — default `DEFAULT_TIMEOUT_MS` (see constants)
- `ElementInspector.captureOnce(): Promise<{ element: Element, eventType: string }>` — enters capture mode and resolves on next click
- `ElementInspector.explainElement(element, overrides?): Promise<AnalyzeResult>` — runs explanation for a provided element
- `ElementInspector.captureAndExplain(overrides?): Promise<{ element: Element, eventType: string, result: AnalyzeResult }>` — captures and explains in one call
- `ElementInspector.stop(): void` — cancels an in-progress capture (delegates to `ElementCapture.stop()`)
- `ElementInspector.defaults: Defaults` — current default configuration
- `ElementInspector.version: string`

Where `overrides` may include: `apiKey`, `model`, `applicationDescription`, `pageHtml`, `generationConfig`, `timeoutMs`, `extraContext`, and the following callbacks:
  - `onExplanationStart?: (element: Element) => void` — callback fired right after element capture, before the explanation API call. Ideal for showing a loading state.
  - `onExplanationEnd?: () => void` — callback fired after the explanation API call completes (on both success and failure). Ideal for hiding a loading state.

### ElementCapture (low-level)
- `ElementCapture.start(): Promise<{ element: Element, eventType: string }>`
- `ElementCapture.stop(): void`
- `ElementCapture.isCapturing(): boolean`
- `ElementCapture.getLastCapturedElement(): Element | null`
- `ElementCapture.version: string`

### ElementMeaning (low-level)
- `ElementMeaning.analyze(options): Promise<AnalyzeResult>`
  - **options**:
    - `apiKey: string` (required)
    - `applicationDescription: string` (required)
    - `pageHtml: string` (required)
    - `element?: Element` — DOM element to analyze (or provide `elementInfo`)
    - `elementInfo?: object` — custom element context if DOM is not available
    - `extraContext?: object | string` — optional additional context
    - `model?: string` — defaults to `gemini-2.5-flash-lite`
    - `generationConfig?: { temperature?: number, topP?: number, topK?: number, maxOutputTokens?: number }`
    - `timeoutMs?: number` — default `DEFAULT_TIMEOUT_MS`
  - **AnalyzeResult**:
    - `ok: boolean`
    - `answerText?: string` — present when `ok` is true
    - `raw?: any` — raw Gemini response
    - `model?: string`
    - `code?: string` — error code when `ok` is false
    - `message?: string` — error message when `ok` is false
    - `status?: number` — HTTP status when available

### Error codes
- `MISSING_API_KEY`
- `INVALID_API_KEY`
- `RATE_LIMITED`
- `FORBIDDEN`
- `BAD_REQUEST`
- `NOT_FOUND`
- `SERVER_ERROR`
- `NETWORK_ERROR`
- `UNKNOWN`

### Constants
Available at `ElementMeaning.constants`:
- `DEFAULT_MODEL`
- `TEXT_CONTENT_LIMIT` — default `4000`
- `OUTER_HTML_LIMIT` — default `100000`
- `DEFAULT_TIMEOUT_MS` — default `30000`

## Notes

- No visual highlighting is performed; only the clicked element is captured.
- Safety: the library does not override Google safety settings; the API's default, safer content filters are used by default.
- Works without bundlers or transpilers.
