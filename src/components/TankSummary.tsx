import { useState, useRef } from 'react';
import type { SpraySwath } from '../types';
import { buildSwathPolygon, calculateAcres, totalSwathDistanceFeet } from '../utils/geo';
import {
  useAreaUnit, useRateUnit, useDistanceUnit, useVolumeUnit,
  formatArea, formatRate, formatDistance,
  VOL_TO_GAL,
} from '../utils/units';
import { GlassSelect } from './GlassSelect';

interface TankSummaryProps {
  tankNumber: number;
  swaths: SpraySwath[];
  onSave: (gallons: number | undefined) => void;
  onCancel: () => void;
  onDeleteJob: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
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

export function TankSummary({ tankNumber, swaths, onSave, onCancel, onDeleteJob }: TankSummaryProps) {
  const [volStr, setVolStr] = useState('');
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();
  const [rateUnit, , rateTap, , rateCycle, selectRate] = useRateUnit();
  const [distUnit, , distTap, , distCycle, selectDist] = useDistanceUnit();
  const [volUnit, , volTap, , volCycle, selectVol] = useVolumeUnit();
  const inputRef = useRef<HTMLInputElement>(null);


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
            <span className="summary-label">Area</span>
            <span key={areaTap} className="summary-value tappable">{formatArea(acres, areaUnit)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Distance</span>
            {distCycle.length > 2 ? (
              <GlassSelect
                value={distUnit}
                display={formatDistance(distance, distUnit)}
                options={distCycle}
                onSelect={(u) => selectDist(u as typeof distUnit)}
                tapKey={distTap}
              />
            ) : (
              <span key={distTap} className="summary-value tappable" onClick={() => selectDist(distCycle[distCycle.indexOf(distUnit) === 0 ? 1 : 0])}>
                {formatDistance(distance, distUnit)}
              </span>
            )}
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
          {volCycle.length > 2 ? (
            <GlassSelect
              value={volUnit}
              display={volUnit}
              options={volCycle}
              onSelect={(u) => selectVol(u as typeof volUnit)}
              triggerClass="calc-unit tappable"
              tapKey={volTap}
            />
          ) : (
            <span key={volTap} className="calc-unit tappable" onClick={() => selectVol(volCycle[volCycle.indexOf(volUnit) === 0 ? 1 : 0])}>
              {volUnit}
            </span>
          )}
        </div>

        {gallons && acres > 0 && (
          <div className="rate-readout">
            {rateCycle.length > 2 ? (
              <GlassSelect
                value={rateUnit}
                display={formatRate(gallons, acres, rateUnit)}
                options={rateCycle}
                onSelect={(u) => selectRate(u as typeof rateUnit)}
                triggerClass="tappable"
                tapKey={rateTap}
              />
            ) : (
              <span key={rateTap} className="tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                {formatRate(gallons, acres, rateUnit)}
              </span>
            )}
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
        <button className="delete-job-btn" onClick={onDeleteJob}>
          Delete Job
        </button>
      </div>
    </div>
  );
}
