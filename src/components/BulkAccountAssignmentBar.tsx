import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Zap,
  Tag,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  Layers,
  ChevronDown
} from 'lucide-react';
import { CurrencyType, VenNifAccount, BankTransaction } from '../types/accounting';
import { VEN_NIF_ACCOUNTS } from '../data/venNifAccounts';

export interface PredefinedBulkAccount {
  code: string;
  name: string;
  category: string;
  moduleTag: string;
  autoReconciledBy?: BankTransaction['autoReconciledBy'];
  badgeLabel: string;
  icon?: string;
}

export const PREDEFINED_BULK_ACCOUNTS: PredefinedBulkAccount[] = [
  {
    code: '6.1.02.01.001',
    name: 'Gastos por Comisiones Bancarias y Mantenimiento',
    category: 'GASTOS',
    moduleTag: 'MOD_COMISIONES',
    autoReconciledBy: 'AUTO_BANK_FEE',
    badgeLabel: 'Comisiones Bancarias',
  },
  {
    code: '6.1.02.02.001',
    name: 'Gastos por Impuesto a las Grandes Transacciones Financieras (IGTF)',
    category: 'GASTOS',
    moduleTag: 'MOD_SENIAT_PAGO',
    autoReconciledBy: 'AUTO_BANK_FEE',
    badgeLabel: 'IGTF Débito 3%',
  },
  {
    code: '1.1.02.01.001',
    name: 'Cuentas por Cobrar Comerciales Clientes',
    category: 'ACTIVO',
    moduleTag: 'MOD_VENTAS',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Cobranzas Clientes',
  },
  {
    code: '2.1.01.01.001',
    name: 'Cuentas por Pagar Proveedores Comerciales',
    category: 'PASIVO',
    moduleTag: 'MOD_PROVEEDORES',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Pago Proveedores',
  },
  {
    code: '1.1.02.01.005',
    name: 'Cobranzas por Puntos de Venta (POS)',
    category: 'ACTIVO',
    moduleTag: 'MOD_POS',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Liquidación Lotes POS',
  },
  {
    code: '1.1.01.03.001',
    name: 'Depósitos y Transferencias en Tránsito',
    category: 'ACTIVO',
    moduleTag: 'MOD_OTROS',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Partidas en Tránsito',
  },
  {
    code: '4.1.01.01.001',
    name: 'Ventas de Mercancías Gravadas con IVA',
    category: 'INGRESOS',
    moduleTag: 'MOD_VENTAS',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Ventas Ordinarias',
  },
  {
    code: '6.1.01.01.001',
    name: 'Gastos de Sueldos y Salarios Operativos',
    category: 'GASTOS',
    moduleTag: 'MOD_NOMINA',
    autoReconciledBy: 'MANUAL',
    badgeLabel: 'Nómina / Sueldos',
  }
];

interface BulkAccountAssignmentBarProps {
  selectedCount: number;
  selectedTotalAmount: number;
  currency: CurrencyType;
  onApplyAccount: (code: string, name: string, moduleTag?: string, autoReconciledBy?: BankTransaction['autoReconciledBy']) => void;
  onSelectAllPendingBank: () => void;
  onSelectAllPendingLedger: () => void;
  onSelectAllPendingBoth: () => void;
  onClearSelection: () => void;
  totalPendingBankCount: number;
  totalPendingLedgerCount: number;
}

