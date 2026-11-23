import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Overlay';
import { ConfirmContext, ToastContext } from './contexts';
import type { ConfirmOptions, ToastOptions, ToastTone } from './contexts';

interface ToastItem extends ToastOptions {
  id: number;
}

const TOAST_ICON: Record<ToastTone, ReactNode> = {
  success: <CircleCheck />,
  error: <CircleAlert />,
  info: <Info />,
};

const TOAST_DURATION_MS = 4500;

/** Toast notifications and the confirm dialog for the whole app. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...options, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  function settle(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <Modal
          open={confirmState !== null}
          onClose={() => settle(false)}
          title={confirmState?.title ?? ''}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                Cancel
              </Button>
              <Button
                variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                data-autofocus
              >
                {confirmState?.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <p className="text-secondary" style={{ fontSize: 13.5 }}>
            {confirmState?.description}
          </p>
        </Modal>

        {createPortal(
          <div className="toast-region" aria-live="polite" role="status">
            {toasts.map((item) => (
              <div
                key={item.id}
                className="toast"
                data-tone={item.tone ?? 'success'}
              >
                <span className="toast-icon">
                  {TOAST_ICON[item.tone ?? 'success']}
                </span>
                <div className="toast-content">
                  <div className="toast-title">{item.title}</div>
                  {item.description && (
                    <div className="toast-description">{item.description}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X />}
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
