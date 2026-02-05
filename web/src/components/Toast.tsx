import { useToastStore } from '../store/toast';
import './Toast.css';

export default function Toast() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="rd-toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rd-toast rd-toast--${t.type}`}
          role="alert"
          onMouseEnter={() => clearTimeout((t as { _tid?: number })._tid)}
        >
          <span className="rd-toast__message">{t.message}</span>
          <button
            type="button"
            className="rd-toast__close"
            onClick={() => remove(t.id)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
