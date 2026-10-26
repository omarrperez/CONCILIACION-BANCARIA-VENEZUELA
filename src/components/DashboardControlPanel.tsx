import React from 'react';
import {
  LayoutDashboard,
  GitCompare,
  Sparkles,
  Banknote,
  ReceiptText,
  ShieldAlert,
  Folders,
  ScrollText,
  Lock,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  ShieldCheck,
  HelpCircle,
  Zap,
  History,
  BookOpen
} from 'lucide-react';
import { BankTransaction, CurrencyType, ProofOfCash } from '../types/accounting';

export type AppModuleId =
  | 'DASHBOARD'
  | 'MONTHLY_RECONCILIATION_VAULT'
  | 'PENDIENTES_ACLARAR'
  | 'RECONCILIATION_RESULTS'
  | 'RECONCILIATION'
  | 'AI_ASSISTANT'
  | 'CASH_TRAIL'
  | 'SENIAT_TAX'
  | 'SUDEBAN_AML'
  | 'JUSTIFICATION_MODULES'
  | 'LEGAL_CONTRACTS'
  | 'AUDIT_VAULT'
  | 'ERP_EXPORT'
  | 'BANK_RULES';

interface DashboardControlPanelProps {
  activeModule: AppModuleId;
  onSelectModule: (moduleId: AppModuleId) => void;
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  proofOfCash: ProofOfCash;
  onOpenProofModal: () => void;
}

