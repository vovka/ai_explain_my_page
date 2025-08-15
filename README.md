# ElementCapture (Vanilla JS)

A zero-dependency drop-in script that lets you start a temporary "capture mode" on any web page to capture the next clicked element. It prevents the element's default behavior, logs it to the console, and resolves a Promise with the captured element.

## Install

Include the scripts directly from your hosting (or GitHub raw). Example:

```html
<script src="/element-capture.js"></script>
<script src="/element-meaning.js"></script>
```

This exposes global `ElementCapture` and `ElementMeaning` objects.

## Usage

```html
<button id="start-capture">Start capture</button>
<script>
  document.getElementById('start-capture').addEventListener('click', function() {
    ElementCapture.start().then(async function(result) {
      const element = result.element;

      // Provide your app description, page HTML, and Gemini API key
      const applicationDescription = 'A SaaS dashboard for managing subscriptions and invoices';
      const pageHtml = document.documentElement.outerHTML;
      const apiKey = '<YOUR_GEMINI_API_KEY>';

      const response = await ElementMeaning.analyze({
        apiKey,
        applicationDescription,
        pageHtml,
        element,
        // Optional overrides:
        // model: 'gemini-2.5-flash-lite',
        // generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        // extraContext: { userRole: 'admin' }
      });

      if (!response.ok) {
        console.warn('ElementMeaning error:', response.code, response.message || '');
        if (response.code === ElementMeaning.errors.MISSING_API_KEY) {
          alert('Missing API key. Please configure your Gemini API key.');
        } else if (response.code === ElementMeaning.errors.INVALID_API_KEY) {
          alert('Invalid API key. Please verify and try again.');
        } else {
          alert('Could not analyze element: ' + (response.message || response.code));
        }
        return;
      }

      console.log('Meaning:', response.answerText);
      alert('Meaning: ' + response.answerText);
    }).catch(function(err) {
      console.warn('Capture was cancelled/stopped:', err.message);
    });
  });
</script>
```

- Press `Esc` to cancel.
- While active, the next click is intercepted with `preventDefault()` and `stopImmediatePropagation()`.
- `ElementCapture.stop()` programmatically cancels capture.

## API

### ElementCapture
- `ElementCapture.start(): Promise<{ element: Element, eventType: string }>`
- `ElementCapture.stop(): void`
- `ElementCapture.isCapturing(): boolean`
- `ElementCapture.getLastCapturedElement(): Element | null`
- `ElementCapture.version: string`

### ElementMeaning
- `ElementMeaning.analyze(options): Promise<AnalyzeResult>`
  - **options**:
    - `apiKey: string` (required) – Gemini API key
    - `applicationDescription: string` (required) – high-level description of your app
    - `pageHtml: string` (required) – full HTML content of the page
    - `element?: Element` – DOM element to analyze (or provide `elementInfo`)
    - `elementInfo?: object` – custom element context object if DOM is not available
    - `extraContext?: object | string` – optional extra signals (e.g., user role)
    - `model?: string` – defaults to `gemini-2.5-flash-lite`
    - `generationConfig?: { temperature?: number, topP?: number, topK?: number, maxOutputTokens?: number }`
    - `timeoutMs?: number` – default 30000
  - **AnalyzeResult**:
    - `ok: boolean`
    - `answerText?: string` – present when `ok` is true
    - `raw?: any` – raw Gemini response
    - `model?: string`
    - `code?: string` – error code when `ok` is false
    - `message?: string` – error message when `ok` is false
    - `status?: number` – HTTP status when available

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

## Notes

- Works without bundlers or transpilers.
- Uses capture-phase listeners to intercept early.
- No visual highlighting is performed; only the clicked element is captured.
- The element analyzer sends only text to the Gemini `generateContent` endpoint and requests a concise 2–4 sentence summary of the element's meaning in context.