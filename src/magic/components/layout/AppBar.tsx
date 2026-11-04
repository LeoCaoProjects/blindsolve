import React from "react";
import { KeyboardIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAppData } from "../../contexts/AppDataContext";
import { primaryNav, settingsNav } from "../../data/navigation";

interface AppBarProps {
  className?: string;
  onShortcuts: () => void;
  /** Page-specific controls, placed before the global icons */
  right?: React.ReactNode;
}

// Adapted from Magic Patterns NavRail.tsx and MobileDock.tsx; no prototype state or logo.
export function AppBar({ className = "", onShortcuts, right }: AppBarProps) {
  const { pathname } = useLocation();
  const { navGuard } = useAppData();
  const items = [
    primaryNav[0],
    primaryNav[3],
    primaryNav[1],
    primaryNav[2],
    settingsNav,
  ];
  const onNav = (event: React.MouseEvent, path: string) => {
    if (
      path === pathname ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (navGuard && !navGuard(path)) event.preventDefault();
  };
  const links = (mobile: boolean) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = pathname === item.path;
      return (
        <li
          key={item.id}
          className={!mobile && item.id === "settings" ? "mt-auto" : undefined}
        >
          <Link
            to={item.path}
            onClick={(e) => onNav(e, item.path)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`${mobile ? "flex h-full flex-col items-center justify-center gap-1" : "group flex w-14 flex-col items-center gap-1 rounded-lg py-2"} transition-colors duration-150 ease-out ${active ? "text-ink " + (mobile ? "" : "bg-raised") : "text-ink-3 hover:text-ink"}`}
          >
            <Icon
              className={mobile ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]"}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="text-[10.5px] font-medium leading-none tracking-[-0.005em]">
              {item.short}
            </span>
          </Link>
        </li>
      );
    });
  return (
    <>
      <nav
        aria-label="Sections"
        className={`fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col items-center border-r border-line bg-bg py-3 font-sans transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100 md:flex ${className}`}
      >
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5">{links(false)}</ul>
        <button
          type="button"
          onClick={onShortcuts}
          aria-label="Keyboard shortcuts  ?"
          title="Keyboard shortcuts  ?"
          className="mt-1 flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
        >
          <KeyboardIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </nav>
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] font-sans md:hidden"
      >
        <ul className="grid h-14 grid-cols-5">{links(true)}</ul>
      </nav>
      {right ? (
        <header
          className={`flex h-11 shrink-0 items-center justify-end border-b border-line px-3 ${className}`}
        >
          {right}
        </header>
      ) : null}
    </>
  );
}
