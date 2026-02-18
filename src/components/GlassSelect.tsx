import { useState, useRef, useEffect } from 'react';

interface GlassSelectProps {
  value: string;
  display: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  triggerClass?: string;
  tapKey?: number;
}

export function GlassSelect({ value, display, options, onSelect, triggerClass = 'summary-value tappable', tapKey }: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
    };
  }, [open]);

  return (
    <div className="glass-select" ref={ref}>
      <span
        key={tapKey}
        className={triggerClass}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {display}
      </span>
      {open && (
        <div className="glass-select-menu">
          {options.map((opt) => (
            <button
              key={opt}
              className={`glass-select-option${opt === value ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelect(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
