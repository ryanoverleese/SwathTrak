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

        <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
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
          <label>Spray Width: {sprayWidth} ft</label>
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
