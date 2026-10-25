import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  Building,
  Check,
  Search,
  Zap,
  Info,
  ExternalLink
} from 'lucide-react';
import {
  BankTransaction,
  CurrencyType,
  UserCompanyProfile
} from '../types/accounting';
import {
  ALL_BANK_RULES,
  getBankRulesDefinition,
  classifyTransactionByBankRules,
  generateBankLedgerExcel,
  BankRulesDefinition,
  BankRuleItem
} from '../services/bankAccountingRules';

interface BankAccountingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: BankTransaction[];
  currency: CurrencyType;
  company?: Partial<UserCompanyProfile>;
  initialBankCode?: string;
  onUpdateTransactions?: (updated: BankTransaction[]) => void;
}

export const BankAccountingRulesModal: React.FC<BankAccountingRulesModalProps> = ({
  isOpen,
  onClose,
  transactions,
  currency,
  company,
  initialBankCode = '0102',
  onUpdateTransactions
}) => {
  const [selectedBankCode, setSelectedBankCode] = useState<string>(initialBankCode);
  const [searchPattern, setSearchPattern] = useState<string>('');
  const [actionToast, setActionToast] = useState<string | null>(null);

  const activeBankDef = useMemo(() => {
    return getBankRulesDefinition(selectedBankCode);
  }, [selectedBankCode]);

  // Bank transactions for the selected bank
  const currentBankTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.source === 'BANK' &&
      t.currency === currency &&
      (!selectedBankCode || selectedBankCode === 'ALL' || t.bankCode === selectedBankCode)
    );
  }, [transactions, currency, selectedBankCode]);

  // Statistics per rule
  const ruleMatchStats = useMemo(() => {
    const counts: Record<string, { count: number; totalAmount: number }> = {};
    let unclassifiedCount = 0;
    let unclassifiedAmount = 0;

    activeBankDef.rules.forEach(r => {
      counts[r.id] = { count: 0, totalAmount: 0 };
    });

    currentBankTransactions.forEach(t => {
      const res = classifyTransactionByBankRules(
        t.rawDescription,
        t.amountNominal,
        t.txType,
        selectedBankCode
      );

      if (res.matchedRule) {
        counts[res.matchedRule.id].count++;
        counts[res.matchedRule.id].totalAmount += t.amountNominal;
      } else {
        unclassifiedCount++;
        unclassifiedAmount += t.amountNominal;
      }
    });

    return { counts, unclassifiedCount, unclassifiedAmount };
  }, [currentBankTransactions, activeBankDef, selectedBankCode]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 5000);
  };

  // 1. Descarga del Libro de Bancos en Excel (3 Hojas con Partida Doble)
  const handleDownloadLedgerExcel = () => {
    generateBankLedgerExcel(transactions, selectedBankCode, company, currency);
    showToast(`¡Libro de Bancos de ${activeBankDef.bankName} generado con éxito en Excel (3 Hojas con Partida Doble)!`);
  };

  // 2. Aplicar las reglas del banco a las transacciones del estado de cuenta
  const handleApplyRulesToTransactions = () => {
    if (!onUpdateTransactions) return;

    let updatedCount = 0;
    const updated = transactions.map(t => {
      if (t.source === 'BANK' && t.currency === currency && (!selectedBankCode || t.bankCode === selectedBankCode)) {
        const res = classifyTransactionByBankRules(
          t.rawDescription,
          t.amountNominal,
          t.txType,
          selectedBankCode
        );
        updatedCount++;
        return {
          ...t,
          accountCode: res.accountCode,
          accountName: res.accountName,
          moduleTag: res.moduleTag,
          notes: res.matchedRule ? `Regla Bancaria: ${res.matchedRule.name}` : t.notes
        };
      }
      return t;
    });

    onUpdateTransactions(updated);
    showToast(`¡Se aplicaron las reglas de ${activeBankDef.bankName} a ${updatedCount} transacciones bancarias!`);
  };

  const bankOptions = [
    { code: '0102', name: 'Banco de Venezuela', account: '1.1.1.2.30', color: 'rose' },
    { code: '0105', name: 'Banco Mercantil', account: '1.1.1.2.60', color: 'blue' },
    { code: '0138', name: 'Banco Plaza', account: '1.1.1.2.10', color: 'emerald' },
    { code: '0134', name: 'Banesco (SGT)', account: '1.1.1.2.10', color: 'amber' },
    { code: '0172', name: 'Bancamiga (Oficial)', account: '1.1.1.2.20', color: 'teal' },
    { code: '0191', name: 'BNC', account: '1.1.1.2.91', color: 'indigo' }
  ];

  const filteredRules = activeBankDef.rules.filter(r => {
    if (!searchPattern.trim()) return true;
    const term = searchPattern.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.targetAccountCode.toLowerCase().includes(term) ||
      r.targetAccountName.toLowerCase().includes(term) ||
      r.descriptionPatterns.some(p => p.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-fadeIn">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-700 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-200">
                  Manual de Reglas Contables por Banco
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  Ven-NIF • Partida Doble
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                Reglas de Contabilidad Bancaria y Libro de Bancos
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadLedgerExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer"
              title="Descargar Libro de Bancos en Excel (3 Hojas con Partida Doble)"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Libro en Excel (.XLSX)</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast feedback */}
        {actionToast && (
          <div className="bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold flex items-center justify-between animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionToast}</span>
            </div>
            <button onClick={() => setActionToast(null)} className="underline cursor-pointer">
              Cerrar
            </button>
          </div>
        )}

        {/* Bank Selector Toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {bankOptions.map(b => (
              <button
                key={b.code}
                onClick={() => setSelectedBankCode(b.code)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  selectedBankCode === b.code
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <span>{b.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  selectedBankCode === b.code ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {b.account}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar patrón o cuenta..."
                value={searchPattern}
                onChange={(e) => setSearchPattern(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <button
              onClick={handleApplyRulesToTransactions}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
              title="Aplica los códigos y cuentas de este banco a todos los movimientos cargados"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Aplicar al Extracto</span>
            </button>
          </div>
        </div>

        {/* Explanation Banner */}
        <div className="p-4 bg-gradient-to-r from-cyan-900 via-sky-900 to-indigo-950 text-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-200">
                  Banco Activo: {activeBankDef.bankName}
                </span>
                <span>•</span>
                <span className="font-mono text-cyan-300 font-bold">
                  Cuenta Contable Banco: {activeBankDef.accountCodeBank}
                </span>
              </div>
              <p className="text-cyan-100/90 text-[11px] leading-relaxed max-w-3xl">
                Las reglas se evalúan en <strong>orden estricto (1-N)</strong>. Al generar el <strong>Libro de Bancos en Excel</strong>, se generan 3 hojas con <strong>Partida Doble exacta (suma 0.00)</strong>: Hoja 1 (Entrada Contable completa), Hoja 2 (Ingresos NC contra Cuentas por Cobrar 1.1.2.1.10) y Hoja 3 (Egresos ND con fila positiva de gasto/pasivo y fila negativa de banco).
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white/10 p-2.5 rounded-2xl border border-white/20 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-cyan-200 block uppercase font-bold">Partidas Analizadas</span>
                <span className="font-mono font-bold text-sm text-white">
                  {currentBankTransactions.length}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/20" />
              <div className="text-right">
                <span className="text-[10px] text-cyan-200 block uppercase font-bold">Huérfanos</span>
                <span className="font-mono font-bold text-sm text-amber-300">
                  {ruleMatchStats.unclassifiedCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content: Scrollable Rules List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {filteredRules.map((rule) => {
            const stats = ruleMatchStats.counts[rule.id] || { count: 0, totalAmount: 0 };
            const isNC = rule.ruleType === 'NC';

            return (
              <div
                key={rule.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-cyan-300 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {rule.order}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {rule.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          isNC ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isNC ? 'NC • Nota de Crédito (Monto Positivo +)' : 'ND • Nota de Débito (Monto Negativo -)'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Orden: #{rule.order}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Account Pill */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Cuenta Asignada</span>
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {rule.targetAccountCode} • {rule.targetAccountName}
                      </span>
                    </div>

                    <div className="bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 text-center min-w-[70px]">
                      <span className="text-[9px] uppercase font-bold text-emerald-800 block">Detectadas</span>
                      <span className="font-mono font-extrabold text-xs text-emerald-900">
                        {stats.count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pattern keywords cloud */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Patrones de Texto en Descripción Bancaria (Condición contiene):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.descriptionPatterns.map((pat, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-mono text-[11px] font-medium border border-slate-200"
                      >
                        "{pat}"
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rule Notes */}
                {rule.notes && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{rule.notes}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unclassified Box */}
          <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/60 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-700" />
                <h4 className="text-xs font-bold text-amber-950 uppercase">
                  Partidas no coincidentes con ninguna regla («Carpeta de Huérfanos»)
                </h4>
              </div>
              <span className="font-mono font-bold text-xs text-amber-900">
                {ruleMatchStats.unclassifiedCount} partidas pendientes
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Cualquier registro del estado de cuenta que no coincida con el catálogo de reglas se asignará automáticamente a la <strong>Carpeta de Huérfanos</strong> para revisión manual, justificación contable y carga de soportes en el módulo de Justificación.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>
              Genera <strong>Hoja 1 (General)</strong>, <strong>Hoja 2 (Ingresos NC)</strong> y <strong>Hoja 3 (Egresos ND)</strong> con partida doble exacta.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyRulesToTransactions}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Aplicar Reglas a Movimientos
            </button>
            <button
              onClick={handleDownloadLedgerExcel}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Libro en Excel (.XLSX)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
