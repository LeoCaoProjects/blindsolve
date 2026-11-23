import type { TrainMode } from "./trainingModes";
export interface ShortcutItem {
  keys: string[];
  label: string;
}
export interface ShortcutSection {
  id: string;
  title: string;
  items: ShortcutItem[];
}

export const shortcuts: ShortcutItem[] = [
  { keys: ["Space"], label: "Hold, then release to start" },
  { keys: ["Space"], label: "End memo or stop timing" },
  { keys: ["N"], label: "New scramble while idle" },
  { keys: ["1 / 2 / 3"], label: "OK, +2 or DNF in results or for the latest solve while idle" },
  { keys: ["Arrows"], label: "Select a cycle-break target" },
  { keys: ["Letter"], label: "Choose and confirm a cycle-break target" },
  { keys: ["Double-click"], label: "Confirm a cycle-break sticker or letter" },
  { keys: ["Click Back"], label: "Return to an earlier reconstruction choice" },
  { keys: ["Click word"], label: "Edit a word in the completed summary" },
  { keys: ["Enter"], label: "Confirm a target, continue, or save the summary" },
  { keys: ["Backspace"], label: "Delete latest solve" },
  { keys: ["Shift + Backspace"], label: "Clear this mode’s history" },
];

export function trainingShortcuts(mode: TrainMode): ShortcutItem[] {
  const items: ShortcutItem[] = [
    { keys: ["Space"], label: "Hold, then release to start" },
  ];
  if (mode === "recognition")
    items.push({
      keys: ["Label / Enter"],
      label: "Answer highlighted piece; Enter submits multi-character labels",
    });
  if (mode === "exec") items.push({ keys: ["Space"], label: "Stop timing" });
  if (mode === "guided")
    items.push({ keys: ["Space"], label: "End memo or stop execution" });
  if (mode === "recall")
    items.push(
      { keys: ["Space"], label: "Hide memo and start recall" },
      { keys: ["Esc"], label: "Reveal the answer during recall" },
    );
  if (mode === "recall" || mode === "trace")
    items.push({ keys: ["Enter"], label: "Next field or submit" });
  if (mode === "exec" || mode === "guided")
    items.push(
      { keys: ["N"], label: "New scramble while idle" },
      {
        keys: ["S / D"],
        label:
          mode === "exec" ? "Solved or DNF in results" : "OK or DNF in results",
      },
    );
  items.push(
    { keys: ["1 / 2"], label: "OK or DNF for the latest attempt while idle" },
    { keys: ["Backspace"], label: "Delete latest attempt" },
    { keys: ["Shift + Backspace"], label: "Clear this drill’s history" },
  );
  return items;
}

export const shortcutSections: ShortcutSection[] = [
  { id: "timer", title: "Timer", items: shortcuts },
  { id: "training", title: "Training", items: trainingShortcuts("exec") },
  {
    id: "pairs",
    title: "Letter Pairs",
    items: [
      { keys: ["↑ / ↓"], label: "Previous or next pair" },
      { keys: ["← / →"], label: "Previous or next group" },
      { keys: ["[ / ]"], label: "Previous or next first letter" },
      { keys: ["Two letters"], label: "Jump to a pair" },
      { keys: ["Enter"], label: "Edit the focused pair" },
    ],
  },
  {
    id: "flashcards",
    title: "Flashcards",
    items: [
      { keys: ["Space"], label: "Reveal answer" },
      { keys: ["1"], label: "Mark remembered after reveal" },
      { keys: ["2"], label: "Mark forgotten after reveal" },
      { keys: ["3"], label: "Edit word after reveal" },
      { keys: ["Backspace"], label: "Delete latest history entry" },
      { keys: ["Shift + Backspace"], label: "Clear history" },
    ],
  },
];
export const popupShortcuts: ShortcutItem[] = [
  { keys: ["Esc"], label: "Close popup" },
  { keys: ["Space"], label: "Close non-editing popup" },
  { keys: ["?"], label: "Open keybinds" },
];
