import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardPaste,
  Scale,
  Zap,
  Sparkles,
  Download,
  BookOpen,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

interface InteractiveTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStep?: (step: number) => void;
  onOpenUploadModal?: (source: 'BANK' | 'LEDGER', mode: 'FILE' | 'PASTE') => void;
  onRunReconciliation?: () => void;
  onNavigateToWorkspace?: () => void;
  onOpenExportModal?: () => void;
}

export const InteractiveTourOverlay: React.FC<InteractiveTourOverlayProps> = ({
  isOpen,
  onClose,
  onSelectStep,
  onOpenUploadModal,
  onRunReconciliation,
  onNavigateToWorkspace,
  onOpenExportModal
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      badge: 'Paso 1: Carga de Datos',
      badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
      accentBg: 'from-sky-600 to-indigo-700',
      icon: ClipboardPaste,
      title: '1. Cargar Extracto del Banco y Libro Mayor Contable',
      subtitle: 'El punto de partida de la conciliación bancaria mensual',
      description:
        'El primer paso consiste en alimentar el sistema con dos fuentes de información: el extracto bancario (PDF, Excel o texto copiado de tu banco) y el libro mayor contable de tu ERP.',
      instructions: [
        'Puedes presionar "Pegar Extracto Banco" y pegar directamente el texto copiado de Banesco, Mercantil, BDV o BNC.',
        'Sube el Libro Mayor Contable en cualquier formato estructurado o de texto plano.',
        'Nuestra IA detecta automáticamente fechas, referencias de 4 dígitos, débitos, créditos y montos.'
      ],
      actionLabel: '📋 Probar Carga / Pegado Ahora',
      onAction: () => {
        onClose();
        if (onOpenUploadModal) onOpenUploadModal('BANK', 'PASTE');
      }
    },
    {
      stepNumber: 2,
      badge: 'Paso 2: Saldos de Apertura',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      accentBg: 'from-indigo-600 to-purple-700',
      icon: Scale,
      title: '2. Calibración e Ingreso de Saldos Iniciales',
      subtitle: 'Saldos de inicio de mes para Banco y Libros',
      description:
        'Para que la ecuación de conciliación matemática de 4 columnas (Prueba de Efectivo) sea exacta, debes ingresar los saldos con los que comenzó el mes.',
      instructions: [
        'Ingresa el saldo del extracto bancario del último día del mes anterior.',
        'Ingresa el saldo en libros contables al inicio del período.',
        'Si tu empresa arranca operaciones este mes, puedes dejar ambos saldos en 0,00.'
      ],
      actionLabel: '⚙️ Ir al Paso 2: Saldos Iniciales',
      onAction: () => {
        if (onSelectStep) onSelectStep(2);
        onClose();
      }
    },
    {
      stepNumber: 3,
      badge: 'Paso 3: Auto-Cruce Ven-NIF',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      accentBg: 'from-purple-600 to-teal-700',
      icon: Zap,
      title: '3. Ejecución del Cruce Automático Algorítmico',
      subtitle: 'Pariación inteligente en 1 segundo',
      description:
        'El motor de inteligencia contable analiza ambas fuentes y realiza el pareo de registros según estándares de auditoría bancaria venezolana (SUDEBAN y Ven-NIF).',
      instructions: [
        'Compara los últimos 4 dígitos del número de referencia bancaria o comprobante.',
        'Verifica coincidencia exacta de fecha dentro del rango de tolerancia (±3 días).',
        'Filtra por montos nominales idénticos en Bolívares (Bs.) o Dólares ($).'
      ],
      actionLabel: '⚡ Ejecutar Cruce Automático',
      onAction: () => {
        onClose();
        if (onRunReconciliation) onRunReconciliation();
      }
    },
    {
      stepNumber: 4,
      badge: 'Paso 4: Partidas Pendientes',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      accentBg: 'from-amber-600 to-rose-700',
      icon: Sparkles,
      title: '4. Revisión de Partidas Huérfanas y Ajustes Contables',
      subtitle: 'Tratamiento de comisiones, IGTF, débitos y notas sin registrar',
      description:
        'Las partidas que no cruzaron de forma idéntica representan transacciones en tránsito (comisiones bancarias no registradas, IGTF del 3%, retenciones o depósitos por identificar).',
      instructions: [
        'Entra a la Mesa de Trabajo para vincular o cruzar manualmente partidas pendientes.',
        'Usa la herramienta "Ajustes Sugeridos" para generar los asientos contables de comisiones automáticas.',
        'Agrega notas explicativas para la auditoría interna.'
      ],
      actionLabel: '🔍 Abrir Mesa de Trabajo',
      onAction: () => {
        onClose();
        if (onNavigateToWorkspace) onNavigateToWorkspace();
      }
    },
    {
      stepNumber: 5,
      badge: 'Paso 5: Cierre & Cédula',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      accentBg: 'from-emerald-600 to-teal-800',
      icon: Download,
      title: '5. Cédula de Conciliación, Prueba de Caja y Exportación ERP',
      subtitle: 'Cierre mensual cuadrado y exportación lista para SGT / Gálac / Profit',
      description:
        'Una vez resueltas las partidas pendientes, obtienes la Cédula de Cierre Mensual con la Prueba de Efectivo de 4 Columnas 100% matemática y balanceada.',
      instructions: [
        'Verifica que la variación o diferencia matemática entre el saldo conciliado del banco y el de libros sea 0,00.',
        'Descarga el paquete oficial en Excel (.XLSX) con Libro Diario y Mayor Analítico.',
        'Genera archivos de importación de asientos para Profit Plus, Gálac, Saint, Valery o SGT Contable.'
      ],
      actionLabel: '📥 Exportar Archivo Excel para ERP',
      onAction: () => {
        onClose();
        if (onOpenExportModal) onOpenExportModal();
      }
    }
  ];

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      if (onSelectStep) onSelectStep(nextIdx + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      if (onSelectStep) onSelectStep(prevIdx + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Header Banner with Dynamic Accent Gradient */}
        <div className={`p-6 bg-gradient-to-r ${currentStep.accentBg} text-white relative shrink-0`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            title="Cerrar Tour Guiado"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs">
                🎓 Modo Tour Guiado — {currentStep.badge}
              </span>
              <span className="text-xs font-bold text-white/80">
                Paso {currentStep.stepNumber} de 5
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black leading-tight flex items-center gap-2">
              <StepIcon className="w-7 h-7 shrink-0 text-white/90" />
              <span>{currentStep.title}</span>
            </h2>

            <p className="text-xs sm:text-sm text-white/90 font-medium">
              {currentStep.subtitle}
            </p>
          </div>

          {/* 5 Progress Tabs Bar */}
          <div className="mt-5 flex items-center justify-between gap-1.5 pt-3 border-t border-white/20">
            {steps.map((s, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              return (
                <button
                  key={s.stepNumber}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    if (onSelectStep) onSelectStep(idx + 1);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                    isActive
                      ? 'bg-white text-slate-900 border-white shadow-md'
                      : isPast
                      ? 'bg-white/30 text-white border-white/40'
                      : 'bg-black/20 text-white/70 border-white/10 hover:bg-white/20'
                  }`}
                >
                  <span>{isPast ? '✓' : `${s.stepNumber}.`}</span>
                  <span className="hidden sm:inline truncate">{s.badge.split(':')[1] || s.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Main Description */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900 block font-extrabold mb-1">
              📌 ¿De qué trata esta etapa?
            </strong>
            {currentStep.description}
          </div>

          {/* Step Instructions / Checkpoints */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Instrucciones clave para el contador:</span>
            </h4>

            <div className="space-y-2">
              {currentStep.instructions.map((inst, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 leading-snug">
                    {inst}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Shortcut Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                ⚡ Acción Rápida Directa
              </span>
              <p className="text-xs text-slate-200 font-semibold">
                ¿Deseas probar esta acción de inmediato en la aplicación?
              </p>
            </div>

            <button
              onClick={currentStep.onAction}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>{currentStep.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
              currentStepIndex === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer shadow-2xs'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Paso Anterior</span>
          </button>

          <div className="text-xs font-bold text-slate-500 font-mono">
            Paso {currentStepIndex + 1} de {steps.length}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <span>{currentStepIndex === steps.length - 1 ? 'Finalizar Tour ✓' : 'Siguiente Paso →'}</span>
            {currentStepIndex < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
};
