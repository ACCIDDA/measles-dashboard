import { useEffect } from 'react';

// Transient toast shown when a user activates a state that is not yet
// drillable. The message is announced to screen readers via the
// role="status" + aria-live="polite" attributes, and auto-dismisses after
// `durationMs` so the user is not blocked.
//
// Props:
//   stateName: the human-readable state name to announce (e.g. "Texas").
//              When falsy, the component renders nothing.
//   onDismiss: called when the toast auto-dismisses or the user clicks the
//              close button.
//   durationMs: auto-dismiss delay; defaults to 4000.
export default function NoDataToast({ stateName, onDismiss, durationMs = 4000 }) {
  useEffect(() => {
    if (!stateName) return undefined;
    const id = setTimeout(() => {
      if (typeof onDismiss === 'function') onDismiss();
    }, durationMs);
    return () => clearTimeout(id);
  }, [stateName, onDismiss, durationMs]);

  if (!stateName) return null;

  const message = `Data not yet available for ${stateName}.`;

  return (
    <div
      id="no-data-toast"
      className="no-data-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="no-data-toast"
    >
      <span className="no-data-toast-msg">{message}</span>
      <button
        type="button"
        className="no-data-toast-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        {'×'}
      </button>
    </div>
  );
}
