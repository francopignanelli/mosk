import { useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Dna,
  Droplet,
  ExternalLink,
  Heart,
  Leaf,
  Maximize2,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  FlaskConical,
  RotateCcw,
  Shield,
  Sparkles,
  Sprout,
  X,
  Zap,
} from 'lucide-react';
import { useExperiment } from './ui/useExperiment';
import { WorldView } from './ui/WorldView';
import { BrainPanel } from './ui/BrainPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { EventList, Journal } from './ui/Journal';
import { Modal } from './ui/Modal';
import { formatTime } from './shared/math';
import { DEFAULT_FLY_NAME, flyNameError, normalizeFlyName } from './shared/flyName';
import { parseSnapshot } from './persistence/storage';
import type { BrainMode, Snapshot, Vitals } from './shared/types';
import './styles.css';

const vitals: {
  key: keyof Vitals;
  label: string;
  icon: typeof Zap;
  color: string;
  description: string;
}[] = [
  {
    key: 'energy',
    label: 'Energy',
    icon: Zap,
    color: '#a58bcc',
    description: 'Fuel for movement. Eating restores energy.',
  },
  {
    key: 'hunger',
    label: 'Hunger',
    icon: Leaf,
    color: '#ceae77',
    description: 'Higher means hungrier. Feeding reduces this drive.',
  },
  {
    key: 'hydration',
    label: 'Hydration',
    icon: Droplet,
    color: '#7eafc2',
    description: 'Water balance. Drinking replenishes it.',
  },
  {
    key: 'fatigue',
    label: 'Fatigue',
    icon: Moon,
    color: '#9a9fc1',
    description: 'Activity builds fatigue; staying still reduces it.',
  },
  {
    key: 'health',
    label: 'Health',
    icon: Heart,
    color: '#91b6a2',
    description:
      'Injury from bites or severe deprivation. Recovery requires rest and adequate reserves.',
  },
  {
    key: 'threat',
    label: 'Arousal',
    icon: Shield,
    color: '#ce9590',
    description: 'Immediate threat signal from the nearest detected spider.',
  },
];
function App() {
  const sim = useExperiment();
  const [tab, setTab] = useState<'observe' | 'journal' | 'research'>('observe');
  const [modal, setModal] = useState<'new' | 'about' | 'import' | 'rename' | null>(null);
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<BrainMode>('adaptive');
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<Snapshot | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState('');
  const state = sim.state.current;
  const fly = state.fly;
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
  };
  const openNew = () => {
    setSeed(`MOSK-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`);
    setMode('adaptive');
    setModal('new');
  };
  if (!sim.ready)
    return (
      <div className="loading-screen">
        <div className="brand-mark">m</div>
        <span className="wordmark">MOSK</span>
        <p>
          Restoring your little world<span className="loading-dots">…</span>
        </p>
        <small>Opening the experiment store</small>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <a
          className="brand-mark"
          href="#"
          aria-label="MOSK observatory"
          onClick={(e) => {
            e.preventDefault();
            setTab('observe');
          }}
        >
          m
        </a>
        <div className="rail-nav">
          <button
            className={tab === 'observe' ? 'selected' : ''}
            onClick={() => setTab('observe')}
            aria-label="Observatory"
            title="Observatory"
          >
            <Maximize2 size={20} />
          </button>
          <button
            className={tab === 'journal' ? 'selected' : ''}
            onClick={() => setTab('journal')}
            aria-label="Experiment journal"
            title="Experiment journal"
          >
            <BookOpen size={20} />
          </button>
          <button
            className={tab === 'research' ? 'selected' : ''}
            onClick={() => setTab('research')}
            aria-label="Research and learning"
            title="Research and learning"
          >
            <Dna size={21} />
          </button>
        </div>
        <button className="rail-help" onClick={() => setModal('about')} aria-label="About MOSK">
          <CircleHelp size={21} />
        </button>
        <span className="rail-version">V.01</span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="brand">
            <span className="wordmark">
              MOSK<span className="brand-period">.</span>
            </span>
            <span className="brand-divider" />
            <span className="brand-tagline">A small life, unfolding.</span>
          </div>
          <div className="topbar-right">
            <span className="experiment-number">
              EXPERIMENT {String(state.generation).padStart(3, '0')}
            </span>
            <button className="text-button" onClick={() => setModal('about')}>
              About the experiment <ExternalLink size={13} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow page-eyebrow">
                <span />
                AN ARTIFICIAL LIFE OBSERVATORY
              </div>
              <h1>
                {tab === 'observe'
                  ? 'Life, on its own terms.'
                  : tab === 'research'
                    ? 'From wiring to learning.'
                    : 'Small moments. A living history.'}
              </h1>
              <p>
                {tab === 'observe'
                  ? 'One autonomous fly. An endless world. Watch what happens next.'
                  : tab === 'research'
                    ? 'Published models. Observable memory. Reproducible experiments.'
                    : 'Follow the signals, encounters, and quiet decisions that make a life.'}
              </p>
            </div>
            <button
              className="button secondary new-generation"
              onClick={openNew}
              disabled={sim.readOnly}
            >
              <Plus size={16} />
              New generation
            </button>
          </div>
          <div className="tabs-row">
            <nav className="tabs" aria-label="Experiment views">
              <button
                className={tab === 'observe' ? 'active' : ''}
                onClick={() => setTab('observe')}
              >
                <Radio size={16} />
                Observatory
              </button>
              <button
                className={tab === 'journal' ? 'active' : ''}
                onClick={() => setTab('journal')}
              >
                <BookOpen size={16} />
                Experiment journal
                {sim.archives.current.length > 0 && (
                  <span className="count">{sim.archives.current.length}</span>
                )}
              </button>
              <button
                className={tab === 'research' ? 'active' : ''}
                onClick={() => setTab('research')}
              >
                <FlaskConical size={16} />
                Research & learning
              </button>
            </nav>
            <div className="data-actions">
              <button
                title="Import experiment"
                aria-label="Import experiment"
                onClick={() => file.current?.click()}
                disabled={sim.readOnly}
              >
                <ArrowUpFromLine size={15} />
                <span>Import</span>
              </button>
              <button
                aria-label="Export experiment"
                onClick={() => {
                  sim.exportExperiment();
                  notify('Experiment exported as JSON.');
                }}
              >
                <ArrowDownToLine size={15} />
                <span>Export experiment</span>
              </button>
            </div>
          </div>
          {sim.error && (
            <div className="error-banner" role="alert">
              <Shield size={18} />
              <p>{sim.error}</p>
              <button onClick={() => sim.setError('')} aria-label="Dismiss message">
                <X size={16} />
              </button>
            </div>
          )}
          {tab === 'observe' ? (
            <>
              <div className="observatory-grid">
                <section className="world-panel" aria-labelledby="world-title">
                  <div className="panel-header">
                    <div>
                      <span className={`status-dot ${sim.running && fly.alive ? '' : 'paused'}`} />
                      <h2 id="world-title">The living world</h2>
                      <span className="status-label">
                        {!fly.alive ? 'LIFE CONCLUDED' : sim.running ? 'LIVE' : 'PAUSED'}
                      </span>
                    </div>
                    <span className="seed-label">
                      SEED <strong>{state.world.seed}</strong>
                    </span>
                  </div>
                  <WorldView state={sim.state} />
                  <div className="world-footer">
                    <div className="world-legend">
                      <span>
                        <i className="legend-food" />
                        Food
                      </span>
                      <span>
                        <i className="legend-water" />
                        Water
                      </span>
                      <span>
                        <i className="legend-predator" />
                        Predator
                      </span>
                      <span>
                        <i className="legend-refuge" />
                        Refuge
                      </span>
                    </div>
                    <span className="world-note">
                      {state.world.exploredChunks.length} sectors explored
                    </span>
                  </div>
                  <div className="playback-bar">
                    <div className="playback-controls">
                      <button
                        className="play-button"
                        onClick={() => sim.setRunning(!sim.running)}
                        disabled={!fly.alive || sim.readOnly}
                        aria-label={sim.running ? 'Pause simulation' : 'Resume simulation'}
                      >
                        {sim.running && fly.alive ? (
                          <Pause size={15} fill="currentColor" />
                        ) : (
                          <Play size={15} fill="currentColor" />
                        )}
                      </button>
                      <div className="speed-controls" aria-label="Simulation speed">
                        {[1, 2, 5].map((speed) => (
                          <button
                            key={speed}
                            className={sim.speed === speed ? 'active' : ''}
                            onClick={() => sim.setSpeed(speed)}
                            aria-pressed={sim.speed === speed}
                          >
                            {speed}×
                          </button>
                        ))}
                      </div>
                      <span className="playback-divider" />
                      <span className="simulation-time">
                        {formatTime(fly.age)}
                        <small>SIMULATED TIME</small>
                      </span>
                    </div>
                    <span className="generation-tag">
                      <Sprout size={14} />
                      Generation {String(state.generation).padStart(3, '0')}
                    </span>
                  </div>
                </section>
                <BrainPanel
                  state={state}
                  onAbout={() => setModal('about')}
                  onResearch={() => setTab('research')}
                />
              </div>
              {!fly.alive && (
                <div className="death-banner">
                  <Leaf size={25} />
                  <div>
                    <strong>A small life, remembered.</strong>
                    <p>
                      {state.deathCause} after {formatTime(fly.age)}. This generation’s record is
                      preserved.
                    </p>
                  </div>
                  <button className="button primary" onClick={openNew}>
                    Begin a new life
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <section className="fly-state" aria-labelledby="fly-state-title">
                <div className="state-header">
                  <div>
                    <h2 id="fly-state-title">A moment in this life</h2>
                    <span>{fly.name ?? DEFAULT_FLY_NAME} · Internal state</span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setModal('rename')}
                    disabled={sim.readOnly}
                    aria-label={`Rename ${fly.name ?? DEFAULT_FLY_NAME}`}
                  >
                    <Pencil size={13} />
                    Name this fly
                  </button>
                </div>
                <div className="vitals-grid">
                  {vitals.map((v) => (
                    <div className="vital" key={v.key} title={v.description}>
                      <div className="vital-label">
                        <v.icon size={15} style={{ color: v.color }} />
                        <span>{v.label}</span>
                      </div>
                      <div className="vital-reading">
                        <strong>
                          {Math.round(fly.vitals[v.key])}
                          <small>%</small>
                        </strong>
                        <span>
                          {v.key === 'threat'
                            ? fly.vitals.threat > 30
                              ? 'Alert'
                              : 'Calm'
                            : v.key === 'health'
                              ? fly.vitals.health > 70
                                ? 'Healthy'
                                : 'Vulnerable'
                              : v.key === 'hunger'
                                ? fly.vitals.hunger > 65
                                  ? 'Hungry'
                                  : 'Satiated'
                                : v.key === 'fatigue'
                                  ? fly.vitals.fatigue > 60
                                    ? 'Tired'
                                    : 'Rested'
                                  : fly.vitals[v.key] > 50
                                    ? 'Balanced'
                                    : 'Low'}
                        </span>
                      </div>
                      <div
                        className="vital-track"
                        role="meter"
                        aria-label={v.label}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(fly.vitals[v.key])}
                      >
                        <div style={{ width: `${fly.vitals[v.key]}%`, background: v.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="observation-bottom">
                <section className="field-notes">
                  <div className="section-title">
                    <h3>
                      <Activity size={16} />
                      Field notes
                    </h3>
                    <button className="text-button" onClick={() => setTab('journal')}>
                      View journal
                      <ArrowUpFromLine size={13} className="diagonal-icon" />
                    </button>
                  </div>
                  <EventList state={state} limit={3} />
                </section>
                <div className="observation-note">
                  <span className="note-symbol">✳</span>
                  <div>
                    <h3>Observe. Don’t intervene.</h3>
                    <p>
                      Every turn, pause, and pursuit comes from the fly’s own sensory loop. You’re
                      here to watch a little life find its way.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : tab === 'research' ? (
            <ResearchPanel state={state} readOnly={sim.readOnly} onCheckpoint={sim.updateAssay} />
          ) : (
            <Journal current={state} archive={sim.archives.current} />
          )}
          <footer className="site-footer">
            <span>
              <span className="save-dot" />
              {sim.saveStatus}
            </span>
            <span>
              MOSK <span className="footer-slash">/</span> An ongoing experiment in artificial life{' '}
              <span className="footer-slash">/</span> v0.1
            </span>
            <button onClick={() => setModal('about')}>
              Made of signals, not certainty <ArrowUpRightIcon />
            </button>
          </footer>
        </main>
      </div>
      <input
        className="file-input"
        type="file"
        accept=".json,application/json"
        ref={file}
        aria-label="Choose experiment JSON"
        onChange={async (e) => {
          const chosen = e.target.files?.[0];
          e.target.value = '';
          if (!chosen) return;
          try {
            if (chosen.size > 50 * 1024 * 1024)
              throw new Error('Experiment files must be smaller than 50 MB.');
            const snapshot = parseSnapshot(await chosen.text());
            setPendingImport(snapshot);
            setModal('import');
          } catch (error) {
            sim.setError(
              error instanceof Error ? error.message : 'Could not read this experiment.',
            );
          }
        }}
      />
      {modal === 'new' && (
        <Modal title="A new little life." onClose={() => !busy && setModal(null)}>
          <p className="modal-intro">
            The current generation will be archived with all its observations. A new fly will enter
            a freshly generated world.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = normalizeFlyName(String(new FormData(e.currentTarget).get('fly-name')));
              setBusy(true);
              try {
                await sim.newGeneration(seed.trim() || 'MOSK-0042', mode, name);
                setModal(null);
                setTab('observe');
                notify('A new generation has entered the habitat.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <FlyNameField name={DEFAULT_FLY_NAME} />
            <label className="form-label" htmlFor="world-seed">
              World seed
            </label>
            <div className="seed-input">
              <input
                id="world-seed"
                maxLength={100}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                required
                autoComplete="off"
              />
              <button
                type="button"
                title="Generate a new seed"
                aria-label="Generate a new seed"
                onClick={() =>
                  setSeed(
                    `MOSK-${Math.floor(Math.random() * 999999)
                      .toString()
                      .padStart(6, '0')}`,
                  )
                }
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <p className="input-hint">Same seed + same brain = the same initial experiment.</p>
            <label className="form-label" htmlFor="brain-mode">
              Brain engine
            </label>
            <div className="select-wrap">
              <select
                id="brain-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as BrainMode)}
              >
                <option value="adaptive">Sensory utility model</option>
                <option value="random">Random baseline</option>
              </select>
              <ChevronDown size={16} />
            </div>
            <p className="input-hint">
              {mode === 'adaptive'
                ? 'An interpretable controller driven by local senses and internal needs.'
                : 'Seeded random movement with contact feeding. A simple comparison agent.'}{' '}
              Neither mode uses MaleCNS data.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Keep observing
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? 'Preparing…' : 'Begin generation'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'rename' && (
        <Modal title="Name this little life." onClose={() => !busy && setModal(null)}>
          <p className="modal-intro">
            Give this individual a name. Its age, controller state, world, and observations continue
            from the same moment.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = normalizeFlyName(String(new FormData(e.currentTarget).get('fly-name')));
              setBusy(true);
              try {
                await sim.renameFly(name);
                setModal(null);
                notify(`This little life is now called ${name}.`);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FlyNameField name={fly.name ?? DEFAULT_FLY_NAME} />
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save name'}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'import' && pendingImport && (
        <Modal title="Continue another experiment" onClose={() => !busy && setModal(null)}>
          <p className="modal-intro">
            Generation {pendingImport.current.generation} · {pendingImport.current.world.seed}
            <br />
            {formatTime(pendingImport.current.fly.age)} lived · {pendingImport.archive.length}{' '}
            archived generations.
          </p>
          <div className="import-notice">
            Importing replaces the experiment on this device, including its archive. Export your
            current experiment first if you want to keep it.
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={sim.exportExperiment}>
              <ArrowDownToLine size={16} />
              Export current
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await sim.importExperiment(pendingImport);
                  setModal(null);
                  notify('Experiment restored. Press play to continue.');
                } catch {
                  sim.setError('Import could not be saved. The current experiment is unchanged.');
                  setModal(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import & pause
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="A life made of signals." onClose={() => setModal(null)} wide>
          <div className="about-badge">
            <Sparkles size={14} />
            MOSK · EXPERIMENTAL ARTIFICIAL LIFE
          </div>
          <p className="modal-intro">
            MOSK is a digital terrarium for an autonomous virtual fruit fly. It is an experiment in
            behavior, not a claim to simulate a complete biological animal.
          </p>
          <div className="method-flow">
            <span>World</span>
            <ArrowRight />
            <span>Senses</span>
            <ArrowRight />
            <span>Brain</span>
            <ArrowRight />
            <span>Actions</span>
          </div>
          <h3>The brain running today</h3>
          <p>
            The sensory utility model weighs local food and water cues, nearby danger, hunger,
            thirst, and fatigue. Explicit rules with hysteresis choose feeding, drinking,
            exploration, escape, and rest. The random baseline provides a seeded comparison.
          </p>
          <p>
            The activity panel shows 18 actual controller values. Small satellite points belong to
            the same channel; they are visual glyphs, not extra neurons. Edges describe signal
            relationships, not anatomical connections. This roaming controller has no neural
            learning. The Research & learning view contains a separate published memory circuit with
            real plasticity variables and its own readout.
          </p>
          <h3>Where MaleCNS fits</h3>
          <p>
            MaleCNS v1.0 is a reconstruction of an adult male fruit fly’s central nervous system.
            The reference atlas now includes source-identified cells from the official annotation
            dataset, with provenance and attribution. That atlas is anatomy, not simulated neural
            activity. The full connection graph does not control the roaming fly.
          </p>
          <div className="source-links">
            <a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">
              MaleCNS project
              <ExternalLink size={14} />
            </a>
            <a href="https://male-cns.janelia.org/download/" target="_blank" rel="noreferrer">
              Dataset & CC BY 4.0 license
              <ExternalLink size={14} />
            </a>
            <a
              href="https://github.com/philshiu/Drosophila_brain_model"
              target="_blank"
              rel="noreferrer"
            >
              Shiu model · female FlyWire
              <ExternalLink size={14} />
            </a>
          </div>
          <h3>Continuity, with care</h3>
          <p>
            The world is generated from its seed as the fly explores. Nearby terrain is active;
            distant animals pause, and food cycles and pond refill catch up when a sector is
            revisited. Terrain unfolds around the fly through soft exploration fog. Drag to revisit
            discovered places, or press F to follow. Panning never reveals new territory. This map
            is the observer’s record; it does not give the controller spatial memory.
          </p>
          <h3>A refuge with limits</h3>
          <p>
            The leafy inner circle represents dense cover with openings too small for spiders.
            Inside it, spiders cannot enter, see or bite the fly, and pursuit stops. The outer rim
            only reduces detection, so it remains risky. Hunger and thirst continue in cover, and
            newly generated refuges contain no food or water: safety buys recovery time, not an
            unlimited life. This is a designed habitat mechanic, not a measured biological model.
          </p>
          <p>
            Fruit is consumed or decays, then fresh fruit ripens at a new location. Ponds refill
            slowly. One spider can pursue for up to eight simulation seconds, followed by twelve
            seconds before another chase can begin. Close contact can still leave injuries. Health
            recovers slowly during rest with adequate food, water and energy. A healthy survivor can
            still remain at 100%. These rates are habitat balance settings, not measurements from
            the brain model.
          </p>
          <h3>Memory and lifespan</h3>
          <p>
            Reloading restores the same life and its controller state. A new life starts a fresh
            controller; archived experience is not inherited. A published Huang–Luo memory assay can
            be run separately and saved with this life. Its checkpoint reconstructs the same learned
            synaptic changes; its memory does not guide the roaming fly. Aging is not currently
            modeled, so there is no fixed maximum lifespan if the fly can meet its needs and avoid
            injury.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setModal(null);
              setTab('research');
            }}
          >
            <FlaskConical size={16} />
            Open research, memory & tutorial
          </button>
          <p>
            Snapshots save on this device every 10 seconds and when the page becomes hidden. Time
            stops while you are away. Death ends a life; a new generation preserves its complete
            saved history. Export JSON to move an experiment between devices. Clear browser data and
            local saves will be lost.
          </p>
          <p className="method-footnote">
            World units and time are simulation units. Physiology, environmental cues, and predator
            behavior are designed abstractions, not calibrated biological measurements.
          </p>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ExternalLink size={12} />;
}
function FlyNameField({ name }: { name: string }) {
  return (
    <>
      <label className="form-label" htmlFor="fly-name">
        Fly name
      </label>
      <div className="seed-input">
        <input
          id="fly-name"
          name="fly-name"
          defaultValue={name}
          required
          autoComplete="off"
          aria-describedby="fly-name-hint"
          onChange={(e) => e.currentTarget.setCustomValidity(flyNameError(e.currentTarget.value))}
        />
      </div>
      <p className="input-hint" id="fly-name-hint">
        1–32 characters. Names are saved with each individual life.
      </p>
    </>
  );
}
export default App;
