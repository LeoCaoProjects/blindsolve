import { TrainMode, modeInfo } from "../../data/trainingModes";
import { ReferenceModal } from "../common/ReferenceModal";

export function TrainingHelp({
  open,
  onClose,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  mode: TrainMode;
}) {
  const info = modeInfo(mode);
  return (
    <ReferenceModal
      open={open}
      onClose={onClose}
      label={`How ${info.label} works`}
      title="How it works"
    >
      <p className="text-ink-3">{info.tests}</p>
      {(mode === "trace" || mode === "recognition") && (
        <p className="mt-3 text-ink-2">
          With M2 target swap on, enter the swapped second targets yourself.
          {mode === "trace" ? " Separate multi-character labels with spaces." : " Press Enter after each multi-character label."}
        </p>
      )}
      <dl className="mt-5 space-y-4">
        {info.steps.map((step) => (
          <div key={step.label}>
            <dt className="font-medium text-ink">{step.label}</dt>
            <dd className="mt-1 text-ink-2">{step.text}</dd>
          </div>
        ))}
      </dl>
    </ReferenceModal>
  );
}
