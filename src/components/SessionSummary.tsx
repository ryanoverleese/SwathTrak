import { useState, useRef, useEffect } from 'react';
import type { SpraySwath, Tank } from '../types';
import { buildSwathPolygon, calculateAcres } from '../utils/geo';

interface SessionSummaryProps {
  defaultName: string;
  tanks: Tank[];
  onSave: (name: string, gallonsPerTank: (number | undefined)[]) => void;
  onCancel: () => void;
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

function tankAcres(swaths: SpraySwath[]): number {
  const polys = swaths.map((s) => buildSwathPolygon(s.points, s.widthFeet)).filter(Boolean) as any[];
  return calculateAcres(polys);
}

export function SessionSummary({ defaultName, tanks, onSave, onCancel }: SessionSummaryProps) {
  const [name, setName] = useState(defaultName);
  const [gallonsInputs, setGallonsInputs] = useState<string[]>(
    tanks.map((t) => (t.gallons != null ? String(t.gallons) : ''))
  );
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
  const totalGallons = gallonsInputs.reduce((sum, g) => {
    const v = parseFloat(g);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  function handleSave() {
    if (!name.trim()) return;
    const perTank = gallonsInputs.map((g) => {
      const v = parseFloat(g);
      return isNaN(v) ? undefined : v;
    });
    onSave(name.trim(), perTank);
  }

  function setTankGallons(index: number, value: string) {
    setGallonsInputs((prev) => {
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
            <span className="summary-label">Total Spray Time</span>
            <span className="summary-value">{formatDuration(totalTime)}</span>
          </div>
          {tanks.length > 1 && (
            <div className="summary-stat-row">
              <span className="summary-label">Tanks</span>
              <span className="summary-value">{tanks.length}</span>
            </div>
          )}
          {totalGallons > 0 && (
            <div className="summary-stat-row">
              <span className="summary-label">Total Gallons</span>
              <span className="summary-value">{totalGallons}</span>
            </div>
          )}
        </div>

        {/* Per-tank breakdown */}
        {tanks.length > 1 && (
          <div className="tank-breakdown">
            {tanks.map((tank, i) => {
              const acres = tankAcres(tank.swaths);
              const time = calcSprayTime(tank.swaths);
              return (
                <div key={tank.id} className="tank-row">
                  <div className="tank-row-header">
                    <span className="tank-row-label">Tank {i + 1}</span>
                    <span className="tank-row-stats">
                      {acres.toFixed(2)} ac · {formatDuration(time)}
                    </span>
                  </div>
                  <input
                    className="tank-gallons-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="Gallons"
                    value={gallonsInputs[i]}
                    onChange={(e) => setTankGallons(i, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Single tank: just one gallons input */}
        {tanks.length === 1 && (
          <>
            <label className="summary-name-label">Gallons Sprayed</label>
            <input
              className="summary-name-input"
              type="number"
              inputMode="decimal"
              placeholder="Optional"
              value={gallonsInputs[0]}
              onChange={(e) => setTankGallons(0, e.target.value)}
            />
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
      </div>
    </div>
  );
}
