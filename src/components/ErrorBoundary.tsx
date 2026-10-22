import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  backupRecovered: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    backupRecovered: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      backupRecovered: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL: React Error Boundary Intercepted Error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Auto-backup emergency snapshot to localStorage if possible
    try {
      const emergencyBackup = {
        timestamp: new Date().toISOString(),
        errorMsg: error.message
      };
      localStorage.setItem('nominus_emergency_error_log', JSON.stringify(emergencyBackup));
    } catch (e) {
      console.warn('Could not save emergency error log:', e);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      backupRecovered: true
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 max-w-xl w-full p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                <ShieldAlert className="w-7 h-7 text-amber-400" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  Protección Anti-Pérdida de Datos Activada
                </span>
                <h2 className="text-xl font-black text-white">
                  Ocurrió un inconveniente temporal en la pantalla
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tranquilo: <strong>Tus transacciones y estados de cuenta están seguros en la memoria de tu dispositivo.</strong> El sistema ha evitado que la aplicación se cierre o se borren tus datos.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 font-mono text-[11px] text-amber-300 space-y-1 overflow-x-auto">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Detalle técnico del error:</span>
              <p className="whitespace-pre-wrap">{this.state.error?.message || 'Error de renderizado no controlado'}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Recuperar Pantalla y Continuar Trabajos</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-slate-300" />
                <span>Recargar Aplicación</span>
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
