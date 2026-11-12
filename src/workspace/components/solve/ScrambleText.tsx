import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ScrambleTextProps {
  scramble: string;
  className?: string;
  align?: "start" | "center";
  animate?: boolean;
}

export function ScrambleText({
  scramble,
  className = "",
  align = "start",
  animate = true,
}: ScrambleTextProps) {
  const reduced = useReducedMotion();
  const moves = scramble.trim().split(/\s+/);
  return (
    <>
      <motion.p
        key={scramble}
        initial={animate && !reduced ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className={`flex flex-wrap font-mono ${align === "center" ? "justify-center" : ""} ${className}`}
      >
        <span className="sr-only">Scramble {scramble}</span>
        {moves.map((m, i) => (
          <span
            key={i}
            aria-hidden
            className="inline-block w-[2.22em] whitespace-pre"
          >
            {m}
          </span>
        ))}
      </motion.p>
    </>
  );
}
