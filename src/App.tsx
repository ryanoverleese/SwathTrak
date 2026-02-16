import { useState, useCallback, useRef, useEffect } from 'react';
import { SprayMap } from './components/SprayMap';
import { Controls } from './components/Controls';
import { SessionList } from './components/SessionList';
import { useGps } from './hooks/useGps';
import { buildSwathPolygon, calculateAcres, distanceFeet } from './utils/geo';
import {
  loadSessions,
  saveSession,
  deleteSession,
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
  const [sessionId] = useState(() => {
    const saved = loadActiveSession();
    return saved ? saved.id : generateId();
  });
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<SpraySession[]>(loadSessions);
  const [pastSessionSwaths, setPastSessionSwaths] = useState<SpraySwath[]>([]);

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

  const handleEndSession = useCallback(() => {
    let allSwaths = swaths;
    if (isSpraying && activeSwathRef.current) {
      const finished: SpraySwath = {
        ...activeSwathRef.current,
        endTime: Date.now(),
      };
      allSwaths = [...swaths, finished];
    }

    if (allSwaths.length > 0) {
      const session: SpraySession = {
        id: sessionId,
        name: `Session ${new Date().toLocaleDateString()}`,
        date: new Date().toLocaleDateString(),
        swaths: allSwaths,
        totalAcres: calculateTotalAcres(allSwaths, null),
      };
      saveSession(session);
    }

    setSwaths([]);
    setActiveSwath(null);
    setIsSpraying(false);
    clearActiveSession();
    setSessions(loadSessions());
  }, [isSpraying, swaths, sessionId]);

  const handleLoadSession = useCallback((session: SpraySession) => {
    setPastSessionSwaths(session.swaths);
    setShowSessions(false);
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
        onEndSession={handleEndSession}
        onOpenSessions={() => {
          setSessions(loadSessions());
          setShowSessions(true);
        }}
      />
      {showSessions && (
        <SessionList
          sessions={sessions}
          onLoad={handleLoadSession}
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
