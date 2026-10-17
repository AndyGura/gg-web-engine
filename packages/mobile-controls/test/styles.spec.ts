import { injectMobileControlsStyles, MOBILE_CONTROLS_STYLE_ID } from '../src/styles';
import { TouchButton } from '../src/controls/touch-button';
import { TouchDPad } from '../src/controls/touch-dpad';
import { TouchLookArea } from '../src/controls/touch-look-area';
import { TouchStick } from '../src/controls/touch-stick';
import { TouchControl } from '../src/controls/touch-control';

const sheet = (): CSSStyleSheet =>
  (document.getElementById(MOBILE_CONTROLS_STYLE_ID) as HTMLStyleElement).sheet as CSSStyleSheet;

const styleRules = (rules: CSSRuleList): CSSStyleRule[] =>
  Array.from(rules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

const selectors = (r: CSSStyleRule): string[] => r.selectorText.split(/\s*,\s*/);

/** The declarations of the top-level rule whose selector list contains `selector`. */
const rule = (selector: string): CSSStyleDeclaration => {
  const found = styleRules(sheet().cssRules).find(r => selectors(r).includes(selector));
  if (!found) {
    throw new Error(`no rule for ${selector}`);
  }
  return found.style;
};

const list = (value: string): string[] =>
  value
    .split(',')
    .map(v => v.trim())
    .filter(v => !!v);

/** Splits a `transition` shorthand into its transitions, keeping commas inside parentheses. */
const transitions = (value: string): string[] => {
  const out = [''];
  let depth = 0;
  for (const ch of value) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (ch === ',' && depth === 0) {
      out.push('');
    } else {
      out[out.length - 1] += ch;
    }
  }
  return out.map(t => t.trim()).filter(t => !!t);
};

const specificity = (selector: string): number => {
  const s = selector.replace(/::[\w-]+/g, '').replace(/:not\(([^)]*)\)/g, ' $1');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
  const types = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return ids * 10000 + classes * 100 + types;
};

/**
 * The value of `property` the stylesheet gives `element` (or its `::before` when `pseudo` is set).
 * jsdom's own `getComputedStyle` drops any `opacity` written with `var()`, so the cascade is
 * resolved here, by specificity and then source order.
 */
const declared = (element: Element, property: string, pseudo: '' | '::before' = ''): string => {
  let best: { specificity: number; value: string } | null = null;
  for (const r of styleRules(sheet().cssRules)) {
    const value = r.style.getPropertyValue(property);
    if (!value) {
      continue;
    }
    for (const selector of selectors(r)) {
      const isPseudo = selector.endsWith('::before');
      if (isPseudo !== !!pseudo || !element.matches(selector.replace(/::before$/, ''))) {
        continue;
      }
      if (!best || specificity(selector) >= best.specificity) {
        best = { specificity: specificity(selector), value };
      }
    }
  }
  return best?.value ?? '';
};

