// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSAY_MODEL, type AssayCheckpoint } from '../src/research/assay';
import { createExperiment } from '../src/simulation/engine';
import { ResearchPanel } from '../src/ui/ResearchPanel';
import type { ExperimentState } from '../src/shared/types';

const checkpoint: AssayCheckpoint = {
  version: 1,
  model: ASSAY_MODEL,
  odorSet: 'attractive',
  protocol: 'conditioning',
  cursor: 3,
};

let host: HTMLDivElement;
let root: Root;
let state: ExperimentState;
let onCheckpoint: ReturnType<typeof vi.fn>;
let readOnly: boolean;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  state = createExperiment('research-panel', 17);
  onCheckpoint = vi.fn();
  readOnly = false;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const render = async () => {
  await act(async () =>
    root.render(<ResearchPanel state={state} readOnly={readOnly} onCheckpoint={onCheckpoint} />),
  );
};
const currentFrame = () => host.querySelector<HTMLIFrameElement>('iframe')!;
const postFrom = async (
  data: unknown,
  source: MessageEventSource | null = currentFrame().contentWindow,
  origin = window.location.origin,
) => {
  await act(async () =>
    window.dispatchEvent(new MessageEvent('message', { data, source, origin })),
  );
};
const handshake = async () => {
  const child = currentFrame().contentWindow!;
  const send = vi.spyOn(child, 'postMessage');
  await postFrom({ type: 'mosk-lab:ready' }, child);
  const restore = send.mock.calls.find(([message]) => message.type === 'mosk-lab:restore')!;
  expect(restore).toBeDefined();
  expect(restore[1]).toBe(window.location.origin);
  return { child, send, flyId: restore[0].flyId as string, restore: restore[0] };
};

describe('published assay host boundary', () => {
  it('restores the current life only after a message from its actual same-origin frame', async () => {
    state.assay = { ...checkpoint };
    state.fly.name = 'Luna';
    await render();
    const child = currentFrame().contentWindow!;
    const send = vi.spyOn(child, 'postMessage');
    await postFrom({ type: 'mosk-lab:ready' }, window);
    await postFrom({ type: 'mosk-lab:ready' }, child, 'https://unrelated.example');
    expect(send).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Opening');
    await postFrom({ type: 'mosk-lab:ready' }, child);
    const restore = send.mock.calls.find(([message]) => message.type === 'mosk-lab:restore')!;
    expect(restore[0]).toMatchObject({
      type: 'mosk-lab:restore',
      flyName: 'Luna',
      state: checkpoint,
      readOnly: false,
    });
    expect(restore[0].flyId).toEqual(expect.any(String));
    expect(restore[0].flyId.length).toBeGreaterThan(10);
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('rejects foreign origin, wrong window, wrong life ID and malformed checkpoints', async () => {
    await render();
    const { child, flyId } = await handshake();
    const payload = { type: 'mosk-lab:state', flyId, state: checkpoint };
    await postFrom(payload, child, 'https://unrelated.example');
    await postFrom(payload, window);
    await postFrom({ ...payload, flyId: 'another-life' }, child);
    await postFrom({ ...payload, state: { ...checkpoint, cursor: 42 } }, child);
    await postFrom({ ...payload, state: { ...checkpoint, model: 'unsupported-model' } }, child);
    await postFrom({ ...payload, state: { ...checkpoint, arbitraryWeights: [1, 2] } }, child);
    await postFrom(null, child);
    expect(onCheckpoint).not.toHaveBeenCalled();
    await postFrom(payload, child);
    expect(onCheckpoint).toHaveBeenCalledOnce();
    expect(onCheckpoint).toHaveBeenCalledWith(checkpoint, 17);
  });

  it('replaces the iframe identity for another world and rejects delayed writes from the previous life', async () => {
    await render();
    const previous = await handshake();
    const firstFrame = currentFrame();
    state = createExperiment('research-next-life', 18);
    await render();
    expect(currentFrame()).not.toBe(firstFrame);
    const next = await handshake();
    expect(next.flyId).not.toBe(previous.flyId);
    expect(next.restore.state).toBeNull();
    await postFrom(
      { type: 'mosk-lab:state', flyId: previous.flyId, state: checkpoint },
      previous.child,
    );
    await postFrom(
      { type: 'mosk-lab:state', flyId: previous.flyId, state: checkpoint },
      next.child,
    );
    expect(onCheckpoint).not.toHaveBeenCalled();
    await postFrom({ type: 'mosk-lab:state', flyId: next.flyId, state: checkpoint }, next.child);
    expect(onCheckpoint).toHaveBeenCalledExactlyOnceWith(checkpoint, 18);
  });

  it.each(['observer', 'concluded'] as const)(
    'blocks checkpoint writes for a %s life, including an already-open assay',
    async (mode) => {
      await render();
      const { child, flyId, send } = await handshake();
      const sameFrame = currentFrame();
      if (mode === 'observer') readOnly = true;
      else state.fly.alive = false;
      await render();
      expect(currentFrame()).toBe(sameFrame);
      const context = send.mock.calls
        .filter(([message]) => message.type === 'mosk-lab:context')
        .at(-1)!;
      expect(context[0]).toMatchObject({ flyId, readOnly: true });
      expect(host.querySelector('.assay-readonly')?.textContent).toContain('Training is disabled');
      await postFrom({ type: 'mosk-lab:state', flyId, state: checkpoint }, child);
      expect(onCheckpoint).not.toHaveBeenCalled();
    },
  );

  it('updates the current name without changing the life identity or replaying the assay', async () => {
    await render();
    const { flyId, send } = await handshake();
    const sameFrame = currentFrame();
    send.mockClear();
    state.fly.name = 'Sol';
    await render();
    expect(currentFrame()).toBe(sameFrame);
    expect(send).toHaveBeenCalledExactlyOnceWith(
      { type: 'mosk-lab:context', flyId, flyName: 'Sol', readOnly: false },
      window.location.origin,
    );
    expect(host.querySelector('.research-specimen')?.textContent).toContain('Sol');
  });

  it('accepts finite sizing messages only from the active frame and clamps the requested height', async () => {
    await render();
    const { child } = await handshake();
    await postFrom({ type: 'mosk-lab:height', height: 1200 }, window);
    expect(currentFrame().style.height).toBe('1050px');
    await postFrom({ type: 'mosk-lab:height', height: 1200 }, child);
    expect(currentFrame().style.height).toBe('1200px');
    await postFrom({ type: 'mosk-lab:height', height: Infinity }, child);
    expect(currentFrame().style.height).toBe('1200px');
    await postFrom({ type: 'mosk-lab:height', height: 50000 }, child);
    expect(currentFrame().style.height).toBe('2600px');
    await postFrom({ type: 'mosk-lab:height', height: -1 }, child);
    expect(currentFrame().style.height).toBe('700px');
  });

  it('removes the assay message listener when another research view opens', async () => {
    await render();
    const { child, flyId } = await handshake();
    const guide = [...host.querySelectorAll<HTMLButtonElement>('.research-tabs button')].find(
      (button) => button.textContent?.includes('How to observe'),
    )!;
    await act(async () => guide.click());
    expect(host.querySelector('iframe')).toBeNull();
    await postFrom({ type: 'mosk-lab:state', flyId, state: checkpoint }, child);
    expect(onCheckpoint).not.toHaveBeenCalled();
  });
});
