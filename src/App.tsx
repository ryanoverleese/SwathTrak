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
  const [showSessions, setShowSessions] = useState(false);
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
    setSessionId(generateId());
    clearActiveSession();
  }, []);

  const totalAcres = calculateTotalAcres(allSwaths, activeSwath);

  return (
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
        onCancelJob={handleCancelJob}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setShowSessions(true);
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
        />
      )}
    </div>
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
