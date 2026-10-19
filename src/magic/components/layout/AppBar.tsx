import React from 'react';
import { KeyboardIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppData } from '../../contexts/AppDataContext';
import { primaryNav, settingsNav } from '../../data/navigation';
import { IconButton } from '../common/IconButton';

interface AppBarProps {
  className?: string;
  onShortcuts: () => void;
  /** Page-specific controls, placed before the global icons */
  right?: React.ReactNode;
}

export function AppBar({ className = '', onShortcuts, right }: AppBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { navGuard } = useAppData();
  const SettingsIcon = settingsNav.icon;

  const go = (path: string) => {
    if (path === pathname) return;
    if (navGuard && !navGuard(path)) return;
    navigate(path);
  };

  return (
    <>
      {pathname === "/" && <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-line px-3 text-[11px] text-ink-3 md:px-5"><h1 className="truncate">BlindSolve <span className="ml-1">· 3×3 blindfolded cube timer &amp; training</span></h1><Link to="/about" className="shrink-0 underline underline-offset-2">Guide</Link></div>}
    <header
      className={`flex h-11 shrink-0 items-stretch justify-between border-b border-line pl-1 pr-3 transition-opacity duration-300 ease-out md:pl-4 ${className}`}>
      
      <nav aria-label="Sections" className="scroll-none flex min-w-0 items-stretch overflow-x-auto">
        <ul className="flex items-stretch">
          {primaryNav.map((item) => {
            const active = item.path === pathname;
            return (
              <li key={item.id} className="flex">
                <Link
                  to={item.path}
                  onClick={(event) => {
                    if (item.path === pathname) return;
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if (navGuard && !navGuard(item.path)) event.preventDefault();
                  }}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  className={`relative flex items-center whitespace-nowrap px-1.5 text-[12.5px] transition-colors duration-150 ease-out sm:px-3 md:px-4 ${
                  active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
                  }>
                  
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {active && <span aria-hidden className="absolute inset-x-3 -bottom-px h-px bg-ink md:inset-x-4" />}
                </Link>
              </li>);

          })}
        </ul>
      </nav>
      <div className="flex shrink-0 items-center gap-1">
        {right}
        <IconButton size="sm" label="Keyboard shortcuts  ?" onClick={onShortcuts} className="hidden md:inline-flex">
          <KeyboardIcon strokeWidth={1.5} />
        </IconButton>
        <IconButton size="sm" label={settingsNav.label} pressed={pathname === settingsNav.path} onClick={() => go(settingsNav.path)}>
          <SettingsIcon strokeWidth={1.5} />
        </IconButton>
      </div>
    </header></>);

}
