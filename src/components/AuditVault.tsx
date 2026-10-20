import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Download
} from 'lucide-react';
import { AuditVaultItem, CurrencyType } from '../types/accounting';
import { calculateSha256 } from '../services/cryptoService';

interface AuditVaultProps {
  currency: CurrencyType;
  bcvRate: number;
}

export const AuditVault: React.FC<AuditVaultProps> = ({ currency, bcvRate }) => {
  const [vaultItems, setVaultItems] = useState<AuditVaultItem[]>([]);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDocType, setNewDocType] = useState<AuditVaultItem['documentType']>('FACTURA_COMPRA');
  const [newRif, setNewRif] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRef, setNewRef] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const rawContent = `${newTitle}|${newDocType}|${newRif}|${newAmount}|${newRef}|${Date.now()}`;
    const hash = await calculateSha256(rawContent);

    const newItem: AuditVaultItem = {
      id: `vlt-${Date.now()}`,
      documentType: newDocType,
      title: newTitle,
      sha256Hash: hash,
      relatedReference: newRef || 'REF-N/A',
      counterpartyRif: newRif || 'N/A',
      amount: parseFloat(newAmount) || 0,
      currency,
      date: new Date().toISOString().split('T')[0],
      notes: 'Documento sellado digitalmente en la Bóveda Criptográfica NOMINUS.',
      createdAt: new Date().toISOString()
    };

    setVaultItems([newItem, ...vaultItems]);
    setNewTitle('');
    setNewRif('');
    setNewAmount('');
    setNewRef('');
    setIsAdding(false);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredItems = vaultItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.sha256Hash.toLowerCase().includes(term) ||
      item.counterpartyRif.toLowerCase().includes(term) ||
      item.relatedReference.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white p-5 rounded-2xl border border-indigo-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Bóveda Documental Criptográfica SHA-256
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Inmutabilidad & Cadena de Custodia
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Resguardo inalterable de facturas, contratos mercantiles y comprobantes de retención. Cada soporte genera una huella criptográfica SHA-256 verificable ante auditorías tributarias.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            {isAdding ? 'Cancelar' : '+ Registrar Documento en Bóveda'}
          </button>
        </div>
      </div>

      {/* Add Document Form */}
      {isAdding && (
        <form onSubmit={handleAddItem} className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
            Registro de Soporte Digital con Huella SHA-256
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Título o Descripción del Documento:</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Factura Compra N° 890 - Inversiones Industriales"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Tipo de Instrumento:</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50"
              >
                <option value="FACTURA_VENTA">Factura Fiscal de Venta (Prov. 0071)</option>
                <option value="FACTURA_COMPRA">Factura de Compra Recibida</option>
                <option value="COMPROBANTE_RETENCION">Comprobante Retención IVA (14 Dígitos)</option>
                <option value="CONTRATO_MUTUO">Contrato de Mutuo Socios (SUDEBAN 010.25)</option>
                <option value="CONTRATO_COMISION">Contrato de Comisión Mercantil</option>
                <option value="PLANILLA_DEPOSITO">Planilla de Despacho Efectivo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">RIF de la Contraparte:</label>
              <input
                type="text"
                value={newRif}
                onChange={(e) => setNewRif(e.target.value)}
                placeholder="J-12345678-9"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Monto del Documento:</label>
              <input
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Referencia Bancaria Asociada:</label>
              <input
                type="text"
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                placeholder="REF-8849201"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              Generar Huella SHA-256 e Incorporar a Bóveda
            </button>
          </div>
        </form>
      )}

      {/* Search & Items List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, RIF, hash SHA-256 o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {filteredItems.length} registros protegidos criptográficamente
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-slate-200/80 text-xs space-y-1">
            <Lock className="w-7 h-7 text-slate-300 mx-auto mb-1" />
            <p className="font-semibold text-slate-600">Bóveda Criptográfica limpia y lista para su uso.</p>
            <p className="text-[11px] text-slate-400">Haz clic en "+ Registrar Documento en Bóveda" para resguardar facturas, contratos o comprobantes con huella SHA-256 inmutable.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
          {filteredItems.map(item => (
            <div key={item.id} className="py-3.5 space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {item.documentType}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{item.notes}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-slate-900 block text-xs">
                    {item.currency === 'VES' ? 'Bs.' : '$'} {item.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.date}</span>
                </div>
              </div>

              {/* SHA-256 Hash Display */}
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 font-mono text-[10px] text-indigo-950 flex items-center justify-between gap-2 break-all">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>SHA-256: {item.sha256Hash}</span>
                </div>
                <button
                  onClick={() => handleCopyHash(item.sha256Hash)}
                  className="text-slate-500 hover:text-indigo-700 font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedHash === item.sha256Hash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHash === item.sha256Hash ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span>RIF: <strong className="text-slate-700 font-mono">{item.counterpartyRif}</strong></span>
                <span>Ref Bancaria: <strong className="text-slate-700 font-mono">{item.relatedReference}</strong></span>
              </div>
            </div>
          ))}
        </div>
        )}

      </div>

    </div>
  );
};
