// jsdom has no canvas backend: its `getContext` logs a "Not implemented" error on every call, and
// pixi.js probes for one while it loads. No test here draws, so answer "no context" quietly.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
