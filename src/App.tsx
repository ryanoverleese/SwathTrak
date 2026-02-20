import { useState, useCallback, useRef, useEffect } from 'react';
import { SprayMap } from './components/SprayMap';
import { Controls } from './components/Controls';
import { SessionList } from './components/SessionList';
import { SessionSummary } from './components/SessionSummary';
import { TankSummary } from './components/TankSummary';
import { useGps } from './hooks/useGps';
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
  const [showMenu, setShowMenu] = useState(false);
  const [menuView, setMenuView] = useState<'menu' | 'sessions'>('menu');
  const [sessions, setSessions] = useState<SpraySession[]>(loadSessions);
  const [pastSessionSwaths, setPastSessionSwaths] = useState<SpraySwath[]>([]);

  // Modals
  const [showSummary, setShowSummary] = useState(false);
  const [showTankSummary, setShowTankSummary] = useState(false);
  const [finishedTanks, setFinishedTanks] = useState<Tank[]>([]);

  const activeSwathRef = useRef(activeSwath);
  activeSwathRef.current = activeSwath;

  // GPS is always active so we can show position on map
  const { position, error: gpsError, accuracy: gpsAccuracy } = useGps(true);

  // Current tank index (completed tanks + 1)
  const tankNumber = tanks.length + 1;

  // All swaths across all tanks + current tank (for map rendering)
  const allSwaths: SpraySwath[] = [
    ...tanks.flatMap((t) => t.swaths),
    ...currentTankSwaths,
  ];

  // Restore active session on mount
  useEffect(() => {
    const saved = loadActiveSession();
    if (saved) {
      setTanks(saved.tanks || []);
      // If there were tanks, the "current" swaths are empty (user needs to start a new tank)
      // If it's a migrated session, the first tank's swaths become the current tank swaths
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
    // Stash swaths temporarily — TankSummary will let user input gallons
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
    // Just close the modal, keep swaths in current tank
    setShowTankSummary(false);
  }, []);

  // ---- Finish session flow ----
  const handleFinish = useCallback(() => {
    const swaths = finalizeCurrentTankSwaths();

    // Build the full list of tanks including the current one
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
    // Apply per-tank gallons
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
    // Put tanks back so the user can keep going
    // The last tank in finishedTanks becomes the current tank again
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
    setShowMenu(false);
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
    setShowMenu(false);
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
        position={position}
        swaths={allSwaths}
        activeSwath={activeSwath}
        pastSessionSwaths={pastSessionSwaths}
      />
      <Controls
        isSpraying={isSpraying}
        sprayWidth={sprayWidth}
        totalAcres={totalAcres}
        tankNumber={tankNumber}
        gpsAccuracy={gpsAccuracy}
        gpsError={gpsError}
        onSprayToggle={handleSprayToggle}
        onWidthChange={setSprayWidth}
        onRefill={handleRefill}
        onEndSession={handleFinish}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setMenuView('menu');
          setShowMenu(true);
        }}
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
      {showMenu && menuView === 'menu' && (
        <div className="session-overlay">
          <div className="session-panel menu-panel">
            <div className="session-header">
              <h2>Menu</h2>
              <button className="close-btn" onClick={() => setShowMenu(false)}>✕</button>
            </div>
            <div className="menu-options">
              <button className="menu-option" onClick={() => setMenuView('sessions')}>
                <div className="menu-option-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                    <path d="M10 9H8" />
                  </svg>
                </div>
                <div className="menu-option-text">
                  <span className="menu-option-title">Sessions</span>
                  <span className="menu-option-sub">{sessions.length} saved</span>
                </div>
                <svg className="menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="menu-unit-toggle">
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
          </div>
        </div>
      )}
      {showMenu && menuView === 'sessions' && (
        <SessionList
          sessions={sessions}
          onLoad={handleLoadSession}
          onResume={handleResumeSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowMenu(false)}
          onBack={() => setMenuView('menu')}
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
