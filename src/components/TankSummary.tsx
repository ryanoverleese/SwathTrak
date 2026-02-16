import { useState, useRef, useEffect } from 'react';
import type { SpraySwath } from '../types';
import { buildSwathPolygon, calculateAcres } from '../utils/geo';

interface TankSummaryProps {
  tankNumber: number;
  swaths: SpraySwath[];
  onSave: (gallons: number | undefined) => void;
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

export function TankSummary({ tankNumber, swaths, onSave, onCancel }: TankSummaryProps) {
  const [gallonsStr, setGallonsStr] = useState('');
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

  function handleSave() {
    const gallons = gallonsStr.trim() ? parseFloat(gallonsStr) : undefined;
    onSave(gallons && !isNaN(gallons) ? gallons : undefined);
  }

  return (
    <div className="summary-overlay">
      <div className="summary-panel">
        <h2>Tank {tankNumber} Complete</h2>

        <div className="summary-stats">
          <div className="summary-stat-row">
            <span className="summary-label">Acres</span>
            <span className="summary-value">{acres.toFixed(2)}</span>
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

        <label className="summary-name-label">Gallons Used</label>
        <input
          ref={inputRef}
          className="summary-name-input"
          type="number"
          inputMode="decimal"
          placeholder="Optional"
          value={gallonsStr}
          onChange={(e) => setGallonsStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />

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
