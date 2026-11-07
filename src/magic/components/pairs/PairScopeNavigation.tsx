import React, { useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SUB_NAV_EASE, SUB_NAV_ITEM } from "../layout/SubNavigation";
export type PairView = "default" | "overrides";

const scopes: { value: PairView; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "overrides", label: "Overrides" },
];

/** Training's contextual navigation geometry and selection motion. */
export function PairScopeNavigation({
  value,
  onChange,
  onSelect,
}: {
  value: PairView;
  onChange: (scope: PairView) => void;
  onSelect: () => void;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <nav aria-label="Vocabulary">
      <div
        role="radiogroup"
        aria-label="Vocabulary"
        className="flex flex-col gap-0.5"
      >
        {scopes.map((scope, index) => (
          <button
            key={scope.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={scope.value === value}
            tabIndex={scope.value === value ? 0 : -1}
            onClick={() => {
              onChange(scope.value);
              onSelect();
            }}
            onKeyDown={(event) => {
              if (
                ![
                  "ArrowDown",
                  "ArrowUp",
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? scopes.length - 1
                    : (index +
                        (["ArrowDown", "ArrowRight"].includes(event.key)
                          ? 1
                          : -1) +
                        scopes.length) %
                      scopes.length;
              onChange(scopes[next].value);
              refs.current[next]?.focus();
            }}
            className={`${SUB_NAV_ITEM} relative font-medium ${scope.value === value ? "text-ink" : "text-ink-2"}`}
          >
            {scope.value === value && (
              <motion.span
                aria-hidden
                layoutId={`pair-scope-${id}`}
                initial={false}
                transition={{
                  duration: reduced ? 0 : 0.18,
                  ease: SUB_NAV_EASE,
                }}
                className="absolute inset-0 rounded-md bg-selected"
              />
            )}
            <span className="relative">{scope.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