export const DashboardControlPanel: React.FC<DashboardControlPanelProps> = ({
  activeModule,
  onSelectModule,
  transactions,
  currency,
  bcvRate,
  proofOfCash,
  onOpenProofModal
}) => {
  const bankItems = transactions.filter(t => t.source === 'BANK' && t.currency === currency);
  const ledgerItems = transactions.filter(t => t.source === 'LEDGER' && t.currency === currency);

  const matchedCount = bankItems.filter(t => t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY').length;
  const pendingCount = bankItems.filter(t => t.matchingStatus === 'UNMATCHED').length;
  const discrepancyCount = bankItems.filter(t => t.matchingStatus === 'DISCREPANCY').length;

  const matchPercentage = bankItems.length > 0 ? Math.round((matchedCount / bankItems.length) * 100) : 0;

  const resultsBadge = bankItems.length === 0 && ledgerItems.length === 0
    ? 'Sin datos'
    : (bankItems.length === 0 || ledgerItems.length === 0)
      ? 'Falta 1 Lado'
      : proofOfCash.isBalanced
        ? '🟢 100% Cuadrada'
        : (pendingCount > 0 ? '🟡 Ajuste Pendiente' : '🔴 Descuadre');

  const resultsBadgeColor = (bankItems.length === 0 || ledgerItems.length === 0)
    ? 'bg-slate-100 text-slate-700 border-slate-200'
    : proofOfCash.isBalanced
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : (pendingCount > 0 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200');

  // Cuadros Pequeños del Menú de Control con colores pasteles
  const menuCards = [
    {
      id: 'DASHBOARD' as AppModuleId,
      title: 'Resumen y Prueba',
      subtitle: bankItems.length === 0 ? 'Sin movimientos (0.00)' : (proofOfCash.isBalanced ? 'Cuadrada en 4 Columnas' : 'Diferencia detectada'),
      badge: bankItems.length === 0 ? 'Limpio y Listo' : `${matchPercentage}% Listo`,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      bgColor: 'bg-[#F2FBF7]',
      borderColor: 'border-emerald-200/80',
      hoverBorder: 'hover:border-emerald-400',
      activeRing: 'ring-2 ring-emerald-500/70 border-emerald-500',
      icon: LayoutDashboard,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100/90'
    },
    {
      id: 'PENDIENTES_ACLARAR' as AppModuleId,
      title: '⚡ Pendientes por Aclarar',
      subtitle: 'Modo Rápido 1 Clic / Telegram',
      badge: pendingCount > 0 ? `${pendingCount} Huérfanos` : 'Al Día',
      badgeColor: pendingCount > 0 ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      bgColor: 'bg-[#FFFBEB]',
      borderColor: 'border-amber-300/90',
      hoverBorder: 'hover:border-amber-500',
      activeRing: 'ring-2 ring-amber-500/80 border-amber-500',
      icon: Zap,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-100/90'
    },
    {
      id: 'MONTHLY_RECONCILIATION_VAULT' as AppModuleId,
      title: 'Conciliaciones Mensuales',
      subtitle: 'Histórico Mes a Mes Ven-NIF',
      badge: 'Bóveda Histórica',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
      bgColor: 'bg-[#EFF6FF]',
      borderColor: 'border-blue-200/80',
      hoverBorder: 'hover:border-blue-400',
      activeRing: 'ring-2 ring-blue-500/70 border-blue-500',
      icon: History,
      iconColor: 'text-blue-700',
      iconBg: 'bg-blue-100/90'
    },
    {
      id: 'RECONCILIATION_RESULTS' as AppModuleId,
      title: 'Resultados y Diagnóstico',
      subtitle: '¿Está Bien o Mal? / ¿Qué Tomar?',
      badge: resultsBadge,
      badgeColor: resultsBadgeColor,
      bgColor: 'bg-[#F0FDF4]',
      borderColor: 'border-emerald-300',
      hoverBorder: 'hover:border-emerald-500',
      activeRing: 'ring-2 ring-emerald-600/70 border-emerald-600',
      icon: ShieldCheck,
      iconColor: 'text-emerald-800',
      iconBg: 'bg-emerald-100'
    },
    {
      id: 'RECONCILIATION' as AppModuleId,
      title: 'Conciliación 5 Etapas',
      subtitle: 'Banco vs Libros Split',
      badge: pendingCount > 0 ? `${pendingCount} Pendientes` : '0 Pendientes',
      badgeColor: pendingCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200',
      bgColor: 'bg-[#F0F7FF]',
      borderColor: 'border-sky-200/80',
      hoverBorder: 'hover:border-sky-400',
      activeRing: 'ring-2 ring-sky-500/70 border-sky-500',
      icon: GitCompare,
      iconColor: 'text-sky-700',
      iconBg: 'bg-sky-100/90'
    },
    {
      id: 'AI_ASSISTANT' as AppModuleId,
      title: 'IA Carga: Banco & Libros',
      subtitle: 'Extracto o Mayor Contable',
      badge: 'Extracto & Libro',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      bgColor: 'bg-[#FAF5FF]',
      borderColor: 'border-purple-200/80',
      hoverBorder: 'hover:border-purple-400',
      activeRing: 'ring-2 ring-purple-500/70 border-purple-500',
      icon: Sparkles,
      iconColor: 'text-purple-700',
      iconBg: 'bg-purple-100/90'
    },
    {
      id: 'CASH_TRAIL' as AppModuleId,
      title: '💡 Arqueos de Caja y Traza de Efectivo',
      subtitle: 'Conteo de billetes, remesas y salida a taquilla bancaria (Depósitos) / POS',
      badge: 'Caja & Banco',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
      bgColor: 'bg-[#FFF9F2]',
      borderColor: 'border-amber-300/90',
      hoverBorder: 'hover:border-amber-500',
      activeRing: 'ring-2 ring-amber-500/80 border-amber-500',
      icon: Banknote,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-100/90'
    },
    {
      id: 'SENIAT_TAX' as AppModuleId,
      title: 'SENIAT & Retenciones',
      subtitle: 'Prov. SNAT/2025/000054',
      badge: '75% / 100% IVA',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      bgColor: 'bg-[#F0FDF4]',
      borderColor: 'border-teal-200/80',
      hoverBorder: 'hover:border-teal-400',
      activeRing: 'ring-2 ring-teal-500/70 border-teal-500',
      icon: ReceiptText,
      iconColor: 'text-teal-700',
      iconBg: 'bg-teal-100/90'
    },
    {
      id: 'SUDEBAN_AML' as AppModuleId,
      title: 'Escudo SUDEBAN 010.25',
      subtitle: 'Prevención LC/FT & EBR',
      badge: 'Compliance Dossier',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      bgColor: 'bg-[#FFF5F5]',
      borderColor: 'border-rose-200/80',
      hoverBorder: 'hover:border-rose-400',
      activeRing: 'ring-2 ring-rose-500/70 border-rose-500',
      icon: ShieldAlert,
      iconColor: 'text-rose-700',
      iconBg: 'bg-rose-100/90'
    },
    {
      id: 'JUSTIFICATION_MODULES' as AppModuleId,
      title: 'Justificación & Soportes',
      subtitle: '16 Categorías con Fotos/PDF',
      badge: '16 Bóvedas Digitales',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      bgColor: 'bg-[#F0FDFA]',
      borderColor: 'border-cyan-200/80',
      hoverBorder: 'hover:border-cyan-400',
      activeRing: 'ring-2 ring-cyan-500/70 border-cyan-500',
      icon: Folders,
      iconColor: 'text-cyan-700',
      iconBg: 'bg-cyan-100/90'
    },
    {
      id: 'LEGAL_CONTRACTS' as AppModuleId,
      title: 'Contratos & Bóveda Legal',
      subtitle: 'Mutuo y Comisión C.Com',
      badge: 'Sustento Jurídico',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      bgColor: 'bg-[#FEFCE8]',
      borderColor: 'border-yellow-200/80',
      hoverBorder: 'hover:border-yellow-400',
      activeRing: 'ring-2 ring-yellow-500/70 border-yellow-500',
      icon: ScrollText,
      iconColor: 'text-yellow-700',
      iconBg: 'bg-yellow-100/90'
    },
    {
      id: 'AUDIT_VAULT' as AppModuleId,
      title: 'Bóveda Criptográfica',
      subtitle: 'Huellas SHA-256 Inmutables',
      badge: 'Auditoría Fiscal',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      bgColor: 'bg-[#F5F3FF]',
      borderColor: 'border-indigo-200/80',
      hoverBorder: 'hover:border-indigo-400',
      activeRing: 'ring-2 ring-indigo-500/70 border-indigo-500',
      icon: Lock,
      iconColor: 'text-indigo-700',
      iconBg: 'bg-indigo-100/90'
    },
    {
      id: 'ERP_EXPORT' as AppModuleId,
      title: 'Exportación a ERP',
      subtitle: 'Profit, Gálac, Saint, Valery',
      badge: 'Ven-NIF Directo',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      bgColor: 'bg-[#ECFDF5]',
      borderColor: 'border-emerald-200/80',
      hoverBorder: 'hover:border-emerald-400',
      activeRing: 'ring-2 ring-emerald-500/70 border-emerald-500',
      icon: Download,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100/90'
    },
    {
      id: 'BANK_RULES' as AppModuleId,
      title: 'Reglas de Bancos (BDV, Banesco, Bancamiga, Mercantil, Plaza)',
      subtitle: 'SGT Contable • Libro 3 Hojas Excel',
      badge: '5 Columnas Exactas',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
      bgColor: 'bg-[#FAF5FF]',
      borderColor: 'border-purple-200/80',
      hoverBorder: 'hover:border-purple-400',
      activeRing: 'ring-2 ring-purple-500/70 border-purple-500',
      icon: BookOpen,
      iconColor: 'text-purple-700',
      iconBg: 'bg-purple-100/90'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Resumen Superior Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Saldo Banco */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Saldo en Bancos</span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {currency === 'VES'
              ? `≈ $${(proofOfCash.finalBalanceBank / bcvRate).toLocaleString('en-US', { maximumFractionDigits: 2 })} BCV`
              : `≈ Bs. ${(proofOfCash.finalBalanceBank * bcvRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
          </p>
        </div>

        {/* Saldo Libros */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Saldo en Libros</span>
            <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Mayor General de Bancos
          </p>
        </div>

        {/* Partidas en Conciliación */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Estado Conciliación</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {matchPercentage}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${matchPercentage}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>{matchedCount} Conciliadas</span>
            <span className="text-amber-600 font-medium">{pendingCount} Pendientes</span>
          </p>
        </div>

        {/* Prueba de Efectivo (Proof of Cash) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/60 to-sky-50/60 border border-emerald-200/70 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">Prueba de Efectivo</span>
            <button
              onClick={onOpenProofModal}
              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              Ver 4 Col. →
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {proofOfCash.isBalanced ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Saldo Conciliado Exacto
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Dif: {currency === 'VES' ? 'Bs.' : '$'} {Math.abs(proofOfCash.difference).toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5 truncate">
            S_conciliado: {currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Menú de Panel de Control en Cuadros Pequeños con Colores Pasteles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
            <span>Panel de Módulos Operativos</span>
            <span className="text-[10px] lowercase text-slate-400 font-normal">(haz clic en cualquier cuadro para entrar)</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {menuCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeModule === card.id;

            return (
              <button
                key={card.id}
                onClick={() => onSelectModule(card.id)}
                className={`text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer relative group flex flex-col justify-between ${card.bgColor} ${card.borderColor} ${card.hoverBorder} ${
                  isActive ? card.activeRing : 'shadow-2xs hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center ${card.iconColor} shadow-2xs group-hover:scale-105 transition-transform`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-slate-800 transition-colors leading-tight">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {card.subtitle}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] font-medium text-slate-500">
                  <span>Abrir módulo</span>
                  <span className={`group-hover:translate-x-0.5 transition-transform font-bold ${card.iconColor}`}>
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
