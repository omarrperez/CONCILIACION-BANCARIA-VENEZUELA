import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Save,
  Sliders,
  Check,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Bot,
  Send,
  TrendingUp,
  Eye,
  EyeOff,
  Plus,
  Landmark,
  CreditCard,
  Layers,
  Edit3
} from 'lucide-react';
import { CompanyProfile, CompanyBankAccount, CurrencyType } from '../types/accounting';
import { fetchLiveBcvRate } from '../services/bcvService';
import { getTelegramConfig, saveTelegramConfig, testTelegramBotConnection, sendTelegramMessage } from '../services/telegramSyncService';
import { VENEZUELAN_BANKS, getBankDefinition } from '../data/venezuelanBanks';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyProfile[];
  activeCompanyId: string;
  onSelectActiveCompany: (companyId: string) => void;
  onSaveCompany: (updated: CompanyProfile) => void;
  onCreateCompany: (newComp: CompanyProfile) => void;
  onDeleteCompany: (companyId: string) => void;
  onUpdateBankAccounts: (companyId: string, bankAccounts: CompanyBankAccount[]) => void;
  onPurgeAllData?: () => Promise<void>;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  onSelectActiveCompany,
  onSaveCompany,
  onCreateCompany,
  onDeleteCompany,
  onUpdateBankAccounts,
  onPurgeAllData
}) => {
  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0];

  const [activeTab, setActiveTab] = useState<'DETAILS' | 'BANKS' | 'MULTI_COMPANY'>('DETAILS');
  const [formData, setFormData] = useState<CompanyProfile>(activeCompany);

  // Bank Account Form state
  const [editingBank, setEditingBank] = useState<CompanyBankAccount | null>(null);
  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState<{
    bankCode: string;
    accountNumber: string;
    accountType: 'CORRIENTE' | 'AHORRO' | 'MONEDA_EXTRANJERA_USD' | 'CUSTODIA';
    currency: CurrencyType;
    initialBalanceBank: string;
    initialBalanceLedger: string;
    notes: string;
  }>({
    bankCode: '0134',
    accountNumber: '0134-0000-00-0000000000',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: '0.00',
    initialBalanceLedger: '0.00',
    notes: ''
  });

  // Create New Company state
  const [isNewCompanyFormOpen, setIsNewCompanyFormOpen] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    companyName: '',
    companyRif: '',
    address: '',
    isSpecialTaxpayer: true
  });

  // Security & Telegram
  const [userGeminiKey, setUserGeminiKey] = useState<string>(() => {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('user_gemini_api_key')) || '';
  });
  const [telegramToken, setTelegramToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [isFetchingBcv, setIsFetchingBcv] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgedSuccess, setPurgedSuccess] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; text: string } | null>(null);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      setFormData(activeCompany);
    }
    if (typeof localStorage !== 'undefined') {
      setUserGeminiKey(localStorage.getItem('user_gemini_api_key') || '');
      const tg = getTelegramConfig();
      setTelegramToken(tg.botToken);
      setTelegramChatId(tg.chatId);
    }
  }, [activeCompany, isOpen]);

  if (!isOpen) return null;

  const handleFetchLiveBcv = async () => {
    setIsFetchingBcv(true);
    const res = await fetchLiveBcvRate();
    setFormData(prev => ({ ...prev, bcvRate: res.rate }));
    setIsFetchingBcv(false);
  };

  const handleSubmitCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof localStorage !== 'undefined') {
      if (userGeminiKey.trim()) {
        localStorage.setItem('user_gemini_api_key', userGeminiKey.trim());
      } else {
        localStorage.removeItem('user_gemini_api_key');
      }
      saveTelegramConfig({
        botToken: telegramToken,
        chatId: telegramChatId
      });
    }
    onSaveCompany(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1200);
  };

  // Open bank form for new bank
  const handleOpenAddBank = () => {
    setEditingBank(null);
    setBankFormData({
      bankCode: '0134',
      accountNumber: '0134-',
      accountType: 'CORRIENTE',
      currency: 'VES',
      initialBalanceBank: '0.00',
      initialBalanceLedger: '0.00',
      notes: ''
    });
    setIsBankFormOpen(true);
  };

  // Open bank form for editing bank
  const handleOpenEditBank = (bank: CompanyBankAccount) => {
    setEditingBank(bank);
    setBankFormData({
      bankCode: bank.bankCode,
      accountNumber: bank.accountNumber,
      accountType: bank.accountType,
      currency: bank.currency,
      initialBalanceBank: bank.initialBalanceBank.toString(),
      initialBalanceLedger: bank.initialBalanceLedger.toString(),
      notes: bank.notes || ''
    });
    setIsBankFormOpen(true);
  };

  // Save bank account
  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const bankDef = getBankDefinition(bankFormData.bankCode);
    const existing = formData.bankAccounts || [];

    const newBankItem: CompanyBankAccount = {
      id: editingBank ? editingBank.id : `bank-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      companyId: formData.id,
      bankCode: bankDef.code,
      bankName: bankDef.fullName,
      accountNumber: bankFormData.accountNumber || `${bankDef.code}-0000-00-0000000000`,
      accountType: bankFormData.accountType,
      currency: bankFormData.currency,
      initialBalanceBank: parseFloat(bankFormData.initialBalanceBank) || 0,
      initialBalanceLedger: parseFloat(bankFormData.initialBalanceLedger) || 0,
      isActive: true,
      notes: bankFormData.notes
    };

    let updatedBanks: CompanyBankAccount[];
    if (editingBank) {
      updatedBanks = existing.map(b => b.id === editingBank.id ? newBankItem : b);
    } else {
      updatedBanks = [...existing, newBankItem];
    }

    const updatedComp = { ...formData, bankAccounts: updatedBanks };
    setFormData(updatedComp);
    onUpdateBankAccounts(formData.id, updatedBanks);
    setIsBankFormOpen(false);
  };

  // Delete bank account
  const handleDeleteBankAccount = (bankId: string) => {
    const updatedBanks = (formData.bankAccounts || []).filter(b => b.id !== bankId);
    const updatedComp = { ...formData, bankAccounts: updatedBanks };
    setFormData(updatedComp);
    onUpdateBankAccounts(formData.id, updatedBanks);
  };

  // Handle create new company
  const handleCreateNewCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyData.companyName.trim() || !newCompanyData.companyRif.trim()) return;

    const newComp: CompanyProfile = {
      id: `comp-${Date.now()}`,
      companyName: newCompanyData.companyName.trim(),
      companyRif: newCompanyData.companyRif.trim().toUpperCase(),
      address: newCompanyData.address.trim() || 'Venezuela',
      isSpecialTaxpayer: newCompanyData.isSpecialTaxpayer,
      vatRetentionRate: 75,
      defaultCurrency: 'VES',
      bcvRate: formData.bcvRate || 52.40,
      accountingSystemTarget: 'PROFIT',
      bankAccounts: [
        {
          id: `bank-${Date.now()}-1`,
          companyId: `comp-${Date.now()}`,
          bankCode: '0134',
          bankName: 'Banesco Banco Universal',
          accountNumber: '0134-0000-00-0000000000',
          accountType: 'CORRIENTE',
          currency: 'VES',
          initialBalanceBank: 0,
          initialBalanceLedger: 0,
          isActive: true,
          notes: 'Cuenta Principal Banesco'
        }
      ],
      createdAt: new Date().toISOString()
    };

    onCreateCompany(newComp);
    onSelectActiveCompany(newComp.id);
    setIsNewCompanyFormOpen(false);
    setNewCompanyData({
      companyName: '',
      companyRif: '',
      address: '',
      isSpecialTaxpayer: true
    });
  };

  // Telegram helpers
  const handleTestBotToken = async () => {
    if (!telegramToken.trim()) {
      setTelegramTestResult({ success: false, text: 'Introduce primero el Token de tu bot de Telegram.' });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    const res = await testTelegramBotConnection(telegramToken.trim());
    setIsTestingTelegram(false);
    if (res.success) {
      setTelegramTestResult({
        success: true,
        text: `✅ ¡Conexión exitosa! Bot: @${res.username} (${res.botName}). Token 100% válido.`
      });
    } else {
      setTelegramTestResult({
        success: false,
        text: `❌ Error al conectar: ${res.error || 'Token inválido'}`
      });
    }
  };

  const handleDetectTelegramChatId = async () => {
    if (!telegramToken.trim()) {
      setTelegramTestResult({ success: false, text: 'Introduce primero el Token de tu bot.' });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${telegramToken.trim()}/getUpdates?limit=5`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        const lastMsg = data.result[data.result.length - 1];
        const foundChatId = lastMsg.message?.chat?.id || lastMsg.callback_query?.message?.chat?.id;
        const senderName = lastMsg.message?.from?.first_name || lastMsg.message?.chat?.title || 'Usuario';
        if (foundChatId) {
          setTelegramChatId(foundChatId.toString());
          setTelegramTestResult({
            success: true,
            text: `✅ Chat ID detectado: ${foundChatId} (${senderName}). ¡Asignado al campo!`
          });
          setIsTestingTelegram(false);
          return;
        }
      }
      setTelegramTestResult({
        success: false,
        text: 'Abre Telegram en tu celular, escribe "/start" a tu bot y vuelve a pulsar este botón.'
      });
    } catch (err: any) {
      setTelegramTestResult({ success: false, text: `Error de conexión: ${err.message}` });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTelegramTestResult({
        success: false,
        text: '❌ Debes ingresar tanto el Bot Token como el Chat ID para enviar el mensaje de prueba.'
      });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    const text = `🚀 <b>¡Prueba Exitosa con NOMINUS Conciliación!</b>\n\nTu bot de Telegram está vinculado y listo para recibir fotos y transferencias.\n\n🏢 <b>Empresa:</b> ${formData.companyName}\n📅 <i>${new Date().toLocaleDateString('es-VE')} - Venezuela</i>`;
    const sent = await sendTelegramMessage(telegramToken.trim(), telegramChatId.trim(), text);
    setIsTestingTelegram(false);
    if (sent) {
      setTelegramTestResult({
        success: true,
        text: '📲 ¡Mensaje de prueba enviado exitosamente! Revisa tu Telegram.'
      });
    } else {
      setTelegramTestResult({
        success: false,
        text: '❌ No se pudo enviar el mensaje. Asegúrate de haberle escrito "/start" a tu bot en Telegram.'
      });
    }
  };

  const handleExecutePurge = async () => {
    if (!onPurgeAllData) return;
    setIsPurging(true);
    try {
      await onPurgeAllData();
      setPurgedSuccess(true);
      setShowPurgeConfirm(false);
      setTimeout(() => setPurgedSuccess(false), 3000);
    } catch (err) {
      console.error('Error al purgar:', err);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-inner">
              <Building2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Gestión Multi-Empresa & Cuentas Bancarias
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  1 a 10 Bancos
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Configura múltiples empresas y sus cuentas bancarias venezolanas independientes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'DETAILS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            <span>Empresa Activa</span>
          </button>

          <button
            onClick={() => setActiveTab('BANKS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'BANKS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>Cuentas Bancarias ({formData.bankAccounts?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('MULTI_COMPANY')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'MULTI_COMPANY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Multi-Empresas ({companies.length})</span>
          </button>
        </div>

        {/* TAB 1: DETAILS OF ACTIVE COMPANY */}
        {activeTab === 'DETAILS' && (
          <form onSubmit={handleSubmitCompany} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Empresa Seleccionada Activa</span>
                <h4 className="text-sm font-extrabold text-slate-900">{formData.companyName || 'Sin Razón Social'}</h4>
                <p className="text-[11px] text-slate-600 font-mono">RIF: {formData.companyRif || 'Sin RIF'}</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white text-emerald-900 border border-emerald-300 shadow-2xs">
                {formData.bankAccounts?.length || 0} Bancos Registrados
              </span>
            </div>

            <div>
              <label className="text-slate-800 font-bold block mb-1">Razón Social de la Empresa:</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-medium"
                placeholder="ej. Inversiones y Servicios Comerciales, C.A."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-800 font-bold block mb-1">R.I.F. SENIAT:</label>
                <input
                  type="text"
                  value={formData.companyRif}
                  onChange={(e) => setFormData({ ...formData, companyRif: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono uppercase"
                  placeholder="J-12345678-9"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-800 font-bold block">Tasa BCV (Bs./$):</label>
                  <button
                    type="button"
                    onClick={handleFetchLiveBcv}
                    disabled={isFetchingBcv}
                    className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-300"
                  >
                    <TrendingUp className={`w-3 h-3 ${isFetchingBcv ? 'animate-spin' : ''}`} />
                    <span>{isFetchingBcv ? 'Consultando...' : 'Obtener Hoy'}</span>
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bcvRate}
                  onChange={(e) => setFormData({ ...formData, bcvRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-slate-800 font-bold block mb-1">Domicilio Fiscal (Venezuela):</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                placeholder="Ciudad, Municipio, Estado"
                required
              />
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
              <span className="font-bold text-slate-800 block">Condición Tributaria Especial:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isSpecialTaxpayer}
                  onChange={(e) => setFormData({ ...formData, isSpecialTaxpayer: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-slate-800 font-semibold">
                  Notificado como Sujeto Pasivo Especial (SPE) por el SENIAT
                </span>
              </label>
              <p className="text-[10px] text-slate-500">
                Habilita la retención de IVA (75%/100%) bajo Providencia SNAT/2025/000054.
              </p>
            </div>

            <div>
              <label className="text-slate-800 font-bold block mb-1">Sistema Contable de Destino:</label>
              <select
                value={formData.accountingSystemTarget}
                onChange={(e) => setFormData({ ...formData, accountingSystemTarget: e.target.value as any })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-slate-50 text-xs font-semibold"
              >
                <option value="SGT">SGT Contable (Plan de Cuentas Oficial)</option>
                <option value="PROFIT">Profit Plus Contabilidad (2K8 / 2K12 / ERP)</option>
                <option value="GALAC">Gálac Software Contabilidad</option>
                <option value="SAINT">Saint Enterprise Contabilidad</option>
                <option value="VALERY">Valery Software</option>
                <option value="EXCEL_VEN_NIF">Excel / CSV Oficial Ven-NIF</option>
              </select>
            </div>

            {/* Telegram Section */}
            <div className="p-3.5 bg-sky-50/80 rounded-2xl border border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sky-950 font-extrabold text-xs">
                  <Bot className="w-4 h-4 text-sky-700" />
                  <span>Telegram Sync Bot:</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
                  Gratuito
                </span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-sky-950 block mb-1">
                    Bot Token (@BotFather):
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showTelegramToken ? 'text' : 'password'}
                        placeholder="7839218392:AAHdxx_..."
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 border border-sky-300 rounded-xl font-mono text-xs bg-white text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTelegramToken(!showTelegramToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showTelegramToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestBotToken}
                      disabled={isTestingTelegram}
                      className="px-2.5 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-900 font-extrabold text-[11px] rounded-xl border border-sky-300 cursor-pointer shrink-0"
                    >
                      {isTestingTelegram ? 'Probando...' : '🔍 Probar Token'}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-sky-950 block">
                      Chat ID / Grupo:
                    </label>
                    <button
                      type="button"
                      onClick={handleDetectTelegramChatId}
                      disabled={isTestingTelegram}
                      className="text-[10px] text-sky-800 hover:text-sky-950 font-bold flex items-center gap-1 cursor-pointer bg-sky-100 px-2 py-0.5 rounded border border-sky-300"
                    >
                      🎯 Detectar mi Chat ID
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-sky-300 rounded-xl font-mono text-xs bg-white text-slate-800"
                  />
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={isTestingTelegram}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Mensaje de Prueba</span>
                  </button>
                </div>

                {telegramTestResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold border ${
                    telegramTestResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {telegramTestResult.text}
                  </div>
                )}
              </div>
            </div>

            {/* Zona de Limpieza y Vaciado Total de Datos de Prueba */}
            {onPurgeAllData && (
              <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-rose-950">
                        Vaciado de Base de Datos (Comenzar 100% Limpio)
                      </h4>
                      <p className="text-[11px] text-rose-800 leading-tight">
                        Elimina cualquier registro de prueba previo para que el sistema quede en blanco y listo para vaciar tu contabilidad real.
                      </p>
                    </div>
                  </div>

                  {!showPurgeConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowPurgeConfirm(true)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-white hover:bg-rose-600 border border-rose-300 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Vaciar / Purgar Todo...
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPurgeConfirm(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecutePurge}
                        disabled={isPurging}
                        className="px-3 py-1 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isPurging ? 'Vaciando...' : 'Confirmar Vaciado'}
                      </button>
                    </div>
                  )}
                </div>

                {purgedSuccess && (
                  <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>¡Base de datos vaciada con éxito! No existen datos ficticios en el sistema.</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Configuración Guardada Exitosa
                </span>
              ) : <span />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer font-semibold"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: BANK ACCOUNTS OF ACTIVE COMPANY (1 to 10 Banks) */}
        {activeTab === 'BANKS' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-2xl border border-blue-200">
              <div>
                <h4 className="text-xs font-extrabold text-blue-950">
                  Cuentas Bancarias de {formData.companyName}
                </h4>
                <p className="text-[11px] text-blue-800">
                  Soporta de 1 a 10 bancos venezolanos independientes por empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddBank}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar Banco</span>
              </button>
            </div>

            {/* List of current bank accounts */}
            <div className="space-y-2.5">
              {(formData.bankAccounts || []).length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Landmark className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700">No hay cuentas bancarias registradas para esta empresa.</p>
                  <p className="text-slate-500 text-[11px]">Haz clic en "+ Agregar Banco" para añadir Mercantil, Banesco, BDV, BNC, Bancamiga, etc.</p>
                  <button
                    type="button"
                    onClick={handleOpenAddBank}
                    className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    + Registrar Primer Banco
                  </button>
                </div>
              ) : (
                (formData.bankAccounts || []).map((bank) => {
                  const def = getBankDefinition(bank.bankCode);
                  return (
                    <div
                      key={bank.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${def.bgColor} ${def.borderColor}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white border ${def.borderColor} ${def.textColor}`}>
                            Code: {bank.bankCode}
                          </span>
                          <h5 className="font-extrabold text-slate-900 text-xs">
                            {bank.bankName}
                          </h5>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                            {bank.currency}
                          </span>
                        </div>
                        <p className="font-mono font-bold text-slate-800 text-[11px]">
                          N° Cuenta: {bank.accountNumber}
                        </p>
                        <div className="flex gap-3 text-[10px] font-mono text-slate-600">
                          <span>Tipo: <strong>{bank.accountType}</strong></span>
                          <span>Saldo Banco: <strong>{bank.currency === 'VES' ? 'Bs.' : '$'} {bank.initialBalanceBank.toFixed(2)}</strong></span>
                          <span>Saldo Libro: <strong>{bank.currency === 'VES' ? 'Bs.' : '$'} {bank.initialBalanceLedger.toFixed(2)}</strong></span>
                        </div>
                        {bank.notes && (
                          <p className="text-[10px] text-slate-500 italic">Nota: {bank.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBank(bank)}
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer shadow-2xs"
                          title="Editar cuenta bancaria"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankAccount(bank.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer shadow-2xs"
                          title="Eliminar cuenta bancaria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal for adding/editing bank account */}
            {isBankFormOpen && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    <span>{editingBank ? 'Editar Cuenta Bancaria' : 'Agregar Nueva Cuenta Bancaria'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsBankFormOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveBankAccount} className="space-y-3">
                  <div>
                    <label className="text-slate-800 font-bold block mb-1">Seleccionar Banco de Venezuela:</label>
                    <select
                      value={bankFormData.bankCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const def = getBankDefinition(code);
                        setBankFormData({
                          ...bankFormData,
                          bankCode: code,
                          accountNumber: `${code}-`
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-xs"
                    >
                      {VENEZUELAN_BANKS.map((b) => (
                        <option key={b.code} value={b.code}>
                          ({b.code}) {b.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-800 font-bold block mb-1">Número de Cuenta (20 Dígitos):</label>
                      <input
                        type="text"
                        value={bankFormData.accountNumber}
                        onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                        placeholder="0134-0000-00-0000000000"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-slate-800 font-bold block mb-1">Tipo de Cuenta:</label>
                      <select
                        value={bankFormData.accountType}
                        onChange={(e) => setBankFormData({ ...bankFormData, accountType: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-semibold text-xs"
                      >
                        <option value="CORRIENTE">Cuenta Corriente</option>
                        <option value="AHORRO">Cuenta de Ahorros</option>
                        <option value="MONEDA_EXTRANJERA_USD">Moneda Extranjera / Divisas USD</option>
                        <option value="CUSTODIA">Cuenta Custodia / Convenio 1</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-800 font-bold block mb-1">Moneda:</label>
                      <select
                        value={bankFormData.currency}
                        onChange={(e) => setBankFormData({ ...bankFormData, currency: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-xs"
                      >
                        <option value="VES">Bolívares (VES)</option>
                        <option value="USD">Dólares (USD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-800 font-bold block mb-1">Saldo Apertura Banco:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={bankFormData.initialBalanceBank}
                        onChange={(e) => setBankFormData({ ...bankFormData, initialBalanceBank: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-800 font-bold block mb-1">Saldo Apertura Libro:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={bankFormData.initialBalanceLedger}
                        onChange={(e) => setBankFormData({ ...bankFormData, initialBalanceLedger: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-800 font-bold block mb-1">Nota o Identificador:</label>
                    <input
                      type="text"
                      value={bankFormData.notes}
                      onChange={(e) => setBankFormData({ ...bankFormData, notes: e.target.value })}
                      placeholder="ej. Cuenta Principal Operativa, Recaudación Punto de Venta"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsBankFormOpen(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-2xs"
                    >
                      {editingBank ? 'Guardar Cambios' : 'Registrar Cuenta Bancaria'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MULTI-COMPANY MANAGEMENT */}
        {activeTab === 'MULTI_COMPANY' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            <div className="flex items-center justify-between bg-purple-50/70 p-3 rounded-2xl border border-purple-200">
              <div>
                <h4 className="text-xs font-extrabold text-purple-950">
                  Listado de Empresas Registradas ({companies.length})
                </h4>
                <p className="text-[11px] text-purple-800">
                  Selecciona la empresa con la que deseas trabajar o crea una nueva.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCompanyFormOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nueva Empresa</span>
              </button>
            </div>

            {/* List of Companies */}
            <div className="space-y-2.5">
              {companies.map((comp) => {
                const isActive = comp.id === activeCompanyId;
                const banksCount = (comp.bankAccounts || []).length;

                return (
                  <div
                    key={comp.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/50 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-extrabold text-slate-900 text-xs">
                          {comp.companyName}
                        </h5>
                        {isActive && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            Activa
                          </span>
                        )}
                        {comp.isSpecialTaxpayer && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            SPE
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-slate-600 font-bold text-[11px]">
                        RIF: {comp.companyRif} | {banksCount} Bancos Registrados
                      </p>
                      <p className="text-[10px] text-slate-500 truncate max-w-md">
                        {comp.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectActiveCompany(comp.id);
                            setActiveTab('DETAILS');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-2xs cursor-pointer"
                        >
                          Seleccionar
                        </button>
                      )}
                      {companies.length > 1 && !isActive && (
                        <button
                          type="button"
                          onClick={() => onDeleteCompany(comp.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer"
                          title="Eliminar empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create new company form */}
            {isNewCompanyFormOpen && (
              <div className="p-4 bg-purple-50/90 rounded-2xl border border-purple-300 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <h4 className="font-extrabold text-purple-950 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-700" />
                    <span>Crear Nueva Empresa</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsNewCompanyFormOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateNewCompany} className="space-y-3">
                  <div>
                    <label className="text-purple-950 font-bold block mb-1">Razón Social:</label>
                    <input
                      type="text"
                      value={newCompanyData.companyName}
                      onChange={(e) => setNewCompanyData({ ...newCompanyData, companyName: e.target.value })}
                      placeholder="ej. Empresa Venezolana 2, C.A."
                      className="w-full px-3 py-1.5 border border-purple-300 rounded-xl bg-white text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-purple-950 font-bold block mb-1">R.I.F. SENIAT:</label>
                      <input
                        type="text"
                        value={newCompanyData.companyRif}
                        onChange={(e) => setNewCompanyData({ ...newCompanyData, companyRif: e.target.value })}
                        placeholder="J-12345678-9"
                        className="w-full px-3 py-1.5 border border-purple-300 rounded-xl font-mono text-xs uppercase bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-purple-950 font-bold block mb-1">Domicilio Fiscal:</label>
                      <input
                        type="text"
                        value={newCompanyData.address}
                        onChange={(e) => setNewCompanyData({ ...newCompanyData, address: e.target.value })}
                        placeholder="Caracas, Venezuela"
                        className="w-full px-3 py-1.5 border border-purple-300 rounded-xl bg-white text-xs"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={newCompanyData.isSpecialTaxpayer}
                      onChange={(e) => setNewCompanyData({ ...newCompanyData, isSpecialTaxpayer: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-purple-950 font-semibold text-xs">
                      Sujeto Pasivo Especial SENIAT
                    </span>
                  </label>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsNewCompanyFormOpen(false)}
                      className="px-3 py-1.5 rounded-xl border border-purple-300 text-purple-900 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow-2xs"
                    >
                      Crear Empresa
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
