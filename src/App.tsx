import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, testConnection, handleFirestoreError, OperationType, logoutUser } from './firebase/config';
import {
  BankTransaction,
  CashLogRecord,
  CashFlowTraceItem,
  CurrencyType,
  JournalEntry,
  TransactionSource,
  UserCompanyProfile,
  CompanyProfile,
  CompanyBankAccount,
  DigitalSupportAttachment
} from './types/accounting';
import {
  INITIAL_COMPANIES,
  DEFAULT_COMPANY_PROFILE,
  INITIAL_BANK_TRANSACTIONS,
  INITIAL_CASH_LOGS,
  INITIAL_CASH_FLOW_TRACES
} from './data/sampleData';
import { calculateProofOfCash, runAutomatedReconciliation, runAutomatedReconciliationAsync } from './services/matchingEngine';
import { categorizeTransactionRuleBased } from './services/aiAccountant';
import {
  exportToSgtContableExcel,
  exportToCsvVenNif,
  exportToProfitPlus,
  exportToGalac,
  exportToSaint,
  exportToValery,
  triggerFileDownload
} from './services/exportService';
import { fetchLiveBcvRate, calculateUsdEquivalent } from './services/bcvService';
import { runVenezuelanAutoMatcher, getLast4Digits } from './services/venezuelanAutoMatcher';
import { ArrowLeft, Download, FileSpreadsheet, Sparkles, Zap, Bot, RefreshCw, Building2 } from 'lucide-react';

