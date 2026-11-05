import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/jetbrains-mono/200.css";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { StoreProvider } from "./app/Store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StorageWarning } from "./components/StorageWarning";
import { App as MagicPatternsApp } from "./magic/App";
import "./magic/index.css";

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <StorageWarning />
        <MagicPatternsApp />
      </StoreProvider>
    </ErrorBoundary>
  );
}
