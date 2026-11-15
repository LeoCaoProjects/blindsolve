import { useSyncExternalStore } from "react";

const query = "(max-width: 639px) and (max-height: 720px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;

export function useShortPhoneViewport() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
