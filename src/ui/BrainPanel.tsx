import { Activity, ArrowUpRight, ChevronRight, Pin, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { BRAIN_EDGES, brainNodes } from '../brain/engine';
import { SIGNAL_DETAILS } from '../brain/signals';
import type { ExperimentState } from '../shared/types';
const positions = [
  [66, 59],
  [41, 103],
  [54, 153],
  [51, 204],
  [72, 248],
  [100, 283],
  [180, 47],
  [208, 95],
  [177, 144],
  [213, 194],
  [183, 243],
  [206, 288],
  [301, 61],
  [331, 106],
  [313, 155],
  [339, 204],
  [312, 253],
  [287, 286],
];
export function BrainPanel({
  state,
  onAbout,
  onResearch,
}: {
  state: ExperimentState;
  onAbout: () => void;
  onResearch?: () => void;
}) {
  const nodes = brainNodes(state.brain);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const nodeElements = useRef<(SVGGElement | null)[]>([]);
  const selectedId = hoveredId ?? focusedId ?? pinnedId;
  const selected = nodes.find((node) => node.id === selectedId);
  const details = selected ? SIGNAL_DETAILS[selected.id] : null;
  const dismissInspector = () => {
    setHoveredId(null);
    setFocusedId(null);
    setPinnedId(null);
  };
  const activity = nodes.reduce((s, n) => s + n.value, 0) / nodes.length;
  const signal = useRef<{ tick: number; generation: number; seed: string; values: number[] }>({
    tick: -1,
    generation: state.generation,
    seed: state.world.seed,
    values: [],
  });
  if (
    signal.current.generation !== state.generation ||
    signal.current.seed !== state.world.seed ||
    signal.current.tick > state.tick
  ) {
    signal.current = { tick: -1, generation: state.generation, seed: state.world.seed, values: [] };
  }
  if (signal.current.tick !== state.tick) {
    signal.current.tick = state.tick;
    signal.current.values.push(activity);
    if (signal.current.values.length > 100) signal.current.values.shift();
  }
  const activeCount = nodes.filter((n) => n.value > 0.3).length;
  const color = (layer: string) =>
    layer === 'sensory' ? '#a896e8' : layer === 'drive' ? '#bc91d7' : '#8bc2b8';
  return (
    <section
      className="brain-panel"
      aria-labelledby="brain-title"
      onPointerLeave={() => setHoveredId(null)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismissInspector();
      }}
    >
      <div className="brain-header">
        <div>
          <span className="eyebrow">INSIDE THE LITTLE MIND</span>
          <h2 id="brain-title">
            Brain activity <Activity size={18} />
          </h2>
        </div>
        <button className="dark-icon" onClick={onAbout} aria-label="About the brain model">
          <ArrowUpRight size={20} />
        </button>
      </div>
      <button className="model-badge" onClick={onAbout}>
        <span />
        {state.brain.mode === 'adaptive' ? 'SENSORY UTILITY MODEL' : 'RANDOM BASELINE'}
        <ChevronRight size={13} />
      </button>
      <div className="brain-visual">
        <div className="brain-columns">
          <span>SENSORY</span>
          <span>DRIVE</span>
          <span>MOTOR</span>
        </div>
        <svg
          viewBox="0 0 380 320"
          role="group"
          aria-label={`18 controller signal channels, ${activeCount} above 30 percent activation. This is not a biological connectome.`}
        >
          <defs>
            <radialGradient id="brain-halo">
              <stop offset="0" stopColor="#b39ce8" stopOpacity=".10" />
              <stop offset="1" stopColor="#b39ce8" stopOpacity="0" />
            </radialGradient>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <ellipse cx="190" cy="163" rx="180" ry="155" fill="url(#brain-halo)" />
          <path
            d="M123 28C9 29 10 120 31 176C-6 269 71 309 135 292M254 28C367 32 370 125 349 183C377 272 313 309 256 294"
            fill="none"
            stroke="#8875a2"
            strokeOpacity=".16"
            strokeDasharray="2 6"
          />
          {BRAIN_EDGES.map((edge, i) => {
            const from = nodes.findIndex((n) => n.id === edge.source);
            const to = nodes.findIndex((n) => n.id === edge.target);
            const a = positions[from];
            const b = positions[to];
            const strength = Math.min(nodes[from].value, nodes[to].value);
            const related = edge.source === selectedId || edge.target === selectedId;
            return (
              <path
                key={i}
                d={`M${a[0]} ${a[1]} C${(a[0] + b[0]) / 2} ${a[1]}, ${(a[0] + b[0]) / 2} ${b[1]}, ${b[0]} ${b[1]}`}
                stroke={edge.weight < 0 ? '#d59eac' : color(nodes[to].layer)}
                strokeWidth={(related ? 1.7 : 0.7) + strength * 1.8}
                strokeOpacity={selectedId ? (related ? 0.9 : 0.08) : 0.14 + strength * 0.8}
                strokeDasharray={edge.weight < 0 ? '3 4' : undefined}
                fill="none"
              />
            );
          })}
          {nodes.map((node, i) => {
            const [x, y] = positions[i];
            return (
              <g
                key={node.id}
                ref={(element) => {
                  nodeElements.current[i] = element;
                }}
                className={`brain-node${selectedId === node.id ? ' is-selected' : ''}`}
                role="button"
                tabIndex={keyboardIndex === i ? 0 : -1}
                aria-label={`${node.label}, ${node.layer} signal. Inspect activity.`}
                aria-pressed={pinnedId === node.id}
                aria-controls="brain-node-inspector"
                aria-describedby={selectedId === node.id ? 'brain-node-summary' : undefined}
                onPointerEnter={() => setHoveredId(node.id)}
                onFocus={() => {
                  setFocusedId(node.id);
                  setKeyboardIndex(i);
                }}
                onBlur={() => setFocusedId(null)}
                onClick={() => {
                  setPinnedId(pinnedId === node.id ? null : node.id);
                  setHoveredId(node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setPinnedId(pinnedId === node.id ? null : node.id);
                    setFocusedId(node.id);
                    return;
                  }
                  let next = i;
                  if (event.key === 'ArrowDown') next = (i + 1) % nodes.length;
                  else if (event.key === 'ArrowUp') next = (i + nodes.length - 1) % nodes.length;
                  else if (event.key === 'ArrowRight') next = (i + 6) % nodes.length;
                  else if (event.key === 'ArrowLeft') next = (i + nodes.length - 6) % nodes.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = nodes.length - 1;
                  else return;
                  event.preventDefault();
                  setHoveredId(null);
                  nodeElements.current[next]?.focus();
                }}
              >
                <circle className="brain-node-hit" cx={x} cy={y} r={18} fill="transparent" />
                <circle
                  className="brain-node-ring"
                  cx={x}
                  cy={y}
                  r={11}
                  fill="none"
                  stroke={color(node.layer)}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={7 + node.value * 8}
                  fill={color(node.layer)}
                  opacity={node.value * 0.19}
                  filter="url(#node-glow)"
                />
                {[0, 1, 2, 3].map((j) => {
                  const angle = j * 1.57 + i * 0.75;
                  const sx = x + Math.cos(angle) * (13 + (i % 3) * 3);
                  const sy = y + Math.sin(angle) * (13 + (i % 3) * 3);
                  return (
                    <g key={j}>
                      <line
                        x1={x}
                        y1={y}
                        x2={sx}
                        y2={sy}
                        stroke={color(node.layer)}
                        strokeOpacity={0.1 + node.value * 0.22}
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r={1.3 + node.value * 0.7}
                        fill={color(node.layer)}
                        opacity={0.15 + node.value * 0.65}
                      />
                    </g>
                  );
                })}
                <circle
                  cx={x}
                  cy={y}
                  r={3 + node.value * 2.5}
                  fill={color(node.layer)}
                  opacity={0.3 + node.value * 0.7}
                />
                <circle cx={x} cy={y} r={1.2} fill="#fff" opacity={node.value} />
              </g>
            );
          })}
        </svg>
        <div className="brain-legend">
          <span>
            <i style={{ background: '#a896e8' }} />
            Sensory input
          </span>
          <span>
            <i style={{ background: '#bc91d7' }} />
            Motivation
          </span>
          <span>
            <i style={{ background: '#8bc2b8' }} />
            Motor output
          </span>
        </div>
        <p className="brain-inspect-hint">
          Hover, focus or tap a signal to inspect · arrow keys to move
        </p>
      </div>
      <div className="brain-readout">
        <div className="brain-default-readout" aria-hidden={selected ? true : undefined}>
          <div className="signal-strip">
            <span>SIGNAL ACTIVITY</span>
            <svg
              viewBox="0 0 200 34"
              preserveAspectRatio="none"
              aria-label="Recent mean channel activity"
            >
              <path
                d={signal.current.values
                  .map(
                    (v, i, all) =>
                      `${i ? 'L' : 'M'}${(i * 200) / Math.max(1, all.length - 1)} ${31 - v * 55}`,
                  )
                  .join(' ')}
                fill="none"
                stroke="#b5a2e8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <strong>
              {Math.round(activity * 100)}
              <small>%</small>
            </strong>
          </div>
          <div className="brain-output">
            <div>
              <span className="eyebrow">CURRENT INTENT</span>
              <strong>
                <span className={state.fly.alive ? 'pulse-dot' : ''} />
                {state.fly.action}
              </strong>
            </div>
            <span className="output-note">
              {activeCount} / 18
              <br />
              channels active
            </span>
          </div>
          <p className="brain-disclaimer">
            Roaming controller · designed signals.
            <br />
            Map placements can change these values when sensed locally.
            <br />
            They do not train the separate memory assay. MaleCNS anatomy is in the research atlas.
          </p>
          {onResearch && (
            <button className="brain-research-link" onClick={onResearch}>
              {state.assay
                ? `Memory assay · bout ${state.assay.cursor}`
                : 'Explore memory & real anatomy'}
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
        {selected && details && (
          <aside
            className="brain-node-inspector"
            id="brain-node-inspector"
            aria-label={`${selected.label} signal details`}
          >
            <div className="brain-inspector-heading">
              <div>
                <span>{details.type}</span>
                <h3>
                  {selected.label}{' '}
                  <strong>
                    {Math.round(selected.value * 100)}
                    <small>%</small>
                  </strong>
                </h3>
              </div>
              <div className="brain-inspector-actions">
                <button
                  aria-label={
                    pinnedId === selected.id ? 'Unpin signal details' : 'Pin signal details'
                  }
                  aria-pressed={pinnedId === selected.id}
                  onClick={() => setPinnedId(pinnedId === selected.id ? null : selected.id)}
                >
                  <Pin size={14} />
                </button>
                <button aria-label="Close signal details" onClick={dismissInspector}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div
              className="brain-inspector-content"
              tabIndex={0}
              aria-label="Signal explanation; scroll for connections"
            >
              <p id="brain-node-summary">{details.description}</p>
              <p>
                <b>Reads:</b> {details.source}
              </p>
              <p className="brain-signal-smoothing">
                Activation is smoothed for display; it is not a firing rate.
              </p>
              <dl>
                <dt>Illustrated inputs</dt>
                <dd>
                  {BRAIN_EDGES.filter((edge) => edge.target === selected.id)
                    .map(
                      (edge) =>
                        `${nodes.find((node) => node.id === edge.source)?.label}${edge.weight < 0 ? ' (reduces)' : ''}`,
                    )
                    .join(' · ') ||
                    (selected.layer === 'sensory' || selected.id === 'contact'
                      ? 'Body or environment'
                      : 'Current controller state')}
                </dd>
                <dt>Illustrated influences</dt>
                <dd>
                  {BRAIN_EDGES.filter((edge) => edge.source === selected.id)
                    .map(
                      (edge) =>
                        `${nodes.find((node) => node.id === edge.target)?.label}${edge.weight < 0 ? ' (reduces)' : ''}`,
                    )
                    .join(' · ') || 'Movement or body action; no outgoing diagram links'}
                </dd>
              </dl>
              <p className="brain-signal-caveat">
                {state.brain.mode === 'random'
                  ? 'In Random baseline, needs are monitored but most do not guide decisions. '
                  : ''}
                These are controller signals, not biological neurons. Links illustrate
                relationships; they do not run a neural network. Small surrounding dots repeat the
                same signal.
              </p>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
