import { useState, useRef, useEffect } from 'react';
import type { SpraySwath, Tank } from '../types';
import { buildSwathPolygon, calculateAcres, totalSwathDistanceFeet } from '../utils/geo';

interface SessionSummaryProps {
  defaultName: string;
  tanks: Tank[];
  onSave: (name: string, gallonsPerTank: (number | undefined)[]) => void;
  onCancel: () => void;
  onDeleteJob: () => void;
}

type VolumeUnit = 'gal' | 'pt' | 'oz';
type RateUnit = 'gal/ac' | 'gal/ft²';

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

function tankAcres(swaths: SpraySwath[]): number {
  const polys = swaths.map((s) => buildSwathPolygon(s.points, s.widthFeet)).filter(Boolean) as any[];
  return calculateAcres(polys);
}

function calcRate(gallons: number, acres: number, rateUnit: RateUnit): string {
  if (rateUnit === 'gal/ac') return `${(gallons / acres).toFixed(1)} gal/ac`;
  return `${(gallons / (acres * 43560)).toFixed(4)} gal/ft²`;
}

export function SessionSummary({ defaultName, tanks, onSave, onCancel, onDeleteJob }: SessionSummaryProps) {
  const [name, setName] = useState(defaultName);
  const [volInputs, setVolInputs] = useState<string[]>(
    tanks.map((t) => (t.gallons != null ? String(t.gallons) : ''))
  );
  const [volUnit, setVolUnit] = useState<VolumeUnit>('gal');
  const [rateUnit, setRateUnit] = useState<RateUnit>('gal/ac');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const allSwaths = tanks.flatMap((t) => t.swaths);
  const totalAcres = tankAcres(allSwaths);
  const totalTime = calcSprayTime(allSwaths);
  const totalDistance = totalSwathDistanceFeet(allSwaths);

  // Convert all inputs to gallons for totals
  const totalGallons = volInputs.reduce((sum, g) => {
    const v = parseFloat(g);
    return sum + (isNaN(v) ? 0 : v * VOL_TO_GAL[volUnit]);
  }, 0);

  function handleSave() {
    if (!name.trim()) return;
    const perTank = volInputs.map((g) => {
      const v = parseFloat(g);
      return isNaN(v) ? undefined : v * VOL_TO_GAL[volUnit];
    });
    onSave(name.trim(), perTank);
  }

  function setTankVol(index: number, value: string) {
    setVolInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  return (
    <div className="summary-overlay">
      <div className="summary-panel summary-panel-scrollable">
        <h2>Session Summary</h2>

        {/* Session totals */}
        <div className="summary-stats">
          <div className="summary-stat-row">
            <span className="summary-label">Total Acres</span>
            <span className="summary-value">{totalAcres.toFixed(2)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Distance</span>
            <span className="summary-value">{formatDistance(totalDistance)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Spray Time</span>
            <span className="summary-value">{formatDuration(totalTime)}</span>
          </div>
          {tanks.length > 1 && (
            <div className="summary-stat-row">
              <span className="summary-label">Tanks</span>
              <span className="summary-value">{tanks.length}</span>
            </div>
          )}
          {totalGallons > 0 && (
            <>
              <div className="summary-stat-row">
                <span className="summary-label">Total Gallons</span>
                <span className="summary-value">{totalGallons.toFixed(1)}</span>
              </div>
              {totalAcres > 0 && (
                <div className="summary-stat-row">
                  <span className="summary-label">Rate</span>
                  <span className="summary-value rate-tap" onClick={() => setRateUnit(rateUnit === 'gal/ac' ? 'gal/ft²' : 'gal/ac')}>
                    {calcRate(totalGallons, totalAcres, rateUnit)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Volume input — matches TankSummary layout */}
        <label className="summary-name-label">Volume Used</label>
        {tanks.length === 1 ? (
          <>
            <div className="vol-input-row">
              <input
                className="summary-name-input vol-input"
                type="number"
                inputMode="decimal"
                placeholder="Optional"
                value={volInputs[0]}
                onChange={(e) => setTankVol(0, e.target.value)}
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
            {(() => {
              const rawVol = parseFloat(volInputs[0]);
              const gal = !isNaN(rawVol) && rawVol > 0 ? rawVol * VOL_TO_GAL[volUnit] : null;
              if (!gal || totalAcres <= 0) return null;
              return (
                <div className="rate-readout" onClick={() => setRateUnit(rateUnit === 'gal/ac' ? 'gal/ft²' : 'gal/ac')}>
                  <span>{calcRate(gal, totalAcres, rateUnit)}</span>
                  <span className="rate-toggle-hint">tap to switch</span>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div className="vol-input-row" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1 }} />
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
            <div className="tank-breakdown">
              {tanks.map((tank, i) => {
                const acres = tankAcres(tank.swaths);
                const time = calcSprayTime(tank.swaths);
                const dist = totalSwathDistanceFeet(tank.swaths);
                const rawVol = parseFloat(volInputs[i]);
                const tankGal = !isNaN(rawVol) && rawVol > 0 ? rawVol * VOL_TO_GAL[volUnit] : null;
                return (
                  <div key={tank.id} className="tank-row">
                    <div className="tank-row-header">
                      <span className="tank-row-label">Tank {i + 1}</span>
                      <span className="tank-row-stats">
                        {acres.toFixed(2)} ac · {formatDistance(dist)} · {formatDuration(time)}
                      </span>
                    </div>
                    <input
                      className="tank-gallons-input"
                      type="number"
                      inputMode="decimal"
                      placeholder={volUnit}
                      value={volInputs[i]}
                      onChange={(e) => setTankVol(i, e.target.value)}
                    />
                    {tankGal && acres > 0 && (
                      <div className="rate-readout" onClick={() => setRateUnit(rateUnit === 'gal/ac' ? 'gal/ft²' : 'gal/ac')}>
                        <span>{calcRate(tankGal, acres, rateUnit)}</span>
                        <span className="rate-toggle-hint">tap to switch</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <label className="summary-name-label">Session Name</label>
        <input
          ref={inputRef}
          className="summary-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />

        <div className="summary-actions">
          <button className="summary-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="summary-save-btn" onClick={handleSave}>
            Save
          </button>
        </div>

        <button
          className="delete-job-btn"
          onClick={() => { if (confirm('Delete this job? All unsaved data will be lost.')) onDeleteJob(); }}
        >
          Delete Job
        </button>
      </div>
    </div>
  );
}
