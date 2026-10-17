import { injectMobileControlsStyles, MOBILE_CONTROLS_CSS, MOBILE_CONTROLS_STYLE_ID } from '../src/styles';

const sheet = (): CSSStyleSheet =>
  (document.getElementById(MOBILE_CONTROLS_STYLE_ID) as HTMLStyleElement).sheet as CSSStyleSheet;

const styleRules = (rules: CSSRuleList): CSSStyleRule[] =>
  Array.from(rules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

/** The declarations of the top-level rule whose selector list contains `selector`. */
const rule = (selector: string): CSSStyleDeclaration => {
  const found = styleRules(sheet().cssRules).find(r => r.selectorText.split(/\s*,\s*/).includes(selector));
  if (!found) {
    throw new Error(`no rule for ${selector}`);
  }
  return found.style;
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

  it('never transitions a background, only transform and opacity', () => {
    const transitions = MOBILE_CONTROLS_CSS.match(/transition:[^;]*/g)!;
    expect(transitions.length).toBeGreaterThan(0);
    for (const transition of transitions) {
      const properties = transition
        .replace('transition:', '')
        .split(',')
        .map(part => part.trim().split(/\s+/)[0]);
      for (const property of properties) {
        expect(['transform', 'opacity', 'none']).toContain(property);
      }
    }
  });

  it('keeps the animated elements on layers of their own', () => {
    expect(rule('.gg-mc-button').getPropertyValue('will-change')).toBe('transform');
    expect(rule('.gg-mc-button::before').getPropertyValue('will-change')).toBe('opacity');
    expect(rule('.gg-mc-stick--floating .gg-mc-stick-base').getPropertyValue('will-change')).toBe('opacity');
    expect(rule('.gg-mc-stick-knob').getPropertyValue('will-change')).toBe('transform');
  });

  it('shows the pressed colour of buttons and d-pad arms as a fading ::before layer below the content', () => {
    const before = rule('.gg-mc-dpad-arm::before');
    expect(before).toBe(rule('.gg-mc-button::before'));
    expect(before.getPropertyValue('background')).toBe('var(--gg-mc-active-background)');
    expect(before.getPropertyValue('opacity')).toBe('0');
    expect(before.getPropertyValue('z-index')).toBe('-1');
    expect(rule('.gg-mc-button.gg-mc-active::before').getPropertyValue('opacity')).toBe('1');
    expect(rule('.gg-mc-dpad-arm.gg-mc-active::before').getPropertyValue('opacity')).toBe('1');
    // the negative z-index stays inside the control, above its own background
    expect(rule('.gg-mc-button').getPropertyValue('isolation')).toBe('isolate');
    expect(rule('.gg-mc-dpad-arm').getPropertyValue('isolation')).toBe('isolate');
    expect(rule('.gg-mc-button.gg-mc-active').getPropertyValue('background')).toBe('');
  });

  it('turns transitions off for reduced motion', () => {
    const media = Array.from(sheet().cssRules).find(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule && r.media.mediaText.includes('prefers-reduced-motion'),
    )!;
    expect(media).toBeDefined();
    const selectors = styleRules(media.cssRules).flatMap(r => {
      expect(r.style.getPropertyValue('transition')).toBe('none');
      return r.selectorText.split(/\s*,\s*/);
    });
    for (const transitioned of styleRules(sheet().cssRules).filter(r => r.style.getPropertyValue('transition'))) {
      for (const selector of transitioned.selectorText.split(/\s*,\s*/)) {
        expect(selectors).toContain(selector);
      }
    }
  });
});
