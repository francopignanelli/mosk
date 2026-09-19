import {
  ArrowUpRight,
  BookOpen,
  Brain,
  ChevronDown,
  Clock3,
  Leaf,
  Route,
  ShieldAlert,
} from 'lucide-react';
import { formatTime } from '../shared/math';
import type { ArchivedGeneration, ExperimentState, MetricSample } from '../shared/types';
import { useId, useState } from 'react';
import { MemoryAssay } from './ResearchPanel';
import './JournalMemory.css';
export function HistoryChart({ history }: { history: MetricSample[] }) {
  const samples =
    history.length > 500
      ? history.filter((_, i) => i % Math.ceil(history.length / 500) === 0)
      : history;
  const path = (key: 'energy' | 'hunger' | 'hydration') =>
    samples
      .map(
        (s, i) =>
          `${i ? 'L' : 'M'} ${45 + (i / Math.max(1, samples.length - 1)) * 915} ${195 - s[key] * 1.7}`,
      )
      .join(' ');
  return (
    <div className="history-chart">
      <div className="chart-key">
        <span>
          <i style={{ background: '#9d80d7' }} />
          Energy
        </span>
        <span>
          <i style={{ background: '#d3b071' }} />
          Hunger
        </span>
        <span>
          <i style={{ background: '#7caebe' }} />
          Hydration
        </span>
      </div>
      {samples.length < 2 ? (
        <div className="chart-empty">
          Your history is taking shape.
          <small>The first readings appear after 10 seconds of simulation.</small>
        </div>
      ) : (
        <>
          <svg
            viewBox="0 0 985 220"
            role="img"
            aria-label="Energy, hunger and hydration over the life of this generation"
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <text x="0" y={199 - v * 1.7}>
                  {v}
                </text>
                <line x1="40" x2="970" y1={195 - v * 1.7} y2={195 - v * 1.7} />
              </g>
            ))}
            <path d={path('energy')} stroke="#9d80d7" />
            <path d={path('hunger')} stroke="#d3b071" />
            <path d={path('hydration')} stroke="#7caebe" />
          </svg>
          <div className="chart-times">
            <span>{formatTime(samples[0].time)}</span>
            <span>SIMULATED LIFETIME</span>
            <span>{formatTime(samples[samples.length - 1].time)}</span>
          </div>
        </>
      )}
    </div>
  );
}
export function EventList({ state, limit = 5 }: { state: ExperimentState; limit?: number }) {
  const icons = {
    birth: Leaf,
    food: Leaf,
    threat: ShieldAlert,
    rest: Clock3,
    death: ShieldAlert,
    generation: BookOpen,
    exploration: Route,
  };
  return (
    <div className="event-list">
      {state.events
        .slice(-limit)
        .reverse()
        .map((event, i) => {
          const Icon = icons[event.kind];
          return (
            <div className={`event event-${event.kind}`} key={`${event.id}-${i}`}>
              <span className="event-icon">
                <Icon size={15} />
              </span>
              <p>{event.message}</p>
              <time>{formatTime(event.time)}</time>
            </div>
          );
        })}
    </div>
  );
}
export function Journal({
  current,
  archive,
}: {
  current: ExperimentState;
  archive: ArchivedGeneration[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedArchive = selected === null ? undefined : archive[selected];
  const state = selectedArchive?.finalState ?? current;
  return (
    <div className="journal-view">
      <div className="journal-top">
        <div>
          <span className="eyebrow">EVERY LIFE LEAVES A TRACE</span>
          <h2>Experiment journal</h2>
        </div>
        <label className="generation-select">
          Viewing
          <select
            value={selected ?? 'current'}
            onChange={(e) =>
              setSelected(e.target.value === 'current' ? null : Number(e.target.value))
            }
          >
            <option value="current">
              {current.fly.name ?? 'MOSK'} · Generation {current.generation} · current
            </option>
            {archive.map((a, i) => (
              <option key={i} value={i}>
                {a.finalState.fly.name ?? 'MOSK'} · Generation {a.generation} · {a.seed}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="journal-stats">
        {[
          [Clock3, 'Survival time', formatTime(state.fly.age)],
          [Route, 'Distance travelled', `${(state.fly.distance / 1000).toFixed(2)} ku`],
          [Leaf, 'Food consumed', `${state.fly.foodEaten.toFixed(1)} portions`],
          [ShieldAlert, 'Predator encounters', state.fly.encounters.toString()],
        ].map(([Icon, label, value], i) => {
          const Symbol = Icon as typeof Clock3;
          return (
            <div key={i}>
              <Symbol size={18} />
              <span>{String(label)}</span>
              <strong>{String(value)}</strong>
            </div>
          );
        })}
      </div>
      <section className="surface journal-chart">
        <div className="section-title">
          <h3>{state.fly.name ?? 'MOSK'} · A life in signals</h3>
          <span>
            {selectedArchive?.cause ??
              (state.fly.alive ? 'Recording every 5 simulated seconds' : state.deathCause)}
          </span>
        </div>
        <HistoryChart history={state.history} />
      </section>
      {state.assay && (
        <SavedMemoryAssay
          key={`${selected ?? 'current'}:${state.generation}:${state.world.seed}`}
          state={state}
        />
      )}
      <div className="journal-bottom">
        <section className="surface">
          <div className="section-title">
            <h3>Field notes</h3>
            <span>{state.events.length} events</span>
          </div>
          <EventList state={state} limit={50} />
        </section>
        <section className="surface generations">
          <div className="section-title">
            <h3>Previous generations</h3>
            <BookOpen size={17} />
          </div>
          {archive.length === 0 ? (
            <div className="empty-history">
              <BookOpen size={28} />
              <strong>The first chapter.</strong>
              <p>When a new generation begins, this life and its observations will be kept here.</p>
            </div>
          ) : (
            archive.map((a, i) => (
              <button key={i} onClick={() => setSelected(i)}>
                <div>
                  <strong>
                    {a.finalState.fly.name ?? 'MOSK'} · Generation{' '}
                    {String(a.generation).padStart(3, '0')}
                  </strong>
                  <span>
                    {a.cause} · {formatTime(a.age)}
                  </span>
                  <span>
                    Mean energy {a.averageEnergy.toFixed(0)}% ·{' '}
                    {a.mode === 'adaptive' ? 'Utility model' : 'Random baseline'}
                  </span>
                </div>
                <ArrowUpRight size={18} />
              </button>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function SavedMemoryAssay({ state }: { state: ExperimentState }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <section className="surface journal-memory">
      <button
        className="journal-memory-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <Brain size={20} />
        <span>
          <strong>Inspect saved memory assay</strong>
          <small>{state.fly.name ?? 'MOSK'} · saved circuit state · read only</small>
        </span>
        <ChevronDown size={18} className={open ? 'expanded' : ''} />
      </button>
      <div id={contentId} role="region" aria-label="Saved memory assay inspection" hidden={!open}>
        {open && (
          <>
            <p className="journal-memory-explanation">
              This temporary replay reconstructs the weights saved with this life. Inspection does
              not change its checkpoint or train the roaming fly.
            </p>
            <MemoryAssay state={state} readOnly onCheckpoint={() => {}} />
          </>
        )}
      </div>
    </section>
  );
}
