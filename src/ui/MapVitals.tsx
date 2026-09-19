import { Droplet, Heart, Leaf, Moon, Shield, Zap } from 'lucide-react';
import type { Vitals } from '../shared/types';

const indicators = [
  { key: 'energy', label: 'Energy', icon: Zap, color: '#9774bc' },
  { key: 'hunger', label: 'Hunger', icon: Leaf, color: '#ae864a' },
  { key: 'hydration', label: 'Hydration', icon: Droplet, color: '#6398ad' },
  { key: 'fatigue', label: 'Fatigue', icon: Moon, color: '#8388b0' },
  { key: 'health', label: 'Health', icon: Heart, color: '#719d84' },
  { key: 'threat', label: 'Arousal', icon: Shield, color: '#bc8580' },
] as const;

/** Uses the same live values as the full card, without another timer or simulation state. */
export function MapVitals({ vitals }: { vitals: Vitals }) {
  return (
    <div className="map-vitals" role="group" aria-label="Compact fly vital signs">
      {indicators.map(({ key, label, icon: Icon, color }) => {
        const value = Math.round(vitals[key]);
        return (
          <div
            key={key}
            className="map-vital"
            tabIndex={0}
            role="img"
            aria-label={`${label}: ${value}%`}
          >
            <Icon size={13} color={color} aria-hidden="true" />
            <span aria-hidden="true">
              {value}
              <small>%</small>
            </span>
            <span className="map-vital-tooltip" aria-hidden="true">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
