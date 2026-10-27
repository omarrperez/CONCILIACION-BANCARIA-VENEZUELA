import React, { useState } from 'react';
import {
  Landmark,
  TrendingUp,
  Building2,
  User as UserIcon,
  LogIn,
  LogOut,
  Download,
  Sliders,
  History,
  RefreshCw,
  Zap,
  ChevronDown,
  Plus,
  Check,
  CreditCard,
  ShieldCheck,
  HeartPulse,
  Lock,
  HelpCircle,
  Loader2,
  X,
  Sparkles,
  AlertTriangle,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { User } from 'firebase/auth';
import { CompanyProfile, CompanyBankAccount, CurrencyType } from '../types/accounting';
import { loginWithGoogle, logoutUser } from '../firebase/config';
import { fetchLiveBcvRate } from '../services/bcvService';
import { VENEZUELAN_BANKS, getBankDefinition } from '../data/venezuelanBanks';

interface NavbarProps {
  companies: CompanyProfile[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  selectedBankAccountId: string; // 'ALL' or specific bank account id
  onSelectBankAccount: (bankAccountId: string) => void;
  user: User | null;
  currency: CurrencyType;
  onCurrencyToggle: (curr: CurrencyType) => void;
  onOpenSettings: () => void;
  onOpenExportModal: () => void;
  onOpenClearModal?: () => void;
  onOpenRestoreModal?: () => void;
  onOpenHealthCheckup?: () => void;
  onOpenEncryptedBackup?: () => void;
  onOpenOnboarding?: () => void;
  onLoginAsLocalUser?: (email: string, displayName: string) => void;
  onLogoutUser?: () => void;
  healthIssuesCount?: number;
  onUpdateBcvRate: (newRate: number) => void;
  onNavigateToClarify?: () => void;
  unclarifiedCount?: number;
  bcvRateInfo?: {
    rate: number;
    lastUpdated?: string;
    source?: string;
    isLive?: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  selectedBankAccountId,
  onSelectBankAccount,
  user,
  currency,
  onCurrencyToggle,
  onOpenSettings,
  onOpenExportModal,
  onOpenClearModal,
  onOpenRestoreModal,
  onOpenHealthCheckup,
  onOpenEncryptedBackup,
  onOpenOnboarding,
  onLoginAsLocalUser,
  onLogoutUser,
  healthIssuesCount = 0,
  onUpdateBcvRate,
  onNavigateToClarify,
  unclarifiedCount = 0,
  bcvRateInfo
}) => {
  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0] || {
    id: 'default',
    companyName: 'Mi Empresa, C.A.',
    companyRif: 'J-00000000-0',
    bcvRate: 56.80,
    bankAccounts: []
  };

  const bankAccounts = activeCompany.bankAccounts || [];
  const activeBankAccount = bankAccounts.find(b => b.id === selectedBankAccountId);

  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const [isEditingBcv, setIsEditingBcv] = useState(false);
  const [tempBcv, setTempBcv] = useState(activeCompany.bcvRate.toString());
  const [isFetchingBcv, setIsFetchingBcv] = useState(false);

  // Auth Modal & Fallback States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('omarrperezc@gmail.com');
  const [customName, setCustomName] = useState('Omar Pérez (Contador CPC)');

  const handleFetchLiveBcv = async () => {
    setIsFetchingBcv(true);
    const res = await fetchLiveBcvRate();
    onUpdateBcvRate(res.rate);
    setTempBcv(res.rate.toString());
    setIsFetchingBcv(false);
  };

  const handleSaveBcv = () => {
    const parsed = parseFloat(tempBcv);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateBcvRate(parsed);
      setIsEditingBcv(false);
    }
  };

  const handleAuthClick = async () => {
    if (user) {
      try {
        if (onLogoutUser) {
          await onLogoutUser();
        } else {
          await logoutUser();
        }
      } catch (e) {
        console.warn('Logout error:', e);
      }
    } else {
      setIsAuthModalOpen(true);
      setAuthError(null);
    }
  };

  const handleGoogleLoginDirect = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Google Sign-In Error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('popup-blocked')) {
        setAuthError('El navegador bloqueó la ventana emergente de Google. Puedes usar el ingreso rápido a continuación.');
      } else if (msg.includes('popup-closed-by-user')) {
        setAuthError('La ventana de Google fue cerrada antes de seleccionar la cuenta.');
      } else {
        setAuthError('No se pudo conectar directamente con Google en esta ventana. Utiliza el Ingreso Rápido de Contador a continuación.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickLocalLogin = (emailToUse?: string, nameToUse?: string) => {
    const email = emailToUse || customEmail || 'omarrperezc@gmail.com';
    const name = nameToUse || customName || 'Omar Pérez (Contador CPC)';
    if (onLoginAsLocalUser) {
      onLoginAsLocalUser(email, name);
    }
    setIsAuthModalOpen(false);
    setAuthError(null);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="w-full px-3 sm:px-6 xl:px-8">
        <div className="flex items-center justify-between h-16 gap-3 lg:gap-6">
          
          {/* Logo Brand, Multi-Company Selector & Active Bank (Never shrink) */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            
            {/* App Icon */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold shadow-sm shrink-0">
              <Landmark className="w-5 h-5 text-white" />
            </div>

            {/* Brand NOMINUS & Multi-Company Selector */}
            <div className="flex flex-col justify-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 tracking-tight text-lg sm:text-xl leading-none">
                  NOMINUS
                </span>
                <span className="hidden sm:inline-flex text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ven-NIF RegTech
                </span>
              </div>

              {/* Company Switcher Pill */}
              <div className="relative mt-1">
                <button
                  onClick={() => {
                    setIsCompanyDropdownOpen(!isCompanyDropdownOpen);
                    setIsBankDropdownOpen(false);
                    setIsToolsDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold max-w-[170px] sm:max-w-[210px] truncate cursor-pointer py-0.5"
                  title="Cambiar de Empresa Registrada (Multi-Empresa)"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate text-slate-800 font-bold">{activeCompany.companyName || 'Seleccionar Empresa'}</span>
                  {activeCompany.companyRif && (
                    <span className="text-[10px] font-normal text-slate-400 hidden md:inline">({activeCompany.companyRif})</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                {/* Company Dropdown Menu */}
                {isCompanyDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                      <span>Empresas Registradas ({companies.length})</span>
                      <span className="text-emerald-600 font-bold">Multi-Empresa</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {companies.map(comp => {
                        const isSelected = comp.id === activeCompany.id;
                        return (
                          <button
                            key={comp.id}
                            onClick={() => {
                              onSelectCompany(comp.id);
                              setIsCompanyDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold truncate">{comp.companyName || 'Sin Nombre'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{comp.companyRif || 'Sin RIF'} • {comp.bankAccounts?.length || 0} banco(s)</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 pt-1 px-2">
                      <button
                        onClick={() => {
                          setIsCompanyDropdownOpen(false);
                          onOpenSettings();
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs text-emerald-700 font-bold hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar o Administrar Empresas...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selector de Banco Activo (1 a 10 Bancos) */}
            <div className="relative hidden xl:block border-l border-slate-200/90 pl-3.5 ml-1 shrink-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Cuenta Bancaria</span>
              <button
                onClick={() => {
                  setIsBankDropdownOpen(!isBankDropdownOpen);
                  setIsCompanyDropdownOpen(false);
                  setIsToolsDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 hover:text-emerald-700 transition-colors cursor-pointer mt-0.5"
              >
                {activeBankAccount ? (
                  <>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getBankDefinition(activeBankAccount.bankCode).bgColor} ${getBankDefinition(activeBankAccount.bankCode).textColor}`}>
                      {getBankDefinition(activeBankAccount.bankCode).shortName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">
                      ...{activeBankAccount.accountNumber.slice(-6)}
                    </span>
                  </>
                ) : bankAccounts.length === 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Registrar Banco (0)
                  </span>
                ) : (
                  <span className="text-slate-700 font-bold">🏦 Todos los Bancos ({bankAccounts.length})</span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Bank Selector Dropdown */}
              {isBankDropdownOpen && (
                <div className="absolute left-0 mt-1 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Cuentas de {activeCompany.companyName}</span>
                    <span className="text-slate-500 font-medium">1 a 10 Bancos</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1">
                    {bankAccounts.length === 0 ? (
                      <div className="p-3 text-center text-xs space-y-1">
                        <p className="font-bold text-slate-800">No hay bancos registrados</p>
                        <p className="text-[11px] text-slate-500">Agrega tus cuentas bancarias venezolanas reales para comenzar a conciliar.</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectBankAccount('ALL');
                          setIsBankDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          selectedBankAccountId === 'ALL' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold">🏢 Consolidado: Todos los Bancos</p>
                          <p className="text-[10px] text-slate-400">Ver transacciones de todas las cuentas registradas</p>
                        </div>
                        {selectedBankAccountId === 'ALL' && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                    )}

                    {bankAccounts.map(bank => {
                      const bankDef = getBankDefinition(bank.bankCode);
                      const isSelected = bank.id === selectedBankAccountId;
                      return (
                        <button
                          key={bank.id}
                          onClick={() => {
                            onSelectBankAccount(bank.id);
                            setIsBankDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50/50 transition-colors cursor-pointer border-t border-slate-50 ${
                            isSelected ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${bankDef.bgColor} ${bankDef.textColor} border ${bankDef.borderColor}`}>
                                {bankDef.shortName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-800">{bank.accountNumber}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[210px]">
                              {bank.accountType} ({bank.currency}) • {bank.notes || 'Sin observaciones'}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-1 px-2">
                    <button
                      onClick={() => {
                        setIsBankDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-emerald-700 font-bold hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Configurar Bancos e Iniciales...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right controls: Acciones bien espaciadas y legibles en tonos pasteles */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Tasa Oficial BCV de Hoy */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-xs font-semibold text-emerald-950 shadow-2xs shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden xl:inline text-[10px] font-extrabold text-emerald-700 uppercase tracking-tight">
                BCV:
              </span>

              {isEditingBcv ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={tempBcv}
                    onChange={(e) => setTempBcv(e.target.value)}
                    className="w-16 px-1.5 py-0.5 text-xs bg-white border border-emerald-400 rounded focus:outline-none font-bold"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveBcv}
                    className="text-[10px] px-2 py-0.5 bg-emerald-700 text-white rounded font-extrabold hover:bg-emerald-800"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsEditingBcv(true)}
                    title={`Tasa Oficial BCV: Bs. ${activeCompany.bcvRate.toFixed(2)}. Haz clic para ajustar manualmente si lo requieres.`}
                    className="hover:underline flex items-center gap-0.5 cursor-pointer font-black text-emerald-900 text-xs sm:text-sm"
                  >
                    <span>Bs. {activeCompany.bcvRate.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-600 font-normal">/USD</span>
                  </button>

                  <button
                    onClick={handleFetchLiveBcv}
                    disabled={isFetchingBcv}
                    title="Forzar refresco directo con Servidores BCV de Hoy"
                    className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-md cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBcv ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Acceso Rápido a Movimientos Huérfanos */}
            {unclarifiedCount > 0 && onNavigateToClarify && (
              <button
                onClick={onNavigateToClarify}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-extrabold hover:bg-amber-100 transition-colors cursor-pointer animate-pulse shrink-0"
                title={`${unclarifiedCount} movimientos bancarios pendientes por aclarar`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>{unclarifiedCount} Huérfanos</span>
              </button>
            )}

            {/* Toggle Moneda Visual (VES / USD) */}
            <div className="flex items-center rounded-xl bg-slate-100/90 p-0.5 border border-slate-200/90 text-xs font-bold shrink-0">
              <button
                onClick={() => onCurrencyToggle('VES')}
                className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  currency === 'VES'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bs.
              </button>
              <button
                onClick={() => onCurrencyToggle('USD')}
                className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                $ USD
              </button>
            </div>

            {/* Botón Exportar ERP */}
            <button
              onClick={onOpenExportModal}
              title="Exportar Cédula y Asientos a SGT Contable, Profit Plus, Gálac, Saint o Valery"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-900 border border-sky-200/90 text-xs font-bold hover:bg-sky-100 transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-sky-700" />
              <span>Exportar ERP</span>
            </button>

            {/* Botón Limpiar Conciliación Rápido */}
            {onOpenClearModal && (
              <button
                onClick={onOpenClearModal}
                title="Limpiar movimientos cargados y reiniciar la conciliación para volver a vaciar información desde cero"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200/90 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Limpiar Todo</span>
              </button>
            )}

            {/* Snapshots / Puntos de Restauración (Desktop 2xl) */}
            {onOpenRestoreModal && (
              <button
                onClick={onOpenRestoreModal}
                title="Puntos de Restauración (Histórico de Conciliaciones)"
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200/90 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <History className="w-3.5 h-3.5 text-indigo-700" />
                <span>Histórico</span>
              </button>
            )}

            {/* Bóveda Cifrada AES-256 (Pastel Púrpura suave, sin negro invasivo) */}
            {onOpenEncryptedBackup && (
              <button
                onClick={onOpenEncryptedBackup}
                title="Bóveda Cifrada: Exportar/Importar base de datos completa con clave local (AES-256)"
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200/90 text-xs font-bold hover:bg-purple-100 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Lock className="w-3.5 h-3.5 text-purple-700" />
                <span>Bóveda AES-256</span>
              </button>
            )}

            {/* Checkup Saludable de Transacciones (Desktop xl) */}
            {onOpenHealthCheckup && (
              <button
                onClick={onOpenHealthCheckup}
                title="Checkup Saludable: Audita duplicados y referencias mal formadas con saneamiento en 1 clic"
                className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  healthIssuesCount > 0
                    ? 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 ring-1 ring-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <HeartPulse className={`w-3.5 h-3.5 ${healthIssuesCount > 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`} />
                <span>Salud</span>
                {healthIssuesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                    {healthIssuesCount}
                  </span>
                )}
              </button>
            )}

            {/* Guía Rápida Tutorial (Desktop 2xl) */}
            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                title="Guía Rápida Interactiva de 3 Pasos"
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200/90 text-xs font-bold transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
                <span>Guía Rápida</span>
              </button>
            )}

            {/* Menú Desplegable de Más Herramientas para pantallas medianas */}
            <div className="relative 2xl:hidden">
              <button
                onClick={() => {
                  setIsToolsDropdownOpen(!isToolsDropdownOpen);
                  setIsCompanyDropdownOpen(false);
                  setIsBankDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
                title="Más Herramientas Contables"
              >
                <MoreHorizontal className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Herramientas</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isToolsDropdownOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Herramientas del Sistema
                  </div>
                  {onOpenRestoreModal && (
                    <button
                      onClick={() => {
                        setIsToolsDropdownOpen(false);
                        onOpenRestoreModal();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-900 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <History className="w-4 h-4 text-indigo-600" />
                      <span>Histórico y Restauración</span>
                    </button>
                  )}
                  {onOpenEncryptedBackup && (
                    <button
                      onClick={() => {
                        setIsToolsDropdownOpen(false);
                        onOpenEncryptedBackup();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-purple-50/70 hover:text-purple-900 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <Lock className="w-4 h-4 text-purple-600" />
                      <span>Bóveda Cifrada AES-256</span>
                    </button>
                  )}
                  {onOpenHealthCheckup && (
                    <button
                      onClick={() => {
                        setIsToolsDropdownOpen(false);
                        onOpenHealthCheckup();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900 flex items-center justify-between cursor-pointer font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-4 h-4 text-emerald-600" />
                        <span>Checkup de Salud</span>
                      </div>
                      {healthIssuesCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                          {healthIssuesCount}
                        </span>
                      )}
                    </button>
                  )}
                  {onOpenOnboarding && (
                    <button
                      onClick={() => {
                        setIsToolsDropdownOpen(false);
                        onOpenOnboarding();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-teal-50/70 hover:text-teal-900 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <HelpCircle className="w-4 h-4 text-teal-600" />
                      <span>Guía Rápida Interactiva</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Configuración de Empresa & Bancos */}
            <button
              onClick={onOpenSettings}
              title="Configuración de Empresa, 1 a 10 Bancos y Parámetros"
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/90 transition-colors cursor-pointer shrink-0"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Autenticación Google & Perfil de Usuario */}
            <button
              onClick={handleAuthClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                user
                  ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {user ? (
                <>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-4 h-4 rounded-full" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden md:inline truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Google Sign-In</span>
                </>
              )}
            </button>

          </div>

        </div>
      </div>

      {/* Modal Interactivo de Inicio de Sesión */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
                  <UserIcon className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Acceso de Contador / Auditor
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                    Iniciar Sesión en NOMINUS
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message Box */}
            {authError && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Aviso de conexión de Google:</span>
                  <p className="text-[11px] leading-relaxed">{authError}</p>
                </div>
              </div>
            )}

            {/* OPCCIÓN A: Google Sign-In Directo */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Opción 1: Conexión Directa con Google</span>
              <button
                onClick={handleGoogleLoginDirect}
                disabled={isLoggingIn}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>Conectando con Google...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    <span>Continuar con Google Auth Popup</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider absolute">
                o acceso de prueba
              </span>
            </div>

            {/* OPCCIÓN B: Ingreso Rápido de Contador */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Opción 2: Ingreso Rápido de Contador (1 Clic)</span>
              </span>

              <button
                onClick={() => handleQuickLocalLogin('omarrperezc@gmail.com', 'Omar Pérez (Contador CPC)')}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="text-left">
                  <span className="block font-bold">Omar Pérez (Contador CPC)</span>
                  <span className="text-[10px] text-emerald-100 font-mono">omarrperezc@gmail.com</span>
                </div>
                <Check className="w-4 h-4 text-white" />
              </button>

              <div className="pt-2 border-t border-slate-200/80 space-y-2 text-xs">
                <span className="text-[11px] font-bold text-slate-700 block">Personalizar otro correo / usuario:</span>
                <input
                  type="email"
                  placeholder="Tu correo de empresa o contador"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Tu nombre completo / Titular"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => handleQuickLocalLogin()}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Ingresar con este Perfil
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
