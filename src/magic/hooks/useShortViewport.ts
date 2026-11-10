import { useSyncExternalStore } from "react";

const query = "(max-height: 720px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;

export function useShortViewport() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
