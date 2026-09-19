// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExperiment } from '../src/ui/useExperiment';
import { CHECKPOINT_KEY, IndexedDBStorage } from '../src/persistence/storage';
import {
  archiveGeneration,
  createExperiment,
  createSnapshot,
  stepExperiment,
} from '../src/simulation/engine';

let session: ReturnType<typeof useExperiment>;
let root: Root;
function SessionHarness() {
  session = useExperiment();
  return <span>{session.ready ? session.state.current.world.seed : 'loading'}</span>;
}
const mount = async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<SessionHarness />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(session.ready).toBe(true);
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  // Node 26 also exposes localStorage; use an isolated browser-shaped store here.
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('experiment session lifecycle', () => {
  it('renames and saves an individual without resetting its life or archived names', async () => {
    await mount();
    stepExperiment(session.state.current);
    const before = structuredClone(session.state.current);
    await act(async () => {
      await session.renameFly('  Luna 🪰  ');
    });
    expect(session.state.current).toEqual({ ...before, fly: { ...before.fly, name: 'Luna 🪰' } });
    expect((await new IndexedDBStorage().load())?.current.fly.name).toBe('Luna 🪰');
    await act(async () => {
      await session.newGeneration('named-next', 'adaptive', 'Sol');
    });
    expect(session.state.current.fly.name).toBe('Sol');
    expect(session.archives.current[0].finalState.fly.name).toBe('Luna 🪰');
    expect((await new IndexedDBStorage().load())?.archive[0].finalState.fly.name).toBe('Luna 🪰');
  });
  it('rejects invalid names before changing or archiving a life', async () => {
    await mount();
    const before = structuredClone(session.state.current);
    await act(async () => {
      await expect(session.renameFly('  ')).rejects.toThrow('1–32');
      await expect(session.newGeneration('invalid-name', 'random', 'x'.repeat(33))).rejects.toThrow(
        '1–32',
      );
    });
    expect(session.state.current).toEqual(before);
    expect(session.archives.current).toHaveLength(0);
  });
  it('imports atomically, pauses, and restores from the committed database', async () => {
    await mount();
    const snapshot = createSnapshot(createExperiment('imported', 7), []);
    await act(async () => {
      await session.importExperiment(snapshot);
    });
    expect(session.state.current.world.seed).toBe('imported');
    expect(session.running).toBe(false);
    expect((await new IndexedDBStorage().load())?.current).toEqual(snapshot.current);
  });
  it('serializes import after an outstanding save and blocks stale autosaves', async () => {
    await mount();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalSave = IndexedDBStorage.prototype.save;
    vi.spyOn(IndexedDBStorage.prototype, 'save').mockImplementationOnce(async function (
      this: IndexedDBStorage,
      snapshot,
    ) {
      await gate;
      return originalSave.call(this, snapshot);
    });
    let importing!: Promise<void>;
    await act(async () => {
      void session.save();
      importing = session.importExperiment(createSnapshot(createExperiment('race-safe', 8), []));
      await session.save();
    });
    await act(async () => {
      release();
      await importing;
    });
    expect((await new IndexedDBStorage().load())?.current.world.seed).toBe('race-safe');
  });
  it('keeps the current experiment if import storage fails', async () => {
    await mount();
    const previous = structuredClone(session.state.current);
    vi.spyOn(IndexedDBStorage.prototype, 'save').mockRejectedValueOnce(new Error('Quota exceeded'));
    await act(async () => {
      await expect(
        session.importExperiment(createSnapshot(createExperiment('rejected'), [])),
      ).rejects.toThrow();
    });
    expect(session.state.current).toEqual(previous);
    expect(session.running).toBe(true);
  });
  it('recovers a valid exit checkpoint even when IndexedDB is unavailable', async () => {
    const checkpoint = createSnapshot(createExperiment('recovered'), []);
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    vi.spyOn(IndexedDBStorage.prototype, 'load').mockRejectedValueOnce(new Error('Unavailable'));
    vi.spyOn(IndexedDBStorage.prototype, 'recover').mockRejectedValueOnce(new Error('Unavailable'));
    await mount();
    expect(session.state.current.world.seed).toBe('recovered');
    expect(session.error).toContain('Recovered the exit checkpoint');
  });
  it('recovers a newer complete interrupted upgrade and keeps every archive with autosaving enabled', async () => {
    const snapshot = createSnapshot(
      createExperiment('current-six', 6),
      Array.from({ length: 5 }, (_, index) =>
        archiveGeneration(createExperiment(`archive-${index}`, index + 1)),
      ),
    );
    const interrupted = JSON.parse(JSON.stringify(snapshot));
    for (const archive of interrupted.archive) {
      delete archive.finalState.world.terrainVersion;
      delete archive.finalState.world.legacyChunkKeys;
      delete archive.finalState.world.revealed;
    }
    await new IndexedDBStorage().save(interrupted);
    const older = createSnapshot(createExperiment('older-checkpoint', 5), []);
    older.savedAt = '2020-01-01T00:00:00.000Z';
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(older));
    await mount();
    expect(session.state.current.world.seed).toBe('current-six');
    expect(session.archives.current).toHaveLength(5);
    expect(session.error).toBe('');
    expect(session.saveStatus).toBe('Saved on this device');
    stepExperiment(session.state.current);
    await act(async () => {
      await session.save();
    });
    const saved = await new IndexedDBStorage().load();
    expect(saved?.current.tick).toBe(session.state.current.tick);
    expect(saved?.archive).toHaveLength(5);
  });
  it('does not fail a committed import when localStorage cleanup is blocked', async () => {
    await mount();
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    await act(async () => {
      await session.importExperiment(createSnapshot(createExperiment('committed'), []));
    });
    expect(session.state.current.world.seed).toBe('committed');
    expect(session.error).toBe('');
  });
  it('exports a JSON blob through a named download link', async () => {
    await mount();
    let download = '';
    let href = '';
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mosk-test');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      download = this.download;
      href = this.href;
    });
    session.exportExperiment();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(download).toMatch(/^mosk-generation-1-.*\.json$/);
    expect(href).toBe('blob:mosk-test');
  });
});
