/**
 * A fake `Gamepad` for `navigator.getGamepads()`: `buttons` by index (a boolean, or a trigger's
 * analog value), `axes` by index, standard mapping and connected unless said otherwise.
 */
export type FakeGamepad = {
  buttons?: Record<number, number | boolean>;
  axes?: number[];
  mapping?: string;
  connected?: boolean;
  /** `Gamepad.id`, `'fake'` by default */
  id?: string;
  /** `Gamepad.index`, 0 by default */
  index?: number;
};

export const fakeGamepad = (pad: FakeGamepad = {}): Gamepad => {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const b = pad.buttons?.[i] ?? 0;
    const value = typeof b === 'boolean' ? (b ? 1 : 0) : b;
    return { pressed: value > 0.5, touched: value > 0, value } as GamepadButton;
  });
  const axes = [0, 0, 0, 0];
  (pad.axes || []).forEach((v, i) => (axes[i] = v));
  return {
    id: pad.id ?? 'fake',
    index: pad.index ?? 0,
    connected: pad.connected ?? true,
    mapping: pad.mapping ?? 'standard',
    buttons,
    axes,
    timestamp: 0,
  } as unknown as Gamepad;
};

/**
 * Stubs `navigator.getGamepads` (jsdom has none) for the current test: `set(pad)` makes that the
 * one connected gamepad (`null` for none), `restore()` removes the stub - call it in `afterEach`.
 */
export const stubGamepads = () => {
  let pads: (Gamepad | null)[] = [];
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true, writable: true });
  return {
    set: (pad: FakeGamepad | null) => (pads = pad ? [fakeGamepad(pad)] : []),
    setAll: (all: (Gamepad | null)[]) => (pads = all),
    restore: () => delete (navigator as any).getGamepads,
  };
};
