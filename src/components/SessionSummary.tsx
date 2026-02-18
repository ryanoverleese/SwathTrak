import { useState, useRef, useEffect } from 'react';
import type { SpraySwath, Tank } from '../types';
import { buildSwathPolygon, calculateAcres, totalSwathDistanceFeet } from '../utils/geo';
import {
  useAreaUnit, useRateUnit, useDistanceUnit, useVolumeUnit,
  formatArea, formatRate, formatDistance, formatVolume,
  VOL_TO_GAL,
} from '../utils/units';
import { GlassSelect } from './GlassSelect';

interface SessionSummaryProps {
  defaultName: string;
  tanks: Tank[];
  onSave: (name: string, gallonsPerTank: (number | undefined)[]) => void;
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

function tankAcres(swaths: SpraySwath[]): number {
  const polys = swaths.map((s) => buildSwathPolygon(s.points, s.widthFeet)).filter(Boolean) as any[];
  return calculateAcres(polys);
}


export function SessionSummary({ defaultName, tanks, onSave, onCancel, onDeleteJob }: SessionSummaryProps) {
  const [name, setName] = useState(defaultName);
  const [volInputs, setVolInputs] = useState<string[]>(
    tanks.map((t) => (t.gallons != null ? String(t.gallons) : ''))
  );
  const [areaUnit, cycleArea, areaTap] = useAreaUnit();
  const [rateUnit, , rateTap, , rateCycle, selectRate] = useRateUnit();
  const [distUnit, , distTap, , distCycle, selectDist] = useDistanceUnit();
  const [volUnit, , volTap, , volCycle, selectVol] = useVolumeUnit();
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
  const totalDistanceFt = totalSwathDistanceFeet(allSwaths);

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
          <div className="summary-stat-row" onClick={cycleArea}>
            <span className="summary-label">Total Area</span>
            <span key={areaTap} className="summary-value tappable">{formatArea(totalAcres, areaUnit)}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-label">Distance</span>
            {distCycle.length > 2 ? (
              <GlassSelect
                value={distUnit}
                display={formatDistance(totalDistanceFt, distUnit)}
                options={distCycle}
                onSelect={(u) => selectDist(u as typeof distUnit)}
                tapKey={distTap}
              />
            ) : (
              <span key={distTap} className="summary-value tappable" onClick={() => selectDist(distCycle[distCycle.indexOf(distUnit) === 0 ? 1 : 0])}>
                {formatDistance(totalDistanceFt, distUnit)}
              </span>
            )}
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
                <span className="summary-label">Total Volume</span>
                {volCycle.length > 2 ? (
                  <GlassSelect
                    value={volUnit}
                    display={formatVolume(totalGallons, volUnit)}
                    options={volCycle}
                    onSelect={(u) => selectVol(u as typeof volUnit)}
                    tapKey={volTap}
                  />
                ) : (
                  <span key={volTap} className="summary-value tappable" onClick={() => selectVol(volCycle[volCycle.indexOf(volUnit) === 0 ? 1 : 0])}>
                    {formatVolume(totalGallons, volUnit)}
                  </span>
                )}
              </div>
              {totalAcres > 0 && (
                <div className="summary-stat-row">
                  <span className="summary-label">Rate</span>
                  {rateCycle.length > 2 ? (
                    <GlassSelect
                      value={rateUnit}
                      display={formatRate(totalGallons, totalAcres, rateUnit)}
                      options={rateCycle}
                      onSelect={(u) => selectRate(u as typeof rateUnit)}
                      tapKey={rateTap}
                    />
                  ) : (
                    <span key={rateTap} className="summary-value tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                      {formatRate(totalGallons, totalAcres, rateUnit)}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Volume input */}
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
            {(() => {
              const rawVol = parseFloat(volInputs[0]);
              const gal = !isNaN(rawVol) && rawVol > 0 ? rawVol * VOL_TO_GAL[volUnit] : null;
              if (!gal || totalAcres <= 0) return null;
              return (
                <div className="rate-readout">
                  {rateCycle.length > 2 ? (
                    <GlassSelect
                      value={rateUnit}
                      display={formatRate(gal, totalAcres, rateUnit)}
                      options={rateCycle}
                      onSelect={(u) => selectRate(u as typeof rateUnit)}
                      triggerClass="tappable"
                      tapKey={rateTap}
                    />
                  ) : (
                    <span key={rateTap} className="tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                      {formatRate(gal, totalAcres, rateUnit)}
                    </span>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div className="vol-input-row" style={{ marginBottom: 10, justifyContent: 'flex-end' }}>
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
                        {formatArea(acres, areaUnit)} · {formatDistance(dist, distUnit)} · {formatDuration(time)}
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
                      <div className="rate-readout">
                        {rateCycle.length > 2 ? (
                          <GlassSelect
                            value={rateUnit}
                            display={formatRate(tankGal, acres, rateUnit)}
                            options={rateCycle}
                            onSelect={(u) => selectRate(u as typeof rateUnit)}
                            triggerClass="tappable"
                            tapKey={rateTap}
                          />
                        ) : (
                          <span key={rateTap} className="tappable" onClick={() => selectRate(rateCycle[rateCycle.indexOf(rateUnit) === 0 ? 1 : 0])}>
                            {formatRate(tankGal, acres, rateUnit)}
                          </span>
                        )}
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
