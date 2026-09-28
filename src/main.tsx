// Vite may share its dynamic-import helper with module workers. Keep this
// entry DOM-free so importing that helper inside cubing.js's worker cannot
// accidentally bootstrap the React application in the worker global scope.
if (typeof document !== "undefined") {
  void import("./bootstrap");
}
