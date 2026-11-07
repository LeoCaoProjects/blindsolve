import type { CubeOrbitState, LetteringScheme } from "../../domain/bld/types";
import { traceSection } from "../../domain/bld/trace";
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
) {
  const expected = groups.map((group, index) => {
    const typed = tokenize(inputs[index] ?? "", vocabulary);
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
          tokens: section.targets.map((target) => target.token),
        };
      const candidate = typed[section.targets.length];
      const chosen = section.validCycleBreaks.find(
        (id) => scheme.stickers[id].label === candidate,
      );
      choices.push(chosen ?? section.validCycleBreaks[0]);
    }
    throw new Error("Trace cycle-break validation did not converge");
  });
  return compareGroups(expected, inputs, vocabulary);
}