export const BulkAccountAssignmentBar: React.FC<BulkAccountAssignmentBarProps> = ({
  selectedCount,
  selectedTotalAmount,
  currency,
  onApplyAccount,
  onSelectAllPendingBank,
  onSelectAllPendingLedger,
  onSelectAllPendingBoth,
  onClearSelection,
  totalPendingBankCount,
  totalPendingLedgerCount
}) => {
  const [selectedCustomCode, setSelectedCustomCode] = useState<string>(PREDEFINED_BULK_ACCOUNTS[0].code);
  const sym = currency === 'VES' ? 'Bs.' : '$';

  const handleCustomApply = () => {
    const foundPreset = PREDEFINED_BULK_ACCOUNTS.find(p => p.code === selectedCustomCode);
    if (foundPreset) {
      onApplyAccount(foundPreset.code, foundPreset.name, foundPreset.moduleTag, foundPreset.autoReconciledBy);
      return;
    }

    const foundVenNif = VEN_NIF_ACCOUNTS.find(a => a.code === selectedCustomCode);
    if (foundVenNif) {
      // Map module tag based on category
      let moduleTag = 'MOD_OTROS';
      if (foundVenNif.category === 'GASTOS') moduleTag = 'MOD_COMISIONES';
      if (foundVenNif.category === 'INGRESOS') moduleTag = 'MOD_VENTAS';
      if (foundVenNif.category === 'PASIVO') moduleTag = 'MOD_PROVEEDORES';
      onApplyAccount(foundVenNif.code, foundVenNif.name, moduleTag, 'MANUAL');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/30 p-3 sm:p-4 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Background ambient effect */}
      <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Top row: Counter, Amount & Quick Select Utilities */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-indigo-800/40">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-bold text-xs">
              <CheckSquare className="w-4 h-4 text-indigo-300" />
              <span>{selectedCount} {selectedCount === 1 ? 'partida seleccionada' : 'partidas seleccionadas'}</span>
            </div>

            <div className="text-xs text-slate-300">
              Total acumulado: <strong className="text-emerald-400 font-mono text-sm">{sym} {selectedTotalAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          {/* Quick select helpers */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {totalPendingBankCount > 0 && (
              <button
                type="button"
                onClick={onSelectAllPendingBank}
                className="px-2 py-0.5 rounded-md bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white border border-indigo-700/50 text-[11px] font-medium transition-colors cursor-pointer"
                title="Seleccionar todas las partidas pendientes del extracto bancario"
              >
                + Todas en Banco ({totalPendingBankCount})
              </button>
            )}

            {totalPendingLedgerCount > 0 && (
              <button
                type="button"
                onClick={onSelectAllPendingLedger}
                className="px-2 py-0.5 rounded-md bg-emerald-950/60 hover:bg-emerald-900 text-emerald-200 hover:text-white border border-emerald-700/50 text-[11px] font-medium transition-colors cursor-pointer"
                title="Seleccionar todas las partidas pendientes del mayor general"
              >
                + Todas en Libros ({totalPendingLedgerCount})
              </button>
            )}

            {(totalPendingBankCount > 0 || totalPendingLedgerCount > 0) && (
              <button
                type="button"
                onClick={onSelectAllPendingBoth}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                title="Seleccionar todas las partidas pendientes de ambos lados"
              >
                Todas ({totalPendingBankCount + totalPendingLedgerCount})
              </button>
            )}

            <button
              type="button"
              onClick={onClearSelection}
              className="px-2 py-0.5 rounded-md bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/50 text-[11px] font-medium transition-colors cursor-pointer ml-1"
              title="Deseleccionar todas las partidas"
            >
              <X className="w-3 h-3 inline mr-0.5" /> Desmarcar
            </button>
          </div>
        </div>

        {/* Middle section: Action heading and 1-Click Preset Buttons */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Asignación Masiva en 1 Clic (Actualiza estado a Conciliado automáticamente):
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PREDEFINED_BULK_ACCOUNTS.map(preset => (
              <button
                key={preset.code}
                type="button"
                onClick={() => onApplyAccount(preset.code, preset.name, preset.moduleTag, preset.autoReconciledBy)}
                className="group flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-semibold shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                title={`Aplicar "${preset.code} - ${preset.name}" a las ${selectedCount} partidas seleccionadas y conciliarlas al instante`}
              >
                <span className="text-amber-400 group-hover:text-amber-300">⚡</span>
                <span>{preset.badgeLabel}</span>
                <span className="text-[10px] text-slate-400 group-hover:text-indigo-200 font-mono ml-0.5">
                  ({preset.code.split('.').slice(0, 3).join('.')})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom section: Full VEN-NIF Catalog Dropdown + 1-Click Apply Button */}
        <div className="pt-2 border-t border-indigo-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-slate-300 font-medium shrink-0 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              O seleccionar otra cuenta Ven-NIF:
            </span>
            <div className="relative flex-1 min-w-[200px]">
              <select
                value={selectedCustomCode}
                onChange={(e) => setSelectedCustomCode(e.target.value)}
                className="w-full bg-slate-800 text-slate-100 text-xs font-mono rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                <optgroup label="Cuentas Frecuentes / Predefinidas">
                  {PREDEFINED_BULK_ACCOUNTS.map(p => (
                    <option key={`preset-${p.code}`} value={p.code}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Gastos (Grupo 6)">
                  {VEN_NIF_ACCOUNTS.filter(a => a.category === 'GASTOS').map(a => (
                    <option key={`gastos-${a.code}`} value={a.code}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Activo (Grupo 1)">
                  {VEN_NIF_ACCOUNTS.filter(a => a.category === 'ACTIVO').map(a => (
                    <option key={`activo-${a.code}`} value={a.code}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Pasivo (Grupo 2)">
                  {VEN_NIF_ACCOUNTS.filter(a => a.category === 'PASIVO').map(a => (
                    <option key={`pasivo-${a.code}`} value={a.code}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ingresos (Grupo 4)">
                  {VEN_NIF_ACCOUNTS.filter(a => a.category === 'INGRESOS').map(a => (
                    <option key={`ingresos-${a.code}`} value={a.code}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCustomApply}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-950/30 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aplicar y Conciliar ({selectedCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
