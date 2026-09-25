import { memo, useEffect, useRef } from "react";
import { formatTime } from "../../lib/interaction";
export const ClockFace = memo(function ClockFace({
  started,
  stopped,
  running,
  onPointerDown,
  onPointerUp,
  disabled,
  label,
}: {
  started: number;
  stopped: number;
  running: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  disabled: boolean;
  label: string;
}) {
  const output = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      if (output.current)
        output.current.textContent = formatTime(
          started ? (running ? performance.now() : stopped) - started : 0,
        );
      if (running) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [started, stopped, running]);
  return (
    <button
      className="clock-face"
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerDown();
      }}
      onPointerUp={(event) => {
        if (event.button !== 0) return;
        onPointerUp();
      }}
      onPointerCancel={onPointerUp}
      aria-label={label}
    >
      <span ref={output} aria-hidden="true">
        0.00
      </span>
    </button>
  );
});
