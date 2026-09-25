import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { Dialog } from "./Dialog";
export function LeaveGuard({
  active,
  title,
  message,
}: {
  active: boolean;
  title: string;
  message: string;
}) {
  const blocker = useBlocker(active);
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
  return blocker.state === "blocked" ? (
    <Dialog title={title} onClose={() => blocker.reset()}>
      <p>{message}</p>
      <div className="actions">
        <button className="primary" onClick={() => blocker.reset()}>
          Stay here
        </button>
        <button onClick={() => blocker.proceed()}>Leave without saving</button>
      </div>
    </Dialog>
  ) : null;
}
