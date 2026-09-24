import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../simulation/config';
import { isAssayCheckpoint, type AssayCheckpoint } from '../research/assay';
import {
  archiveGeneration,
  createExperiment,
  createSnapshot,
  stepExperiment,
} from '../simulation/engine';
import {
  CHECKPOINT_KEY,
  IndexedDBStorage,
  parseSnapshot,
  recoverSnapshot,
} from '../persistence/storage';
import type { ArchivedGeneration, BrainMode, Snapshot } from '../shared/types';
import { DEFAULT_FLY_NAME, normalizeFlyName } from '../shared/flyName';
import { placeIntervention, type InterventionKind } from '../world/interventions';
import type { Vec2 } from '../shared/types';

export function useExperiment() {
  const [initialState] = useState(() => createExperiment());
  const state = useRef(initialState);
  const archives = useRef<ArchivedGeneration[]>([]);
  const storage = useRef(new IndexedDBStorage());
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [, render] = useState(0);
  const [saveStatus, setSaveStatus] = useState('Restoring experiment');
  const [error, setError] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const enabled = useRef(false);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const importing = useRef(false);
  const lockLifetime = useRef<Promise<unknown>>(Promise.resolve());
  runningRef.current = running;
  speedRef.current = speed;
  const save = () => {
    if (!enabled.current || importing.current) return Promise.resolve();
    const snapshot = createSnapshot(state.current, archives.current);
    setSaveStatus('Saving…');
    saving.current = saving.current
      .catch(() => {})
      .then(() => storage.current.save(snapshot))
      .then(() => {
        setSaveStatus('Saved on this device');
        setError('');
      })
      .catch(() => {
        setSaveStatus('Save unavailable');
        setError('Your browser could not save this experiment. Export a copy to keep it.');
      });
    return saving.current;
  };
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    const restore = async () => {
      // Fast Refresh retains the live refs: never replace them with an older disk save.
      if (ready) {
        const wasRunning = runningRef.current;
        importing.current = true;
        runningRef.current = false;
        setRunning(false);
        try {
          const snapshot = recoverSnapshot(createSnapshot(state.current, archives.current));
          // Preserve the current in-memory life before attempting a database repair.
          try {
            localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(snapshot));
          } catch {
            /* The atomic database recovery can still succeed. */
          }
          const commit = saving.current
            .catch(() => {})
            .then(() => {
              // A ref may hold a pre-upgrade class instance without the new recovery API.
              // Replace it only after preceding writes finish, preserving their ordering.
              storage.current = new IndexedDBStorage();
              return storage.current.recover(snapshot);
            });
          saving.current = commit;
          await commit;
          if (disposed) return;
          state.current = snapshot.current;
          archives.current = snapshot.archive;
          enabled.current = true;
          setReadOnly(false);
          setSaveStatus('Saved on this device');
          setError('');
        } catch {
          if (disposed) return;
          enabled.current = false;
          setSaveStatus('Recovery pending');
          setError(
            'Your current life and archives are still open. Database recovery failed; export a copy before leaving.',
          );
        } finally {
          importing.current = false;
          if (!disposed) {
            runningRef.current = wasRunning;
            setRunning(wasRunning);
          }
        }
        return;
      }
      let checkpoint: Snapshot | null = null;
      let checkpointError = false;
      try {
        const raw = localStorage.getItem(CHECKPOINT_KEY);
        if (raw) checkpoint = parseSnapshot(raw);
      } catch {
        checkpointError = true;
      }
      let selected = checkpoint;
      try {
        const stored = await storage.current.load();
        const latest =
          checkpoint && (!stored || Date.parse(checkpoint.savedAt) > Date.parse(stored.savedAt))
            ? checkpoint
            : stored;
        selected = latest;
        if (disposed) return;
        if (latest) {
          state.current = latest.current;
          archives.current = latest.archive;
        }
        enabled.current = true;
        setReadOnly(false);
        setSaveStatus(latest ? 'Restored from this device' : 'Saved on this device');
        if (checkpointError)
          setError(
            'The exit checkpoint was unavailable. MOSK restored the latest valid database save.',
          );
        await storage.current.save(createSnapshot(state.current, archives.current));
      } catch {
        if (disposed) return;
        // A complete transitional database record may be newer than the exit checkpoint.
        // Validation is strict for each recognized world format before any migration.
        try {
          const raw = await storage.current.loadRaw();
          const recovered = raw ? recoverSnapshot(raw) : null;
          if (
            recovered &&
            (!selected || Date.parse(recovered.savedAt) > Date.parse(selected.savedAt))
          )
            selected = recovered;
        } catch {
          /* Preserve unreadable data in the backup if a valid checkpoint can recover it. */
        }
        if (disposed) return;
        if (selected) {
          state.current = selected.current;
          archives.current = selected.archive;
          try {
            await storage.current.recover(selected);
            if (disposed) return;
            enabled.current = true;
            setSaveStatus('Saved on this device');
            setError('');
            setReady(true);
            return;
          } catch {
            /* Keep the validated recovered life open if storage itself is unavailable. */
          }
        }
        if (disposed) return;
        setError(
          selected
            ? 'Recovered the exit checkpoint. Database storage is unavailable; export a copy before leaving.'
            : 'Saved data could not be read. This session is temporary; export it before leaving. Import a valid snapshot to resume saving.',
        );
        setSaveStatus('Temporary session');
        enabled.current = false;
      }
      if (!disposed) setReady(true);
    };
    if (navigator.locks) {
      lockLifetime.current = lockLifetime.current.then(() =>
        navigator.locks.request('mosk-single-writer', { ifAvailable: true }, async (lock) => {
          if (disposed) return;
          if (!lock) {
            setReadOnly(true);
            setRunning(false);
            // A second observer should see a saved life, not a fresh placeholder fly.
            try {
              const snapshot = await storage.current.load();
              if (disposed) return;
              if (snapshot) {
                state.current = snapshot.current;
                archives.current = snapshot.archive;
              }
            } catch {
              /* Keep this observer read-only if storage is unavailable. */
            }
            setSaveStatus('Open in another tab');
            setError(
              'MOSK is running in another tab. This is the latest saved snapshot. Close the other tab and reload here to continue.',
            );
            setReady(true);
            return;
          }
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          await restore();
          if (!disposed) await held;
        }),
      );
    } else void restore();
    return () => {
      disposed = true;
      enabled.current = false;
      release?.();
    };
  }, []);
  useEffect(() => {
    if (!ready || readOnly) return;
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let lastUI = previous;
    const animate = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.2);
      previous = now;
      if (runningRef.current && !document.hidden) {
        accumulator += elapsed * speedRef.current;
        while (accumulator >= CONFIG.dt) {
          stepExperiment(state.current);
          accumulator -= CONFIG.dt;
        }
      } else accumulator = 0;
      if (now - lastUI > 100) {
        render((v) => v + 1);
        lastUI = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const checkpoint = () => {
      if (enabled.current && !importing.current) {
        try {
          localStorage.setItem(
            CHECKPOINT_KEY,
            JSON.stringify(createSnapshot(state.current, archives.current)),
          );
        } catch {
          setSaveStatus('Exit checkpoint unavailable');
        }
      }
      void save();
    };
    const visibility = () => {
      previous = performance.now();
      accumulator = 0;
      if (document.hidden) checkpoint();
    };
    const interval = setInterval(() => void save(), CONFIG.autoSaveMs);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', checkpoint);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', checkpoint);
    };
  }, [ready, readOnly]);
  const newGeneration = async (seed: string, mode: BrainMode, name = DEFAULT_FLY_NAME) => {
    if (readOnly) return;
    const next = createExperiment(seed, state.current.generation + 1, mode, name);
    archives.current = [...archives.current, archiveGeneration(state.current)];
    state.current = next;
    setRunning(true);
    render((v) => v + 1);
    await save();
  };
  const renameFly = async (name: string) => {
    if (readOnly) return;
    state.current.fly.name = normalizeFlyName(name);
    render((v) => v + 1);
    await save();
  };
  const addMapIntervention = (kind: InterventionKind, point: Vec2) => {
    if (readOnly || !enabled.current || importing.current)
      return { ok: false as const, reason: 'This experiment is not editable in this tab.' };
    const result = placeIntervention(state.current, kind, point);
    if (result.ok) {
      render((v) => v + 1);
      void save();
    }
    return result;
  };
  const updateAssay = (checkpoint: AssayCheckpoint, generation: number) => {
    if (
      readOnly ||
      importing.current ||
      generation !== state.current.generation ||
      !state.current.fly.alive
    )
      return;
    if (!isAssayCheckpoint(checkpoint)) return;
    state.current.assay = structuredClone(checkpoint);
    render((v) => v + 1);
    void save();
  };
  const importExperiment = async (snapshot: Snapshot) => {
    if (readOnly) return;
    importing.current = true;
    const wasRunning = runningRef.current;
    runningRef.current = false;
    setRunning(false);
    // Import shares the writer queue and blocks new autosaves until the commit finishes.
    const imported = { ...structuredClone(snapshot), savedAt: new Date().toISOString() };
    const commit = saving.current.catch(() => {}).then(() => storage.current.save(imported));
    saving.current = commit;
    try {
      await commit;
      state.current = imported.current;
      archives.current = imported.archive;
      enabled.current = true;
      try {
        localStorage.removeItem(CHECKPOINT_KEY);
      } catch {
        /* A newer database save takes precedence. */
      }
      setError('');
      setSaveStatus('Imported · paused');
      render((v) => v + 1);
    } catch (error) {
      runningRef.current = wasRunning;
      setRunning(wasRunning);
      throw error;
    } finally {
      importing.current = false;
    }
  };
  const exportExperiment = () => {
    const blob = new Blob(
      [JSON.stringify(createSnapshot(state.current, archives.current), null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mosk-generation-${state.current.generation}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  return {
    state,
    archives,
    ready,
    running,
    setRunning,
    speed,
    setSpeed,
    saveStatus,
    error,
    setError,
    readOnly,
    save,
    newGeneration,
    renameFly,
    placeIntervention: addMapIntervention,
    updateAssay,
    importExperiment,
    exportExperiment,
  };
}
