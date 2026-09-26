import React from 'react';

export function SettingsSection({ id, title, children }: {id: string;title: string;children: React.ReactNode;}) {
  return (
    <section id={id} data-section={id} className="scroll-mt-6 border-t border-line pb-12 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-[13px] font-medium text-ink">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>);

}

export function SettingsRow({ label, hint, children }: {label: string;hint?: string;children: React.ReactNode;}) {
  return (
    <div className="flex items-center justify-between gap-8 border-b border-line py-4 first:pt-0 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] text-ink-3">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>);

}

export function SecondaryButton({ children, onClick, disabled }: {children: React.ReactNode;onClick: () => void;disabled?: boolean;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-line-strong px-3 text-[12.5px] text-ink transition-colors duration-150 ease-out hover:bg-hover disabled:border-line disabled:text-ink-3 disabled:hover:bg-transparent">
      
      {children}
    </button>);

}