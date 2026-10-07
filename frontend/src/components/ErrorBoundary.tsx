import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-[100dvh] bg-black text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-white/70 max-w-sm">
          WikiTok hit an unexpected error. Reloading clears it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold"
        >
          Reload
        </button>
      </div>
    );
  }
}
