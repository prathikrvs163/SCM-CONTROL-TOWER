import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChevronRight,
  Command,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Zap,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useTheme } from '../app/providers/contexts';
import type { ThemePreference } from '../app/providers/contexts';
import { Button } from '../components/ui/Button';
import { cx } from '../components/ui/cx';
import { fetchExceptions } from '../features/exceptions/exceptionSlice';
import { CommandPalette } from './CommandPalette';
import { findNavGroup, findNavItem, NAV_GROUPS } from './navigation';

const COLLAPSE_KEY = 'scm-sidebar-collapsed';

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_LABEL: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { preference, setPreference } = useTheme();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const exceptionCount = useAppSelector(
    (state) => state.exceptions.data?.totalExceptions ?? 0,
  );
  const highCount = useAppSelector(
    (state) => state.exceptions.data?.highCount ?? 0,
  );

  // Keep the sidebar badge populated on every page.
  useEffect(() => {
    dispatch(fetchExceptions({}));
  }, [dispatch]);

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }

  const currentItem = findNavItem(location.pathname);
  const currentGroup = findNavGroup(location.pathname);
  const ThemeIcon =
    preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;

  return (
    <div
      className={cx(
        'app-shell',
        collapsed && 'is-collapsed',
        mobileOpen && 'is-mobile-open',
      )}
    >
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Zap />
          </span>
          <span className="brand-text">
            <strong>Control Tower</strong>
            <span>Supply chain operations</span>
          </span>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isExceptions = item.path === '/exceptions';

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className="nav-link"
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span className="nav-label">{item.label}</span>
                    {isExceptions && exceptionCount > 0 && (
                      <>
                        <span
                          className="nav-count"
                          aria-label={`${exceptionCount} open exceptions`}
                        >
                          {exceptionCount}
                        </span>
                        {collapsed && highCount > 0 && (
                          <span className="nav-dot desktop-only" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="nav-link"
            onClick={() => setPreference(THEME_CYCLE[preference])}
            title={`Theme: ${THEME_LABEL[preference]}`}
          >
            <ThemeIcon aria-hidden="true" />
            <span className="nav-label">
              Theme: {THEME_LABEL[preference]}
            </span>
          </button>
          <button
            type="button"
            className="nav-link desktop-only"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span className="nav-label">Collapse sidebar</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      )}

      <div className="app-main">
        <header className="topbar">
          <Button
            variant="ghost"
            size="sm"
            className="mobile-only"
            icon={<Menu />}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          />

          <nav className="breadcrumb" aria-label="Breadcrumb">
            {currentGroup && <span>{currentGroup.label}</span>}
            {currentGroup && <ChevronRight aria-hidden="true" />}
            <strong>{currentItem?.label ?? 'Not found'}</strong>
          </nav>

          <div className="topbar-spacer" />

          <button
            type="button"
            className="command-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
          >
            <Search aria-hidden="true" />
            <span>Search or jump to...</span>
            <span className="kbd">
              <Command style={{ width: 11, height: 11 }} />K
            </span>
          </button>

          <Button
            variant="ghost"
            size="sm"
            icon={<ThemeIcon />}
            onClick={() => setPreference(THEME_CYCLE[preference])}
            aria-label={`Theme: ${THEME_LABEL[preference]}. Switch to ${THEME_LABEL[THEME_CYCLE[preference]]}`}
            title={`Theme: ${THEME_LABEL[preference]}`}
          />
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
