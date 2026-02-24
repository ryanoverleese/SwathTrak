import { useState, useCallback, useRef, useEffect } from 'react';
import { SprayMap } from './components/SprayMap';
import type { SprayMapHandle } from './components/SprayMap';
import { Controls } from './components/Controls';
import { SessionList } from './components/SessionList';
import { SessionSummary } from './components/SessionSummary';
import { TankSummary } from './components/TankSummary';
import { HowTo } from './components/HowTo';
import { useGps } from './hooks/useGps';
import { useCompass } from './hooks/useCompass';
import { buildSwathPolygon, calculateAcres, distanceFeet } from './utils/geo';
import {
  loadSessions,
  saveSession,
  deleteSession,
  renameSession,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from './utils/storage';
import {
  UnitSystemContext,
  loadUnitSystem,
  saveUnitSystem,
} from './utils/units';
import type { UnitSystem } from './utils/units';
import type { SpraySwath, SpraySession, Tank } from './types';
import './App.css';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Colors for each tank — cycles if more than 6 tanks */
const TANK_COLORS = [
  '#00e676', // green
  '#26c6da', // teal
  '#42a5f5', // blue
  '#ab47bc', // purple
  '#ffa726', // orange
  '#ef5350', // red
];

function tankColor(index: number): string {
  return TANK_COLORS[index % TANK_COLORS.length];
}

function App() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(loadUnitSystem);
  const [isSpraying, setIsSpraying] = useState(false);
  const [sprayWidth, setSprayWidth] = useState(16);
  const [sprayView, setSprayView] = useState<'tilted' | 'overhead'>(() => {
    return (localStorage.getItem('swathtrak_spray_view') as 'tilted' | 'overhead') || 'tilted';
  });

  // Completed tanks in the current session
  const [tanks, setTanks] = useState<Tank[]>([]);
  // Swaths for the current (active) tank
  const [currentTankSwaths, setCurrentTankSwaths] = useState<SpraySwath[]>([]);
  const [currentTankStart, setCurrentTankStart] = useState(Date.now);

  const [activeSwath, setActiveSwath] = useState<SpraySwath | null>(null);
  const [sessionId, setSessionId] = useState(() => {
    const saved = loadActiveSession();
    return saved ? saved.id : generateId();
  });
  const [showSessions, setShowSessions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState<SpraySession[]>(loadSessions);
  const [pastSessionSwaths, setPastSessionSwaths] = useState<SpraySwath[]>([]);
  const [lockNorth, setLockNorth] = useState(false);

  // Modals
  const [showSummary, setShowSummary] = useState(false);
  const [showTankSummary, setShowTankSummary] = useState(false);
  const [finishedTanks, setFinishedTanks] = useState<Tank[]>([]);
  const [showHowTo, setShowHowTo] = useState(false);

  const activeSwathRef = useRef(activeSwath);
  activeSwathRef.current = activeSwath;

  const mapRef = useRef<SprayMapHandle>(null);

  // GPS is always active so we can show position on map
  const { position, error: gpsError, accuracy: gpsAccuracy } = useGps(true);
  const heading = useCompass(isSpraying);

  // Current tank index (completed tanks + 1)
  const tankNumber = tanks.length + 1;

  // All swaths across all tanks + current tank (for map rendering)
  const allSwaths: SpraySwath[] = [
    ...tanks.flatMap((t) => t.swaths),
    ...currentTankSwaths,
  ];

  const tiltEnabled = isSpraying && sprayView === 'tilted';
  const compassRotation = tiltEnabled && !lockNorth && heading != null ? heading : 0;

  // Restore active session on mount
  useEffect(() => {
    const saved = loadActiveSession();
    if (saved) {
      setTanks(saved.tanks || []);
      if (saved.tanks.length === 0 && saved.swaths && saved.swaths.length > 0) {
        setCurrentTankSwaths(saved.swaths);
      }
    }
  }, []);

  // Auto-save active session whenever state changes
  useEffect(() => {
    const session: SpraySession = {
      id: sessionId,
      name: `Session ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      tanks,
      totalAcres: calculateTotalAcres(allSwaths, activeSwath),
    };
    saveActiveSession(session);
  }, [tanks, currentTankSwaths, activeSwath, sessionId]);

  // Record GPS points while spraying
  useEffect(() => {
    if (!isSpraying || !position || !activeSwathRef.current) return;

    const current = activeSwathRef.current;
    const lastPoint = current.points[current.points.length - 1];

    // Only add point if we've moved at least 3 feet (reduce noise)
    if (lastPoint && distanceFeet(lastPoint, position) < 3) return;

    // Reject GPS outliers: if speed between points exceeds 60 mph, skip it
    if (lastPoint && lastPoint.timestamp && position.timestamp) {
      const elapsedSec = (position.timestamp - lastPoint.timestamp) / 1000;
      if (elapsedSec > 0) {
        const feet = distanceFeet(lastPoint, position);
        const mph = (feet / elapsedSec) * 0.6818;
        if (mph > 60) return;
      }
    }

    const updated: SpraySwath = {
      ...current,
      points: [...current.points, position],
    };

    setActiveSwath(updated);
  }, [isSpraying, position]);

  const handleSprayToggle = useCallback(() => {
    if (isSpraying) {
      // Stop spraying - save the active swath to current tank
      if (activeSwathRef.current && activeSwathRef.current.points.length >= 2) {
        const finished: SpraySwath = {
          ...activeSwathRef.current,
          endTime: Date.now(),
        };
        setCurrentTankSwaths((prev) => [...prev, finished]);
      }
      setActiveSwath(null);
      setIsSpraying(false);
    } else {
      // Start spraying
      const newSwath: SpraySwath = {
        id: generateId(),
        points: position ? [position] : [],
        widthFeet: sprayWidth,
        color: tankColor(tankNumber - 1),
        startTime: Date.now(),
      };
      setActiveSwath(newSwath);
      setIsSpraying(true);
    }
  }, [isSpraying, position, sprayWidth, tankNumber]);

  /** Finalize the current tank's swaths (stopping spray if active) */
  function finalizeCurrentTankSwaths(): SpraySwath[] {
    let swaths = currentTankSwaths;
    if (isSpraying && activeSwathRef.current) {
      const finished: SpraySwath = {
        ...activeSwathRef.current,
        endTime: Date.now(),
      };
      swaths = [...swaths, finished];
    }
    setIsSpraying(false);
    setActiveSwath(null);
    return swaths;
  }

  // ---- Refill flow ----
  const handleRefill = useCallback(() => {
    const swaths = finalizeCurrentTankSwaths();
    if (swaths.length === 0) return;
    setCurrentTankSwaths(swaths);
    setShowTankSummary(true);
  }, [isSpraying, currentTankSwaths]);

  const handleTankSave = useCallback((gallons: number | undefined) => {
    const tank: Tank = {
      id: generateId(),
      swaths: currentTankSwaths,
      gallons,
      startTime: currentTankStart,
      endTime: Date.now(),
    };
    setTanks((prev) => [...prev, tank]);
    setCurrentTankSwaths([]);
    setCurrentTankStart(Date.now());
    setShowTankSummary(false);
  }, [currentTankSwaths, currentTankStart]);

  const handleTankCancel = useCallback(() => {
    setShowTankSummary(false);
  }, []);

  // ---- Finish session flow ----
  const handleFinish = useCallback(() => {
    const swaths = finalizeCurrentTankSwaths();

    let allTanks = [...tanks];
    if (swaths.length > 0) {
      allTanks.push({
        id: generateId(),
        swaths,
        startTime: currentTankStart,
        endTime: Date.now(),
      });
    }

    if (allTanks.length === 0) return;

    setFinishedTanks(allTanks);
    setShowSummary(true);
  }, [isSpraying, currentTankSwaths, tanks, currentTankStart]);

  const handleSaveSummary = useCallback((name: string, gallonsPerTank: (number | undefined)[]) => {
    const tanksWithGallons = finishedTanks.map((t, i) => ({
      ...t,
      gallons: gallonsPerTank[i] ?? t.gallons,
    }));

    const allSwaths = tanksWithGallons.flatMap((t) => t.swaths);
    const totalGallons = tanksWithGallons.reduce((sum, t) => sum + (t.gallons || 0), 0);

    const session: SpraySession = {
      id: sessionId,
      name,
      date: new Date().toLocaleDateString(),
      tanks: tanksWithGallons,
      totalAcres: calculateTotalAcres(allSwaths, null),
      gallons: totalGallons || undefined,
    };
    saveSession(session);

    // Reset everything
    setTanks([]);
    setCurrentTankSwaths([]);
    setCurrentTankStart(Date.now());
    setFinishedTanks([]);
    setShowSummary(false);
    setSessionId(generateId());
    clearActiveSession();
    setSessions(loadSessions());
  }, [sessionId, finishedTanks]);

  const handleCancelSummary = useCallback(() => {
    const lastTank = finishedTanks[finishedTanks.length - 1];
    const previousTanks = finishedTanks.slice(0, -1);
    setTanks(previousTanks);
    setCurrentTankSwaths(lastTank ? lastTank.swaths : []);
    setCurrentTankStart(lastTank ? lastTank.startTime : Date.now());
    setFinishedTanks([]);
    setShowSummary(false);
  }, [finishedTanks]);

  const handleLoadSession = useCallback((session: SpraySession) => {
    const swaths = session.tanks.flatMap((t) => t.swaths);
    setPastSessionSwaths(swaths);
    setShowSessions(false);
  }, []);

  const handleResumeSession = useCallback((session: SpraySession) => {
    if (isSpraying && activeSwathRef.current) {
      setIsSpraying(false);
      setActiveSwath(null);
    }

    setSessionId(session.id);
    setTanks(session.tanks);
    setCurrentTankSwaths([]);
    setCurrentTankStart(Date.now());
    setPastSessionSwaths([]);

    deleteSession(session.id);
    setSessions(loadSessions());
    setShowSessions(false);
  }, [isSpraying]);

  const handleRenameSession = useCallback((id: string, name: string) => {
    renameSession(id, name);
    setSessions(loadSessions());
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setSessions(loadSessions());
  }, []);

  const handleCancelJob = useCallback(() => {
    setIsSpraying(false);
    setActiveSwath(null);
    setTanks([]);
    setCurrentTankSwaths([]);
    setCurrentTankStart(Date.now());
    setPastSessionSwaths([]);
    setFinishedTanks([]);
    setShowSummary(false);
    setShowTankSummary(false);
    setSessionId(generateId());
    clearActiveSession();
  }, []);

  const totalAcres = calculateTotalAcres(allSwaths, activeSwath);

  function handleUnitSystem(system: UnitSystem) {
    setUnitSystem(system);
    saveUnitSystem(system);
  }

  return (
    <UnitSystemContext.Provider value={unitSystem}>
    <div className="app">
      <SprayMap
        ref={mapRef}
        position={position}
        swaths={allSwaths}
        activeSwath={activeSwath}
        pastSessionSwaths={pastSessionSwaths}
        isSpraying={isSpraying}
        tiltEnabled={tiltEnabled}
        heading={heading}
        lockNorth={lockNorth}
      />
      <Controls
        isSpraying={isSpraying}
        sprayWidth={sprayWidth}
        totalAcres={totalAcres}
        tankNumber={tankNumber}
        gpsAccuracy={gpsAccuracy}
        gpsError={gpsError}
        lockNorth={lockNorth}
        compassRotation={compassRotation}
        heading={heading}
        onSprayToggle={handleSprayToggle}
        onWidthChange={setSprayWidth}
        onRefill={handleRefill}
        onEndSession={handleFinish}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setShowSessions(true);
        }}
        onOpenSettings={() => setShowSettings(true)}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onToggleLockNorth={() => setLockNorth((v) => !v)}
      />
      {showTankSummary && (
        <TankSummary
          tankNumber={tankNumber}
          swaths={currentTankSwaths}
          onSave={handleTankSave}
          onCancel={handleTankCancel}
        />
      )}
      {showSummary && (
        <SessionSummary
          defaultName={`Session ${new Date().toLocaleDateString()}`}
          tanks={finishedTanks}
          onSave={handleSaveSummary}
          onCancel={handleCancelSummary}
          onDeleteJob={handleCancelJob}
        />
      )}
      {showSessions && (
        <SessionList
          sessions={sessions}
          onLoad={handleLoadSession}
          onResume={handleResumeSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowSessions(false)}
          onBack={() => setShowSessions(false)}
        />
      )}
      {showSettings && (
        <div className="session-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="session-panel settings-sheet">
            <div className="session-header">
              <h2>Settings</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="menu-unit-toggle" style={{ marginTop: 0 }}>
              <span className="menu-unit-label">Units</span>
              <div className="menu-unit-segmented">
                <button
                  className={`menu-unit-btn${unitSystem === 'imperial' ? ' active' : ''}`}
                  onClick={() => handleUnitSystem('imperial')}
                >
                  Imperial
                </button>
                <button
                  className={`menu-unit-btn${unitSystem === 'metric' ? ' active' : ''}`}
                  onClick={() => handleUnitSystem('metric')}
                >
                  Metric
                </button>
              </div>
            </div>
            <div className="menu-unit-toggle">
              <span className="menu-unit-label">Spray View</span>
              <div className="menu-unit-segmented">
                <button
                  className={`menu-unit-btn${sprayView === 'tilted' ? ' active' : ''}`}
                  onClick={() => { setSprayView('tilted'); localStorage.setItem('swathtrak_spray_view', 'tilted'); }}
                >
                  Tilted
                </button>
                <button
                  className={`menu-unit-btn${sprayView === 'overhead' ? ' active' : ''}`}
                  onClick={() => { setSprayView('overhead'); localStorage.setItem('swathtrak_spray_view', 'overhead'); }}
                >
                  Overhead
                </button>
              </div>
            </div>
            <div className="menu-options" style={{ marginTop: 16 }}>
              <button className="menu-option" onClick={() => { setShowSettings(false); setShowHowTo(true); }}>
                <div className="menu-option-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>
                <div className="menu-option-text">
                  <span className="menu-option-title">How To Use</span>
                  <span className="menu-option-sub">Step-by-step guide</span>
                </div>
                <svg className="menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <a className="menu-support" href="mailto:support@swathtrak.com">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Questions or improvements? Contact support@swathtrak.com
            </a>
          </div>
        </div>
      )}
      {showHowTo && (
        <HowTo
          onClose={() => setShowHowTo(false)}
          onBack={() => { setShowHowTo(false); setShowSettings(true); }}
        />
      )}
    </div>
    </UnitSystemContext.Provider>
  );
}

function calculateTotalAcres(
  swaths: SpraySwath[],
  activeSwath: SpraySwath | null
): number {
  const allSwaths = activeSwath ? [...swaths, activeSwath] : swaths;
  const polygons = allSwaths.map((s) => buildSwathPolygon(s.points, s.widthFeet));
  return calculateAcres(polygons);
}

export default App;
