import type { SpraySession } from '../types';

interface SessionListProps {
  sessions: SpraySession[];
  onLoad: (session: SpraySession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SessionList({ sessions, onLoad, onDelete, onClose }: SessionListProps) {
  return (
    <div className="session-overlay">
      <div className="session-panel">
        <div className="session-header">
          <h2>Saved Sessions</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {sessions.length === 0 ? (
          <p className="no-sessions">No saved sessions yet. Start spraying to create one!</p>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-item">
                <div className="session-info" onClick={() => onLoad(session)}>
                  <strong>{session.name}</strong>
                  <span>{session.date}</span>
                  <span>
                    {session.swaths.length} swath{session.swaths.length !== 1 ? 's' : ''} &middot;{' '}
                    {session.totalAcres.toFixed(2)} acres
                  </span>
                </div>
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
