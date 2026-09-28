import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Vite can share the application chunk with cubing.js's module worker. Keep
// browser bootstrapping guarded when that chunk runs in a worker global scope.
if (typeof document !== "undefined") {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