describe('default stylesheet', () => {
  beforeAll(() => injectMobileControlsStyles());

  it('is injected once', () => {
    injectMobileControlsStyles();
    expect(document.querySelectorAll(`#${MOBILE_CONTROLS_STYLE_ID}`)).toHaveLength(1);
  });

  it('applies --gg-mc-opacity per control, not to the full-screen overlay', () => {
    expect(rule('.gg-mc').getPropertyValue('opacity')).toBe('');
    expect(rule('.gg-mc').getPropertyValue('--gg-mc-opacity').trim()).toBe('0.85');
    expect(rule('.gg-mc-control').getPropertyValue('opacity')).toBe('var(--gg-mc-opacity, 1)');
  });

  it('moves the stick knob on a layer of its own', () => {
    expect(list(rule('.gg-mc-stick-knob').getPropertyValue('will-change'))).toContain('transform');
  });

  it('turns transitions off for reduced motion', () => {
    const media = Array.from(sheet().cssRules).find(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule && r.media.mediaText.includes('prefers-reduced-motion'),
    )!;
    expect(media).toBeDefined();
    const reduced = styleRules(media.cssRules).flatMap(r => {
      expect(r.style.getPropertyValue('transition')).toBe('none');
      return selectors(r);
    });
    for (const transitioned of styleRules(sheet().cssRules).filter(r => r.style.getPropertyValue('transition'))) {
      for (const selector of selectors(transitioned)) {
        expect(reduced).toContain(selector);
      }
    }
  });

  describe('on the controls', () => {
    let overlay: HTMLElement;
    let controls: TouchControl[];
    beforeEach(() => {
      overlay = document.createElement('div');
      overlay.className = 'gg-mc';
      document.body.appendChild(overlay);
      controls = [
        new TouchLookArea(),
        new TouchStick(),
        new TouchStick({ mode: 'floating' }),
        new TouchDPad(),
        new TouchButton({ content: '<svg></svg>' }),
      ];
      for (const control of controls) {
        overlay.appendChild(control.element);
      }
    });
    afterEach(() => {
      controls.forEach(c => c.dispose());
      overlay.remove();
    });

    /** Every element of the overlay with its `::before`, at rest and pressed. */
    const eachPart = (fn: (element: Element, pseudo: '' | '::before') => void) => {
      for (const active of [false, true]) {
        for (const control of controls) {
          control.element.classList.toggle('gg-mc-active', active);
          overlay.querySelectorAll('.gg-mc-dpad-arm').forEach(arm => arm.classList.toggle('gg-mc-active', active));
        }
        for (const element of [overlay, ...Array.from(overlay.querySelectorAll('*'))]) {
          fn(element, '');
          fn(element, '::before');
        }
      }
    };

    it('transitions only transform and opacity, on parts that are layers of their own already', () => {
      let count = 0;
      eachPart((element, pseudo) => {
        const transition = declared(element, 'transition', pseudo);
        if (!transition || transition === 'none') {
          return;
        }
        const willChange = list(declared(element, 'will-change', pseudo));
        for (const property of transitions(transition).map(t => t.split(/\s+/)[0])) {
          count++;
          expect(['transform', 'opacity']).toContain(property);
          // a transition on a part without its layer promotes it on every press and demotes it after
          expect(willChange).toContain(property);
        }
      });
      expect(count).toBeGreaterThan(0);
    });

    // An opacity below 1 over more than one layer is drawn through an offscreen pass, on every frame,
    // for as long as it lasts. So no translucent element may contain a part that is a layer of its own.
    it('never puts a layer of its own under a translucent element', () => {
      let layers = 0;
      eachPart((element, pseudo) => {
        if (!declared(element, 'will-change', pseudo)) {
          return;
        }
        layers++;
        // a ::before is inside its element; any other layer only inside its ancestors
        let el: Element | null = pseudo ? element : element.parentElement;
        for (; el && el !== document.body; el = el.parentElement) {
          expect(['', '1'].includes(declared(el, 'opacity')) ? '' : el.className).toBe('');
        }
      });
      expect(layers).toBeGreaterThan(0);
    });

    it('still dims every visible part of a control by --gg-mc-opacity', () => {
      const dimmed = (element: Element, pseudo: '' | '::before' = ''): boolean => {
        for (let el: Element | null = element; el && el !== overlay; el = el.parentElement) {
          if (declared(el, 'opacity', el === element ? pseudo : '').includes('--gg-mc-opacity')) {
            return true;
          }
        }
        return false;
      };
      for (const selector of ['.gg-mc-button', '.gg-mc-dpad-arm', '.gg-mc-stick-knob']) {
        overlay.querySelectorAll(selector).forEach(element => expect(dimmed(element)).toBe(true));
      }
      overlay.querySelectorAll('.gg-mc-stick-base').forEach(base => expect(dimmed(base, '::before')).toBe(true));
    });
  });
});
