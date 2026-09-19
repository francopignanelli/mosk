// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSAY_MODEL, type AssayCheckpoint } from '../src/research/assay';
import { archiveGeneration, createExperiment } from '../src/simulation/engine';
import { Journal } from '../src/ui/Journal';

const checkpoint: AssayCheckpoint = {
  version: 1,
  model: ASSAY_MODEL,
  odorSet: 'attractive',
  protocol: 'conditioning',
  cursor: 3,
};
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const toggle = () => host.querySelector<HTMLButtonElement>('.journal-memory-toggle')!;
const chooseLife = async (value: string) => {
  const select = host.querySelector<HTMLSelectElement>('.generation-select select')!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const frame = () => host.querySelector<HTMLIFrameElement>('iframe');
const handshake = async () => {
  const child = frame()!.contentWindow!;
  const send = vi.spyOn(child, 'postMessage');
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'mosk-lab:ready' },
        origin: window.location.origin,
        source: child,
      }),
    );
  });
  const restore = send.mock.calls.find(([message]) => message.type === 'mosk-lab:restore')![0];
  return { child, restore };
};

describe('journal saved-memory inspection', () => {
  it('loads an archived assay only on expansion and always restores it read-only', async () => {
    const current = createExperiment('current', 2, 'adaptive', 'Sol');
    const prior = createExperiment('archive', 1, 'adaptive', 'Luna');
    prior.assay = { ...checkpoint };
    const archived = archiveGeneration(prior);
    await act(async () => root.render(<Journal current={current} archive={[archived]} />));
    expect(toggle()).toBeNull();
    expect(frame()).toBeNull();
    await chooseLife('0');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().textContent).toContain('Luna');
    expect(frame()).toBeNull();
    await act(async () => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle().getAttribute('aria-controls')!)).not.toBeNull();
    const { child, restore } = await handshake();
    expect(restore).toMatchObject({ state: checkpoint, flyName: 'Luna', readOnly: true });
    expect(host.textContent).toContain('does not change its checkpoint');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          source: child,
          data: {
            type: 'mosk-lab:state',
            flyId: restore.flyId,
            state: { ...checkpoint, cursor: 9 },
          },
        }),
      );
    });
    expect(archived.finalState.assay).toEqual(checkpoint);
    expect(current.assay).toBeUndefined();
    await act(async () => toggle().click());
    expect(frame()).toBeNull();
  });

  it('closes the replay when selecting another life and restores that life on reopening', async () => {
    const current = createExperiment('current', 2, 'adaptive', 'Sol');
    current.assay = { ...checkpoint, cursor: 7 };
    const prior = createExperiment('archive', 1, 'adaptive', 'Luna');
    prior.assay = { ...checkpoint };
    await act(async () =>
      root.render(<Journal current={current} archive={[archiveGeneration(prior)]} />),
    );
    await act(async () => toggle().click());
    const first = await handshake();
    expect(first.restore).toMatchObject({ readOnly: true, state: current.assay });
    await chooseLife('0');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(frame()).toBeNull();
    await act(async () => toggle().click());
    const next = await handshake();
    expect(next.restore).toMatchObject({ readOnly: true, state: prior.assay });
    expect(next.restore.flyId).not.toBe(first.restore.flyId);
    await chooseLife('current');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(frame()).toBeNull();
  });
});
