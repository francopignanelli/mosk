import { useEffect, useRef, useState } from 'react';
import { BookOpen, Brain, Database, ExternalLink, RefreshCw } from 'lucide-react';
import type { ExperimentState } from '../shared/types';
import { isAssayCheckpoint, type AssayCheckpoint } from '../research/assay';
import { ConnectomeAtlas } from './ConnectomeAtlas';
import { Tutorial } from './Tutorial';
import './ResearchPanel.css';

export function ResearchPanel({
  state,
  readOnly,
  onCheckpoint,
}: {
  state: ExperimentState;
  readOnly: boolean;
  onCheckpoint: (checkpoint: AssayCheckpoint, generation: number) => void;
}) {
  const [view, setView] = useState<'memory' | 'atlas' | 'guide'>('memory');
  return (
    <section className="research-panel" aria-label="Research and learning">
      <div className="research-intro">
        <div>
          <span className="eyebrow">FROM PUBLISHED SCIENCE</span>
          <h2>A closer look at learning.</h2>
          <p>
            Inspect real anatomy and run a published memory circuit. Each source has its own role.
          </p>
        </div>
        <span className="research-specimen">
          {state.fly.name} <small>Life {String(state.generation).padStart(3, '0')}</small>
        </span>
      </div>
      <nav className="research-tabs" aria-label="Research views">
        <button className={view === 'memory' ? 'active' : ''} onClick={() => setView('memory')}>
          <Brain size={16} />
          Memory assay
        </button>
        <button className={view === 'atlas' ? 'active' : ''} onClick={() => setView('atlas')}>
          <Database size={16} />
          MaleCNS atlas
        </button>
        <button className={view === 'guide' ? 'active' : ''} onClick={() => setView('guide')}>
          <BookOpen size={16} />
          How to observe
        </button>
      </nav>
      {view === 'memory' ? (
        <>
          <div className="research-boundary">
            <strong>Two distinct experiments</strong>
            <p>
              The roaming fly uses the sensory utility controller. This assay runs the published
              Huang–Luo mushroom-body circuit with its fitted parameters. Its synaptic memory is
              saved with this life, but does not steer the roaming fly. Assay seconds follow the
              paper’s protocol.
            </p>
          </div>
          <MemoryAssay
            state={state}
            readOnly={readOnly || !state.fly.alive}
            onCheckpoint={onCheckpoint}
          />
          <p className="research-source">
            Published circuit:{' '}
            <a
              href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11525173/"
              target="_blank"
              rel="noreferrer"
            >
              Huang, Luo et al., Nature 2024 <ExternalLink size={12} />
            </a>{' '}
            ·{' '}
            <a href="/learning-lab/README.md" target="_blank" rel="noreferrer">
              Model, source & license
            </a>
            . This is a separate published model, not a simulation of the entire MaleCNS connectome.
          </p>
        </>
      ) : view === 'atlas' ? (
        <ConnectomeAtlas />
      ) : (
        <Tutorial />
      )}
    </section>
  );
}

export function MemoryAssay({
  state,
  readOnly,
  onCheckpoint,
}: {
  state: ExperimentState;
  readOnly: boolean;
  onCheckpoint: (checkpoint: AssayCheckpoint, generation: number) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(1050);
  const [retry, setRetry] = useState(0);
  const life = useRef({ world: state.world, id: crypto.randomUUID() });
  if (life.current.world !== state.world)
    life.current = { world: state.world, id: crypto.randomUUID() };
  const lifeId = life.current.id;
  const latest = useRef({ state, readOnly, onCheckpoint });
  latest.current = { state, readOnly, onCheckpoint };
  useEffect(() => {
    setReady(false);
    const restore = () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: 'mosk-lab:restore',
          flyId: lifeId,
          flyName: latest.current.state.fly.name,
          readOnly: latest.current.readOnly,
          state: latest.current.state.assay ?? null,
        },
        window.location.origin,
      );
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'mosk-lab:ready') {
        setReady(true);
        restore();
      }
      if (data.type === 'mosk-lab:height' && Number.isFinite(data.height))
        setHeight(Math.max(700, Math.min(2600, data.height)));
      if (
        data.type === 'mosk-lab:state' &&
        data.flyId === lifeId &&
        !latest.current.readOnly &&
        isAssayCheckpoint(data.state)
      )
        latest.current.onCheckpoint(data.state, latest.current.state.generation);
    };
    window.addEventListener('message', receive);
    restore();
    return () => window.removeEventListener('message', receive);
  }, [lifeId, retry]);
  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        { type: 'mosk-lab:context', flyId: lifeId, flyName: state.fly.name, readOnly },
        window.location.origin,
      );
  }, [readOnly, state.fly.name, ready, lifeId]);
  return (
    <div className="memory-assay-frame">
      {!ready && (
        <div className="assay-loading" role="status">
          Opening the published circuit…{' '}
          <button onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      {readOnly && (
        <p className="assay-readonly">
          This life’s saved memory is available for inspection. Training is disabled for a concluded
          life or a read-only observer.
        </p>
      )}
      <iframe
        key={`${lifeId}:${retry}`}
        ref={frame}
        title="Published mushroom-body memory assay and live synaptic log"
        src="/learning-lab/index.html"
        style={{ height }}
      />
    </div>
  );
}
