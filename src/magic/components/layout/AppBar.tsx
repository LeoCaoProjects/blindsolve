import React from "react";
import { useGlobalNavigation } from "./GlobalNavigation";

interface AppBarProps {
  className?: string;
  onShortcuts: () => void;
  right?: React.ReactNode;
}

/** Page-specific controls; the global rail/dock lives in GlobalNavigationShell. */
export function AppBar({ className = "", onShortcuts, right }: AppBarProps) {
  useGlobalNavigation({ className, onShortcuts });
  return right ? (
    <header
      className={`flex h-11 shrink-0 items-center justify-end border-b border-line px-3 ${className}`}
    >
      {right}
    </header>
  ) : null;
}
