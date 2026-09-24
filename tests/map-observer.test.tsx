// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewBounds, wheelZoom, zoomCameraAt } from '../src/rendering/camera';
import { createExperiment } from '../src/simulation/engine';
import { WorldView } from '../src/ui/WorldView';

const ignoredPlacement = () => ({ ok: false as const, reason: 'Read-only test' });

describe('observer zoom', () => {
  it('keeps the same world point under the pointer at arbitrary coordinates', () => {
    const center = { x: -23785, y: 87900 };
    const pointer = { x: 191, y: 260 };
    const before = viewBounds(900, 500, 0.8, center);
    const next = zoomCameraAt(center, pointer, 900, 500, 0.8, 1.6);
    const after = viewBounds(900, 500, 1.6, next);
    expect(before.left + pointer.x / before.scale).toBeCloseTo(
      after.left + pointer.x / after.scale,
    );
    expect(before.top + pointer.y / before.scale).toBeCloseTo(after.top + pointer.y / after.scale);
    expect(zoomCameraAt(center, { x: 450, y: 250 }, 900, 500, 0.8, 1.6)).toEqual(center);
  });

  it('handles pixel, line and page wheels consistently, and limits large deltas', () => {
    expect(wheelZoom(1, -3, 1, 760)).toBe(wheelZoom(1, -48, 0, 760));
    expect(wheelZoom(1, 1, 2, 200)).toBe(wheelZoom(1, 200, 0, 200));
    expect(wheelZoom(1, -10000, 0, 760)).toBe(wheelZoom(1, -250, 0, 760));
    expect(wheelZoom(wheelZoom(1, -2.3, 0, 760), 2.3, 0, 760)).toBeCloseTo(1);
    expect(wheelZoom(2.5, -200, 0, 760)).toBe(2.5);
    expect(wheelZoom(0.5, 200, 0, 760)).toBe(0.5);
    expect(wheelZoom(1, Number.NaN, 0, 760)).toBe(1);
  });
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        private callback: (entries: { contentRect: { width: number; height: number } }[]) => void,
      ) {}
      observe() {
        this.callback([{ contentRect: { width: 1200, height: 760 } }]);
      }
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform() {},
  } as CanvasRenderingContext2D);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('map controls and live vitals', () => {
  it('zooms only over the map, preserves follow mode and respects the button limits', async () => {
    const current = createExperiment('observer-wheel');
    const before = structuredClone(current);
    await act(async () =>
      root.render(
        <WorldView state={{ current }} editable={false} onIntervene={ignoredPlacement} />,
      ),
    );
    const canvas = host.querySelector('canvas')!;
    const wheel = (target: Element, deltaY: number) => {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    let event: WheelEvent;
    await act(async () => {
      event = wheel(canvas, -100);
    });
    expect(event!.defaultPrevented).toBe(true);
    expect(host.querySelector('.map-controls')?.textContent).toContain('122%');
    expect(host.querySelector('[aria-label="Follow fly"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(wheel(document.body, -100).defaultPrevented).toBe(false);
    await act(async () => {
      for (let i = 0; i < 10; i++) wheel(canvas, -200);
    });
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.disabled).toBe(true);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click(),
    );
    expect(host.querySelector('.map-controls')?.textContent).toContain('225%');
    await act(async () => {
      for (let i = 0; i < 10; i++) wheel(canvas, 200);
    });
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.disabled).toBe(true);
    expect(current).toEqual(before);
  });

  it('keeps free-camera mode while zooming and detaches the wheel handler on unmount', async () => {
    await act(async () =>
      root.render(
        <WorldView
          state={{ current: createExperiment('free-wheel') }}
          editable={false}
          onIntervene={ignoredPlacement}
        />,
      ),
    );
    const canvas = host.querySelector('canvas')!;
    const map = host.querySelector('.world-canvas')!;
    await act(async () =>
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    await act(async () =>
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -30,
          clientX: 200,
          clientY: 300,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(map.classList.contains('free-camera')).toBe(true);
    await act(async () => root.render(null));
    const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    map.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows all six current values with accessible names, including updates while paused', async () => {
    const state = { current: createExperiment('live-hud') };
    state.current.fly.vitals = {
      energy: 99,
      hunger: 11,
      hydration: 76,
      fatigue: 48,
      health: 100,
      threat: 0,
    };
    await act(async () =>
      root.render(<WorldView state={state} editable={false} onIntervene={ignoredPlacement} />),
    );
    const names = () =>
      Array.from(host.querySelectorAll('.map-vital')).map((item) =>
        item.getAttribute('aria-label'),
      );
    expect(names()).toEqual([
      'Energy: 99%',
      'Hunger: 11%',
      'Hydration: 76%',
      'Fatigue: 48%',
      'Health: 100%',
      'Arousal: 0%',
    ]);
    state.current.fly.vitals.health = 64;
    await act(async () =>
      root.render(<WorldView state={state} editable={false} onIntervene={ignoredPlacement} />),
    );
    expect(names()).toContain('Health: 64%');
  });

  it('passes a painted food stimulus at the keyboard cursor to the intervention handler', async () => {
    const state = { current: createExperiment('brush-keyboard') };
    const onIntervene = vi.fn(() => ({ ok: true as const, message: 'Food added' }));
    await act(async () =>
      root.render(<WorldView state={state} editable onIntervene={onIntervene} />),
    );
    const canvas = host.querySelector('canvas')!;
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Paint food on map"]')!.click(),
    );
    await act(async () =>
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    expect(onIntervene).toHaveBeenCalledWith('food', {
      x: state.current.fly.x,
      y: state.current.fly.y,
    });
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Food added');
    await act(async () =>
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('[aria-label="Move map"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
