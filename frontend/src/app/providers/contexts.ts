import { createContext, useContext } from 'react';

/* ---------- Theme ---------- */

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

/* ---------- Toasts ---------- */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
}

/** Without a provider (as in isolated component tests) toasts are a no-op. */
export const ToastContext = createContext<(options: ToastOptions) => void>(
  () => undefined,
);

export function useToast() {
  return useContext(ToastContext);
}

/* ---------- Confirm dialog ---------- */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
}

/**
 * Without a provider, fall back to the browser's confirm so behaviour is
 * preserved wherever a component renders.
 */
export const ConfirmContext = createContext<
  (options: ConfirmOptions) => Promise<boolean>
>((options) =>
  Promise.resolve(
    window.confirm(
      options.description
        ? `${options.title}\n\n${options.description}`
        : options.title,
    ),
  ),
);

export function useConfirm() {
  return useContext(ConfirmContext);
}
