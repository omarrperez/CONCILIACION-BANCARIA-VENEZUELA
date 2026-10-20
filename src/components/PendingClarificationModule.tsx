import React, { useState, useMemo } from 'react';
import {
  Zap,
  UserCheck,
  Truck,
  ArrowRightLeft,
  Receipt,
  Send,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Landmark,
  MessageSquare,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import { BankTransaction, CurrencyType, UserCompanyProfile } from '../types/accounting';
import { calculateUsdEquivalent } from '../services/bcvService';
import { learnBeneficiaryRepository } from '../services/beneficiaryMemoryService';
import { sendQuestionToOwner, getTelegramConfig } from '../services/telegramSyncService';
import { extractMetadataFromDescription } from '../services/matchingEngine';

interface PendingClarificationModuleProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  company: UserCompanyProfile;
  onUpdateTransactions: (updated: BankTransaction[]) => void;
  onOpenSettings: () => void;
}

export const PendingClarificationModule: React.FC<PendingClarificationModuleProps> = ({
  transactions,
  currency,
  bcvRate,
  company,
  onUpdateTransactions,
  onOpenSettings
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTelegramId, setSendingTelegramId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const telegramConfig = getTelegramConfig();
  const sym = currency === 'VES' ? 'Bs.' : '$';

  // Movimientos bancarios huérfanos: del banco, sin soporte, no cuadradas exactamente
  const orphanTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.source !== 'BANK') return false;
      if (t.currency !== currency) return false;

      // Si ya está conciliado exactamente con soporte o por regla fija, no es huérfano
      if (t.matchingStatus === 'MATCHED_EXACT' && t.matchedWithId) return false;
      if (t.autoReconciledBy === 'EXACT_SUPPORT' || t.autoReconciledBy === 'AUTO_BANK_FEE') return false;

      return true;
    });
  }, [transactions, currency]);

  // Filtrado por tipo y término de búsqueda
  const filteredTransactions = useMemo(() => {
    return orphanTransactions.filter((t) => {
      if (filterType !== 'ALL' && t.txType !== filterType) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        t.rawDescription.toLowerCase().includes(term) ||
        t.referenceNum.toLowerCase().includes(term) ||
        t.amountNominal.toString().includes(term) ||
        (t.counterpartyRif && t.counterpartyRif.toLowerCase().includes(term))
      );
    });
  }, [orphanTransactions, filterType, searchTerm]);

  // Totales
  const totalOrphanAmount = useMemo(() => {
    return orphanTransactions.reduce((acc, t) => acc + t.amountNominal, 0);
  }, [orphanTransactions]);

  const totalOrphanUsd = useMemo(() => {
    return currency === 'USD'
      ? totalOrphanAmount
      : calculateUsdEquivalent(totalOrphanAmount, bcvRate);
  }, [totalOrphanAmount, currency, bcvRate]);

  // Clasificación rápida con 1 clic
  const handleQuickClassify = (
    txId: string,
    targetModuleTag: string,
    label: string
  ) => {
    const updated = transactions.map((t) => {
      if (t.id === txId) {
        const meta = extractMetadataFromDescription(t.rawDescription);
        const identifier = meta.rif || t.counterpartyRif || t.counterpartyPhoneOrId;

        // Si tiene identificador, aprenderlo en la memoria histórica de beneficiarios
        if (identifier) {
          learnBeneficiaryRepository(identifier, targetModuleTag, t.counterpartyName);
        }

        return {
          ...t,
          moduleTag: targetModuleTag,
          matchingStatus: 'MATCHED_EXACT' as const,
          autoReconciledBy: 'MANUAL' as const,
          notes: `Clasificado en modo rápido como "${label}". Memoria de beneficiario actualizada.`
        };
      }
      return t;
    });

    onUpdateTransactions(updated);
    setSuccessToast(`✅ Movimiento asignado a "${label}" exitosamente.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Enviar pregunta al dueño por Telegram
  const handleAskOwnerViaTelegram = async (tx: BankTransaction) => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      alert(
        'Debes configurar tu Bot Token y Chat ID de Telegram en la Configuración de la Empresa para poder enviar preguntas al dueño.'
      );
      onOpenSettings();
      return;
    }

    setSendingTelegramId(tx.id);
    const sent = await sendQuestionToOwner(
      telegramConfig.botToken,
      telegramConfig.chatId,
      tx,
      sym
    );
    setSendingTelegramId(null);

    if (sent) {
      setSuccessToast(`📲 Pregunta enviada al celular del dueño por Telegram.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } else {
      alert('Error enviando mensaje a Telegram. Verifica tu Bot Token y Chat ID.');
    }
  };

  // Generador de resumen para copiar en WhatsApp o Telegram
  const handleCopySummaryForMessaging = () => {
    if (orphanTransactions.length === 0) return;

    let text = `📌 *PENDIENTES POR ACLARAR - EXTRACTO BANCARIO* 📌\n`;
    text += `Empresa: *${company.companyName || 'Empresa'}* (${company.companyRif || 'RIF'})\n`;
    text += `Total por justificar: *${sym} ${totalOrphanAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}* (Equiv. *$${totalOrphanUsd.toFixed(2)} USD*)\n`;
    text += `Total movimientos: *${orphanTransactions.length}*\n\n`;
    text += `Por favor indícame a qué corresponde cada uno:\n\n`;

    orphanTransactions.forEach((t, idx) => {
      const typeStr = t.txType === 'DEBIT' ? '🔴 Salida' : '🟢 Entrada';
      const usdEq = currency === 'VES' ? ` (~$${calculateUsdEquivalent(t.amountNominal, bcvRate).toFixed(2)})` : '';
      text += `${idx + 1}. *${t.txDate}* | ${typeStr}: *${sym} ${t.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}*${usdEq}\n`;
      text += `   Ref: \`${t.referenceNum}\` | Banco: ${t.bankName}\n`;
      text += `   Detalle: _${t.rawDescription}_\n\n`;
    });

    text += `_Generado automáticamente con NOMINUS Conciliación Inteligente._`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-500 animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 shadow-xs border border-amber-300">
              <Zap className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900">
                  Modo Rápido: Movimientos Pendientes por Aclarar
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {orphanTransactions.length} Movimientos Huérfanos
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Movimientos del estado de cuenta que no tuvieron soporte fotográfico por Telegram ni cuadraron por reglas fijas. Clasifícalos con 1 solo clic o pregúntale al dueño directo a su celular.
              </p>
            </div>
          </div>

          {/* Acciones del Encabezado */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopySummaryForMessaging}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Copiar lista limpia para enviar al dueño por WhatsApp o Telegram"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>{copiedSummary ? '¡Copiado al Portapapeles!' : 'Copiar Resumen para WhatsApp'}</span>
            </button>

            {!telegramConfig.botToken && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-300 shadow-2xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-sky-600" />
                <span>Configurar Telegram Bot</span>
              </button>
            )}
          </div>
        </div>

        {/* Cifras de Resumen */}
        <div className="mt-4 pt-3 border-t border-amber-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Sin Soporte</span>
            <div className="text-base font-extrabold text-slate-900">{orphanTransactions.length} registros</div>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total en {currency}</span>
            <div className="text-base font-extrabold text-amber-900">
              {sym} {totalOrphanAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Equivalente USD</span>
            <div className="text-base font-extrabold text-emerald-800">
              ${totalOrphanUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Tasa Oficial BCV</span>
            <div className="text-base font-extrabold text-slate-700">Bs. {bcvRate.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Pestañas de Filtro */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-full sm:w-auto text-xs font-semibold">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({orphanTransactions.length})
          </button>
          <button
            onClick={() => setFilterType('DEBIT')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterType === 'DEBIT'
                ? 'bg-white text-rose-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Salidas / Débitos ({orphanTransactions.filter((t) => t.txType === 'DEBIT').length})
          </button>
          <button
            onClick={() => setFilterType('CREDIT')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterType === 'CREDIT'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Entradas / Créditos ({orphanTransactions.filter((t) => t.txType === 'CREDIT').length})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por referencia, monto o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Lista de Tarjetas de Movimientos Huérfanos */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            ¡No hay movimientos huérfanos pendientes!
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Todas las transacciones bancarias del periodo cuentan con soporte digital o han sido cuadradas con sus reglas contables.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTransactions.map((tx) => {
            const isDebit = tx.txType === 'DEBIT';
            const usdEquiv = currency === 'USD' ? tx.amountNominal : calculateUsdEquivalent(tx.amountNominal, bcvRate);
            const isSendingTg = sendingTelegramId === tx.id;

            return (
              <div
                key={tx.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 p-4 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  
                  {/* Info Principal del Movimiento */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isDebit ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isDebit ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {isDebit ? 'Salida' : 'Entrada'}
                      </span>

                      <span className="text-xs font-extrabold text-slate-900">
                        {tx.bankName}
                      </span>

                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        Ref: {tx.referenceNum}
                      </span>

                      <span className="text-[11px] text-slate-500 font-medium">
                        {tx.txDate}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 truncate" title={tx.rawDescription}>
                      {tx.rawDescription}
                    </p>

                    {tx.counterpartyRif && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Contraparte: {tx.counterpartyRif} {tx.counterpartyName ? `(${tx.counterpartyName})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Monto en Moneda y Equivalente USD */}
                  <div className="lg:text-right shrink-0">
                    <div className={`text-base font-extrabold tracking-tight ${isDebit ? 'text-slate-900' : 'text-emerald-700'}`}>
                      {isDebit ? '-' : '+'}{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                    {currency === 'VES' && (
                      <div className="text-[11px] font-bold text-slate-500">
                        Equiv. ${usdEquiv.toFixed(2)} USD (Tasa {bcvRate.toFixed(2)})
                      </div>
                    )}
                  </div>

                </div>

                {/* Botones de Acción Rápida (1 Clic) */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
                    Asignar en 1 clic:
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap flex-1 sm:flex-initial">
                    {/* Botón 1: Cuenta Socio */}
                    <button
                      onClick={() => handleQuickClassify(tx.id, 'MOD_CXC_SOCIOS', 'Cuentas por Cobrar Socios')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                      title="Gasto personal del socio (Farmatodo, automercado, colegios, clínica)"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                      <span>👤 Cuenta Socio</span>
                    </button>

                    {/* Botón 2: Proveedor */}
                    <button
                      onClick={() => handleQuickClassify(tx.id, 'MOD_PROVEEDORES', 'Pago a Proveedores')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-lg text-xs font-bold border border-sky-200 transition-colors cursor-pointer shadow-2xs"
                      title="Facturas de compras comerciales y repuestos con RIF de proveedor"
                    >
                      <Truck className="w-3.5 h-3.5 text-sky-700" />
                      <span>📦 Proveedor</span>
                    </button>

                    {/* Botón 3: Entre Cuentas */}
                    <button
                      onClick={() => handleQuickClassify(
                        tx.id,
                        isDebit ? 'MOD_TFR_PROPIAS_OUT' : 'MOD_TFR_PROPIAS_IN',
                        'Transferencias Entre Cuentas'
                      )}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg text-xs font-bold border border-purple-200 transition-colors cursor-pointer shadow-2xs"
                      title="Traspaso entre cuentas de la misma empresa"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-purple-700" />
                      <span>🔄 Entre Cuentas</span>
                    </button>

                    {/* Botón 4: Gasto Operativo */}
                    <button
                      onClick={() => handleQuickClassify(tx.id, 'MOD_ANTICIPOS', 'Gasto Operativo / General')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                      title="Gastos varios de la oficina o negocio"
                    >
                      <Receipt className="w-3.5 h-3.5 text-slate-600" />
                      <span>🧾 Gasto Operativo</span>
                    </button>

                    {/* Botón 5: Preguntar al Dueño por Telegram */}
                    <button
                      onClick={() => handleAskOwnerViaTelegram(tx)}
                      disabled={isSendingTg}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer ml-auto"
                      title="Enviar consulta al grupo o chat de Telegram con botones para que el dueño responda desde su móvil"
                    >
                      <Send className={`w-3.5 h-3.5 ${isSendingTg ? 'animate-spin' : ''}`} />
                      <span>{isSendingTg ? 'Enviando...' : '📲 Preguntar al Dueño por Telegram'}</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
