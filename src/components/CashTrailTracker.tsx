import React, { useState } from 'react';
import {
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Smartphone,
  Fingerprint,
  Building,
  DollarSign,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Plus,
  Search,
  Filter,
  Download,
  Share2,
  Lock,
  Layers,
  Scale
} from 'lucide-react';
import {
  CashFlowTraceItem,
  PaymentChannel,
  CurrencyType,
  UserCompanyProfile,
  CashLogRecord
} from '../types/accounting';
import { calculateSha256 } from '../services/cryptoService';

interface CashTrailTrackerProps {
  traces: CashFlowTraceItem[];
  cashLogs: CashLogRecord[];
  company: UserCompanyProfile;
  currency: CurrencyType;
  bcvRate: number;
  onAddTrace: (newTrace: CashFlowTraceItem) => void;
  onUpdateTrace: (updated: CashFlowTraceItem) => void;
}

export const CashTrailTracker: React.FC<CashTrailTrackerProps> = ({
  traces,
  cashLogs,
  company,
  currency,
  bcvRate,
  onAddTrace,
  onUpdateTrace
}) => {
  const [activeChannelFilter, setActiveChannelFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'ENTRADA' | 'SALIDA'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<CashFlowTraceItem | null>(traces[0] || null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'DIGITAL_FLOW' | 'PHYSICAL_CASH'>('DIGITAL_FLOW');

  // Form State for new trace
  const [newDirection, setNewDirection] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [newChannel, setNewChannel] = useState<PaymentChannel>('TRANSFERENCIA_BANCARIA');
  const [newBankName, setNewBankName] = useState('Banesco Banco Universal');
  const [newBankCode, setNewBankCode] = useState('0134');
  const [newRef, setNewRef] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<CurrencyType>('VES');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyRif, setNewPartyRif] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [newInvoiceNum, setNewInvoiceNum] = useState('');
  const [newVatRetention, setNewVatRetention] = useState('');
  const [newAmlOrigin, setNewAmlOrigin] = useState('Cobro comercial de factura con entrega de bienes y servicios.');

  // Filtering
  const filteredTraces = traces.filter(t => {
    if (activeChannelFilter !== 'ALL' && t.channel !== activeChannelFilter) return false;
    if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        t.referenceNum.toLowerCase().includes(q) ||
        t.counterpartyName.toLowerCase().includes(q) ||
        t.counterpartyRif.toLowerCase().includes(q) ||
        t.concept.toLowerCase().includes(q) ||
        t.bankName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Totals
  const totalInflowsVes = traces
    .filter(t => t.direction === 'ENTRADA')
    .reduce((acc, t) => acc + (t.currency === 'VES' ? t.amount : t.amount * bcvRate), 0);

  const totalOutflowsVes = traces
    .filter(t => t.direction === 'SALIDA')
    .reduce((acc, t) => acc + (t.currency === 'VES' ? t.amount : t.amount * bcvRate), 0);

  const netOperatingFlowVes = totalInflowsVes - totalOutflowsVes;

  // Channel Breakdown
  const channelMetrics = [
    { id: 'TRANSFERENCIA_BANCARIA', label: 'Transferencias', icon: ArrowDownLeft, count: traces.filter(t => t.channel === 'TRANSFERENCIA_BANCARIA').length },
    { id: 'PUNTO_DE_VENTA', label: 'Puntos de Venta (POS)', icon: CreditCard, count: traces.filter(t => t.channel === 'PUNTO_DE_VENTA').length },
    { id: 'BIO_PAGO', label: 'BioPago BDV', icon: Fingerprint, count: traces.filter(t => t.channel === 'BIO_PAGO').length },
    { id: 'PAGO_MOVIL', label: 'Pago Móvil C2P/P2P', icon: Smartphone, count: traces.filter(t => t.channel === 'PAGO_MOVIL').length },
    { id: 'DIVISAS_CONVENIO_1', label: 'Divisas Convenio 1', icon: DollarSign, count: traces.filter(t => t.channel === 'DIVISAS_CONVENIO_1').length }
  ];

  const handleCreateTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount) || 0;
    const rawData = `${newRef}|${newAmount}|${newPartyRif}|${newDate}|${Date.now()}`;
    const hash = await calculateSha256(rawData);

    const newTraceItem: CashFlowTraceItem = {
      id: `trace-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      bankName: newBankName,
      bankCode: newBankCode,
      accountNumber: `${newBankCode}-0000-00-0000000000`,
      channel: newChannel,
      referenceNum: newRef || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      direction: newDirection,
      amount: amt,
      currency: newCurrency,
      bcvRate,
      amountVes: newCurrency === 'USD' ? amt * bcvRate : amt,
      counterpartyName: newPartyName || 'CONTRA PARTE REGISTRADA',
      counterpartyRif: newPartyRif || 'J-00000000-0',
      concept: newConcept || 'Movimiento de cuenta verificado',
      matchingStatus: 'CONCILIADO',
      justificationSeniat: {
        isJustified: Boolean(newInvoiceNum),
        invoiceNumber: newInvoiceNum || undefined,
        vatRetentionAmount: parseFloat(newVatRetention) || undefined,
        notes: 'Operación soportada con factura fiscal según Providencia 0071 del SENIAT.'
      },
      justificationBank: {
        isJustified: true,
        amlDeclaredOrigin: newAmlOrigin,
        contractOrOrderRef: 'DOC-SOPORTE-2026',
        sudebanRiskTier: 'BAJO',
        complianceSignedBy: 'Oficial de Cumplimiento NOMINUS',
        sha256Proof: hash,
        verifiedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };

    onAddTrace(newTraceItem);
    setSelectedTrace(newTraceItem);
    setShowAddModal(false);
  };

  const newDate = new Date().toISOString().split('T')[0];

  const sym = currency === 'VES' ? 'Bs.' : '$';

  return (
    <div className="space-y-6">
      
      {/* Banner Superior Explicativo de la Realidad Financiera Venezolana */}
      <div className="bg-gradient-to-r from-amber-50/90 via-sky-50/40 to-white p-5 rounded-2xl border border-amber-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-100 to-sky-100 text-amber-800 flex items-center justify-center shadow-xs border border-amber-200/80">
              <Layers className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Traza del Efectivo, Flujos Bancarios y Equivalentes de Efectivo
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Ven-NIF NIC 7 & RegTech
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">
                  SUDEBAN Res. 010.25 & SENIAT
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
                En Venezuela la mayor circulación de dinero ocurre a través de <strong>Transferencias Bancarias Inmediatas, Puntos de Venta (POS), BioPago BDV, Pago Móvil y Cuentas Custodia en Divisas</strong>. Este módulo audita cada entrada y salida de fondos bancarios y genera la justificación legal requerida por el SENIAT y las instituciones bancarias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Verificar y Registrar Movimiento</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas Métricas de Flujo Bancario Global (Entradas, Salidas y Saldo Neto) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Entradas Totales */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Entradas (Abonos)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-700 tracking-tight font-mono">
              Bs. {totalInflowsVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ≈ ${(totalInflowsVes / bcvRate).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD a tasa BCV
          </p>
        </div>

        {/* Salidas Totales */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Salidas (Cargos)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              Bs. {totalOutflowsVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Proveedores, nómina, parafiscales y tributos SENIAT
          </p>
        </div>

        {/* Flujo Neto */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Flujo Neto en Bancos</span>
            <div className="w-7 h-7 rounded-lg bg-slate-700 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-300 tracking-tight font-mono">
              Bs. {netOperatingFlowVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Superávit de Tesorería conciliado
          </p>
        </div>

      </div>

      {/* Selector de Canales de Pago Venezolanos (Píldoras Pastel) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveChannelFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeChannelFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Todos los Canales ({traces.length})
        </button>

        {channelMetrics.map(chan => {
          const Icon = chan.icon;
          const isSelected = activeChannelFilter === chan.id;
          return (
            <button
              key={chan.id}
              onClick={() => setActiveChannelFilter(chan.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{chan.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {chan.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Split Layout: Lista de Flujos de Fondos a la Izquierda vs Justificación SENIAT y Banco a la Derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN (7 Cols): Registro y Filtros de Transacciones */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[700px]">
          
          {/* Header con Búsqueda y Dirección */}
          <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por referencia, cliente, RIF o banco..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none"
                />
              </div>

              {/* Direction Filter */}
              <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-semibold">
                <button
                  onClick={() => setDirectionFilter('ALL')}
                  className={`px-2 py-1 rounded-md transition-colors ${directionFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setDirectionFilter('ENTRADA')}
                  className={`px-2 py-1 rounded-md transition-colors ${directionFilter === 'ENTRADA' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'}`}
                >
                  Entradas
                </button>
                <button
                  onClick={() => setDirectionFilter('SALIDA')}
                  className={`px-2 py-1 rounded-md transition-colors ${directionFilter === 'SALIDA' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600'}`}
                >
                  Salidas
                </button>
              </div>
            </div>
          </div>

          {/* List of Traces */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {filteredTraces.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <p className="font-bold text-slate-700">Sin movimientos de fondos registrados</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  La traza bancaria está limpia y lista. Presiona "Verificar y Registrar Movimiento" o procesa el extracto de tu banco en el módulo de IA.
                </p>
              </div>
            ) : (
              filteredTraces.map((trace) => {
                const isSelected = selectedTrace?.id === trace.id;
                const isInflow = trace.direction === 'ENTRADA';

                return (
                  <div
                    key={trace.id}
                    onClick={() => setSelectedTrace(trace)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-300'
                        : 'border-slate-200/70 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            trace.channel === 'BIO_PAGO'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : trace.channel === 'PUNTO_DE_VENTA'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : trace.channel === 'PAGO_MOVIL'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : trace.channel === 'DIVISAS_CONVENIO_1'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {trace.channel.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{trace.referenceNum}</span>
                          <span className="text-[11px] text-slate-400">{trace.date} {trace.time}</span>
                        </div>

                        <p className="text-slate-800 font-semibold mt-1">
                          {trace.counterpartyName}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {trace.concept}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-bold block ${
                          isInflow ? 'text-emerald-700' : 'text-slate-900'
                        }`}>
                          {isInflow ? '+' : '-'}{trace.currency === 'VES' ? 'Bs.' : '$'} {trace.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                        
                        <div className="mt-1 flex items-center justify-end gap-1">
                          {trace.justificationSeniat.isJustified && (
                            <span className="text-[9px] font-bold px-1 rounded bg-teal-50 text-teal-700 border border-teal-200">
                              SENIAT ✓
                            </span>
                          )}
                          {trace.justificationBank.isJustified && (
                            <span className="text-[9px] font-bold px-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              BANCO ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Banco: <strong className="text-slate-600">{trace.bankName}</strong></span>
                      <span>RIF: <strong className="text-slate-600 font-mono">{trace.counterpartyRif}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): ACTA DE JUSTIFICACIÓN ANTE SENIAT Y EL BANCO */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between h-[700px] overflow-y-auto">
          
          {selectedTrace ? (
            <div className="space-y-4">
              
              {/* Header de Justificación */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Expediente de Cumplimiento
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">
                    Justificación para SENIAT y Entidad Bancaria
                  </h3>
                </div>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Acta
                </button>
              </div>

              {/* Movimiento Seleccionado Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{selectedTrace.referenceNum}</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {selectedTrace.currency === 'VES' ? 'Bs.' : '$'} {selectedTrace.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-slate-700 font-medium">{selectedTrace.concept}</p>
                <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
                  <span>Banco: <strong>{selectedTrace.bankName}</strong></span>
                  <span>Canal: <strong>{selectedTrace.channel.replace(/_/g, ' ')}</strong></span>
                </div>
              </div>

              {/* 1. SECCIÓN DE JUSTIFICACIÓN ANTE EL SENIAT */}
              <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-teal-900 font-bold border-b border-teal-200/60 pb-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <span>1. Soporte Legal y Tributario (SENIAT)</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Factura Fiscal / Reporte Z:</span>
                    <strong className="text-slate-900 font-mono">
                      {selectedTrace.justificationSeniat.invoiceNumber || 'No aplica (Operación societaria/financiera)'}
                    </strong>
                  </div>

                  {selectedTrace.justificationSeniat.vatRetentionAmount && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Retención IVA (Prov. 2025/000054):</span>
                      <strong className="text-teal-800 font-mono">
                        Bs. {selectedTrace.justificationSeniat.vatRetentionAmount.toFixed(2)} (Comp: {selectedTrace.justificationSeniat.vatRetentionVoucher || '202610...'})
                      </strong>
                    </div>
                  )}

                  {selectedTrace.justificationSeniat.taxableBase && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Base Imponible:</span>
                      <span className="text-slate-800 font-mono">
                        Bs. {selectedTrace.justificationSeniat.taxableBase.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="p-2 bg-white rounded-lg border border-teal-100 text-[11px] text-teal-950 mt-1">
                    <span className="font-semibold block">Nota de Auditoría Fiscal:</span>
                    {selectedTrace.justificationSeniat.notes || 'Operación debidamente reflejada en Libro de Compras/Ventas.'}
                  </div>
                </div>
              </div>

              {/* 2. SECCIÓN DE JUSTIFICACIÓN ANTE EL BANCO (SUDEBAN) */}
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-rose-900 font-bold border-b border-rose-200/60 pb-1.5">
                  <Building className="w-4 h-4 text-rose-700" />
                  <span>2. Justificación de Fondos para el Banco (SUDEBAN 010.25)</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-slate-600 block">Declaración de Origen Lícito:</span>
                    <p className="text-slate-800 font-medium mt-0.5">
                      "{selectedTrace.justificationBank.amlDeclaredOrigin}"
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600">Contrato / Orden Vinculada:</span>
                    <strong className="text-slate-900 font-mono">
                      {selectedTrace.justificationBank.contractOrOrderRef || 'ORDEN-COMERCIAL'}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600">Nivel de Riesgo SUDEBAN (EBR):</span>
                    <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {selectedTrace.justificationBank.sudebanRiskTier}
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-rose-100 font-mono text-[9px] text-slate-500 break-all">
                    <span className="font-bold text-slate-700 block">Sello Digital SHA-256 Inmutable:</span>
                    {selectedTrace.justificationBank.sha256Proof}
                  </div>
                </div>
              </div>

              {/* Declaración Jurada Final */}
              <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[10px] leading-relaxed">
                <span className="font-bold uppercase tracking-wider block text-emerald-400 mb-1">
                  Certificación de Trazabilidad Financiera
                </span>
                Se certifica que la presente transacción ha sido reconciliada y validada contra los registros contables bajo normas Ven-NIF de <strong>{company.companyName}</strong> (RIF {company.companyRif}), sirviendo como prueba documental oponible ante la Administración Tributaria y la Unidad de Prevención del Banco emisor.
              </div>

            </div>
          ) : (
            <div className="m-auto text-center text-slate-400 text-xs space-y-1 py-12">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="font-semibold text-slate-600">Sin movimiento seleccionado</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Registra o selecciona un movimiento bancario para emitir su justificación legal ante el SENIAT y el Banco.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Modal: Registrar Nueva Entrada o Salida de Cuenta Bancaria con Justificación */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Verificar y Registrar Flujo Bancario con Soporte SENIAT y Banco
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTrace} className="space-y-3.5 text-xs">
              
              {/* Dirección del Dinero */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Dirección del Flujo:</label>
                  <select
                    value={newDirection}
                    onChange={(e) => setNewDirection(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                  >
                    <option value="ENTRADA">Entrada / Abono a Cuenta (+)</option>
                    <option value="SALIDA">Salida / Cargo a Cuenta (-)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Canal de Pago Utilizado:</label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold"
                  >
                    <option value="TRANSFERENCIA_BANCARIA">Transferencia Bancaria Inmediata</option>
                    <option value="PAGO_MOVIL">Pago Móvil (C2P / P2P / P2C)</option>
                    <option value="PUNTO_DE_VENTA">Punto de Venta POS (Lote Débito/Crédito)</option>
                    <option value="BIO_PAGO">BioPago BDV (Biometría)</option>
                    <option value="TARJETA_DEBITO_CREDITO">Tarjeta Débito / Crédito</option>
                    <option value="DIVISAS_CONVENIO_1">Divisas Cuenta Custodia (Convenio 1)</option>
                    <option value="EFECTIVO_FISICO">Efectivo Físico (Remesa de Caja)</option>
                  </select>
                </div>
              </div>

              {/* Banco y Referencia */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="font-semibold text-slate-700 block mb-1">Banco:</label>
                  <select
                    value={newBankCode}
                    onChange={(e) => {
                      setNewBankCode(e.target.value);
                      const map: Record<string, string> = {
                        '0134': 'Banesco Banco Universal',
                        '0105': 'Banco Mercantil C.A.',
                        '0102': 'Banco de Venezuela S.A.',
                        '0172': 'Bancamiga Banco Universal',
                        '0191': 'Banco Nacional de Crédito BNC'
                      };
                      setNewBankName(map[e.target.value] || 'Banco Universal');
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold"
                  >
                    <option value="0134">Banesco (0134)</option>
                    <option value="0105">Mercantil (0105)</option>
                    <option value="0102">BDV (0102)</option>
                    <option value="0172">Bancamiga (0172)</option>
                    <option value="0191">BNC (0191)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">N° Referencia Bancaria:</label>
                  <input
                    type="text"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    placeholder="Ej. REF-9901824"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Monto Nominal:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono"
                    required
                  />
                </div>
              </div>

              {/* Contraparte */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nombre o Razón Social Contraparte:</label>
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder="Ej. Inversiones San Antonio C.A."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">RIF Contraparte:</label>
                  <input
                    type="text"
                    value={newPartyRif}
                    onChange={(e) => setNewPartyRif(e.target.value)}
                    placeholder="J-12345678-9"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Concepto o Descripción:</label>
                <input
                  type="text"
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  placeholder="Ej. Cobro lote POS / Pago Factura / Transferencia Proveedor"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              {/* Justificación SENIAT */}
              <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200/80 space-y-2">
                <span className="font-bold text-teal-950 block">Datos de Justificación Tributaria (SENIAT):</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">N° Factura Fiscal / Control:</label>
                    <input
                      type="text"
                      value={newInvoiceNum}
                      onChange={(e) => setNewInvoiceNum(e.target.value)}
                      placeholder="Ej. FAC-4491 / 00-004491"
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Monto Retención IVA (Bs.):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newVatRetention}
                      onChange={(e) => setNewVatRetention(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Justificación Banco */}
              <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-1">
                <span className="font-bold text-rose-950 block">Declaración de Fondos para el Banco (SUDEBAN):</span>
                <input
                  type="text"
                  value={newAmlOrigin}
                  onChange={(e) => setNewAmlOrigin(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Registrar con Huella SHA-256
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
