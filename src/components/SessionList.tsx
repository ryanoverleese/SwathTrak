import { useState, useRef, useEffect } from 'react';
import type { SpraySession, SpraySwath } from '../types';
import { buildSwathPolygon, calculateAcres, totalSwathDistanceFeet } from '../utils/geo';
import {
  useAreaUnit, useRateUnit, useDistanceUnit,
  formatArea, formatRate, formatDistance,
} from '../utils/units';
import { GlassSelect } from './GlassSelect';

interface SessionListProps {
  sessions: SpraySession[];
  onLoad: (session: SpraySession) => void;
  onResume: (session: SpraySession) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onBack?: () => void;
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
    if (s.endTime && s.startTime) total += s.endTime - s.startTime;
  }
  return total;
}

function swathAcres(swaths: SpraySwath[]): number {
  const polys = swaths.map((s) => buildSwathPolygon(s.points, s.widthFeet)).filter(Boolean) as any[];
  return calculateAcres(polys);
}

export function SessionList({ sessions, onLoad, onResume, onRename, onDelete, onClose, onBack }: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [detailSession, setDetailSession] = useState<SpraySession | null>(null);
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();
  const [rateUnit, , rateTap, , rateCycle, selectRate] = useRateUnit();
  const [distUnit, , distTap, , distCycle, selectDist] = useDistanceUnit();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEditing(session: SpraySession) {
    setEditingId(session.id);
    setEditValue(session.name);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  // Session detail modal
  if (detailSession) {
    const allSwaths = detailSession.tanks.flatMap((t) => t.swaths);
    const acres = detailSession.totalAcres || swathAcres(allSwaths);
    const distance = totalSwathDistanceFeet(allSwaths);
    const sprayTime = calcSprayTime(allSwaths);
    const totalGallons = detailSession.tanks.reduce((sum, t) => sum + (t.gallons || 0), 0) || detailSession.gallons || 0;

    return (
      <div className="summary-overlay">
        <div className="summary-panel summary-panel-scrollable">
          <div className="detail-header">
            <h2>{detailSession.name}</h2>
            <span className="detail-date">{detailSession.date}</span>
          </div>

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
              <span className="summary-label">Tanks</span>
              <span className="summary-value">{detailSession.tanks.length}</span>
            </div>
            {totalGallons > 0 && (
              <>
                <div className="summary-stat-row">
                  <span className="summary-label">Gallons</span>
                  <span className="summary-value">{totalGallons.toFixed(1)}</span>
                </div>
                {acres > 0 && (
                  <div className="summary-stat-row">
                    <span className="summary-label">Rate</span>
                    {rateCycle.length > 2 ? (
                      <GlassSelect
                        value={rateUnit}
                        display={formatRate(totalGallons, acres, rateUnit)}
                        options={rateCycle}
                        onSelect={(u) => selectRate(u as typeof rateUnit)}
                        tapKey={rateTap}
                      />
                    ) : (
                      <span key={rateTap} className="summary-value tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                        {formatRate(totalGallons, acres, rateUnit)}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Per-tank breakdown */}
          {detailSession.tanks.length > 1 && (
            <div className="tank-breakdown">
              {detailSession.tanks.map((tank, i) => {
                const tAcres = swathAcres(tank.swaths);
                const tDist = totalSwathDistanceFeet(tank.swaths);
                const tTime = calcSprayTime(tank.swaths);
                return (
                  <div key={tank.id} className="tank-row">
                    <div className="tank-row-header">
                      <span className="tank-row-label">Tank {i + 1}</span>
                      <span className="tank-row-stats">
                        {formatArea(tAcres, areaUnit)} · {formatDistance(tDist, distUnit)} · {formatDuration(tTime)}
                      </span>
                    </div>
                    {tank.gallons != null && tank.gallons > 0 && tAcres > 0 && (
                      <div className="rate-readout">
                        <span>{tank.gallons.toFixed(1)} gal</span>
                        {rateCycle.length > 2 ? (
                          <GlassSelect
                            value={rateUnit}
                            display={formatRate(tank.gallons, tAcres, rateUnit)}
                            options={rateCycle}
                            onSelect={(u) => selectRate(u as typeof rateUnit)}
                            triggerClass="tappable"
                            tapKey={rateTap}
                          />
                        ) : (
                          <span key={rateTap} className="tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                            {formatRate(tank.gallons, tAcres, rateUnit)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="summary-actions">
            <button className="summary-cancel-btn" onClick={() => setDetailSession(null)}>
              Back
            </button>
            <button
              className="summary-save-btn"
              onClick={() => {
                onLoad(detailSession);
                setDetailSession(null);
              }}
            >
              Show on Map
            </button>
          </div>

          <button
            className="share-btn"
            onClick={() => {
              const lines = [
                detailSession.name,
                detailSession.date,
                `Area: ${formatArea(acres, areaUnit)}`,
                `Distance: ${formatDistance(distance, distUnit)}`,
                `Time: ${formatDuration(sprayTime)}`,
                `Tanks: ${detailSession.tanks.length}`,
              ];
              if (totalGallons > 0) {
                lines.push(`Volume: ${totalGallons.toFixed(1)} gal`);
                if (acres > 0) lines.push(`Rate: ${formatRate(totalGallons, acres, rateUnit)}`);
              }
              const text = lines.join('\n');
              if (navigator.share) {
                navigator.share({ title: detailSession.name, text });
              } else {
                navigator.clipboard.writeText(text);
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share Summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-overlay">
      <div className="session-panel">
        <div className="session-header">
          {onBack ? (
            <button className="calc-back-btn" onClick={onBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <h2>Sessions</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {sessions.length === 0 ? (
          <p className="no-sessions">No saved sessions yet. Start spraying to create one!</p>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-item">
                <div className="session-info" onClick={() => setDetailSession(session)}>
                  {editingId === session.id ? (
                    <input
                      ref={inputRef}
                      className="session-name-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <strong>
                      {session.name}
                      <svg
                        className="edit-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(session);
                        }}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </strong>
                  )}
                  <span>{session.date}</span>
                  <span>
                    {session.tanks.length} tank{session.tanks.length !== 1 ? 's' : ''} &middot;{' '}
                    {formatArea(session.totalAcres, areaUnit)}
                    {session.gallons != null && ` · ${session.gallons} gal`}
                  </span>
                </div>
                <button
                  className="resume-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume(session);
                  }}
                >
                  Resume
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this session?')) {
                      onDelete(session.id);
                    }
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
