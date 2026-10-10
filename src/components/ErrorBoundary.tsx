import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="error-screen">
        <h1>Unable to display this screen</h1>
        <p>Reload the application. Your saved device data has not been changed.</p>
        <button onClick={() => location.reload()}>Reload application</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
