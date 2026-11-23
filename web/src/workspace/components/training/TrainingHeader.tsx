import React, { useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  SubNavigation,
  SUB_NAV_EASE,
  SUB_NAV_ITEM,
} from "../layout/SubNavigation";
import { trainingModes } from "../../data/trainingModes";
import { TrainingSession } from "../../hooks/useTrainingSession";

function SidebarChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div className="mt-6">
      <span className="mb-2 block px-3 text-[12px] font-medium text-ink-3">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
        className="relative grid rounded-md bg-hover p-0.5"
        onKeyDown={(event) => {
          if (disabled || !["ArrowRight", "ArrowLeft"].includes(event.key))
            return;
          event.preventDefault();
          event.stopPropagation();
          const next =
            (options.findIndex((option) => option.value === value) +
              (event.key === "ArrowRight" ? 1 : -1) +
              options.length) %
            options.length;
          onChange(options[next].value);
          refs.current[next]?.focus();
        }}
      >
        {options.map((option, i) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            ref={(element) => {
              refs.current[i] = element;
            }}
            tabIndex={option.value === value ? 0 : -1}
            aria-checked={option.value === value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative h-8 min-w-0 flex-1 whitespace-nowrap rounded px-1.5 text-[12px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${option.value === value ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
          >
            {option.value === value && (
              <motion.span
                data-selection-indicator
                aria-hidden
                layoutId={`subnav-choice-${id}`}
                initial={false}
                transition={{
                  duration: reduced ? 0 : 0.18,
                  ease: SUB_NAV_EASE,
                }}
                className="absolute inset-0 rounded border border-line-strong bg-selected"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrainingHeader({ t }: { t: TrainingSession }) {
  return (
    <SubNavigation
      label="Training controls"
      title="Training"
      trigger={trainingModes.find((mode) => mode.id === t.mode)?.label}
    >
      <TrainingControls t={t} />
    </SubNavigation>
  );
}

function TrainingControls({ t }: { t: TrainingSession }) {
  const busy = t.running || t.phase === "report" || t.phase === "review";
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <>
      <nav aria-label="Drill">
        <div
          role="radiogroup"
          aria-label="Drill"
          aria-disabled={busy || undefined}
          className="flex flex-col gap-0.5"
        >
          {trainingModes.map((mode, i) => (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-label={mode.label}
              ref={(element) => {
                refs.current[i] = element;
              }}
              aria-checked={mode.id === t.mode}
              tabIndex={mode.id === t.mode ? 0 : -1}
              disabled={busy}
              onClick={() => t.setMode(mode.id)}
              onKeyDown={(event) => {
                if (
                  busy ||
                  !["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                const next =
                  (i +
                    (event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? 1
                      : -1) +
                    trainingModes.length) %
                  trainingModes.length;
                t.setMode(trainingModes[next].id);
                refs.current[next]?.focus();
              }}
              className={`${SUB_NAV_ITEM} disabled:cursor-not-allowed disabled:opacity-40 ${mode.id === t.mode ? "bg-selected text-ink" : "text-ink-2"}`}
            >
              <span
                className={`block font-medium ${mode.id === t.mode ? "text-ink" : "text-ink-2"}`}
              >
                {mode.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
      <SidebarChoice
        label="Pieces"
        value={t.filter}
        onChange={t.setFilter}
        disabled={busy}
        options={[
          { value: "both", label: "Both" },
          { value: "edges", label: "Edges" },
          { value: "corners", label: "Corners" },
        ]}
      />
      {t.mode === "exec" && (
        <SidebarChoice
          label="Show"
          value={t.display}
          onChange={t.setDisplay}
          disabled={busy}
          options={[
            { value: "letters", label: "Letters" },
            { value: "words", label: "Words" },
          ]}
        />
      )}
      {(t.mode === "trace" || t.mode === "recognition") && (
        <SidebarChoice
          label="M2 target swap"
          value={t.m2Swap ? "on" : "off"}
          onChange={(value) => t.setM2Swap(value === "on")}
          disabled={busy || !t.m2Available}
          options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]}
        />
      )}
    </>
  );
}
