import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/jetbrains-mono/200.css";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { StoreProvider, useStore } from "./app/Store";
import { useState } from "react";
import { selectedRecovery } from "./data/recoverySelection";
import { selectRecovery } from "./data/portableRecovery";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { StorageWarning } from "./app/StorageWarning";
import { App as WorkspaceApp } from "./workspace/App";
import "./workspace/index.css";
import "./workspace/viewport-sizing.css";

function Workspace() {
  const store = useStore();
  const [switchError, setSwitchError] = useState("");
  return (
    <>
      {store.recoveredId && (
        <aside className="fixed bottom-16 right-2 z-50 rounded border border-line bg-bg px-3 py-2 text-sm vp-md:bottom-2">
          <span>Recovered local workspace Â· </span>
          <button
            className="underline"
            disabled={!!store.storageIssue}
            onClick={() => {
              try {
                selectRecovery(null);
              } catch {
                setSwitchError("Could not return to the original workspace.");
              }
            }}
          >Return to original workspace</button>
          {(store.recoveryError || switchError) && <p role="alert">{store.recoveryError || switchError}</p>}
        </aside>
      )}
      <StorageWarning />
      {(!store.recoveredId || store.ready) && <WorkspaceApp />}
    </>
  );
}

export default function App() {
  const [recoveredId] = useState(() => selectedRecovery() ?? undefined);
  return (
    <ErrorBoundary>
      <StoreProvider recoveredId={recoveredId}>
        <Workspace />
      </StoreProvider>
    </ErrorBoundary>
  );
}
