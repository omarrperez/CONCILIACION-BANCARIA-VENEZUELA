import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Calendar,
  DollarSign,
  Hash,
  FileText,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Tag,
  CreditCard
} from 'lucide-react';
import {
  BankTransaction,
  TransactionSource,
  TransactionType,
  CurrencyType,
  MatchingStatus
} from '../types/accounting';
import { VENEZUELAN_BANKS, getBankDefinition } from '../data/venezuelanBanks';

interface TransactionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CREATE' | 'EDIT';
  initialTransaction?: BankTransaction | null;
  defaultSource?: TransactionSource;
  defaultBankCode?: string;
  currency: CurrencyType;
  bcvRate: number;
  companyId?: string;
  onSave: (tx: BankTransaction) => void;
  onDelete?: (txId: string) => void;
}

export const TransactionEditorModal: React.FC<TransactionEditorModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialTransaction,
  defaultSource = 'BANK',
  defaultBankCode = '0134',
  currency,
  bcvRate,
  companyId,
  onSave,
  onDelete
}) => {
  const [txCurrency, setTxCurrency] = useState<CurrencyType>(currency || 'VES');
  const [source, setSource] = useState<TransactionSource>(defaultSource);
  const [bankCode, setBankCode] = useState<string>(defaultBankCode);
  const [referenceNum, setReferenceNum] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState<TransactionType>('CREDIT');
  const [amountNominal, setAmountNominal] = useState<string>('');
  const [rawDescription, setRawDescription] = useState<string>('');
  const [counterpartyRif, setCounterpartyRif] = useState<string>('');
  const [accountCode, setAccountCode] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>('UNMATCHED');
  const [notes, setNotes] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (initialTransaction && mode === 'EDIT') {
      setTxCurrency(initialTransaction.currency || currency || 'VES');
      setSource(initialTransaction.source);
      setBankCode(initialTransaction.bankCode || defaultBankCode);
      setReferenceNum(initialTransaction.referenceNum || '');
      setTxDate(initialTransaction.txDate || new Date().toISOString().split('T')[0]);
      setTxType(initialTransaction.txType || 'CREDIT');
      setAmountNominal(String(initialTransaction.amountNominal || ''));
      setRawDescription(initialTransaction.rawDescription || '');
      setCounterpartyRif(initialTransaction.counterpartyRif || '');
      setAccountCode(initialTransaction.accountCode || '');
      setAccountName(initialTransaction.accountName || '');
      setMatchingStatus(initialTransaction.matchingStatus || 'UNMATCHED');
      setNotes(initialTransaction.notes || '');
    } else {
      setTxCurrency(currency || 'VES');
      setSource(defaultSource);
      setBankCode(defaultBankCode !== 'ALL' ? defaultBankCode : '0134');
      setReferenceNum('');
      setTxDate(new Date().toISOString().split('T')[0]);
      setTxType('CREDIT');
      setAmountNominal('');
      setRawDescription('');
      setCounterpartyRif('');
      setAccountCode(defaultSource === 'LEDGER' ? '1.1.01.02.001' : '');
      setAccountName(defaultSource === 'LEDGER' ? 'Bancos Nacionales Cuenta Corriente' : '');
      setMatchingStatus('UNMATCHED');
      setNotes('');
    }
    setFormError(null);
    setShowDeleteConfirm(false);
  }, [initialTransaction, mode, defaultSource, defaultBankCode, currency, isOpen]);

  if (!isOpen) return null;

  const currentBankDef = getBankDefinition(bankCode);

  const numericAmount = parseFloat(amountNominal.replace(',', '.')) || 0;
  const usdEquivalent = txCurrency === 'USD' 
    ? numericAmount 
    : (bcvRate > 0 ? numericAmount / bcvRate : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!referenceNum.trim()) {
      setFormError('Por favor ingresa un número de referencia o comprobante.');
      return;
    }
    if (numericAmount <= 0) {
      setFormError('El monto debe ser un valor mayor a cero.');
      return;
    }
    if (!txDate) {
      setFormError('Por favor selecciona una fecha válida.');
      return;
    }
    if (!rawDescription.trim()) {
      setFormError('Por favor describe el concepto o detalle del movimiento.');
      return;
    }

    const cleanRef = referenceNum.trim();
    const last4 = cleanRef.replace(/\D/g, '').slice(-4) || cleanRef.slice(-4);

    const transactionToSave: BankTransaction = {
      ...(initialTransaction || {}),
      id: initialTransaction?.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      companyId: initialTransaction?.companyId || companyId,
      source,
      bankCode,
      bankName: currentBankDef.fullName,
      referenceNum: cleanRef,
      referenceLast4: last4,
      txDate,
      txType,
      amountNominal: numericAmount,
      currency: txCurrency,
      bcvRate,
      amountVes: txCurrency === 'VES' ? numericAmount : numericAmount * bcvRate,
      amountUsdEquivalent: usdEquivalent,
      rawDescription: rawDescription.trim(),
      counterpartyRif: counterpartyRif.trim() ? counterpartyRif.trim().toUpperCase() : undefined,
      accountCode: accountCode.trim() || undefined,
      accountName: accountName.trim() || undefined,
      matchingStatus: mode === 'CREATE' ? 'UNMATCHED' : matchingStatus,
      notes: notes.trim() || undefined,
      createdAt: initialTransaction?.createdAt || new Date().toISOString()
    };

    onSave(transactionToSave);
    onClose();
  };

  const handleDelete = () => {
    if (initialTransaction && onDelete) {
      onDelete(initialTransaction.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          source === 'BANK'
            ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-100'
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs ${
              source === 'BANK' ? 'bg-sky-600' : 'bg-emerald-600'
            }`}>
              {mode === 'CREATE' ? <FileText className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'CREATE'
                  ? `Introducir Operación en ${source === 'BANK' ? 'Extracto Bancario' : 'Libro Mayor'}`
                  : `Corregir Transacción (${source === 'BANK' ? 'Banco' : 'Libro'})`}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {mode === 'CREATE'
                  ? 'Registra un movimiento omitido o faltante para lograr el cuadre'
                  : `Ajusta el monto, fecha o referencia (ID: ${initialTransaction?.id.slice(-6)})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Selector de Origen (Solo editable en modo CREATE) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Columna / Destino del Registro:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={mode === 'EDIT'}
                onClick={() => setSource('BANK')}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  source === 'BANK'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                } ${mode === 'EDIT' ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                🏦 Extracto Bancario
              </button>
              <button
                type="button"
                disabled={mode === 'EDIT'}
                onClick={() => setSource('LEDGER')}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  source === 'LEDGER'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                } ${mode === 'EDIT' ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                📖 Mayor de Bancos (Libro)
              </button>
            </div>
          </div>

          {/* Banco & Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Banco Venezolano:
              </label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-semibold"
              >
                {VENEZUELAN_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.shortName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Fecha del Movimiento:
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Referencia Bancaria & Tipo de Movimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                N° de Referencia / Comprobante:
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ej. 00492817 o 8291"
                  value={referenceNum}
                  onChange={(e) => setReferenceNum(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Naturaleza de la Operación:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTxType('CREDIT')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    txType === 'CREDIT'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Abono (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('DEBIT')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    txType === 'DEBIT'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  <span>Cargo (-)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Monto Nominal & Equivalente BCV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Monto Nominal ({txCurrency}):
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTxCurrency('VES')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      txCurrency === 'VES'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bs. (VES)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxCurrency('USD')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      txCurrency === 'USD'
                        ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    $ (USD)
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">
                  {txCurrency === 'VES' ? 'Bs.' : '$'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amountNominal}
                  onChange={(e) => setAmountNominal(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-mono font-black text-slate-900"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">
                Contravalor Oficial BCV:
              </span>
              <span className="font-mono font-bold text-slate-800">
                {txCurrency === 'VES'
                  ? `$ ${usdEquivalent.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                  : `Bs. ${(numericAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              <span className="text-[10px] text-slate-400 ml-1.5">
                (Tasa: Bs. {bcvRate.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Concepto / Descripción */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Concepto / Detalle de la Operación:
            </label>
            <input
              type="text"
              placeholder="ej. Transferencia a Proveedor Comercial San José / Cargo comisión punto"
              value={rawDescription}
              onChange={(e) => setRawDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-medium"
            />
          </div>

          {/* RIF de Contraparte & Código Contable Ven-NIF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                RIF Contraparte (Opcional):
              </label>
              <input
                type="text"
                placeholder="ej. J-31298451-0 o V-18492019"
                value={counterpartyRif}
                onChange={(e) => setCounterpartyRif(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Código / Cuenta Contable Ven-NIF:
              </label>
              <select
                value={accountCode ? `${accountCode} - ${accountName}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const [code, ...nameParts] = val.split(' - ');
                    setAccountCode(code.trim());
                    setAccountName(nameParts.join(' - ').trim());
                    setMatchingStatus('MATCHED_EXACT');
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-medium text-slate-900 mb-1"
              >
                <option value="">-- Seleccionar Código Contable --</option>
                <option value="5.2.01.03.001 - Gastos y Comisiones Bancarias">5.2.01.03.001 - Gastos y Comisiones Bancarias</option>
                <option value="5.2.03.01.002 - Impuesto IGTF 3%">5.2.03.01.002 - Impuesto IGTF 3%</option>
                <option value="1.1.02.01.001 - Retención IVA por Cobrar (75%/100%)">1.1.02.01.001 - Retención IVA por Cobrar (75%/100%)</option>
                <option value="2.1.01.01.001 - Proveedores Nacionales">2.1.01.01.001 - Proveedores Nacionales</option>
                <option value="1.1.03.01.001 - Cuentas por Cobrar Socios / Directores">1.1.03.01.001 - Cuentas por Cobrar Socios / Directores</option>
                <option value="4.1.01.01.001 - Ingresos por Ventas / Punto de Venta">4.1.01.01.001 - Ingresos por Ventas / Punto de Venta</option>
                <option value="5.1.01.01.001 - Gastos de Nómina y Sueldos">5.1.01.01.001 - Gastos de Nómina y Sueldos</option>
                <option value="1.1.01.02.001 - Transferencia Entre Cuentas Propias">1.1.01.02.001 - Transferencia Entre Cuentas Propias</option>
                <option value="5.2.01.01.001 - Gastos Generales y Suministros">5.2.01.01.001 - Gastos Generales y Suministros</option>
              </select>
              <input
                type="text"
                placeholder="o escribe la cuenta contable manualmente..."
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Estado de Conciliación (Solo en modo EDIT) */}
          {mode === 'EDIT' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Estado Actual de Conciliación:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'UNMATCHED', label: 'Pendiente', color: 'bg-slate-100 text-slate-700' },
                  { id: 'MATCHED_EXACT', label: 'Exacto (100%)', color: 'bg-emerald-100 text-emerald-800' },
                  { id: 'MATCHED_FUZZY', label: 'Fuzzy / Similitud', color: 'bg-amber-100 text-amber-800' },
                  { id: 'DISCREPANCY', label: 'Variación de Monto', color: 'bg-rose-100 text-rose-800' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setMatchingStatus(s.id as MatchingStatus)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      matchingStatus === s.id
                        ? `${s.color} font-bold ring-2 ring-slate-400`
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notas Adicionales */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Notas u Observaciones Contables:
            </label>
            <input
              type="text"
              placeholder="ej. Corrección manual por referencia truncada en extracto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 font-medium"
            />
          </div>

          {/* Delete Confirm Box */}
          {showDeleteConfirm && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
              <p className="text-xs font-bold text-rose-900">
                ¿Estás seguro de que deseas eliminar este movimiento?
              </p>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Esta acción retirará la transacción de la conciliación y la borrará de Firestore.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Sí, eliminar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <div>
              {mode === 'EDIT' && onDelete && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer ${
                  source === 'BANK'
                    ? 'bg-sky-600 hover:bg-sky-700 active:scale-95'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {mode === 'CREATE' ? 'Guardar y Conciliar' : 'Guardar Corrección'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
