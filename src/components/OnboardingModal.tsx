import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  Layers,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  BookOpen,
  Building,
  Edit3,
  ShieldCheck,
  Zap,
  HelpCircle,
  FileText,
  Download
} from 'lucide-react';
import { exportManualToWord } from '../services/exportService';
import { UserCompanyProfile } from '../types/accounting';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartUpload?: (source: 'BANK' | 'LEDGER') => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToResults?: () => void;
  company?: UserCompanyProfile;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartUpload,
  onNavigateToWorkspace,
  onNavigateToResults,
  company
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  const defaultCompany: UserCompanyProfile = company || {
    id: 'default',
    companyName: 'MI EMPRESA, C.A.',
    companyRif: 'J-00000000-0',
    address: 'Caracas, Venezuela',
    isSpecialTaxpayer: true,
    vatRetentionRate: 75,
    defaultCurrency: 'VES',
    bcvRate: 56.80,
    accountingSystemTarget: 'SGT',
    bankAccounts: [],
    createdAt: new Date().toISOString()
  };

  if (!isOpen) return null;

  const handleFinish = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('nominus_onboarding_dismissed', 'true');
      } catch (e) {
        console.warn('Could not save onboarding preference:', e);
      }
    }
    onClose();
  };

  const steps = [
    {
      step: 1,
      badge: 'Paso 1 de 3: Carga de Datos',
      title: 'Carga tu Extracto Bancario y tu Libro Contable',
      subtitle: 'El punto de partida para una conciliación exacta en Venezuela.',
      icon: <Upload className="w-6 h-6 text-emerald-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Puedes subir archivos en <strong>Excel (.xlsx)</strong>, <strong>PDF de bancos venezolanos</strong> (Banesco, Mercantil, BDV, BNC, Bancamiga, BBVA) o simplemente <strong>Copiar y Pegar</strong> desde tu sistema administrativo (Profit Plus, Gálac, Saint, Valery).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs">
                <Building className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">1. Extracto del Banco</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cargos, abonos, referencias y notas de débito cobradas por el banco.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 font-bold text-xs">
                <BookOpen className="w-4 h-4 text-sky-700" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">2. Mayor Contable</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Asientos contables registrados en tus libros (Debe y Haber).
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>¿No tienes el libro preparado?</strong> Puedes usar la herramienta de <em>Generación Automática con IA</em> para crear tus asientos iniciales.
            </span>
          </div>
        </div>
      )
    },
    {
      step: 2,
      badge: 'Paso 2 de 3: Mesa de Conciliación',
      title: 'Conciliación Automática y Edición Intuitiva',
      subtitle: 'Compara ambas columnas en pantalla dividida y corrige operaciones.',
      icon: <Layers className="w-6 h-6 text-indigo-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            El motor inteligente compara referencia, monto y descripción. Si necesitas corregir un monto, fecha o tipo de moneda (<strong>Bs.</strong> o <strong>$</strong>), haz clic en el botón <strong>`✏️ Corregir`</strong> de cualquier tarjeta.
          </p>

          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
            <div className="flex items-center gap-2 text-indigo-950 text-xs font-bold">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <span>¿Cómo modificar o corregir una transacción?</span>
            </div>
            <p className="text-[11px] text-indigo-900/80 leading-relaxed pl-6">
              1. En la Mesa de Conciliación, presiona <strong>`✏️ Corregir`</strong> sobre la transacción.<br />
              2. En la ventana modal, cambia el monto, la divisa (`Bs.` o `$`) o la referencia.<br />
              3. Presiona <strong>`Guardar Cambios`</strong> para actualizar los saldos al instante.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Botón `✨ Conciliar Automáticamente`:</strong> Cruza en 1 segundo todas las partidas idénticas, comisiones e IGTF.
            </span>
          </div>
        </div>
      )
    },
    {
      step: 3,
      badge: 'Paso 3 de 3: Resultados & Cédula SENIAT',
      title: 'Diagnóstico de Cuadre y Reportes Legales',
      subtitle: 'Obtén la Cédula de 4 Columnas y exporta a tu sistema contable.',
      icon: <FileCheck2 className="w-6 h-6 text-sky-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            En la pantalla de <strong>Resultados de Conciliación</strong> verás el semáforo que te confirma si tu conciliación está 100% cuadrada, o qué cargos del banco faltan por contabilizar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <span className="font-bold text-emerald-900 block">✓ Cédula de 4 Columnas (SENIAT)</span>
              <p className="text-[11px] text-emerald-700 mt-1">
                Genera la Prueba de Efectivo legal exigida por contadores CPC e inspectores del SENIAT.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs">
              <span className="font-bold text-sky-900 block">📊 Exportación a ERPs</span>
              <p className="text-[11px] text-sky-700 mt-1">
                Descarga archivos listos para importar en Profit Plus, Gálac, Saint, Valery o Excel.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-blue-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>Manual de Procedimientos y Guía de Usuario</span>
              </span>
              <p className="text-[11px] text-blue-800">
                Documento en Word (.DOC) en lenguaje sencillo para cualquier persona con instructivos, Telegram y firmas de aprobación.
              </p>
            </div>
            <button
              onClick={() => exportManualToWord(defaultCompany)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Manual (.doc)</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-white text-xs flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-200">
              ¡Listo! Ya tienes todo para conciliar sin estrés.
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">
              Normativa Ven-NIF
            </span>
          </div>
        </div>
      )
    }
  ];

  const activeStepObj = steps[currentStep - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transform transition-all">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-emerald-400 border border-white/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                Guía Rápida Interactiva
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                Cómo Conciliar en 3 Sencillos Pasos
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar & Dots */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(num => (
              <button
                key={num}
                onClick={() => setCurrentStep(num)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  currentStep === num
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                    : currentStep > num
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > num ? '✓' : num}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-500 font-mono">
            Paso {currentStep} de 3
          </span>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="p-2.5 rounded-2xl bg-slate-100 border border-slate-200">
              {activeStepObj.icon}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {activeStepObj.badge}
              </span>
              <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                {activeStepObj.title}
              </h4>
            </div>
          </div>

          {activeStepObj.content}
        </div>

        {/* Footer & Controls */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
            />
            <span>No volver a mostrar al iniciar</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Siguiente Paso</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>¡Entendido! Comenzar Conciliación</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
