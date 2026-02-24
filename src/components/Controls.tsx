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
  lockNorth: boolean;
  compassRotation: number;
  heading: number | null;
  sprayView: 'tilted' | 'overhead';
  onSprayToggle: () => void;
  onWidthChange: (width: number) => void;
  onRefill: () => void;
  onEndSession: () => void;
  onOpenSessions: () => void;
  onOpenSettings: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleLockNorth: () => void;
  onToggleSprayView: () => void;
}

export function Controls({
  isSpraying,
  sprayWidth,
  totalAcres,
  tankNumber,
  gpsAccuracy,
  gpsError,
  lockNorth,
  compassRotation,
  heading,
  sprayView,
  onSprayToggle,
  onWidthChange,
  onRefill,
  onEndSession,
  onOpenSessions,
  onOpenSettings,
  onZoomIn,
  onZoomOut,
  onToggleLockNorth,
  onToggleSprayView,
}: ControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();

  return (
    <div className="controls">
      {/* Top bar - stats */}
      <div className="top-bar">
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

      {/* Bottom-right thumb action cluster */}
      <div className="thumb-actions">
        <button className="zoom-btn" onClick={onZoomIn}>
          <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="6" x2="12" y2="18" /><line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        </button>
        <button className="zoom-btn" onClick={onZoomOut}>
          <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        </button>
        <button
          className={`zoom-btn compass-btn${lockNorth ? ' compass-locked' : ''}`}
          onClick={onToggleLockNorth}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            style={{
              transform: `rotate(${lockNorth && heading != null ? -heading : compassRotation}deg)`,
              transition: 'transform 0.3s ease-out',
            }}>
            <path d="M12 3 L14.5 11 L12 9.5 L9.5 11 Z" fill="rgba(239,68,68,0.8)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
            <path d="M12 21 L9.5 13 L12 14.5 L14.5 13 Z" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <circle cx="12" cy="12" r="1.2" fill="rgba(255,255,255,0.6)" />
          </svg>
        </button>
        {isSpraying && (
          <button
            className={`zoom-btn${sprayView === 'tilted' ? ' compass-locked' : ''}`}
            onClick={onToggleSprayView}
            title={sprayView === 'tilted' ? 'Switch to overhead' : 'Switch to tilted'}
          >
            {sprayView === 'tilted' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20L12 4l10 16" />
                <path d="M6 16h12" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
        {!isSpraying && (
          <>
            <button className="zoom-btn" onClick={onOpenSessions} title="Sessions">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
            </button>
            <button className="zoom-btn" onClick={onOpenSettings} title="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </>
        )}
      </div>

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
