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
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F6EE] px-4 text-center text-[#0D1510]">
          <div className="rp-card w-full max-w-sm space-y-4 rounded-[28px] p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-[-0.03em] text-[#0D1510]">
                Algo saiu de linha
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-[#647468]">
                Ocorreu um erro inesperado na tela. Recarregue o aplicativo para voltar ao jogo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rp-btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-xs"
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
