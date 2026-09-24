import { useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import {
  Crosshair,
  Apple,
  Bug,
  Droplet,
  Expand,
  Hand,
  Infinity as InfinityIcon,
  Minus,
  Plus,
  Route,
  Waves,
} from 'lucide-react';
import type { ExperimentState } from '../shared/types';
import { renderWorld } from '../rendering/world';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  panCamera,
  viewBounds,
  wheelZoom,
  zoomCameraAt,
} from '../rendering/camera';
import { terrainAtCameraIsActive } from '../rendering/terrain';
import { chunkKeyAt } from '../world/generate';
import { MapVitals } from './MapVitals';
import type { InterventionKind } from '../world/interventions';
import './WorldView.css';

type Placement = { ok: true; message: string } | { ok: false; reason: string };

export function WorldView({
  state,
  editable,
  onIntervene,
}: {
  state: RefObject<ExperimentState>;
  editable: boolean;
  onIntervene: (kind: InterventionKind, point: { x: number; y: number }) => Placement;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [scent, setScent] = useState(false);
  const [trail, setTrail] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const [full, setFull] = useState(false);
  const [brush, setBrush] = useState<InterventionKind | null>(null);
  const [brushNotice, setBrushNotice] = useState('');
  const [, updateCameraUI] = useState(0);
  const center = useRef({ x: state.current.fly.x, y: state.current.fly.y });
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const stroke = useRef<{
    pointer: number;
    last: { x: number; y: number };
    placed: number;
  } | null>(null);
  const dimensions = useRef({ width: 1, height: 1 });
  const options = useRef({ scent, trail, zoom, follow });
  options.current = { scent, trail, zoom, follow };
  const currentWorld = state.current.world;
  useEffect(() => {
    center.current = { x: state.current.fly.x, y: state.current.fly.y };
    options.current.follow = true;
    setFollow(true);
    setBrush(null);
    setBrushNotice('');
  }, [currentWorld, state]);
  useEffect(() => {
    if (!editable) {
      setBrush(null);
      stroke.current = null;
    }
  }, [editable]);
  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const onWheel = (event: WheelEvent) => {
      if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
      event.preventDefault();
      const { width, height } = dimensions.current;
      const previousZoom = options.current.zoom;
      const nextZoom = wheelZoom(previousZoom, event.deltaY, event.deltaMode, height);
      if (nextZoom === previousZoom) return;
      if (!options.current.follow) {
        const rect = target.getBoundingClientRect();
        center.current = zoomCameraAt(
          center.current,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          width,
          height,
          previousZoom,
          nextZoom,
        );
      }
      options.current.zoom = nextZoom;
      setZoom(nextZoom);
    };
    // React's delegated wheel listener is passive; cancellation belongs only to this map.
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => target.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const resize = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dimensions.current = { width: rect.width, height: rect.height };
      target.width = Math.round(rect.width * dpr);
      target.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    resize.observe(target);
    const draw = () => {
      const { width, height } = dimensions.current;
      if (!document.hidden && width && height) {
        if (options.current.follow) {
          center.current.x += (state.current.fly.x - center.current.x) * 0.12;
          center.current.y += (state.current.fly.y - center.current.y) * 0.12;
        }
        renderWorld(ctx, width, height, state.current, {
          ...options.current,
          center: center.current,
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const onFull = () => setFull(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, [state]);
  const freeCamera = () => {
    options.current.follow = false;
    setFollow(false);
  };
  const moveCamera = (dx: number, dy: number) => {
    freeCamera();
    const { width, height } = dimensions.current;
    center.current = panCamera(
      center.current,
      dx,
      dy,
      viewBounds(width, height, options.current.zoom, center.current).scale,
    );
    updateCameraUI((v) => v + 1);
  };
  const worldAtPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { width, height } = dimensions.current;
    const bounds = viewBounds(width, height, options.current.zoom, center.current);
    return {
      x: bounds.left + (event.clientX - rect.left) / bounds.scale,
      y: bounds.top + (event.clientY - rect.top) / bounds.scale,
    };
  };
  const stamp = (kind: InterventionKind, point: { x: number; y: number }) => {
    const result = onIntervene(kind, point);
    setBrushNotice(result.ok ? result.message : result.reason);
    return result.ok;
  };
  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    if (brush && editable) {
      event.preventDefault();
      const point = worldAtPointer(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      stroke.current = {
        pointer: event.pointerId,
        last: point,
        placed: stamp(brush, point) ? 1 : 0,
      };
      return;
    }
    freeCamera();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const moveDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const painting = stroke.current;
    if (painting && painting.pointer === event.pointerId && brush && editable) {
      const point = worldAtPointer(event);
      const spacing = brush === 'spider' ? 140 : 70;
      if (
        painting.placed < 8 &&
        Math.hypot(point.x - painting.last.x, point.y - painting.last.y) >= spacing
      ) {
        painting.last = point;
        if (stamp(brush, point)) painting.placed++;
      }
      return;
    }
    const previous = drag.current;
    if (!previous || previous.pointer !== event.pointerId) return;
    moveCamera(event.clientX - previous.x, event.clientY - previous.y);
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const stopDrag = () => {
    drag.current = null;
    stroke.current = null;
  };
  const focusFly = () => {
    if (follow) freeCamera();
    else {
      center.current = { x: state.current.fly.x, y: state.current.fly.y };
      options.current.follow = true;
      setFollow(true);
    }
  };
  const stepZoom = (delta: number) => {
    const next = clampZoom(options.current.zoom + delta);
    options.current.zoom = next;
    setZoom(next);
  };
  const activeTerrain = terrainAtCameraIsActive(state.current.world, center.current);
  const scalePixels =
    100 *
    viewBounds(dimensions.current.width, dimensions.current.height, zoom, center.current).scale;
  return (
    <div
      className={`world-canvas ${follow ? 'following' : 'free-camera'} ${brush && editable ? 'painting' : ''}`}
      ref={container}
    >
      <canvas
        ref={canvas}
        role="img"
        tabIndex={0}
        aria-label={
          brush && editable
            ? `Paint ${brush} on revealed, active terrain. Click or drag to add objects. Press Escape to return to camera movement.`
            : "Infinite ecosystem revealed by the fly's exploration. Scroll the mouse wheel to zoom, drag or use arrow keys to pan, and press F to follow the fly. Zoom stays centered while following; in free camera it follows the pointer."
        }
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && brush) {
            event.preventDefault();
            setBrush(null);
            setBrushNotice('');
            return;
          }
          if (brush && editable && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            stamp(brush, center.current);
            return;
          }
          const movement: Record<string, [number, number]> = {
            ArrowLeft: [100, 0],
            ArrowRight: [-100, 0],
            ArrowUp: [0, 100],
            ArrowDown: [0, -100],
          };
          if (event.key in movement) {
            event.preventDefault();
            moveCamera(...movement[event.key]);
          }
          if (event.key.toLowerCase() === 'f') {
            event.preventDefault();
            center.current = { x: state.current.fly.x, y: state.current.fly.y };
            options.current.follow = true;
            setFollow(true);
          }
        }}
      />
      <div className="observer-tools" role="group" aria-label="Map intervention tools">
        <span className="observer-tools-label">ADD TO MAP</span>
        <button
          type="button"
          className={!brush ? 'active' : ''}
          onClick={() => {
            setBrush(null);
            setBrushNotice('');
          }}
          aria-label="Move map"
          aria-pressed={!brush}
          title="Move map · drag to pan"
        >
          <Hand size={14} /> <span>Move</span>
        </button>
        {(
          [
            { kind: 'food', label: 'Food', icon: Apple },
            { kind: 'water', label: 'Water', icon: Droplet },
            { kind: 'spider', label: 'Spider', icon: Bug },
          ] as const
        ).map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            className={brush === kind ? 'active' : ''}
            onClick={() => {
              setBrush(kind);
              setBrushNotice('Click or drag on revealed terrain.');
            }}
            disabled={!editable}
            aria-label={`Paint ${label.toLowerCase()} on map`}
            aria-pressed={brush === kind}
            title={
              editable
                ? `Paint ${label.toLowerCase()} · click or drag`
                : 'This life is not editable'
            }
          >
            <Icon size={14} /> <span>{label}</span>
          </button>
        ))}
      </div>
      {brush && editable && brushNotice && (
        <div className="observer-brush-notice" role="status">
          {brushNotice}
        </div>
      )}
      <div className="habitat-tag">
        <span className="eyebrow">
          <InfinityIcon size={12} /> UNBOUNDED HABITAT
        </span>
        <strong>The endless orchard</strong>
        <span>
          {follow
            ? `Following ${state.current.fly.name} · revealing the unknown`
            : activeTerrain
              ? `Explored terrain · F to follow ${state.current.fly.name}`
              : 'Unexplored · only the fly can reveal this area'}
        </span>
      </div>
      <span className="coordinate-tag">
        SECTOR {chunkKeyAt(state.current.world, center.current)}
        <br />
        {Math.round(center.current.x)} : {Math.round(center.current.y)}
      </span>
      <div className="map-controls">
        <div className="control-group">
          <button
            className={follow ? 'active' : ''}
            onClick={focusFly}
            title="Follow fly (F)"
            aria-label="Follow fly"
            aria-pressed={follow}
          >
            <Crosshair size={17} />
          </button>
          <button
            className={trail ? 'active' : ''}
            onClick={() => setTrail(!trail)}
            title="Movement trail"
            aria-label="Movement trail"
            aria-pressed={trail}
          >
            <Route size={17} />
          </button>
          <button
            className={scent ? 'active' : ''}
            onClick={() => setScent(!scent)}
            title="Food scent field"
            aria-label="Food scent field"
            aria-pressed={scent}
          >
            <Waves size={17} />
          </button>
        </div>
        <MapVitals vitals={state.current.fly.vitals} />
        <div className="control-group">
          <button onClick={() => stepZoom(-0.25)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => stepZoom(0.25)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <i />
          <button
            onClick={() => {
              if (full) void document.exitFullscreen();
              else void container.current?.requestFullscreen().catch(() => {});
            }}
            aria-label={full ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Expand size={16} />
          </button>
        </div>
      </div>
      <div className="scale-marker">
        <span style={{ width: `${scalePixels}px` }} />
        100 world units
      </div>
    </div>
  );
}
