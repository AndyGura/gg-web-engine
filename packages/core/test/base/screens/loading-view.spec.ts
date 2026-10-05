import { DefaultLoadingView } from '../../../src';

describe('DefaultLoadingView', () => {
  const progress = (fraction: number) => ({
    fraction,
    loadedItems: 0,
    totalItems: 0,
    bytesLoaded: 0,
    bytesTotal: 0,
    current: null,
  });

  it('shows the fraction as a bar width, a label and an accessible value', () => {
    const view = new DefaultLoadingView();
    const fill = view.element.querySelector('.gg-loading__fill') as HTMLElement;
    const label = view.element.querySelector('.gg-loading__label') as HTMLElement;
    expect(view.element.getAttribute('role')).toBe('progressbar');
    expect(label.textContent).toBe('0%');

    view.setProgress(progress(0.426));
    expect(fill.style.width).toBe('43%');
    expect(label.textContent).toBe('43%');
    expect(view.element.getAttribute('aria-valuenow')).toBe('43');

    view.setProgress(progress(7));
    expect(fill.style.width).toBe('100%');
  });

  it('removes its element on dispose', () => {
    const view = new DefaultLoadingView();
    document.body.appendChild(view.element);
    view.dispose();
    expect(view.element.isConnected).toBe(false);
  });
});
