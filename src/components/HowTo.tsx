interface HowToProps {
  onClose: () => void;
  onBack: () => void;
}

const steps = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" />
        <path d="M2 12h20" />
      </svg>
    ),
    title: 'Adjust Spray Width',
    text: 'Tap the width pill (e.g. "16 ft") in the top bar to open width settings. Use the slider or preset buttons to match your boom width.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" />
        <path d="M12 9v3" />
        <path d="M12 22v-4" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
      </svg>
    ),
    title: 'Wait for GPS Lock',
    text: 'Let the GPS settle for a few seconds until the accuracy indicator turns green. This ensures your swaths are recorded accurately.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
    title: 'Start Spraying',
    text: 'Tap the large SPRAY button at the bottom of the screen. Your GPS path will be recorded as a colored swath on the map.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <path d="M8 12h8" />
      </svg>
    ),
    title: 'Stop Spraying',
    text: 'While spraying, two buttons appear: "Stop & End" to finish the session, or "Stop & Refill" when your tank is empty.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6l3 3" />
        <circle cx="12" cy="14" r="8" />
      </svg>
    ),
    title: 'Refill a Tank',
    text: 'Tap "Stop & Refill" when you run out. Enter the gallons used (optional), then continue spraying on a new tank.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
    title: 'End & Save Session',
    text: 'Tap "Stop & End" or the red "Finish" button in the top bar. Name your session and enter volume per tank, then save.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
    ),
    title: 'View Past Sessions',
    text: 'Open the menu and tap "Sessions" to see saved sessions. Tap one to overlay it on the map, or resume where you left off.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Auto-Recovery',
    text: 'If the app closes unexpectedly, your session is automatically saved. It will be restored the next time you open the app.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
    title: 'Switch Units',
    text: 'Toggle between Imperial (acres, ft, gal) and Metric (hectares, m, L) from the menu. You can also tap values on screen to cycle units.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    title: 'Local Storage Only',
    text: 'All sessions are saved on this device only. If the app is deleted or browser data is cleared, your saved sessions will be permanently lost.',
  },
];

export function HowTo({ onClose, onBack }: HowToProps) {
  return (
    <div className="session-overlay">
      <div className="session-panel howto-panel">
        <div className="session-header">
          <button className="back-btn" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2>How To Use</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="howto-steps">
          {steps.map((step, i) => (
            <div className="howto-step" key={i}>
              <div className="howto-step-number">{i + 1}</div>
              <div className="howto-step-icon">{step.icon}</div>
              <div className="howto-step-content">
                <span className="howto-step-title">{step.title}</span>
                <span className="howto-step-text">{step.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
