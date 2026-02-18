import { useState, useRef, useEffect } from 'react';
import type { SpraySwath } from '../types';
import { buildSwathPolygon, calculateAcres, totalSwathDistanceFeet } from '../utils/geo';
import { useAreaUnit, useRateUnit, formatArea, formatRate } from '../utils/units';

interface TankSummaryProps {
  tankNumber: number;
  swaths: SpraySwath[];
  onSave: (gallons: number | undefined) => void;
  onCancel: () => void;
}

type VolumeUnit = 'gal' | 'pt' | 'oz';

const VOL_TO_GAL: Record<VolumeUnit, number> = { gal: 1, pt: 0.125, oz: 1 / 128 };
const VOL_LABELS: VolumeUnit[] = ['gal', 'pt', 'oz'];

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDistance(feet: number): string {
  if (feet >= 5280) return `${(feet / 5280).toFixed(2)} mi`;
  return `${Math.round(feet)} ft`;
}

function calcSprayTime(swaths: SpraySwath[]): number {
  let total = 0;
  for (const s of swaths) {
    if (s.endTime && s.startTime) {
      total += s.endTime - s.startTime;
    }
  }
  return total;
}

export function TankSummary({ tankNumber, swaths, onSave, onCancel }: TankSummaryProps) {
  const [volStr, setVolStr] = useState('');
  const [volUnit, setVolUnit] = useState<VolumeUnit>('gal');
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();
  const [rateUnit, cycleRate, rateTap] = useRateUnit();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const acres = calculateAcres(
    swaths.map((s) => buildSwathPolygon(s.points, s.widthFeet)).filter(Boolean) as any[]
  );
  const sprayTime = calcSprayTime(swaths);
  const distance = totalSwathDistanceFeet(swaths);

  function handleSave() {
    const raw = volStr.trim() ? parseFloat(volStr) : undefined;
    const gallons = raw && !isNaN(raw) ? raw * VOL_TO_GAL[volUnit] : undefined;
    onSave(gallons);
  }

  const rawVol = parseFloat(volStr);
  const gallons = !isNaN(rawVol) && rawVol > 0 ? rawVol * VOL_TO_GAL[volUnit] : null;

  return (
    <div className="summary-overlay">
      <div className="summary-panel">
        <h2>Tank {tankNumber} Complete</h2>

        <div className="summary-stats">
          <div className="summary-stat-row" onClick={cycleArea}>
            <span className="summary-label">Acres</span>
            <span key={areaTap} className="summary-value tappable">{formatArea(acres, areaUnit)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Distance</span>
            <span className="summary-value">{formatDistance(distance)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Spray Time</span>
            <span className="summary-value">{formatDuration(sprayTime)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Swaths</span>
            <span className="summary-value">{swaths.length}</span>
          </div>
        </div>

        <label className="summary-name-label">Volume Used</label>
        <div className="vol-input-row">
          <input
            ref={inputRef}
            className="summary-name-input vol-input"
            type="number"
            inputMode="decimal"
            placeholder="Optional"
            value={volStr}
            onChange={(e) => setVolStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <div className="unit-picker">
            {VOL_LABELS.map((u) => (
              <button
                key={u}
                className={`unit-btn${volUnit === u ? ' active' : ''}`}
                onClick={() => setVolUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {gallons && acres > 0 && (
          <div className="rate-readout" onClick={cycleRate}>
            <span key={rateTap} className="tappable">{formatRate(gallons, acres, rateUnit)}</span>
          </div>
        )}

        <div className="summary-actions">
          <button className="summary-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="summary-save-btn" onClick={handleSave}>
            Next Tank
          </button>
        </div>
      </div>
    </div>
  );
}
