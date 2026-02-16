import { useState, useCallback, useRef, useEffect } from 'react';
import { SprayMap } from './components/SprayMap';
import { Controls } from './components/Controls';
import { SessionList } from './components/SessionList';
import { SessionSummary } from './components/SessionSummary';
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
import type { SpraySwath, SpraySession } from './types';
import './App.css';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function App() {
  const [isSpraying, setIsSpraying] = useState(false);
  const [sprayWidth, setSprayWidth] = useState(16);
  const [swaths, setSwaths] = useState<SpraySwath[]>([]);
  const [activeSwath, setActiveSwath] = useState<SpraySwath | null>(null);
  const [sessionId, setSessionId] = useState(() => {
    const saved = loadActiveSession();
    return saved ? saved.id : generateId();
  });
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<SpraySession[]>(loadSessions);
  const [pastSessionSwaths, setPastSessionSwaths] = useState<SpraySwath[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [finishedSwaths, setFinishedSwaths] = useState<SpraySwath[]>([]);

  const activeSwathRef = useRef(activeSwath);
  activeSwathRef.current = activeSwath;

  // GPS is always active so we can show position on map
  const { position, error: gpsError, accuracy: gpsAccuracy } = useGps(true);

  // Restore active session on mount
  useEffect(() => {
    const saved = loadActiveSession();
    if (saved) {
      setSwaths(saved.swaths);
    }
  }, []);

  // Auto-save active session whenever swaths change
  useEffect(() => {
    const session: SpraySession = {
      id: sessionId,
      name: `Session ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      swaths,
      totalAcres: calculateTotalAcres(swaths, activeSwath),
    };
    saveActiveSession(session);
  }, [swaths, activeSwath, sessionId]);

  // Record GPS points while spraying
  useEffect(() => {
    if (!isSpraying || !position || !activeSwathRef.current) return;

    const current = activeSwathRef.current;
    const lastPoint = current.points[current.points.length - 1];

    // Only add point if we've moved at least 3 feet (reduce noise)
    if (lastPoint && distanceFeet(lastPoint, position) < 3) return;

    // Reject GPS outliers: if speed between points exceeds 60 mph, skip it
    // (an ATV spraying isn't going that fast - it's a GPS glitch)
    if (lastPoint && lastPoint.timestamp && position.timestamp) {
      const elapsedSec = (position.timestamp - lastPoint.timestamp) / 1000;
      if (elapsedSec > 0) {
        const feet = distanceFeet(lastPoint, position);
        const mph = (feet / elapsedSec) * 0.6818; // ft/s to mph
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
      // Stop spraying - save the active swath
      if (activeSwathRef.current && activeSwathRef.current.points.length >= 2) {
        const finished: SpraySwath = {
          ...activeSwathRef.current,
          endTime: Date.now(),
        };
        setSwaths((prev) => [...prev, finished]);
      }
      setActiveSwath(null);
      setIsSpraying(false);
    } else {
      // Start spraying
      const newSwath: SpraySwath = {
        id: generateId(),
        points: position ? [position] : [],
        widthFeet: sprayWidth,
        color: '#00e676',
        startTime: Date.now(),
      };
      setActiveSwath(newSwath);
      setIsSpraying(true);
    }
  }, [isSpraying, position, sprayWidth]);

  const handleFinish = useCallback(() => {
    let allSwaths = swaths;
    if (isSpraying && activeSwathRef.current) {
      const finished: SpraySwath = {
        ...activeSwathRef.current,
        endTime: Date.now(),
      };
      allSwaths = [...swaths, finished];
    }

    if (allSwaths.length === 0) return;

    // Stop spraying and stash the finalized swaths for the summary
    setIsSpraying(false);
    setActiveSwath(null);
    setFinishedSwaths(allSwaths);
    setShowSummary(true);
  }, [isSpraying, swaths]);

  const handleSaveSummary = useCallback((name: string, gallons: number | undefined) => {
    const session: SpraySession = {
      id: sessionId,
      name,
      date: new Date().toLocaleDateString(),
      swaths: finishedSwaths,
      totalAcres: calculateTotalAcres(finishedSwaths, null),
      gallons,
    };
    saveSession(session);

    setSwaths([]);
    setFinishedSwaths([]);
    setShowSummary(false);
    setSessionId(generateId());
    clearActiveSession();
    setSessions(loadSessions());
  }, [sessionId, finishedSwaths]);

  const handleCancelSummary = useCallback(() => {
    // Put the swaths back so the user can keep spraying
    setSwaths(finishedSwaths);
    setFinishedSwaths([]);
    setShowSummary(false);
  }, [finishedSwaths]);

  const handleLoadSession = useCallback((session: SpraySession) => {
    setPastSessionSwaths(session.swaths);
    setShowSessions(false);
  }, []);

  const handleResumeSession = useCallback((session: SpraySession) => {
    // Stop any active spraying first
    if (isSpraying && activeSwathRef.current) {
      setIsSpraying(false);
      setActiveSwath(null);
    }

    // Restore the session as the active one
    setSessionId(session.id);
    setSwaths(session.swaths);
    setPastSessionSwaths([]);

    // Remove it from saved sessions (it's now the active session)
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

  const totalAcres = calculateTotalAcres(swaths, activeSwath);

  return (
    <div className="app">
      <SprayMap
        position={position}
        swaths={swaths}
        activeSwath={activeSwath}
        pastSessionSwaths={pastSessionSwaths}
      />
      <Controls
        isSpraying={isSpraying}
        sprayWidth={sprayWidth}
        totalAcres={totalAcres}
        gpsAccuracy={gpsAccuracy}
        gpsError={gpsError}
        onSprayToggle={handleSprayToggle}
        onWidthChange={setSprayWidth}
        onEndSession={handleFinish}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setShowSessions(true);
        }}
      />
      {showSummary && (
        <SessionSummary
          defaultName={`Session ${new Date().toLocaleDateString()}`}
          swaths={finishedSwaths}
          totalAcres={calculateTotalAcres(finishedSwaths, null)}
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
