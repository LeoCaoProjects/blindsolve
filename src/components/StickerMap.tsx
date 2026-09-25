import { useEffect, useState } from "react";
import type { CubeOrbitState, LetteringScheme } from "../domain/bld/types";
import { SchemeNet } from "./SchemeNet";
export function StickerMap({
  scramble,
  scheme,
}: {
  scramble: string;
  scheme: LetteringScheme;
}) {
  const [state, setState] = useState<CubeOrbitState>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    import("../domain/bld/cubing")
      .then((m) => m.scrambleToState(scramble, scheme.orientation))
      .then((s) => {
        if (active) setState(s);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [scramble, scheme]);
  return error ? (
    <p role="alert">{error}</p>
  ) : state ? (
    <>
      <p className="subtle">
        Labels mark target positions; colours show the scrambled stickers.
        Centres are normalised for your memo frame.
      </p>
      <div className="net-scroll">
        <SchemeNet scheme={scheme} state={state} />
      </div>
    </>
  ) : (
    <p role="status">Loading sticker map…</p>
  );
}
