import LZString from "lz-string";

const encoding = "lz-utf16-v1";
const prefix = `{"storageEncoding":"${encoding}",`;

/** The encoding is device-only; cloud payloads and portable backups stay JSON. */
export function readEnvelopeJson(raw: string): unknown {
  const value = JSON.parse(raw);
  if (value?.storageEncoding === undefined) return value;
  if (
    value.storageEncoding !== encoding ||
    typeof value.contents !== "string" ||
    !Number.isSafeInteger(value.length) ||
    value.length < 0
  )
    throw new Error("Unsupported local workspace encoding.");
  const json = LZString.decompressFromUTF16(value.contents);
  if (json === null || json.length !== value.length)
    throw new Error("The compressed local workspace could not be read.");
  return JSON.parse(json);
}

export function writeEnvelopeJson(key: string, value: unknown) {
  const json = JSON.stringify(value);
  const alreadyCompressed = localStorage.getItem(key)?.startsWith(prefix);
  if (!alreadyCompressed) {
    try {
      localStorage.setItem(key, json);
      return;
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "QuotaExceededError"
      )
        throw error;
    }
  }
  // Migration can duplicate every record in its durable outbox. Compress the
  // entire envelope, including that queue, instead of dropping recovery data or
  // sending changes which have not been saved. setItem replaces it atomically.
  const contents = LZString.compressToUTF16(json);
  localStorage.setItem(
    key,
    JSON.stringify({
      storageEncoding: encoding,
      length: json.length,
      contents,
    }),
  );
}
