import { useState } from 'react';
import { useAreaUnit, formatArea } from '../utils/units';

// Slider positions 0-58 map to widths 2-60 (step 1), positions 59-64 map to 70-120 (step 10)
function sliderToWidth(pos: number): number {
  if (pos <= 58) return pos + 2;           // 0→2, 58→60
  return 60 + (pos - 58) * 10;             // 59→70, 64→120
}

function widthToSlider(width: number): number {
  if (width <= 60) return width - 2;        // 2→0, 60→58
  return 58 + Math.round((width - 60) / 10); // 70→59, 120→64
}

interface ControlsProps {
  isSpraying: boolean;
  sprayWidth: number;
  totalAcres: number;
  tankNumber: number;
  gpsAccuracy: number | null;
  gpsError: string | null;
  tiltAngle: number;
  onSprayToggle: () => void;
  onWidthChange: (width: number) => void;
  onTiltChange: (angle: number) => void;
  onRefill: () => void;
  onEndSession: () => void;
  onOpenSessions: () => void;
}

export function Controls({
  isSpraying,
  sprayWidth,
  totalAcres,
  tankNumber,
  gpsAccuracy,
  gpsError,
  tiltAngle,
  onSprayToggle,
  onWidthChange,
  onTiltChange,
  onRefill,
  onEndSession,
  onOpenSessions,
}: ControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();

  return (
    <div className="controls">
      {/* Top bar - stats */}
      <div className="top-bar">
        <button className="icon-btn" onClick={onOpenSessions} title="Sessions">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <div className="stats">
          <span key={areaTap} className="stat tappable" onClick={cycleArea}>
            {formatArea(totalAcres, areaUnit)}
          </span>
          <span className="stat width-stat" onClick={() => setShowSettings(!showSettings)}>
            {sprayWidth} ft
          </span>
          <span className="stat tank-stat">
            Tank {tankNumber}
          </span>
        </div>

        {!isSpraying && totalAcres > 0 && (
          <div className="top-bar-actions">
            <button className="refill-btn" onClick={onRefill}>
              Refill
            </button>
            <button className="finish-btn" onClick={onEndSession}>
              Finish
            </button>
          </div>
        )}
      </div>

      {/* Tilt slider — horizontal, under the header */}
      {isSpraying && (
        <div className="tilt-slider-bar">
          <span className="tilt-slider-label">Tilt</span>
          <input
            className="tilt-slider"
            type="range"
            min="0"
            max="60"
            step="1"
            value={tiltAngle}
            onChange={(e) => onTiltChange(Number(e.target.value))}
          />
          <span className="tilt-slider-value">{tiltAngle}°</span>
        </div>
      )}

      {/* GPS status */}
      {gpsError && (
        <div className="gps-error">GPS: {gpsError}</div>
      )}
      {gpsAccuracy !== null && !gpsError && (
        <div className={`gps-accuracy ${gpsAccuracy > 10 ? 'poor' : 'good'}`}>
          GPS: ±{Math.round(gpsAccuracy)}m
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <label>Spray Width: {sprayWidth} ft</label>
            <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
          </div>
          <input
            type="range"
            min="0"
            max="64"
            step="1"
            value={widthToSlider(sprayWidth)}
            onChange={(e) => onWidthChange(sliderToWidth(Number(e.target.value)))}
          />

        </div>
      )}

      {/* Bottom actions */}
      {isSpraying ? (
        <div className="stop-actions">
          <button className="stop-action-btn stop-end" onClick={() => { onSprayToggle(); onEndSession(); }}>
            Stop & End
          </button>
          <button className="stop-action-btn stop-refill" onClick={() => { onSprayToggle(); onRefill(); }}>
            Stop & Refill
          </button>
        </div>
      ) : (
        <div className="spray-btn-container">
          <button className="spray-btn" onClick={onSprayToggle}>
            SPRAY
          </button>
        </div>
      )}
    </div>
  );
}
