import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Moon, Plus, Search, Sun } from 'lucide-react';

import { useTheme } from '../app/providers/contexts';
import { cx } from '../components/ui/cx';
import { NAV_ITEMS } from './navigation';

interface Command {
  id: string;
  group: 'Navigate' | 'Actions';
  label: string;
  keywords: string;
  icon: ReactNode;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** Ctrl/Cmd+K launcher for pages and common actions. */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { resolved, setPreference } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      ...NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return {
          id: `nav-${item.path}`,
          group: 'Navigate' as const,
          label: item.label,
          keywords: item.keywords,
          icon: <Icon />,
          hint: 'Page',
          run: () => navigate(item.path),
        };
      }),
      {
        id: 'new-order',
        group: 'Actions',
        label: 'Create order',
        keywords: 'new order demand',
        icon: <Plus />,
        run: () => navigate('/orders?new=1'),
      },
      {
        id: 'new-receipt',
        group: 'Actions',
        label: 'Create inbound receipt',
        keywords: 'new receipt supply purchase',
        icon: <Plus />,
        run: () => navigate('/supply?new=1'),
      },
      {
        id: 'toggle-theme',
        group: 'Actions',
        label: resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        keywords: 'theme dark light appearance',
        icon: resolved === 'dark' ? <Sun /> : <Moon />,
        run: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
      },
    ],
    [navigate, resolved, setPreference],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(term),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function close() {
    setQuery('');
    setActiveIndex(0);
    onClose();
  }

  function run(command: Command | undefined) {
    if (!command) return;
    close();
    command.run();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  let lastGroup: string | null = null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <div className="command-input-row">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            className="command-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search pages and actions..."
            aria-label="Search pages and actions"
          />
          <span className="kbd">Esc</span>
        </div>

        {results.length === 0 ? (
          <div className="command-empty">No matches for “{query}”.</div>
        ) : (
          <ul className="command-list" role="listbox">
            {results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;

              return (
                <li key={command.id} role="presentation">
                  {showGroup && (
                    <div className="command-group-label">{command.group}</div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cx(
                      'command-item',
                      index === activeIndex && 'is-active',
                    )}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => run(command)}
                  >
                    {command.icon}
                    {command.label}
                    {command.hint && (
                      <span className="command-item-hint">{command.hint}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="command-footer">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to
            move
          </span>
          <span>
            <span className="kbd">Enter</span> to open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
