import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cx } from './cx';

const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Open overlays, innermost last; only the top one handles keys. */
const overlayStack: symbol[] = [];

/**
 * Shared behaviour for modal surfaces: Escape closes, page scroll is locked,
 * focus moves inside on open, Tab stays inside, and focus returns to the
 * element that opened the surface on close.
 */
function useModalBehaviour(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const token = Symbol('overlay');
    overlayStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Prefer an explicit autofocus target, then the first field in a modal
    // body, then the surface itself (drawers), then anything focusable.
    const initial =
      container?.querySelector<HTMLElement>('[data-autofocus]') ??
      container?.querySelector<HTMLElement>(
        '.modal-body ' + FOCUSABLE.split(', ').join(', .modal-body '),
      ) ??
      (container?.tabIndex === -1 ? container : null) ??
      container?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (overlayStack[overlayStack.length - 1] !== token) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      overlayStack.splice(overlayStack.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, containerRef]);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehaviour(open, onClose, ref);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cx('modal', size !== 'md' && `modal-${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {description && (
              <p className="modal-description">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<X />}
            onClick={onClose}
            aria-label="Close dialog"
          />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Accessible name when the title is not plain text. */
  label: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  label,
  subtitle,
  actions,
  children,
}: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModalBehaviour(open, onClose, ref);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-overlay" onMouseDown={onClose} />
      <aside
        ref={ref}
        className="drawer"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="drawer-header">
          <div style={{ minWidth: 0 }}>
            {title}
            {subtitle && <div className="card-description">{subtitle}</div>}
          </div>
          <div className="btn-group">
            {actions}
            <Button
              variant="ghost"
              size="sm"
              icon={<X />}
              onClick={onClose}
              aria-label="Close panel"
            />
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
