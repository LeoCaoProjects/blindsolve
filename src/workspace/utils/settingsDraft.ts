import { z } from "zod";
import type { BldSetup, CubeViewPref } from "../types/app";
import { ALL_COLORS, ALL_STICKERS, validFronts } from "./scheme";
import { normalizeLabel } from "../../domain/letterPairs/identity";

const setupSchema = z
  .object({
    scheme: z.record(z.string(), z.string().max(12)),
    schemeName: z.string().max(1000),
    edgeBuffer: z.string(),
    cornerBuffer: z.string(),
    edgeMethod: z.enum(["m2", "op"]),
    cornerMethod: z.literal("op"),
  })
  .refine(
    (setup) =>
      Object.keys(setup.scheme).length === 48 &&
      ALL_STICKERS.every((s) => typeof setup.scheme[s.id] === "string") &&
      ALL_STICKERS.some(
        (s) => s.type === "edge" && s.id === setup.edgeBuffer,
      ) &&
      ALL_STICKERS.some(
        (s) => s.type === "corner" && s.id === setup.cornerBuffer,
      ),
  );
const viewSchema = z
  .object({ top: z.enum(ALL_COLORS), front: z.enum(ALL_COLORS) })
  .refine((view) => validFronts(view.top).includes(view.front));
const draftSchema = z.object({
  version: z.literal(1),
  owner: z.string(),
  setup: setupSchema,
  view: viewSchema,
  baseSetup: setupSchema,
  baseView: viewSchema,
});
export type SettingsDraft = z.infer<typeof draftSchema>;
export const settingsDraftKey = (owner: string) =>
  `blindsolve-settings-draft-v1:${owner}`;
export function readSettingsDraft(
  raw: string | null,
  owner: string,
): SettingsDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "The saved draft could not be read. Export a backup before clearing browser storage.",
    );
  }
  const result = draftSchema.safeParse(parsed);
  if (!result.success || result.data.owner !== owner)
    throw new Error(
      "The saved draft could not be read. Export a backup before clearing browser storage.",
    );
  // Recover abandoned invalid fields without changing unrelated valid edits.
  // Repeat because restoring one label can expose a duplicate in another edit.
  const { scheme } = result.data.setup;
  const base = result.data.baseSetup.scheme;
  for (let pass = 0; pass < ALL_STICKERS.length; pass++) {
    const invalid = ALL_STICKERS.filter(
      (s) =>
        scheme[s.id] !== base[s.id] &&
        (!scheme[s.id].trim() ||
          ALL_STICKERS.some(
            (other) =>
              other.id !== s.id &&
              other.type === s.type &&
              normalizeLabel(scheme[other.id]) === normalizeLabel(scheme[s.id]),
          )),
    );
    if (!invalid.length) break;
    for (const { id } of invalid) scheme[id] = base[id];
  }
  return result.data;
}
export const sameSetup = (a: BldSetup, b: BldSetup) =>
  a.schemeName === b.schemeName &&
  a.edgeBuffer === b.edgeBuffer &&
  a.cornerBuffer === b.cornerBuffer &&
  a.edgeMethod === b.edgeMethod &&
  a.cornerMethod === b.cornerMethod &&
  ALL_STICKERS.every((s) => a.scheme[s.id] === b.scheme[s.id]);
export const sameSettings = (
  a: BldSetup,
  av: CubeViewPref,
  b: BldSetup,
  bv: CubeViewPref,
) => sameSetup(a, b) && av.top === bv.top && av.front === bv.front;
export function setupDraftError(setup: BldSetup): string | null {
  if (!setupSchema.safeParse(setup).success)
    return "Complete your cube setup before it can be applied.";
  const tokens = ALL_STICKERS.map((s) => setup.scheme[s.id]);
  if (tokens.some((token) => !token || !/^[^\s,·|/]+$/.test(token)))
    return "Draft kept on this device. Each sticker needs a token without spaces or separators.";
  for (const type of ["edge", "corner"] as const) {
    const labels = ALL_STICKERS.filter((s) => s.type === type).map((s) =>
      normalizeLabel(setup.scheme[s.id]),
    );
    if (new Set(labels).size !== labels.length)
      return `Draft kept on this device. Each ${type} sticker needs a different token.`;
  }
  return null;
}
