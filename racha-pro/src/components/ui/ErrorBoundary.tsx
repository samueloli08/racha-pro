import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-[#121914] p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">Algo deu errado</h1>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Ocorreu um erro inesperado na tela. Recarregue o aplicativo para continuar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lime-200 to-lime-400 text-xs font-extrabold text-zinc-950"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
