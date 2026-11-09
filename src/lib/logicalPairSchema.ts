import { z } from "zod";
import {
  mnemonicRecordKey,
  normalizeLabel,
  validLabel,
} from "../domain/letterPairs/identity";
const label = z
  .string()
  .refine(
    (value) => validLabel(value) && normalizeLabel(value) === value,
    "Invalid logical label",
  );
const date = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid date");
export const logicalMnemonicSchema = z.object({
  id: z.string().uuid(),
  identity: z.literal("logical-v1"),
  scope: z.enum(["shared", "edges", "corners"]),
  firstToken: label,
  secondToken: label,
  primaryMnemonic: z.string().trim().min(1).max(1000),
  updatedAt: date,
});
export const logicalPairFields = {
  logicalPairs: z
    .record(z.string(), logicalMnemonicSchema)
    .refine(
      (records) =>
        Object.keys(records).length <= 100000 &&
        Object.entries(records).every(
          ([key, record]) =>
            key ===
            mnemonicRecordKey(
              record.firstToken,
              record.secondToken,
              record.scope,
            ),
        ),
      "Logical mnemonic key does not match its labels and scope",
    )
    .optional(),
  logicalPairDeletions: z.record(z.string(), date).optional(),
};
