import type { CubeOrbitState, LetteringScheme } from "../domain/bld/types";
import { createSpeffzScheme } from "../domain/bld/speffz";
import { orientationFaceMap } from "../domain/bld/orientation";
import {occupantHomeSticker} from "../domain/bld/trace";
import type { CSSProperties } from "react";
const defaults = createSpeffzScheme();
const physicalColors: Record<string, string> = {
  U: "#f3f4eb",
  D: "#ebd35a",
  L: "#e59a53",
  R: "#de7771",
  F: "#82b78a",
  B: "#8aadd4",
};
/** Face-local clockwise Speffz order gives the conventional unfolded net. */
export function SchemeNet({
  scheme,
  onLabel,
  state,
  candidates,
  onChoose,
}: {
  scheme: LetteringScheme;
  onLabel?: (id: string, label: string) => void;
  state?: CubeOrbitState;
  candidates?: string[];
  onChoose?: (id: string) => void;
}) {
  const faceMap = orientationFaceMap(scheme.orientation) ?? {
    U: "U",
    D: "D",
    L: "L",
    R: "R",
    F: "F",
    B: "B",
  };
  return (
    <div className="scheme-net">
      {["U", "L", "F", "R", "B", "D"].map((face) => {
        const corners = Object.values(defaults.stickers).filter(
            (s) => s.face === face && s.pieceType === "corner",
          ),
          edges = Object.values(defaults.stickers).filter(
            (s) => s.face === face && s.pieceType === "edge",
          );
        const cells = [
          corners[0],
          edges[0],
          corners[1],
          edges[3],
          null,
          edges[1],
          corners[3],
          edges[2],
          corners[2],
        ];
        return (
          <div
            key={face}
            className={`net-face face-${face}`}
            style={{ "--face": physicalColors[faceMap[face]] } as CSSProperties}
            role="group"
            aria-label={`${face} face`}
          >
            {cells.map((s, i) => {
              if (!s)
                return (
                  <div key={i} className="net-center">
                    {face}
                  </div>
                );
              const home=state?occupantHomeSticker(state,defaults,s.id):undefined;
              const color = home
                ? physicalColors[faceMap[home.face]]
                : undefined;
              const valid = candidates?.includes(s.id),
                className = `net-sticker ${s.pieceType} ${s.id === scheme.edgeBuffer || s.id === scheme.cornerBuffer ? "buffer" : ""} ${candidates && !valid ? "irrelevant" : ""}`;
              const title = `${s.id} · ${s.pieceType}${s.id === scheme.edgeBuffer || s.id === scheme.cornerBuffer ? " buffer" : ""}`;
              if (onChoose)
                return (
                  <button
                    key={s.id}
                    className={className}
                    style={{
                      background: color,
                      color: color ? "#17231a" : undefined,
                    }}
                    disabled={!valid}
                    onClick={() => onChoose(s.id)}
                    aria-label={`Choose ${scheme.stickers[s.id].label}, ${s.id}`}
                  >
                    {scheme.stickers[s.id].label}
                  </button>
                );
              return (
                <label
                  key={s.id}
                  className={className}
                  style={{
                    background: color,
                    color: color ? "#17231a" : undefined,
                  }}
                  title={title}
                >
                  <span className="sr-only">
                    {s.id} {s.pieceType} token
                  </span>
                  {onLabel ? (
                    <input
                      value={scheme.stickers[s.id].label}
                      maxLength={12}
                      onChange={(e) => onLabel(s.id, e.target.value)}
                    />
                  ) : (
                    <span>{scheme.stickers[s.id].label}</span>
                  )}
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
