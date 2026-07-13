import { useEffect } from 'react';
import { useStore, type Toast } from '../store/useStore';
import { BellIcon, CloseIcon } from './icons';

/** Transient notifications (e.g. when a price alert fires during replay). */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-50 flex w-80 -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), 5000);
    return () => window.clearTimeout(id);
  }, [toast.id, dismiss]);

  return (
    <div className="pointer-events-auto flex animate-[fadeIn_150ms_ease-out] items-center gap-2 rounded-md border border-border bg-panel-alt px-3 py-2 text-xs text-white shadow-lg shadow-black/40">
      <span className="text-[#f0b90b]">
        <BellIcon width={14} height={14} />
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-muted hover:text-white"
      >
        <CloseIcon width={12} height={12} />
      </button>
    </div>
  );
}
