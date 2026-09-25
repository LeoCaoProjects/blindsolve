import type { TraceTarget } from "../domain/bld/types";
import { memoPairs } from "../domain/letterPairs";
export function MemoStrip({
  tokens,
  label,
  large = false,
}: {
  tokens: string[];
  label: string;
  large?: boolean;
}) {
  return (
    <div className={`memo-strip ${large ? "large" : ""}`}>
      <span className="strip-label">{label}</span>
      <div
        className="memo-tokens"
        role="group"
        aria-label={`${label}: ${tokens.join(" ")}`}
      >
        {tokens.length ? (
          memoPairs(tokens).map((p, i) => (
            <span className="token-pair" key={i}>
              <span>{p.first}</span>
              {p.second && (
                <>
                  {" "}
                  <span>{p.second}</span>
                </>
              )}
              {!p.second && (
                <small className="trailing" title="Single trailing target">
                  {" "}
                  /
                </small>
              )}
            </span>
          ))
        ) : (
          <span className="subtle">Solved</span>
        )}
      </div>
    </div>
  );
}
export function targetPairs(targets: TraceTarget[]) {
  const result: Array<{ first: TraceTarget; second?: TraceTarget }> = [];
  for (let i = 0; i < targets.length; i += 2)
    result.push({ first: targets[i], second: targets[i + 1] });
  return result;
}
