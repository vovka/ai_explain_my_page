# ElementCapture (Vanilla JS)

A zero-dependency drop-in script that lets you start a temporary "capture mode" on any web page to capture the next clicked element. It prevents the element's default behavior, logs it to the console, and resolves a Promise with the captured element.

## Install

Include the script directly from your hosting (or GitHub raw). Example:

```html
<script src="/element-capture.js"></script>
```

This exposes a global `ElementCapture` object.

## Usage

```html
<button id="start-capture">Start capture</button>
<script>
  document.getElementById('start-capture').addEventListener('click', function() {
    ElementCapture.start().then(function(result) {
      // result.element is the DOM element that was clicked
      console.log('Captured:', result.element);
      // do something with it
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

- `ElementCapture.start(): Promise<{ element: Element, eventType: string }>`
- `ElementCapture.stop(): void`
- `ElementCapture.isCapturing(): boolean`
- `ElementCapture.getLastCapturedElement(): Element | null`
- `ElementCapture.version: string`

## Notes

- Works without bundlers or transpilers.
- Uses capture-phase listeners to intercept early.
- No visual highlighting is performed; only the clicked element is captured.