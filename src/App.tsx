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

  const [restoredSession] = useState(loadActiveSession);

  // Completed tanks in the current session
  const [tanks, setTanks] = useState<Tank[]>(() => restoredSession?.tanks || []);
  // Swaths for the current (active) tank
  const [currentTankSwaths, setCurrentTankSwaths] = useState<SpraySwath[]>(() =>
    restoredSession?.currentTank?.swaths
      || (restoredSession && restoredSession.tanks.length === 0 ? restoredSession.swaths : undefined)
      || []);
  const [currentTankStart, setCurrentTankStart] = useState(() => restoredSession?.currentTank?.startTime ?? Date.now());

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

  const lastFixTimeRef = useRef<number | null>(null);
  const finishSnapshotRef = useRef<{
    isSpraying: boolean;
    activeSwath: SpraySwath | null;
    currentTankSwaths: SpraySwath[];
    currentTankStart: number;
  } | null>(null);

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
  const compassRotation = !lockNorth && heading != null ? heading : 0;

  // Auto-save active session whenever state changes
  useEffect(() => {
    const session: SpraySession = {
      id: sessionId,
      name: `Session ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      tanks,
      currentTank: {
        id: `${sessionId}_current`,
        swaths: activeSwath ? [...currentTankSwaths, activeSwath] : currentTankSwaths,
        startTime: currentTankStart,
      },
      totalAcres: calculateTotalAcres(allSwaths, activeSwath),
    };
    saveActiveSession(session);
  }, [tanks, currentTankSwaths, currentTankStart, activeSwath, sessionId]);

  // Keep screen awake while spraying so GPS doesn't pause when the display sleeps
  useEffect(() => {
    if (!isSpraying || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* not supported */ }
    };
    // Re-acquire if the system releases the lock (e.g. tab hidden then visible)
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [isSpraying]);

  // Record GPS points while spraying
  useEffect(() => {
    if (!isSpraying || !position || !activeSwathRef.current) return;

    const current = activeSwathRef.current;
    const lastPoint = current.points[current.points.length - 1];

    const lastFixTime = lastFixTimeRef.current;
    lastFixTimeRef.current = position.timestamp;
    if (lastFixTime != null && position.timestamp - lastFixTime > 8000) {
      if (current.points.length >= 2) {
        setCurrentTankSwaths(prev => [...prev, { ...current, endTime: lastPoint.timestamp }]);
      }
      // Drop the first post-wake fix and seed the new segment with the next fix.
      setActiveSwath({ ...current, id: generateId(), points: [], startTime: position.timestamp });
      return;
    }

    // Only add point if we've moved at least 3 feet (reduce noise)
    if (lastPoint && distanceFeet(lastPoint, position) < 3) return;

    // Also reject jumps whose implied speed exceeds 60 mph.
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
      // Pause — finalize this segment so the gap isn't marked as sprayed
      if (activeSwathRef.current && activeSwathRef.current.points.length >= 2) {
        const finished: SpraySwath = { ...activeSwathRef.current, endTime: Date.now() };
        setCurrentTankSwaths(prev => [...prev, finished]);
      }
      setIsSpraying(false);
      setActiveSwath(null);
    } else {
      lastFixTimeRef.current = position?.timestamp ?? null;
      // Start / Resume — begin a new swath segment
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

  const handleWidthChange = useCallback((width: number) => {
    if (width === sprayWidth) return;
    const current = activeSwathRef.current;
    if (isSpraying && current) {
      if (current.points.length >= 2) {
        setCurrentTankSwaths(prev => [...prev, { ...current, endTime: Date.now() }]);
      }
      const lastPoint = current.points[current.points.length - 1];
      setActiveSwath({
        ...current,
        id: generateId(),
        points: lastPoint ? [lastPoint] : [],
        widthFeet: width,
        startTime: Date.now(),
      });
    }
    setSprayWidth(width);
  }, [isSpraying, sprayWidth]);

  /** Finalize the current tank's swaths (stopping spray if active or paused) */
  const finalizeCurrentTankSwaths = useCallback((): SpraySwath[] => {
    let swaths = currentTankSwaths;
    if (activeSwathRef.current && activeSwathRef.current.points.length >= 2) {
      const finished: SpraySwath = {
        ...activeSwathRef.current,
        endTime: Date.now(),
      };
      swaths = [...swaths, finished];
    }
    setIsSpraying(false);
    setActiveSwath(null);
    return swaths;
  }, [currentTankSwaths]);

  // ---- Refill flow ----
  const handleRefill = useCallback(() => {
    const swaths = finalizeCurrentTankSwaths();
    if (swaths.length === 0) return;
    setCurrentTankSwaths(swaths);
    setShowTankSummary(true);
  }, [finalizeCurrentTankSwaths]);

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
    finishSnapshotRef.current = {
      isSpraying, activeSwath: activeSwathRef.current, currentTankSwaths, currentTankStart,
    };
    const swaths = finalizeCurrentTankSwaths();
    setCurrentTankSwaths(swaths);

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
  }, [isSpraying, currentTankSwaths, tanks, currentTankStart, finalizeCurrentTankSwaths]);

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
    const snapshot = finishSnapshotRef.current;
    if (snapshot) {
      setIsSpraying(snapshot.isSpraying);
      setActiveSwath(snapshot.activeSwath);
      setCurrentTankSwaths(snapshot.currentTankSwaths);
      setCurrentTankStart(snapshot.currentTankStart);
    }
    finishSnapshotRef.current = null;
    setFinishedTanks([]);
    setShowSummary(false);
  }, []);

  const handleLoadSession = useCallback((session: SpraySession) => {
    const swaths = [...session.tanks.flatMap((t) => t.swaths), ...(session.currentTank?.swaths || [])];
    setPastSessionSwaths(swaths);
    setShowSessions(false);
  }, []);

  const handleResumeSession = useCallback((session: SpraySession) => {
    const swaths = finalizeCurrentTankSwaths();
    if (tanks.length > 0 || swaths.length > 0) {
      saveSession({
        id: sessionId,
        name: `Session ${new Date().toLocaleDateString()}`,
        date: new Date().toLocaleDateString(),
        tanks: swaths.length > 0
          ? [...tanks, { id: `${sessionId}_current`, swaths, startTime: currentTankStart, endTime: Date.now() }]
          : tanks,
        totalAcres: calculateTotalAcres([...tanks.flatMap(t => t.swaths), ...swaths], null),
      });
    }

    setSessionId(session.id);
    setTanks(session.tanks);
    setCurrentTankSwaths(session.currentTank?.swaths || []);
    setCurrentTankStart(session.currentTank?.startTime ?? Date.now());
    setPastSessionSwaths([]);

    deleteSession(session.id);
    setSessions(loadSessions());
    setShowSessions(false);
  }, [tanks, currentTankStart, sessionId, finalizeCurrentTankSwaths]);

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
        onSprayToggle={handleSprayToggle}
        onWidthChange={handleWidthChange}
        onRefill={handleRefill}
        onEndSession={handleFinish}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setShowSessions(true);
        }}
        onOpenSettings={() => setShowSettings(true)}
        sprayView={sprayView}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onToggleLockNorth={() => setLockNorth((v) => !v)}
        onToggleSprayView={() => {
          const next = sprayView === 'tilted' ? 'overhead' : 'tilted';
          setSprayView(next);
          localStorage.setItem('swathtrak_spray_view', next);
        }}
      />
      {showTankSummary && (
        <TankSummary
          tankNumber={tankNumber}
          swaths={currentTankSwaths}
          onSave={handleTankSave}
          onCancel={handleTankCancel}
          onDeleteJob={handleCancelJob}
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
