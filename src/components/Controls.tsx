import { useState } from 'react';

interface ControlsProps {
  isSpraying: boolean;
  sprayWidth: number;
  totalAcres: number;
  gpsAccuracy: number | null;
  gpsError: string | null;
  onSprayToggle: () => void;
  onWidthChange: (width: number) => void;
  onEndSession: () => void;
  onOpenSessions: () => void;
}

export function Controls({
  isSpraying,
  sprayWidth,
  totalAcres,
  gpsAccuracy,
  gpsError,
  onSprayToggle,
  onWidthChange,
  onEndSession,
  onOpenSessions,
}: ControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

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
          <span className="stat">
            {totalAcres.toFixed(2)} acres
          </span>
          <span className="stat width-stat" onClick={() => setShowSettings(!showSettings)}>
            {sprayWidth}ft wide
          </span>
        </div>

        {/* Spacer to keep top-bar balanced */}
        <div style={{ width: 44 }} />
      </div>

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
            min="4"
            max="40"
            step="1"
            value={sprayWidth}
            onChange={(e) => onWidthChange(Number(e.target.value))}
          />
          <div className="width-presets">
            {[8, 12, 16, 20, 24, 30].map((w) => (
              <button
                key={w}
                className={`preset-btn ${w === sprayWidth ? 'active' : ''}`}
                onClick={() => onWidthChange(w)}
              >
                {w}ft
              </button>
            ))}
          </div>

          <div className="settings-divider" />

          <button className="end-session-btn" onClick={() => { onEndSession(); setShowSettings(false); }}>
            Save &amp; End Session
          </button>
        </div>
      )}

      {/* Big spray button */}
      <div className="spray-btn-container">
        <button
          className={`spray-btn ${isSpraying ? 'spraying' : ''}`}
          onClick={onSprayToggle}
        >
          {isSpraying ? 'STOP' : 'SPRAY'}
        </button>
      </div>
    </div>
  );
}