// Components
import { Navbar } from './components/Navbar';
import { DashboardControlPanel, AppModuleId } from './components/DashboardControlPanel';
import { ProofOfCashModal } from './components/ProofOfCashModal';
import { ReconciliationWorkspace } from './components/ReconciliationWorkspace';
import { ReconciliationProcessRoadmap } from './components/ReconciliationProcessRoadmap';
import { FileUploadModal } from './components/FileUploadModal';
import { AIAssistantModule } from './components/AIAssistantModule';
import { CashTrailTracker } from './components/CashTrailTracker';
import { SeniatTaxModule } from './components/SeniatTaxModule';
import { SudebanAmlModule } from './components/SudebanAmlModule';
import { ModuleJustificationSuite } from './components/ModuleJustificationSuite';
import { LegalContractsVault } from './components/LegalContractsVault';
import { AuditVault } from './components/AuditVault';
import { AccountingExportModal } from './components/AccountingExportModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { ReconciliationResultsModule } from './components/ReconciliationResultsModule';
import { RestorePointModal } from './components/RestorePointModal';
import { PendingClarificationModule } from './components/PendingClarificationModule';
import { TelegramSyncControl } from './components/TelegramSyncControl';
import { MonthlyReconciliationVault } from './components/MonthlyReconciliationVault';
import { DataHealthCheckupModal } from './components/DataHealthCheckupModal';
import { runDatabaseHealthCheck } from './services/healthCheckService';
import { EncryptedBackupModal } from './components/EncryptedBackupModal';
import { NominusDatabasePayload } from './services/encryptedBackupService';
import { ClearReconciliationModal, ClearReconciliationOption } from './components/ClearReconciliationModal';
import { OnboardingModal } from './components/OnboardingModal';
import { InteractiveTourOverlay } from './components/InteractiveTourOverlay';
import {
  loadLocalTransactions,
  saveLocalTransactions,
  loadLocalCompanies,
  saveLocalCompanies,
  loadLocalBalances,
  saveLocalBalances,
  mergeTransactionsList
} from './services/persistenceService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [localUser, setLocalUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('nominus_active_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const activeUser = user || localUser;

  const handleLoginAsLocalUser = (email: string, displayName: string) => {
    const usr = {
      uid: `usr-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      displayName,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
    };
    setLocalUser(usr);
    localStorage.setItem('nominus_active_user_session', JSON.stringify(usr));
  };

  const handleLogoutUser = async () => {
    if (user) {
      try {
        await logoutUser();
      } catch (e) {
        console.warn('Logout error:', e);
      }
    }
    setLocalUser(null);
    localStorage.removeItem('nominus_active_user_session');
  };

  const [currency, setCurrency] = useState<CurrencyType>('VES');

  // Multi-Empresa State
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => loadLocalCompanies());
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const loaded = loadLocalCompanies();
    return loaded[0]?.id || 'comp-principal';
  });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('ALL');

  // Empresa activa computada
  const company = useMemo(() => {
    return companies.find(c => c.id === activeCompanyId) || companies[0] || DEFAULT_COMPANY_PROFILE;
  }, [companies, activeCompanyId]);

  const [transactions, setTransactions] = useState<BankTransaction[]>(() => loadLocalTransactions());
  const [cashLogs, setCashLogs] = useState<CashLogRecord[]>(INITIAL_CASH_LOGS);
  const [cashTraces, setCashTraces] = useState<CashFlowTraceItem[]>(INITIAL_CASH_FLOW_TRACES);
  const [digitalSupports, setDigitalSupports] = useState<DigitalSupportAttachment[]>([]);
  const [activeModule, setActiveModule] = useState<AppModuleId>('DASHBOARD');
  const [activePage, setActivePage] = useState<1 | 2>(1); // 1 = Proceso Conciliación Mensual, 2 = Panel Módulos Operativos
  const [showFullWorkspaceOnHome, setShowFullWorkspaceOnHome] = useState(false);
  
  // Selected transaction passed to Justification Suite
  const [txForJustification, setTxForJustification] = useState<BankTransaction | null>(null);

  // Modals
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isTourOverlayOpen, setIsTourOverlayOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'BANK' | 'LEDGER'>('BANK');

  // Check if onboarding should be shown on initial load
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('nominus_onboarding_dismissed');
      if (dismissed !== 'true') {
        setIsOnboardingOpen(true);
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  // Direct Upload Modal from Roadmap
  const [isDirectUploadModalOpen, setIsDirectUploadModalOpen] = useState(false);
  const [directUploadSource, setDirectUploadSource] = useState<'BANK' | 'LEDGER'>('BANK');
  const [directUploadMode, setDirectUploadMode] = useState<'FILE' | 'PASTE'>('PASTE');

  // Checkup Saludable Modal State & Contador reactivo de incidencias
  const [isHealthCheckupModalOpen, setIsHealthCheckupModalOpen] = useState(false);
  const healthIssuesCount = useMemo(() => {
    return runDatabaseHealthCheck(transactions).issues.length;
  }, [transactions]);

  const handleApplyHealthCleanup = async (
    cleanedTransactions: BankTransaction[],
    deletedIds: string[]
  ) => {
    setTransactions(cleanedTransactions);

    // Si el usuario está autenticado, sincronizar eliminaciones en Firestore
    if (user && deletedIds.length > 0) {
      try {
        const chunkSize = 400;
        for (let i = 0; i < deletedIds.length; i += chunkSize) {
          const batch = writeBatch(db);
          const slice = deletedIds.slice(i, i + chunkSize);
          slice.forEach(id => {
            const ref = doc(db, 'users', user.uid, 'transactions', id);
            batch.delete(ref);
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error al depurar duplicados de Firestore:', err);
      }
    }

    // Sincronizar transacciones modificadas en Firestore
    if (user) {
      try {
        const modifiedItems = cleanedTransactions.filter(t => (t.notes || '').includes('[Checkup Saludable'));
        if (modifiedItems.length > 0) {
          const batch = writeBatch(db);
          modifiedItems.slice(0, 400).forEach(tx => {
            const ref = doc(db, 'users', user.uid, 'transactions', tx.id);
            batch.set(ref, tx, { merge: true });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error al actualizar transacciones saneadas en Firestore:', err);
      }
    }
  };

  // Bóveda Cifrada (AES-256) State & Handler
  const [isEncryptedBackupModalOpen, setIsEncryptedBackupModalOpen] = useState(false);

  const handleRestoreDatabase = async (restoredData: NominusDatabasePayload) => {
    if (restoredData.transactions && Array.isArray(restoredData.transactions)) {
      setTransactions(restoredData.transactions);
    }
    if (restoredData.companies && restoredData.companies.length > 0) {
      setCompanies(restoredData.companies);
    }
    if (restoredData.company) {
      setActiveCompanyId(restoredData.company.id);
    }
    if (restoredData.currency) {
      setCurrency(restoredData.currency);
    }
    if (typeof restoredData.initialBalanceBank === 'number') {
      setInitialBalanceBank(restoredData.initialBalanceBank);
    }
    if (typeof restoredData.initialBalanceLedger === 'number') {
      setInitialBalanceLedger(restoredData.initialBalanceLedger);
    }
    if (restoredData.digitalSupports) {
      setDigitalSupports(restoredData.digitalSupports);
    }
    if (restoredData.cashLogs) {
      setCashLogs(restoredData.cashLogs);
    }
    if (restoredData.cashTraces) {
      setCashTraces(restoredData.cashTraces);
    }

    if (user && restoredData.transactions && restoredData.transactions.length > 0) {
      try {
        const chunkSize = 400;
        for (let i = 0; i < restoredData.transactions.length; i += chunkSize) {
          const batch = writeBatch(db);
          const chunk = restoredData.transactions.slice(i, i + chunkSize);
          chunk.forEach(tx => {
            const ref = doc(db, 'users', user.uid, 'transactions', tx.id);
            batch.set(ref, tx, { merge: true });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error al sincronizar base de datos restaurada en Firestore:', err);
      }
    }
  };

  // Saldos Iniciales (Apertura de Periodo) para Banco y Libros
  const [initialBalanceBank, setInitialBalanceBank] = useState<number>(() => loadLocalBalances().initialBalanceBank);
  const [initialBalanceLedger, setInitialBalanceLedger] = useState<number>(() => loadLocalBalances().initialBalanceLedger);

  // Auto-Espejo e Inmunidad a Recargas en LocalStorage
  useEffect(() => {
    saveLocalTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveLocalCompanies(companies);
  }, [companies]);

  useEffect(() => {
    saveLocalBalances(initialBalanceBank, initialBalanceLedger);
  }, [initialBalanceBank, initialBalanceLedger]);

  // Controladores Multi-Empresa & Multi-Banco
  const handleSelectCompany = (compNameOrId: string) => {
    const found = companies.find(c => c.id === compNameOrId || c.companyName === compNameOrId);
    if (found) {
      setActiveCompanyId(found.id);
      setSelectedBankAccountId('ALL');
    }
  };

  const handleSaveCompany = async (updatedCompany: CompanyProfile) => {
    setCompanies(prev => prev.map(c => (c.id === updatedCompany.id ? updatedCompany : c)));
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'companies', updatedCompany.id), updatedCompany, { merge: true });
      } catch (e) {
        console.warn('Error al guardar empresa en Firestore:', e);
      }
    }
  };

  const handleCreateCompany = async (newComp: CompanyProfile) => {
    setCompanies(prev => [...prev, newComp]);
    setActiveCompanyId(newComp.id);
    setSelectedBankAccountId('ALL');
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'companies', newComp.id), newComp);
      } catch (e) {
        console.warn('Error al crear nueva empresa en Firestore:', e);
      }
    }
  };

  const handleDeleteCompany = async (companyIdToDelete: string) => {
    if (companies.length <= 1) return;
    setCompanies(prev => prev.filter(c => c.id !== companyIdToDelete));
    if (activeCompanyId === companyIdToDelete) {
      const remaining = companies.filter(c => c.id !== companyIdToDelete);
      setActiveCompanyId(remaining[0]?.id || '');
      setSelectedBankAccountId('ALL');
    }
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'companies', companyIdToDelete));
      } catch (e) {
        console.warn('Error al eliminar empresa de Firestore:', e);
      }
    }
  };

  const handleUpdateBankAccounts = async (companyIdToUpdate: string, bankAccounts: CompanyBankAccount[]) => {
    setCompanies(prev => prev.map(c => (c.id === companyIdToUpdate ? { ...c, bankAccounts } : c)));
    if (user) {
      try {
        const comp = companies.find(c => c.id === companyIdToUpdate);
        if (comp) {
          await setDoc(
            doc(db, 'users', user.uid, 'companies', companyIdToUpdate),
            { ...comp, bankAccounts },
            { merge: true }
          );
        }
      } catch (e) {
        console.warn('Error al actualizar bancos en Firestore:', e);
      }
    }
  };

  const handleUpdateBcvRate = (newRate: number) => {
    setCompanies(prev => prev.map(c => ({ ...c, bcvRate: newRate })));
    setTransactions(prev => prev.map(t => ({
      ...t,
      amountUsdEquivalent: t.currency === 'VES' ? calculateUsdEquivalent(t.amountNominal, newRate) : t.amountNominal
    })));
  };

  // Consulta automática y continua de la Tasa Oficial del BCV de hoy en segundo plano
  useEffect(() => {
    const updateLiveRate = async () => {
      try {
        const res = await fetchLiveBcvRate();
        if (res && res.rate > 0) {
          handleUpdateBcvRate(res.rate);
        }
      } catch (err) {
        console.warn('Sincronización automática de Tasa BCV:', err);
      }
    };

    // Sincronización al cargar la app
    updateLiveRate();

    // Re-verificar la tasa oficial automáticamente cada 15 minutos
    const intervalId = setInterval(updateLiveRate, 15 * 60 * 1000);

    // Re-verificar la tasa oficial cuando el usuario vuelve a enfocar la aplicación
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLiveRate();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Contador de movimientos huérfanos sin soporte ni conciliación exacta
  const unclarifiedCount = useMemo(() => {
    return transactions.filter(
      t => t.source === 'BANK' &&
           t.currency === currency &&
           t.matchingStatus !== 'MATCHED_EXACT' &&
           t.autoReconciledBy !== 'AUTO_BANK_FEE'
    ).length;
  }, [transactions, currency]);

  const handleNewSupportsAdded = (newSupports: DigitalSupportAttachment[]) => {
    setDigitalSupports(prev => [...newSupports, ...prev]);
  };

  const handleOpenUploadFromRoadmap = (source: 'BANK' | 'LEDGER', mode: 'FILE' | 'PASTE') => {
    setDirectUploadSource(source);
    setDirectUploadMode(mode);
    setIsDirectUploadModalOpen(true);
  };

  const handleRunReconciliationFromRoadmap = async () => {
    try {
      const res = await runAutomatedReconciliationAsync(transactions, 3);
      setTransactions(res.updatedTransactions);
      setActiveModule('RECONCILIATION');
    } catch (err) {
      console.error('Error durante la conciliación desde la hoja de ruta:', err);
    }
  };

  const handleImportCompleteFromDirectModal = (
    newTx: BankTransaction[],
    source: TransactionSource,
    detectedInitialBal?: number
  ) => {
    handleAddParsedTransactions(newTx);
    if (detectedInitialBal !== undefined && detectedInitialBal > 0) {
      if (source === 'BANK') setInitialBalanceBank(detectedInitialBal);
      else setInitialBalanceLedger(detectedInitialBal);
    }
  };

  const handleUpdateInitialBalances = (bVal: number, lVal: number) => {
    setInitialBalanceBank(bVal);
    setInitialBalanceLedger(lVal);
  };

  const handleRestoreComplete = (
    restoredTransactions: BankTransaction[],
    restoredBankBal: number,
    restoredLedgerBal: number,
    restoredCurrency: CurrencyType
  ) => {
    setTransactions(restoredTransactions);
    setInitialBalanceBank(restoredBankBal);
    setInitialBalanceLedger(restoredLedgerBal);
    setCurrency(restoredCurrency);
  };

  const handleNavigateToAssistant = (mode: 'BANK' | 'LEDGER' = 'BANK') => {
    setAssistantMode(mode);
    setActiveModule('AI_ASSISTANT');
  };

  // Firebase auth & initial test
  useEffect(() => {
    testConnection();

    // Limpieza de datos residuales de prueba en localStorage al inicio
    try {
      const snapKey = 'nominus_reconciliation_snapshots_v1';
      const raw = localStorage.getItem(snapKey);
      if (raw && (raw.includes('comp-san-jose') || raw.includes('Comercializadora San José') || raw.includes('0134-0102-33-0100123456'))) {
        localStorage.removeItem(snapKey);
      }
    } catch (e) {
      // Ignore
    }

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Attempt to load user companies & settings from Firestore
        try {
          const compCollRef = collection(db, 'users', currentUser.uid, 'companies');
          const compSnap = await getDocs(compCollRef);
          if (!compSnap.empty) {
            const loadedCompanies: CompanyProfile[] = [];
            for (const d of compSnap.docs) {
              const c = d.data() as CompanyProfile;
              if (c && c.id) {
                // Si proviene de pruebas anteriores con nombres ficticios, eliminarlo de Firestore
                const isDummyCompany =
                  c.id === 'comp-san-jose' ||
                  c.id === 'comp-dist-caracas' ||
                  c.companyName?.includes('Comercializadora San José') ||
                  c.companyName?.includes('Distribuidora Industrial Caracas') ||
                  c.companyRif === 'J-31234567-8' ||
                  c.companyRif === 'J-40987654-3';

                if (isDummyCompany) {
                  deleteDoc(doc(db, 'users', currentUser.uid, 'companies', d.id)).catch(console.warn);
                } else {
                  loadedCompanies.push(c);
                }
              }
            }
            if (loadedCompanies.length > 0) {
              setCompanies(prev => {
                const map = new Map<string, CompanyProfile>();
                loadedCompanies.forEach(c => map.set(c.id, c));
                prev.forEach(c => map.set(c.id, c));
                const mergedComps = Array.from(map.values());
                saveLocalCompanies(mergedComps);
                return mergedComps;
              });
              setActiveCompanyId(loadedCompanies[0].id);
            }
          }

          // Load user's real transactions from subcollection if any and merge with local state
          const txCollRef = collection(db, 'users', currentUser.uid, 'transactions');
          const txSnap = await getDocs(txCollRef);
          if (!txSnap.empty) {
            const loadedTx: BankTransaction[] = [];
            for (const d of txSnap.docs) {
              const t = d.data() as BankTransaction;
              if (t && t.id) {
                const isDummyTx =
                  t.companyId === 'comp-san-jose' ||
                  t.companyId === 'comp-dist-caracas' ||
                  t.bankAccountId === 'bank-101' ||
                  (t as any).accountNumber === '0134-0102-33-0100123456' ||
                  t.referenceNum === '0019283';
                if (isDummyTx) {
                  deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', d.id)).catch(console.warn);
                } else {
                  loadedTx.push(t);
                }
              }
            }
            if (loadedTx.length > 0) {
              setTransactions(prev => {
                const merged = mergeTransactionsList(prev, loadedTx);
                saveLocalTransactions(merged);
                return merged;
              });
            }
          }

          // Load user's real cash traces if any
          const traceCollRef = collection(db, 'users', currentUser.uid, 'cashTraces');
          const traceSnap = await getDocs(traceCollRef);
          if (!traceSnap.empty) {
            const loadedTraces: CashFlowTraceItem[] = [];
            for (const d of traceSnap.docs) {
              const tr = d.data() as CashFlowTraceItem;
              if (tr && tr.id && (tr as any).companyId !== 'comp-san-jose') loadedTraces.push(tr);
            }
            setCashTraces(loadedTraces);
          }

          // Load user's real cash logs if any
          const logCollRef = collection(db, 'users', currentUser.uid, 'cashLogs');
          const logSnap = await getDocs(logCollRef);
          if (!logSnap.empty) {
            const loadedLogs: CashLogRecord[] = [];
            for (const d of logSnap.docs) {
              const l = d.data() as CashLogRecord;
              if (l && l.id) loadedLogs.push(l);
            }
            setCashLogs(loadedLogs);
          }
        } catch (error) {
          console.warn('Could not sync user profile with Firestore:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Compute live Proof of Cash (4 Columns)
  const proofOfCash = useMemo(() => {
    return calculateProofOfCash(transactions, '', currency, initialBalanceBank, initialBalanceLedger);
  }, [transactions, currency, initialBalanceBank, initialBalanceLedger]);

  // Generate balanced journal entries from transactions for ERP export
  const journalEntries = useMemo<JournalEntry[]>(() => {
    return transactions.map((t, idx) => {
      const rule = categorizeTransactionRuleBased(
        t.rawDescription,
        t.amountNominal,
        t.txType,
        t.currency,
        t.bankName
      );

      return {
        id: `entry-${t.id}-${idx}`,
        date: t.txDate,
        reference: t.referenceNum,
        description: t.rawDescription,
        lines: rule.journalEntry.map(l => ({ ...l, rif: t.counterpartyRif })),
        totalDebe: rule.journalEntry.reduce((acc, l) => acc + l.debe, 0),
        totalHaber: rule.journalEntry.reduce((acc, l) => acc + l.haber, 0),
        isBalanced: true,
        moduleTag: t.moduleTag || rule.moduleTag
      };
    });
  }, [transactions]);

  const handlePurgeAllData = async () => {
    // 1. Reset React State to clean zero
    setTransactions([]);
    setCashLogs([]);
    setCashTraces([]);
    setTxForJustification(null);
    setInitialBalanceBank(0);
    setInitialBalanceLedger(0);
    setSelectedBankAccountId('ALL');

    setCompanies(INITIAL_COMPANIES);
    setActiveCompanyId(INITIAL_COMPANIES[0].id);

    // 2. Clear browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore
    }

    // 3. Clear Firestore collections for user
    if (user) {
      try {
        const txCol = collection(db, 'users', user.uid, 'transactions');
        const txSnap = await getDocs(txCol);
        for (const docItem of txSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'transactions', docItem.id));
        }

        const traceCol = collection(db, 'users', user.uid, 'cashTraces');
        const traceSnap = await getDocs(traceCol);
        for (const docItem of traceSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'cashTraces', docItem.id));
        }

        const logCol = collection(db, 'users', user.uid, 'cashLogs');
        const logSnap = await getDocs(logCol);
        for (const docItem of logSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'cashLogs', docItem.id));
        }

        const vaultCol = collection(db, 'users', user.uid, 'vault');
        const vaultSnap = await getDocs(vaultCol);
        for (const docItem of vaultSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'vault', docItem.id));
        }

        const snapCol = collection(db, 'users', user.uid, 'snapshots');
        const snapSnap = await getDocs(snapCol);
        for (const docItem of snapSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'snapshots', docItem.id));
        }

        const compCol = collection(db, 'users', user.uid, 'companies');
        const compSnap = await getDocs(compCol);
        for (const docItem of compSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'companies', docItem.id));
        }

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || '',
          companyName: '',
          companyRif: '',
          address: '',
          isSpecialTaxpayer: true,
          defaultCurrency: 'VES',
          bcvRate: 56.80,
          accountingSystemTarget: 'PROFIT',
          clearedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Error purgando documentos de Firestore:', err);
      }
    }
  };

  // Limpieza Selectiva de Conciliación (Extracto Bancario, Libro o Ambos)
  const handleClearReconciliation = async (
    option: ClearReconciliationOption,
    scope: 'ALL_BANKS' | 'SELECTED_BANK_ONLY'
  ) => {
    let toKeep: BankTransaction[] = [];
    let toDeleteIds: string[] = [];

    const isTarget = (t: BankTransaction) => {
      if (scope === 'SELECTED_BANK_ONLY' && selectedBankAccountId !== 'ALL') {
        return t.bankCode === selectedBankAccountId || t.bankAccountId === selectedBankAccountId;
      }
      return true;
    };

    if (option === 'ALL') {
      toDeleteIds = transactions.filter(isTarget).map(t => t.id);
      toKeep = transactions.filter(t => !isTarget(t));
      setInitialBalanceBank(0);
      setInitialBalanceLedger(0);
    } else if (option === 'BANK') {
      toDeleteIds = transactions.filter(t => isTarget(t) && t.source === 'BANK').map(t => t.id);
      toKeep = transactions.filter(t => !(isTarget(t) && t.source === 'BANK'));
      setInitialBalanceBank(0);
    } else if (option === 'LEDGER') {
      toDeleteIds = transactions.filter(t => isTarget(t) && t.source === 'LEDGER').map(t => t.id);
      toKeep = transactions.filter(t => !(isTarget(t) && t.source === 'LEDGER'));
      setInitialBalanceLedger(0);
    } else if (option === 'RESET_STATUS') {
      toKeep = transactions.map(t => {
        if (isTarget(t)) {
          return {
            ...t,
            matchingStatus: 'UNMATCHED',
            matchedWithId: undefined,
            matchScore: 0,
            discrepancyAmount: undefined
          };
        }
        return t;
      });
    }

    setTransactions(toKeep);

    // Sincronizar eliminaciones con Firestore
    if (user && toDeleteIds.length > 0) {
      try {
        const chunkSize = 400;
        for (let i = 0; i < toDeleteIds.length; i += chunkSize) {
          const batch = writeBatch(db);
          const chunk = toDeleteIds.slice(i, i + chunkSize);
          chunk.forEach(id => {
            batch.delete(doc(db, 'users', user.uid, 'transactions', id));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error eliminando transacciones en Firestore:', err);
      }
    }

    // Sincronizar reset de estados con Firestore
    if (user && option === 'RESET_STATUS') {
      try {
        const chunkSize = 400;
        for (let i = 0; i < toKeep.length; i += chunkSize) {
          const batch = writeBatch(db);
          const chunk = toKeep.slice(i, i + chunkSize);
          chunk.forEach(tx => {
            batch.set(doc(db, 'users', user.uid, 'transactions', tx.id), tx, { merge: true });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error restableciendo estados en Firestore:', err);
      }
    }
  };

  // Guardar creación o edición de una transacción individual
  const handleSaveTransaction = async (tx: BankTransaction) => {
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.id === tx.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = tx;
        return copy;
      }
      return [tx, ...prev];
    });

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'transactions', tx.id), tx, { merge: true });
      } catch (err) {
        console.warn('Error guardando transacción en Firestore:', err);
      }
    }
  };

  // Eliminar una transacción individual
  const handleDeleteTransaction = async (txId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== txId));
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'transactions', txId));
      } catch (err) {
        console.warn('Error eliminando transacción en Firestore:', err);
      }
    }
  };

  const handleAddParsedTransactions = async (newTx: BankTransaction[]) => {
    // 1. Enriquecer con equivalencia en USD, empresa activa, banco seleccionado y referencia de 4 dígitos
    const defaultBankId = selectedBankAccountId !== 'ALL' ? selectedBankAccountId : (company.bankAccounts?.[0]?.id || '');
    const augmentedNewTx: BankTransaction[] = newTx.map(t => {
      const last4 = getLast4Digits(t.referenceNum);
      const usdEq = t.currency === 'USD' ? t.amountNominal : calculateUsdEquivalent(t.amountNominal, company.bcvRate);
      return {
        ...t,
        companyId: t.companyId || company.id,
        bankAccountId: t.bankAccountId || defaultBankId,
        referenceLast4: last4,
        amountUsdEquivalent: usdEq
      };
    });

    // 2. Ejecutar cruce bancario venezolano automático (soportes + comisiones + transferencias propias + memoria)
    const matchReport = runVenezuelanAutoMatcher({
      transactions: [...augmentedNewTx, ...transactions],
      availableSupports: digitalSupports
    });

    setTransactions(matchReport.updatedTransactions);
    setActiveModule('RECONCILIATION');

    if (user) {
      // Guardar en lotes atómicos (writeBatch) en segundo plano para no congelar la UI ni saturar la red
      (async () => {
        try {
          const itemsToSave = matchReport.updatedTransactions;
          const chunkSize = 400;
          for (let i = 0; i < itemsToSave.length; i += chunkSize) {
            const batch = writeBatch(db);
            const slice = itemsToSave.slice(i, i + chunkSize);
            slice.forEach(tx => {
              const ref = doc(db, 'users', user.uid, 'transactions', tx.id);
              batch.set(ref, tx, { merge: true });
            });
            await batch.commit();
          }
        } catch (err) {
          console.warn('Error guardando transacciones en Firestore:', err);
        }
      })();
    }
  };

  const handleSelectTransactionForModule = (tx: BankTransaction) => {
    setTxForJustification(tx);
    setActiveModule('JUSTIFICATION_MODULES');
  };

  const handleAssignModule = (txId: string, moduleTag: string, notes: string) => {
    setTransactions(prev =>
      prev.map(t => {
        if (t.id === txId) {
          const updatedTx = { ...t, moduleTag, notes: notes || t.notes };
          if (user) {
            setDoc(doc(db, 'users', user.uid, 'transactions', t.id), updatedTx, { merge: true }).catch(console.warn);
          }
          return updatedTx;
        }
        return t;
      })
    );
  };

  const handleAddCashLog = async (newLog: CashLogRecord) => {
    setCashLogs(prev => [newLog, ...prev]);
    // Also create the corresponding ledger deposit in transit entry
    const newLedgerTx: BankTransaction = {
      id: `led-${Date.now()}`,
      source: 'LEDGER',
      bankCode: '0134',
      bankName: 'Banesco Banco Universal',
      referenceNum: newLog.bankDepositRef || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      txDate: newLog.date,
      txType: 'CREDIT',
      amountNominal: newLog.physicalCount,
      currency: newLog.currency,
      bcvRate: company.bcvRate,
      amountVes: newLog.currency === 'USD' ? newLog.physicalCount * company.bcvRate : newLog.physicalCount,
      rawDescription: `Depósito Efectivo Remesa Caja (${newLog.cashier} - ${newLog.shift})`,
      accountCode: newLog.currency === 'USD' ? '1.1.01.01.002' : '1.1.01.01.001',
      accountName: newLog.currency === 'USD' ? 'Caja Moneda Extranjera (USD)' : 'Caja Principal Moneda Nacional',
      matchingStatus: 'UNMATCHED',
      moduleTag: 'MOD_VENTAS',
      notes: `Arqueo físico N° ${newLog.dispatchSlipId}. Depósito enviado a taquilla.`,
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => [newLedgerTx, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'cashLogs', newLog.id), newLog);
        await setDoc(doc(db, 'users', user.uid, 'transactions', newLedgerTx.id), newLedgerTx);
      } catch (err) {
        console.warn('Error guardando arqueo en Firestore:', err);
      }
    }
  };

  const handleAddCashTrace = async (newTrace: CashFlowTraceItem) => {
    setCashTraces(prev => [newTrace, ...prev]);
    // Also create corresponding bank transaction so it syncs with reconciliation workspace
    const newBankTx: BankTransaction = {
      id: `tx-trace-${newTrace.id}`,
      source: 'BANK',
      bankCode: newTrace.bankCode,
      bankName: newTrace.bankName,
      referenceNum: newTrace.referenceNum,
      txDate: newTrace.date,
      txType: newTrace.direction === 'ENTRADA' ? 'CREDIT' : 'DEBIT',
      amountNominal: newTrace.amount,
      currency: newTrace.currency,
      bcvRate: newTrace.bcvRate,
      amountVes: newTrace.amountVes,
      rawDescription: `[${newTrace.channel}] ${newTrace.concept} - ${newTrace.counterpartyName}`,
      counterpartyRif: newTrace.counterpartyRif,
      counterpartyName: newTrace.counterpartyName,
      matchingStatus: 'MATCHED_EXACT',
      moduleTag: newTrace.direction === 'ENTRADA' ? 'MOD_VENTAS' : 'MOD_PROVEEDORES',
      retentionVatAmount: newTrace.justificationSeniat.vatRetentionAmount,
      notes: newTrace.justificationSeniat.notes || newTrace.justificationBank.amlDeclaredOrigin,
      createdAt: newTrace.createdAt
    };
    setTransactions(prev => [newBankTx, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'cashTraces', newTrace.id), newTrace);
        await setDoc(doc(db, 'users', user.uid, 'transactions', newBankTx.id), newBankTx);
      } catch (err) {
        console.warn('Error guardando traza en Firestore:', err);
      }
    }
  };

  const handleUpdateCashTrace = async (updated: CashFlowTraceItem) => {
    setCashTraces(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'cashTraces', updated.id), updated, { merge: true });
      } catch (err) {
        console.warn('Error actualizando traza en Firestore:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900 flex flex-col">
      
      {/* Top Navigation */}
      <Navbar
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={handleSelectCompany}
        selectedBankAccountId={selectedBankAccountId}
        onSelectBankAccount={setSelectedBankAccountId}
        user={activeUser}
        currency={currency}
        onCurrencyToggle={setCurrency}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenClearModal={() => setIsClearModalOpen(true)}
        onOpenRestoreModal={() => setIsRestoreModalOpen(true)}
        onOpenEncryptedBackup={() => setIsEncryptedBackupModalOpen(true)}
        onOpenHealthCheckup={() => setIsHealthCheckupModalOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onLoginAsLocalUser={handleLoginAsLocalUser}
        onLogoutUser={handleLogoutUser}
        healthIssuesCount={healthIssuesCount}
        onUpdateBcvRate={handleUpdateBcvRate}
        onNavigateToClarify={() => setActiveModule('PENDIENTES_ACLARAR')}
        unclarifiedCount={unclarifiedCount}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        
        {/* Barra de Automatización Bancaria y Telegram en Tiempo Real */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:px-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <TelegramSyncControl
              bcvRate={company.bcvRate}
              transactions={transactions}
              onUpdateTransactions={setTransactions}
              onNewSupportsAdded={handleNewSupportsAdded}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const report = runVenezuelanAutoMatcher({
                  transactions,
                  availableSupports: digitalSupports
                });
                setTransactions(report.updatedTransactions);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Cruzar con soportes digitales, gastos bancarios fijos y memoria de beneficiarios"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-Cruzar con Reglas Venezolanas</span>
            </button>

            {unclarifiedCount > 0 && (
              <button
                onClick={() => setActiveModule('PENDIENTES_ACLARAR')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-2xs transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{unclarifiedCount} Huérfanos por Aclarar</span>
              </button>
            )}
          </div>
        </div>

        {/* Paginación Principal de la App: Página 1 (Proceso de Conciliación) vs Página 2 (Panel Operativo) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 px-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => {
                setActivePage(1);
                setActiveModule('DASHBOARD');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePage === 1 && activeModule === 'DASHBOARD'
                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/60'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold'
              }`}
            >
              <span>📄 Página 1: Proceso de Conciliación Mensual</span>
            </button>

            <button
              onClick={() => {
                setActivePage(2);
                setActiveModule('DASHBOARD');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePage === 2
                  ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-400/60'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold'
              }`}
            >
              <span>🧩 Página 2: Panel de Módulos Operativos</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activePage === 2 ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-slate-700'
              }`}>
                13 Módulos
              </span>
            </button>
          </div>

          {activeModule !== 'DASHBOARD' && (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  setActiveModule('DASHBOARD');
                  setActivePage(1);
                }}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />
                <span>Volver a Página 1 (Conciliación)</span>
              </button>
              <button
                onClick={() => {
                  setActiveModule('DASHBOARD');
                  setActivePage(2);
                }}
                className="text-xs font-bold text-slate-800 hover:text-slate-950 flex items-center gap-1.5 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs transition-colors"
              >
                <span>Volver a Página 2 (Panel Operativo)</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Module Content View */}
        <section className="transition-all duration-300">
          
          {/* Módulo Especial: Modo Rápido (1 Clic) para Movimientos Huérfanos */}
          {activeModule === 'PENDIENTES_ACLARAR' && (
            <PendingClarificationModule
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
              company={company}
              onUpdateTransactions={setTransactions}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />
          )}
          
          {/* DASHBOARD: PÁGINA 1 (Proceso Guiado de Conciliación) vs PÁGINA 2 (Panel de Módulos Operativos) */}
          {activeModule === 'DASHBOARD' && activePage === 1 && (
            <div className="space-y-6">
              
              {/* Notificación de Sistema Limpio Listo para Cargar */}
              {transactions.length === 0 && (company.bankAccounts || []).length === 0 && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-300/80 p-4 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Sistema Listo: Base de Datos Limpia (Sin Datos Ficticios)
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Listo para vaciar información
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        No hay empresas ni transacciones inventadas cargadas. Configura la Razón Social y RIF real de tu empresa, agrega tus cuentas bancarias venezolanas (Mercantil, Banesco, BDV, BNC, Bancamiga, etc.) y comienza a vaciar tus movimientos bancarios y contables.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Configurar Empresa y Bancos</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PÁGINA 1: Flujo Guiado Paso a Paso (Paso 1, 2, 3, 4, 5 con bordes de colores) */}
              <ReconciliationProcessRoadmap
                transactions={transactions}
                currency={currency}
                bcvRate={company.bcvRate}
                company={company}
                initialBalanceBank={initialBalanceBank}
                initialBalanceLedger={initialBalanceLedger}
                proofOfCash={proofOfCash}
                onOpenUploadModal={handleOpenUploadFromRoadmap}
                onNavigateToWorkspace={() => setActiveModule('RECONCILIATION')}
                onNavigateToResults={() => setActiveModule('RECONCILIATION_RESULTS')}
                onOpenProofModal={() => setIsProofModalOpen(true)}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenAdjustments={() => setActiveModule('AI_ASSISTANT')}
                onRunReconciliation={handleRunReconciliationFromRoadmap}
                onUpdateInitialBalances={handleUpdateInitialBalances}
                onOpenRestoreModal={() => setIsRestoreModalOpen(true)}
                onOpenTourOverlay={() => setIsTourOverlayOpen(true)}
                onOpenClearModal={() => setIsClearModalOpen(true)}
              />

              {/* Toggle Banner for showing full workspace / cards on Home page */}
              {!showFullWorkspaceOnHome ? (
                <div className="p-4 rounded-2xl bg-slate-100/90 border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      💡 ¿Deseas explorar la Mesa de Trabajo y Cédula completa en esta misma pantalla?
                    </span>
                  </div>
                  <button
                    onClick={() => setShowFullWorkspaceOnHome(true)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-900 font-extrabold text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer shrink-0"
                  >
                    Mostrar Mesa de Trabajo y Cédula Abajo 👇
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowFullWorkspaceOnHome(false)}
                      className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                    >
                      ▲ Ocultar Vista Avanzada (Volver a Modo Enfocado)
                    </button>
                  </div>

                  {/* Split teaser and quick actions */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    
                    {/* Proof of Cash Teaser Card */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Cédula de Cierre Mensual
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">
                            Ecuación de Conciliación Matemática y Prueba de Efectivo
                          </h3>
                        </div>
                        <button
                          onClick={() => setIsProofModalOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Ver Detalle Completo (4 Columnas) →
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-semibold block">Saldo Extracto Banco</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.finalBalanceBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                          <span className="text-[10px] text-emerald-800 font-semibold block">(+) Depósitos Tránsito</span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            +{currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.depositsInTransit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                          <span className="text-[10px] text-rose-800 font-semibold block">(-) Cheques Pendientes</span>
                          <span className="font-mono font-bold text-rose-700 text-sm">
                            -{currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.outstandingChecks.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
                          <span className="text-[10px] text-sky-800 font-semibold block">(=) Saldo Conciliado</span>
                          <span className="font-mono font-bold text-sky-900 text-sm">
                            {currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.reconciledBank.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 flex items-center justify-between">
                        <span>Mayor General de Libros: <strong>{currency === 'VES' ? 'Bs.' : '$'} {proofOfCash.finalBalanceLedger.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {proofOfCash.isBalanced ? '✓ Prueba de Caja Cuadrada al 100%' : `Variación: ${currency === 'VES' ? 'Bs.' : '$'} ${proofOfCash.difference.toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Quick RegTech Status Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
                        Blindaje RegTech Venezuela
                      </h3>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/80">
                          <div>
                            <span className="font-bold text-teal-950 block">SENIAT Prov. 2025/000054</span>
                            <span className="text-[11px] text-teal-800">Retenciones IVA 75%/100%</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                            Vigente
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80">
                          <div>
                            <span className="font-bold text-rose-950 block">SUDEBAN Res. 010.25</span>
                            <span className="text-[11px] text-rose-800">Enfoque Basado en Riesgo</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            Auditado
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                          <div>
                            <span className="font-bold text-amber-950 block">Ley Pensiones 2024</span>
                            <span className="text-[11px] text-amber-800">Alícuota 9% Nómina Bruta</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Calculado
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setActiveModule('SENIAT_TAX');
                          setActivePage(2);
                        }}
                        className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Abrir Módulo Fiscal SENIAT →
                      </button>
                    </div>

                  </div>

                  {/* Direct access to reconciliation workspace */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Mesa de Trabajo de Conciliación Bancaria Activa
                        </h3>
                        <p className="text-xs text-slate-500">
                          Visualización simultánea de extractos y asientos contables.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveModule('RECONCILIATION')}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Ver en Pantalla Completa →
                      </button>
                    </div>

                    <ReconciliationWorkspace
                      transactions={transactions}
                      currency={currency}
                      bcvRate={company.bcvRate}
                      company={company}
                      initialBalanceBank={initialBalanceBank}
                      initialBalanceLedger={initialBalanceLedger}
                      onUpdateInitialBalances={handleUpdateInitialBalances}
                      onUpdateTransactions={setTransactions}
                      onSelectTransactionForModule={handleSelectTransactionForModule}
                      onNavigateToAssistant={handleNavigateToAssistant}
                      onAddParsedTransactions={handleAddParsedTransactions}
                      onNavigateToResults={() => setActiveModule('RECONCILIATION_RESULTS')}
                      onOpenExportModal={() => setIsExportModalOpen(true)}
                      onOpenRestoreModal={() => setIsRestoreModalOpen(true)}
                      onOpenHealthCheckup={() => setIsHealthCheckupModalOpen(true)}
                      onOpenEncryptedBackup={() => setIsEncryptedBackupModalOpen(true)}
                      onClearReconciliation={handleClearReconciliation}
                      onSaveTransaction={handleSaveTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* PÁGINA 2: Panel de Módulos Operativos (Cuadros Pequeños con Colores Pasteles) */}
          {activeModule === 'DASHBOARD' && activePage === 2 && (
            <div className="space-y-6">
              <DashboardControlPanel
                activeModule={activeModule}
                onSelectModule={(modId) => {
                  if (modId === 'DASHBOARD') {
                    setActivePage(1);
                  } else {
                    setActiveModule(modId);
                    setActivePage(2);
                  }
                }}
                transactions={transactions}
                currency={currency}
                bcvRate={company.bcvRate}
                proofOfCash={proofOfCash}
                onOpenProofModal={() => setIsProofModalOpen(true)}
              />
            </div>
          )}

          {/* Repositorio de Conciliaciones Mensuales (Histórico Mes a Mes) */}
          {activeModule === 'MONTHLY_RECONCILIATION_VAULT' && (
            <MonthlyReconciliationVault
              user={user}
              company={company}
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
              initialBalanceBank={initialBalanceBank}
              initialBalanceLedger={initialBalanceLedger}
              onRestoreComplete={handleRestoreComplete}
              onOpenExportModal={() => setIsExportModalOpen(true)}
            />
          )}

          {/* 2. Resultados & Diagnóstico Sencillo de la Conciliación */}
          {activeModule === 'RECONCILIATION_RESULTS' && (
            <ReconciliationResultsModule
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
              company={company}
              initialBalanceBank={initialBalanceBank}
              initialBalanceLedger={initialBalanceLedger}
              onUpdateInitialBalances={handleUpdateInitialBalances}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenRestoreModal={() => setIsRestoreModalOpen(true)}
              onUpdateTransactions={setTransactions}
              onNavigateToWorkspace={() => setActiveModule('RECONCILIATION')}
              onNavigateToAssistant={handleNavigateToAssistant}
              onOpenProofModal={() => setIsProofModalOpen(true)}
            />
          )}

          {/* 3. Conciliación 5 Etapas (Split-Screen) */}
          {activeModule === 'RECONCILIATION' && (
            <ReconciliationWorkspace
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
              company={company}
              initialBalanceBank={initialBalanceBank}
              initialBalanceLedger={initialBalanceLedger}
              onUpdateInitialBalances={handleUpdateInitialBalances}
              onUpdateTransactions={setTransactions}
              onSelectTransactionForModule={handleSelectTransactionForModule}
              onNavigateToAssistant={handleNavigateToAssistant}
              onAddParsedTransactions={handleAddParsedTransactions}
              onNavigateToResults={() => setActiveModule('RECONCILIATION_RESULTS')}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenRestoreModal={() => setIsRestoreModalOpen(true)}
              onOpenHealthCheckup={() => setIsHealthCheckupModalOpen(true)}
              onOpenEncryptedBackup={() => setIsEncryptedBackupModalOpen(true)}
              onClearReconciliation={handleClearReconciliation}
              onSaveTransaction={handleSaveTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {/* 4. IA Contable & Carga (Extractos & Libro Mayor) */}
          {activeModule === 'AI_ASSISTANT' && (
            <AIAssistantModule
              key={assistantMode}
              currency={currency}
              bcvRate={company.bcvRate}
              onAddParsedTransactions={handleAddParsedTransactions}
              initialMode={assistantMode}
            />
          )}

          {/* 4. Traza de Fondos, Efectivo y Canales Digitales */}
          {activeModule === 'CASH_TRAIL' && (
            <CashTrailTracker
              traces={cashTraces}
              cashLogs={cashLogs}
              company={company}
              currency={currency}
              bcvRate={company.bcvRate}
              onAddTrace={handleAddCashTrace}
              onUpdateTrace={handleUpdateCashTrace}
            />
          )}

          {/* 5. SENIAT & Retenciones */}
          {activeModule === 'SENIAT_TAX' && (
            <SeniatTaxModule
              company={company}
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
            />
          )}

          {/* 6. SUDEBAN AML & Compliance */}
          {activeModule === 'SUDEBAN_AML' && (
            <SudebanAmlModule
              company={company}
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
            />
          )}

          {/* 7. Módulos de Justificación y Repositorio de Soportes (16 Categorías) */}
          {activeModule === 'JUSTIFICATION_MODULES' && (
            <ModuleJustificationSuite
              company={company}
              transactions={transactions}
              currency={currency}
              bcvRate={company.bcvRate}
              selectedTxForJustification={txForJustification}
              onAssignModule={handleAssignModule}
              onUpdateTransactions={setTransactions}
            />
          )}

          {/* 8. Contratos & Bóveda Legal */}
          {activeModule === 'LEGAL_CONTRACTS' && (
            <LegalContractsVault
              company={company}
              currency={currency}
              bcvRate={company.bcvRate}
            />
          )}

          {/* 9. Bóveda Criptográfica SHA-256 */}
          {activeModule === 'AUDIT_VAULT' && (
            <AuditVault
              currency={currency}
              bcvRate={company.bcvRate}
            />
          )}

          {/* 10. Exportación a ERP */}
          {activeModule === 'ERP_EXPORT' && (
            <div className="space-y-4">
              {/* Top Navigation Bar: Return to Dashboard */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveModule('DASHBOARD')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-300 shadow-2xs shrink-0"
                    title="Salir de la pantalla de exportación y volver al Dashboard"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-700" />
                    <span>← Salir y Volver al Dashboard</span>
                  </button>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Centro de Exportación Contable Venezolana (ERP / Excel)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Descarga tus asientos conciliados para SGT, Profit, Gálac, Saint, Valery o Excel oficial.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Abrir Ventana Emergente</span>
                </button>
              </div>

              {/* Direct Cards for instant download right on this page */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Excel SGT */}
                <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-2xs hover:border-emerald-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">SGT Contable (Excel .XLSX)</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        .XLSX
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Libro Diario, Mayor Analítico acumulado y Plan de Cuentas en 3 hojas de cálculo.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Recomendado</span>
                    <button
                      onClick={() => exportToSgtContableExcel(journalEntries, company)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Excel</span>
                    </button>
                  </div>
                </div>

                {/* Excel / CSV Ven-NIF */}
                <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-2xs hover:border-blue-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Excel / CSV Ven-NIF Oficial</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                        .CSV
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Tabla universal para Excel y Calc con Debe, Haber y referencias de conciliación.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Universal</span>
                    <button
                      onClick={() => {
                        const content = exportToCsvVenNif(journalEntries);
                        triggerFileDownload(content, `NOMINUS_MAYOR_VEN_NIF_${new Date().toISOString().slice(0, 10)}.csv`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar CSV</span>
                    </button>
                  </div>
                </div>

                {/* Profit Plus */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Profit Plus Contabilidad</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        .TXT
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Archivo tabular para importación directa de asientos (2K8 / 2K12 / ERP).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const content = exportToProfitPlus(journalEntries);
                        triggerFileDownload(content, `NOMINUS_ASIENTOS_PROFIT_${new Date().toISOString().slice(0, 10)}.txt`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar TXT</span>
                    </button>
                  </div>
                </div>

                {/* Gálac Software */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Gálac Software Contabilidad</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        .CSV
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Comprobantes estándar con encabezado, Debe, Haber y RIF de contraparte.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const content = exportToGalac(journalEntries);
                        triggerFileDownload(content, `NOMINUS_COMPROBANTES_GALAC_${new Date().toISOString().slice(0, 10)}.csv`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar CSV</span>
                    </button>
                  </div>
                </div>

                {/* Saint Enterprise */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Saint Enterprise</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        .TXT
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Estructura por lotes para el módulo de integración contable Saint.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const content = exportToSaint(journalEntries);
                        triggerFileDownload(content, `NOMINUS_INTERFASE_SAINT_${new Date().toISOString().slice(0, 10)}.txt`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar TXT</span>
                    </button>
                  </div>
                </div>

                {/* Valery Software */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Valery Software Administrativo</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        .CSV
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Interfaz para carga de asientos en contabilidad general Valery.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        const content = exportToValery(journalEntries);
                        triggerFileDownload(content, `NOMINUS_ASIENTOS_VALERY_${new Date().toISOString().slice(0, 10)}.csv`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Big Bottom Return Button */}
              <div className="flex justify-center pt-3 pb-6">
                <button
                  onClick={() => setActiveModule('DASHBOARD')}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Salir y Volver al Dashboard Principal</span>
                </button>
              </div>
            </div>
          )}

        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>NOMINUS CONCILIACIONES</strong> © {new Date().getFullYear()} — Plataforma Especializada de Conciliación Bancaria con Inteligencia Artificial para Venezuela.
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="hover:underline cursor-pointer" onClick={() => setIsProofModalOpen(true)}>Prueba de Efectivo 4 Columnas</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer" onClick={() => setActiveModule('SENIAT_TAX')}>Providencia SNAT/2025/000054</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer" onClick={() => setActiveModule('SUDEBAN_AML')}>SUDEBAN Res. 010.25</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ProofOfCashModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        proof={proofOfCash}
        currency={currency}
        bcvRate={company.bcvRate}
      />

      <AccountingExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        company={company}
        transactions={transactions}
        journalEntries={journalEntries}
      />

      <CompanySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectActiveCompany={handleSelectCompany}
        onSaveCompany={handleSaveCompany}
        onCreateCompany={handleCreateCompany}
        onDeleteCompany={handleDeleteCompany}
        onUpdateBankAccounts={handleUpdateBankAccounts}
        onPurgeAllData={handlePurgeAllData}
      />

      <RestorePointModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        user={user}
        transactions={transactions}
        currency={currency}
        initialBalanceBank={initialBalanceBank}
        initialBalanceLedger={initialBalanceLedger}
        onRestoreComplete={handleRestoreComplete}
        onOpenEncryptedBackup={() => setIsEncryptedBackupModalOpen(true)}
      />

      {isDirectUploadModalOpen && (
        <FileUploadModal
          isOpen={isDirectUploadModalOpen}
          onClose={() => setIsDirectUploadModalOpen(false)}
          defaultSource={directUploadSource}
          initialMode={directUploadMode}
          currency={currency}
          bcvRate={company.bcvRate}
          onImportComplete={handleImportCompleteFromDirectModal}
        />
      )}

      <DataHealthCheckupModal
        isOpen={isHealthCheckupModalOpen}
        onClose={() => setIsHealthCheckupModalOpen(false)}
        transactions={transactions}
        onApplyCleanup={handleApplyHealthCleanup}
      />

      <EncryptedBackupModal
        isOpen={isEncryptedBackupModalOpen}
        onClose={() => setIsEncryptedBackupModalOpen(false)}
        activeCompany={company}
        companies={companies}
        transactions={transactions}
        currency={currency}
        bcvRate={company.bcvRate}
        initialBalanceBank={initialBalanceBank}
        initialBalanceLedger={initialBalanceLedger}
        digitalSupports={digitalSupports}
        cashLogs={cashLogs}
        cashTraces={cashTraces}
        onRestoreDatabase={handleRestoreDatabase}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartUpload={(source) => handleOpenUploadFromRoadmap(source, 'PASTE')}
        onNavigateToWorkspace={() => setActiveModule('RECONCILIATION')}
        onNavigateToResults={() => setActiveModule('RECONCILIATION_RESULTS')}
      />

      <InteractiveTourOverlay
        isOpen={isTourOverlayOpen}
        onClose={() => setIsTourOverlayOpen(false)}
        onOpenUploadModal={handleOpenUploadFromRoadmap}
        onRunReconciliation={handleRunReconciliationFromRoadmap}
        onNavigateToWorkspace={() => setActiveModule('RECONCILIATION')}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      <ClearReconciliationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        transactions={transactions}
        selectedBank={selectedBankAccountId}
        currency={currency}
        onConfirmClear={handleClearReconciliation}
      />

    </div>
  );
}
