import type { CubeOrbitState, LetteringScheme } from "../../domain/bld/types";
import { traceSection } from "../../domain/bld/trace";
import {
  isClassicM2Configuration,
  m2SecondTarget,
} from "../../domain/bld/memoConventions";
import type { TraceTarget } from "../../domain/bld/types";
import { tokenize } from "./pairs";
import { compareGroups, type TrainGroup } from "./training";

/** Replay Timer's tracing engine. Only a genuine cycle break permits a choice;
 * all other targets and cycle closures still have to match the cube state.
 * Invalid/missing choices use a valid continuation solely for the error comparison.
 */
export function compareTraceGroups(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  groups: TrainGroup[],
  inputs: string[],
  vocabulary: string[],
  m2Swap = false,
) {
  const vocabularies = groups.map((group) => {
    const labels = new Set(
      Object.values(scheme.stickers)
        .filter(
          (sticker) =>
            sticker.pieceType === (group.piece === "edges" ? "edge" : "corner"),
        )
        .map((sticker) => sticker.label),
    );
    return vocabulary.filter((token) => labels.has(token));
  });
  const expected = groups.map((group, index) => {
    const convert = (target: TraceTarget, position: number) =>
      m2Swap && group.piece === "edges" && isClassicM2Configuration(scheme)
        ? m2SecondTarget(target, position, scheme)
        : target;
    const typed = tokenize(inputs[index] ?? "", vocabularies[index]);
    const choices: string[] = [];
    for (let guard = 0; guard < 100; guard++) {
      const section = traceSection(
        state,
        scheme,
        group.piece === "edges" ? "edge" : "corner",
        choices,
      );
      if (section.status === "complete")
        return {
          piece: group.piece,
          tokens: section.targets.map(
            (target, position) => convert(target, position).token,
          ),
        };
      const candidate = typed[section.targets.length];
      const chosen = section.validCycleBreaks.find(
        (id) =>
          convert(
            {
              stickerId: id,
              pieceIndex: scheme.stickers[id].pieceIndex,
              token: scheme.stickers[id].label,
              cycleBreak: true,
            },
            section.targets.length,
          ).token === candidate,
      );
      choices.push(chosen ?? section.validCycleBreaks[0]);
    }
    throw new Error("Trace cycle-break validation did not converge");
  });
  return expected.flatMap((group, index) =>
    compareGroups([group], [inputs[index] ?? ""], vocabularies[index]),
  );
}
