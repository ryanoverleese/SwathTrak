import { useState, useRef, useEffect } from 'react';
import type { SpraySession } from '../types';

interface SessionListProps {
  sessions: SpraySession[];
  onLoad: (session: SpraySession) => void;
  onResume: (session: SpraySession) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SessionList({ sessions, onLoad, onResume, onRename, onDelete, onClose }: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
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
                    {session.swaths.length} swath{session.swaths.length !== 1 ? 's' : ''} &middot;{' '}
                    {session.totalAcres.toFixed(2)} acres
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
