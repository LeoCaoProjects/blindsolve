import { memo, useEffect, useRef, useState } from "react";

type TwistyElement = HTMLElement & {
  alg: string;
  puzzle: string;
  visualization: string;
  controlPanel: string;
  background: string;
};

export const CubeView = memo(function CubeView({
  scramble,
  compact = false,
}: {
  scramble: string;
  compact?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    void import("cubing/twisty")
      .then(() => {
        if (!host.current || disposed) return;
        host.current.replaceChildren();
        const player = document.createElement("twisty-player") as TwistyElement;
        player.alg = scramble;
        player.puzzle = "3x3x3";
        player.visualization = "3D";
        player.controlPanel = "none";
        player.background = "none";
        player.setAttribute("hint-facelets", "none");
        player.setAttribute("experimental-setup-anchor", "end");
        player.setAttribute("experimental-setup-alg", scramble);
        player.alg = "";
        player.style.width = "100%";
        player.style.height = "100%";
        host.current.appendChild(player);
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      host.current?.replaceChildren();
    };
  }, [scramble]);
  return error ? (
    <p className="inline-error">
      Cube renderer could not load. The scramble is still available.
    </p>
  ) : (
    <div
      className={`cube-view ${compact ? "compact" : ""}`}
      ref={host}
      role="group"
      aria-label="Interactive scrambled cube"
    />
  );
});
