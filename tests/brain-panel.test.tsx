// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrainPanel } from '../src/ui/BrainPanel';
import { createExperiment } from '../src/simulation/engine';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('brain signal inspector', () => {
  it('explains signals on focus and supports arrow-key navigation across layers', async () => {
    await act(async () =>
      root.render(<BrainPanel state={createExperiment('inspector')} onAbout={() => {}} />),
    );
    const scent = host.querySelector<SVGGElement>('[aria-label^="Food scent,"]')!;
    await act(async () => scent.focus());
    expect(host.querySelector('#brain-node-inspector')?.textContent).toContain(
      'nearest detectable food',
    );
    await act(async () =>
      scent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Forage, drive signal');
    const inspector = host.querySelector('#brain-node-inspector')!;
    expect(inspector.textContent).toContain('Food scent · Hunger');
    expect(inspector.textContent).toContain('Forward · Feed');
    expect(inspector.textContent).toContain('not biological neurons');
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(host.querySelector('#brain-node-inspector')).toBeNull();
  });

  it('keeps pinned details live while the experiment advances and dismisses them explicitly', async () => {
    const state = createExperiment('live-signals');
    state.brain.values.hunger = 0.25;
    const render = () => root.render(<BrainPanel state={state} onAbout={() => {}} />);
    await act(async () => render());
    const hunger = host.querySelector<SVGGElement>('[aria-label^="Hunger,"]')!;
    await act(async () => {
      hunger.focus();
      hunger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await act(async () => {
      hunger.blur();
      state.tick += 1;
      state.brain.values.hunger = 0.67;
      render();
    });
    expect(host.querySelector('.brain-inspector-heading h3')?.textContent).toBe('Hunger 67%');
    expect(hunger.getAttribute('aria-pressed')).toBe('true');
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Close signal details"]')!.click(),
    );
    expect(host.querySelector('#brain-node-inspector')).toBeNull();
    expect(hunger.getAttribute('aria-pressed')).toBe('false');
  });

  it('describes the different meaning of monitored needs in Random baseline', async () => {
    const state = createExperiment('random-signals');
    state.brain.mode = 'random';
    await act(async () => root.render(<BrainPanel state={state} onAbout={() => {}} />));
    await act(async () => host.querySelector<SVGGElement>('[aria-label^="Hunger,"]')!.focus());
    expect(host.querySelector('#brain-node-inspector')?.textContent).toContain(
      'needs are monitored but most do not guide decisions',
    );
  });
});
