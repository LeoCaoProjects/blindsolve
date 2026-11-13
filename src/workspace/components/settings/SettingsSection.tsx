import React from "react";

export function SettingsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-section={id}
      className="scroll-mt-6 border-t border-line pb-12 pt-6 first:border-t-0 first:pt-0"
    >
      <h2 className="text-[14px] font-medium text-ink">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children,
  inlineControl = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  inlineControl?: boolean;
}) {
  const id = React.useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className={`flex gap-3 border-b border-line py-4 first:pt-0 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${inlineControl ? "flex-row items-center justify-between" : "flex-col items-start"}`}
    >
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-[13.5px] text-ink">
          {label}
        </p>
        {hint && (
          <p
            id={`${id}-hint`}
            className="mt-0.5 max-w-[64ch] text-[12.5px] leading-relaxed text-ink-3"
          >
            {hint}
          </p>
        )}
      </div>
      <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
