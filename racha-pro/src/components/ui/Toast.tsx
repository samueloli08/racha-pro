import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4D7C0F]" />,
  info: <Info className="h-4 w-4 shrink-0 text-blue-600" />,
  error: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="flex max-w-md animate-toast-in items-center gap-2.5 rounded-2xl border border-[#0D1510]/10 bg-white/95 px-4 py-3 text-xs font-bold text-[#0D1510] shadow-2xl shadow-[#0D1510]/15 backdrop-blur-xl"
          >
            {ICONS[t.kind]}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
