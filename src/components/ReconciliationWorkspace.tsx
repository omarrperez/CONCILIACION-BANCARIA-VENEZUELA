import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  Check,
  RefreshCw,
  PlusCircle,
  FileText,
  BookOpen,
  X,
  Building,
  Loader2,
  Upload,
  Wand2,
  Zap,
  FileSpreadsheet,
  Download,
  History,
  ClipboardPaste,
  HeartPulse,
  Lock,
  Trash2,
  Pencil,
  Plus,
  CheckSquare,
  Tags
} from 'lucide-react';
import { BankTransaction, CurrencyType, MatchingStatus, TransactionSource, UserCompanyProfile } from '../types/accounting';
import { VENEZUELAN_BANKS } from '../data/venNifAccounts';
import { runAutomatedReconciliation, runAutomatedReconciliationAsync, calculateProofOfCash, ReconciliationProgress } from '../services/matchingEngine';
import { parseAndCategorizeLedgerText, AIParsedLedgerRow } from '../services/aiAccountant';
import { SuggestedAdjustmentsAssistant } from './SuggestedAdjustmentsAssistant';
import { generateSuggestedAdjustments } from '../services/adjustmentEngine';
import { FileUploadModal } from './FileUploadModal';
import { runDatabaseHealthCheck } from '../services/healthCheckService';
import { ClearReconciliationModal, ClearReconciliationOption } from './ClearReconciliationModal';
import { TransactionEditorModal } from './TransactionEditorModal';
import { BulkAccountAssignmentBar } from './BulkAccountAssignmentBar';
import { BankAccountingRulesModal } from './BankAccountingRulesModal';
import { classifyTransactionByBankRules, generateBankLedgerExcel, generateStgAccountingJournalExcel } from '../services/bankAccountingRules';
import { exportToReconciliationProofExcel } from '../services/exportService';

interface ReconciliationWorkspaceProps {
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  company?: UserCompanyProfile;
  initialBalanceBank?: number;
  initialBalanceLedger?: number;
  onUpdateInitialBalances?: (bankBal: number, ledgerBal: number) => void;
  onUpdateTransactions: (updated: BankTransaction[]) => void;
  onSelectTransactionForModule: (tx: BankTransaction) => void;
  onNavigateToAssistant?: (mode: 'BANK' | 'LEDGER') => void;
  onAddParsedTransactions?: (newTx: BankTransaction[]) => void;
  onNavigateToResults?: () => void;
  onOpenExportModal?: () => void;
  onOpenRestoreModal?: () => void;
  onOpenHealthCheckup?: () => void;
  onOpenEncryptedBackup?: () => void;
  onClearReconciliation?: (
    option: ClearReconciliationOption,
    scope: 'ALL_BANKS' | 'SELECTED_BANK_ONLY'
  ) => Promise<void> | void;
  onSaveTransaction?: (tx: BankTransaction) => Promise<void> | void;
  onDeleteTransaction?: (txId: string) => Promise<void> | void;
}

export const ReconciliationWorkspace: React.FC<ReconciliationWorkspaceProps> = ({
  transactions,
  currency,
  bcvRate,
  company,
  initialBalanceBank = 0,
  initialBalanceLedger = 0,
  onUpdateInitialBalances,
  onUpdateTransactions,
  onSelectTransactionForModule,
  onNavigateToAssistant,
  onAddParsedTransactions,
  onNavigateToResults,
  onOpenExportModal,
  onOpenRestoreModal,
  onOpenHealthCheckup,
  onOpenEncryptedBackup,
  onClearReconciliation,
  onSaveTransaction,
  onDeleteTransaction
}) => {
  const [selectedBank, setSelectedBank] = useState<string>('ALL'); // Default to ALL or auto-detected bank
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [toleranceDays, setToleranceDays] = useState<number>(3);

  // Helper de Búsqueda Global por descripción, referencia, RIF, fecha o monto
  const matchesSearchTerm = (tx: BankTransaction, term: string): boolean => {
    if (!term.trim()) return true;
    const cleanTerm = term.toLowerCase().trim();

    // 1. Campos de texto (referencia, descripción, RIF, nombre contraparte, cuenta, notas, fecha)
    if (
      tx.referenceNum.toLowerCase().includes(cleanTerm) ||
      tx.rawDescription.toLowerCase().includes(cleanTerm) ||
      (tx.counterpartyRif && tx.counterpartyRif.toLowerCase().includes(cleanTerm)) ||
      (tx.counterpartyName && tx.counterpartyName.toLowerCase().includes(cleanTerm)) ||
      (tx.accountName && tx.accountName.toLowerCase().includes(cleanTerm)) ||
      (tx.notes && tx.notes.toLowerCase().includes(cleanTerm)) ||
      (tx.txDate && tx.txDate.includes(cleanTerm))
    ) {
      return true;
    }

    // 2. Búsqueda por Monto (Nominal, VES o USD)
    const numericSearch = cleanTerm.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (numericSearch && !isNaN(parseFloat(numericSearch))) {
      const searchVal = parseFloat(numericSearch);
      if (
        Math.abs(tx.amountNominal - searchVal) < 0.01 ||
        Math.abs(tx.amountVes - searchVal) < 0.01 ||
        (tx.amountUsdEquivalent && Math.abs(tx.amountUsdEquivalent - searchVal) < 0.01) ||
        tx.amountNominal.toString().includes(cleanTerm) ||
        tx.amountVes.toString().includes(cleanTerm) ||
        tx.amountNominal.toLocaleString('es-VE').includes(cleanTerm)
      ) {
        return true;
      }
    }

    return false;
  };

  // Auditoría automática de salud de datos
  const healthIssuesCount = useMemo(() => {
    return runDatabaseHealthCheck(transactions).issues.length;
  }, [transactions]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileProgress, setReconcileProgress] = useState<ReconciliationProgress | null>(null);
  const [reconcileResultToast, setReconcileResultToast] = useState<string | null>(null);

  // Modal para Limpiar Conciliación
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  // Modal para Introducir / Corregir Transacciones
  const [isTxEditorOpen, setIsTxEditorOpen] = useState(false);
  const [txEditorMode, setTxEditorMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [txEditorDefaultSource, setTxEditorDefaultSource] = useState<TransactionSource>('BANK');

  // Assistant de Ajustes Sugeridos
  const [isAdjustmentsAssistantOpen, setIsAdjustmentsAssistantOpen] = useState(false);

  // Modal para Cargar Archivos (Excel / PDF / CSV)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalDefaultSource, setUploadModalDefaultSource] = useState<TransactionSource>('BANK');
  const [uploadModalInitialMode, setUploadModalInitialMode] = useState<'FILE' | 'PASTE'>('FILE');

  // Manual matching selection
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  // Selección múltiple para Asignación Masiva de Cuentas Contables (Bulk Account Assignment)
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const selectedPendingSet = useMemo(() => new Set(selectedPendingIds), [selectedPendingIds]);

  // Modal de Carga Rápida de Libro Contable de Banco
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isWhatToTakeModalOpen, setIsWhatToTakeModalOpen] = useState(false);
  const [isBankRulesModalOpen, setIsBankRulesModalOpen] = useState(false);
  const [ledgerPastedText, setLedgerPastedText] = useState('');
  const [ledgerBankCode, setLedgerBankCode] = useState('0134');
  const [isProcessingLedger, setIsProcessingLedger] = useState(false);
  const [previewLedgerRows, setPreviewLedgerRows] = useState<AIParsedLedgerRow[] | null>(null);
  const [ledgerStats, setLedgerStats] = useState<{ totalDebe: number; totalHaber: number } | null>(null);

  // Conteo de operaciones que no cuadran (discrepancias + pendientes)
  const unreconciledCount = useMemo(() => {
    return transactions.filter(t => {
      if (t.currency !== currency) return false;
      if (selectedBank !== 'ALL' && t.bankCode !== selectedBank) return false;
      return t.matchingStatus === 'UNMATCHED' || t.matchingStatus === 'DISCREPANCY';
    }).length;
  }, [transactions, currency, selectedBank]);

  const discrepancyCount = useMemo(() => {
    return transactions.filter(t => {
      if (t.currency !== currency) return false;
      if (selectedBank !== 'ALL' && t.bankCode !== selectedBank) return false;
      return t.matchingStatus === 'DISCREPANCY';
    }).length;
  }, [transactions, currency, selectedBank]);

  // Manejador para abrir modal de introducción de nueva transacción
  const handleOpenCreateTransaction = (src: TransactionSource = 'BANK') => {
    setTxEditorMode('CREATE');
    setEditingTx(null);
    setTxEditorDefaultSource(src);
    setIsTxEditorOpen(true);
  };

  // Manejador para abrir modal de corrección de transacción existente
  const handleOpenEditTransaction = (tx: BankTransaction) => {
    setTxEditorMode('EDIT');
    setEditingTx(tx);
    setTxEditorDefaultSource(tx.source);
    setIsTxEditorOpen(true);
  };

  // Guardar creación o corrección de transacción
  const handleSaveTransactionInternal = async (savedTx: BankTransaction) => {
    if (onSaveTransaction) {
      await onSaveTransaction(savedTx);
    } else {
      const idx = transactions.findIndex(t => t.id === savedTx.id);
      if (idx >= 0) {
        const copy = [...transactions];
        copy[idx] = savedTx;
        onUpdateTransactions(copy);
      } else {
        onUpdateTransactions([savedTx, ...transactions]);
      }
    }
    setReconcileResultToast(
      `Operación ref. ${savedTx.referenceNum} (${savedTx.source === 'BANK' ? 'Banco' : 'Libro'}) guardada con éxito.`
    );
    setTimeout(() => setReconcileResultToast(null), 5000);
  };

  // Eliminar transacción
  const handleDeleteTransactionInternal = async (txId: string) => {
    if (onDeleteTransaction) {
      await onDeleteTransaction(txId);
    } else {
      const filtered = transactions.filter(t => t.id !== txId);
      onUpdateTransactions(filtered);
    }
    setReconcileResultToast('Movimiento eliminado correctamente.');
    setTimeout(() => setReconcileResultToast(null), 4000);
  };

  // Ejecutar limpieza de conciliación
  const handleExecuteClear = async (
    option: ClearReconciliationOption,
    scope: 'ALL_BANKS' | 'SELECTED_BANK_ONLY'
  ) => {
    if (onClearReconciliation) {
      await onClearReconciliation(option, scope);
    } else {
      const isTarget = (t: BankTransaction) => {
        if (scope === 'SELECTED_BANK_ONLY' && selectedBank !== 'ALL') {
          return t.bankCode === selectedBank;
        }
        return true;
      };

      if (option === 'ALL') {
        onUpdateTransactions(transactions.filter(t => !isTarget(t)));
        if (onUpdateInitialBalances) onUpdateInitialBalances(0, 0);
      } else if (option === 'BANK') {
        onUpdateTransactions(transactions.filter(t => !(isTarget(t) && t.source === 'BANK')));
        if (onUpdateInitialBalances) onUpdateInitialBalances(0, initialBalanceLedger || 0);
      } else if (option === 'LEDGER') {
        onUpdateTransactions(transactions.filter(t => !(isTarget(t) && t.source === 'LEDGER')));
        if (onUpdateInitialBalances) onUpdateInitialBalances(initialBalanceBank || 0, 0);
      } else if (option === 'RESET_STATUS') {
        const reseted = transactions.map(t => {
          if (isTarget(t)) {
            return {
              ...t,
              matchingStatus: 'UNMATCHED' as MatchingStatus,
              matchedWithId: undefined,
              matchScore: 0,
              discrepancyAmount: undefined
            };
          }
          return t;
        });
        onUpdateTransactions(reseted);
      }
    }

    setReconcileResultToast('¡La conciliación fue limpiada exitosamente! El sistema está listo para empezar de nuevo.');
    setTimeout(() => setReconcileResultToast(null), 6000);
  };

  // Detect pending adjustments count for selected bank
  const pendingAdjustments = useMemo(() => {
    return generateSuggestedAdjustments(
      transactions,
      selectedBank === 'ALL' ? undefined : selectedBank,
      currency,
      bcvRate
    );
  }, [transactions, selectedBank, currency, bcvRate]);

  // Counts per bank to never lose visibility
  const bankCounts = useMemo(() => {
    const counts: Record<string, { bankCount: number; ledgerCount: number }> = {};
    VENEZUELAN_BANKS.forEach(b => {
      counts[b.code] = { bankCount: 0, ledgerCount: 0 };
    });

    transactions.forEach(t => {
      if (t.currency !== currency) return;
      if (!counts[t.bankCode]) {
        counts[t.bankCode] = { bankCount: 0, ledgerCount: 0 };
      }
      if (t.source === 'BANK') counts[t.bankCode].bankCount++;
      if (t.source === 'LEDGER') counts[t.bankCode].ledgerCount++;
    });

    return counts;
  }, [transactions, currency]);

  // Handle importing from Excel, CSV or PDF
  const handleImportFromFile = (
    newTx: BankTransaction[],
    source: TransactionSource,
    detectedInitialBal?: number
  ) => {
    if (newTx.length === 0) return;

    if (onAddParsedTransactions) {
      onAddParsedTransactions(newTx);
    } else {
      onUpdateTransactions([...transactions, ...newTx]);
    }

    // Auto-select bank of the newly loaded transactions, but avoid hiding the other column!
    const bankCode = newTx[0]?.bankCode;
    const otherSource = source === 'BANK' ? 'LEDGER' : 'BANK';
    const otherSourceTx = transactions.filter(t => t.source === otherSource && t.currency === currency);
    const otherBankCodes = new Set(otherSourceTx.map(t => t.bankCode));

    if (otherSourceTx.length > 0 && bankCode && !otherBankCodes.has(bankCode)) {
      // If transactions exist in the other column for another bank, switch to 'ALL' so both columns stay visible
      setSelectedBank('ALL');
    } else if (bankCode) {
      setSelectedBank(bankCode);
    }

    if (detectedInitialBal !== undefined && detectedInitialBal > 0 && onUpdateInitialBalances) {
      if (source === 'BANK') {
        onUpdateInitialBalances(detectedInitialBal, initialBalanceLedger || 0);
      } else {
        onUpdateInitialBalances(initialBalanceBank || 0, detectedInitialBal);
      }
    }

    setReconcileResultToast(
      `¡Se incorporaron exitosamente ${newTx.length} movimientos de ${source === 'BANK' ? 'Extracto Bancario' : 'Libro Mayor'}!`
    );
    setTimeout(() => setReconcileResultToast(null), 6000);
  };

  const bankTxList = transactions.filter(t => {
    if (t.source !== 'BANK') return false;
    if (t.currency !== currency) return false;
    if (selectedBank !== 'ALL' && t.bankCode !== selectedBank) return false;
    if (typeFilter !== 'ALL' && t.txType !== typeFilter) return false;
    if (statusFilter === 'NO_CUADRAN') {
      if (t.matchingStatus !== 'UNMATCHED' && t.matchingStatus !== 'DISCREPANCY') return false;
    } else if (statusFilter !== 'ALL' && t.matchingStatus !== statusFilter) {
      return false;
    }
    return matchesSearchTerm(t, searchTerm);
  });

  const ledgerTxList = transactions.filter(t => {
    if (t.source !== 'LEDGER') return false;
    if (t.currency !== currency) return false;
    if (selectedBank !== 'ALL' && t.bankCode !== selectedBank) return false;
    if (typeFilter !== 'ALL' && t.txType !== typeFilter) return false;
    if (statusFilter === 'NO_CUADRAN') {
      if (t.matchingStatus !== 'UNMATCHED' && t.matchingStatus !== 'DISCREPANCY') return false;
    } else if (statusFilter !== 'ALL' && t.matchingStatus !== statusFilter) {
      return false;
    }
    return matchesSearchTerm(t, searchTerm);
  });

  // Partidas pendientes visibles para asignación contable masiva (Bulk Assignment)
  const pendingBankTxList = useMemo(() => {
    return bankTxList.filter(t => t.matchingStatus === 'UNMATCHED' || t.matchingStatus === 'DISCREPANCY');
  }, [bankTxList]);

  const pendingLedgerTxList = useMemo(() => {
    return ledgerTxList.filter(t => t.matchingStatus === 'UNMATCHED' || t.matchingStatus === 'DISCREPANCY');
  }, [ledgerTxList]);

  const selectedPendingTransactions = useMemo(() => {
    return transactions.filter(t => selectedPendingSet.has(t.id));
  }, [transactions, selectedPendingSet]);

  const selectedPendingTotalAmount = useMemo(() => {
    return selectedPendingTransactions.reduce((acc, t) => acc + t.amountNominal, 0);
  }, [selectedPendingTransactions]);

  const toggleSelectPendingTx = (txId: string) => {
    setSelectedPendingIds(prev =>
      prev.includes(txId) ? prev.filter(id => id !== txId) : [...prev, txId]
    );
  };

  const handleSelectAllPendingBank = () => {
    const ids = pendingBankTxList.map(t => t.id);
    setSelectedPendingIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleSelectAllPendingLedger = () => {
    const ids = pendingLedgerTxList.map(t => t.id);
    setSelectedPendingIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleSelectAllPendingBoth = () => {
    const ids = [...pendingBankTxList, ...pendingLedgerTxList].map(t => t.id);
    setSelectedPendingIds(ids);
  };

  const handleClearPendingSelection = () => {
    setSelectedPendingIds([]);
  };

  // Aplicar cuenta contable en 1 solo clic y actualizar automáticamente el estado de matching
  const handleApplyBulkAccount = (
    code: string,
    name: string,
    moduleTag?: string,
    autoReconciledBy: BankTransaction['autoReconciledBy'] = 'MANUAL'
  ) => {
    if (selectedPendingIds.length === 0) return;

    const count = selectedPendingIds.length;
    const nowIso = new Date().toLocaleDateString('es-VE');
    const updated = transactions.map(t => {
      if (selectedPendingSet.has(t.id)) {
        return {
          ...t,
          accountCode: code,
          accountName: name,
          moduleTag: moduleTag || t.moduleTag || 'MOD_HUERFANOS',
          matchingStatus: 'MATCHED_EXACT' as MatchingStatus,
          matchScore: 1.0,
          autoReconciledBy: autoReconciledBy,
          notes: t.notes
            ? `${t.notes} | Asignación masiva [${code}]: ${nowIso}`
            : `Asignación masiva: ${code} - ${name} (${nowIso})`
        };
      }
      return t;
    });

    onUpdateTransactions(updated);
    setSelectedPendingIds([]);
    setReconcileResultToast(
      `¡Asignación masiva exitosa! Se aplicó [${code} - ${name}] a ${count} ${count === 1 ? 'partida pendiente' : 'partidas pendientes'} y su estado se actualizó a Conciliado (MATCHED_EXACT).`
    );
    setTimeout(() => setReconcileResultToast(null), 6000);
  };

  // Run 5-stage automated matching via Web Worker / non-blocking chunking
  const handleRunReconciliation = async () => {
    if (isReconciling) return;
    setIsReconciling(true);
    setReconcileProgress({
      progress: 5,
      stageName: 'Iniciando conciliación...',
      exactMatchesCount: 0,
      fuzzyMatchesCount: 0,
      discrepanciesCount: 0
    });

    try {
      const result = await runAutomatedReconciliationAsync(
        transactions,
        toleranceDays,
        (p) => setReconcileProgress(p)
      );

      onUpdateTransactions(result.updatedTransactions);
      setReconcileResultToast(
        `¡Conciliación completada con éxito! ${result.exactMatchesCount} coincidencias exactas, ${result.fuzzyMatchesCount} por similitud difusa, ${result.discrepanciesCount} variaciones detectadas.`
      );
      setTimeout(() => setReconcileResultToast(null), 6000);
    } catch (err) {
      console.error('Error durante la conciliación automática:', err);
      setReconcileResultToast('Ocurrió un error al ejecutar la conciliación. Tus datos se mantienen a salvo.');
      setTimeout(() => setReconcileResultToast(null), 6000);
    } finally {
      setIsReconciling(false);
      setReconcileProgress(null);
    }
  };

  // Confirm fuzzy match manually
  const handleConfirmFuzzyMatch = (txId: string) => {
    const updated = transactions.map(t => {
      if (t.id === txId || (t.matchedWithId === txId)) {
        return { ...t, matchingStatus: 'MATCHED_EXACT' as MatchingStatus, matchScore: 1.0 };
      }
      return t;
    });
    onUpdateTransactions(updated);
  };

  // Manual Match linkage between selected left and right
  const handleManualPair = () => {
    if (!selectedBankId || !selectedLedgerId) return;

    const bnkItem = transactions.find(t => t.id === selectedBankId);
    const ledItem = transactions.find(t => t.id === selectedLedgerId);
    if (!bnkItem || !ledItem) return;

    const delta = bnkItem.amountNominal - ledItem.amountNominal;
    const status: MatchingStatus = Math.abs(delta) < 0.01 ? 'MATCHED_EXACT' : 'DISCREPANCY';

    const updated = transactions.map(t => {
      if (t.id === selectedBankId) {
        return { ...t, matchingStatus: status, matchedWithId: selectedLedgerId, discrepancyAmount: delta };
      }
      if (t.id === selectedLedgerId) {
        return { ...t, matchingStatus: status, matchedWithId: selectedBankId, discrepancyAmount: -delta };
      }
      return t;
    });

    onUpdateTransactions(updated);
    setSelectedBankId(null);
    setSelectedLedgerId(null);
  };

  // Carga rápida del Libro Contable de Banco
  const handleProcessQuickLedger = async () => {
    if (!ledgerPastedText.trim()) return;
    setIsProcessingLedger(true);
    try {
      const res = await parseAndCategorizeLedgerText(ledgerPastedText, ledgerBankCode, currency, bcvRate);
      setPreviewLedgerRows(res.parsedRows);
      setLedgerStats({ totalDebe: res.totalDebe, totalHaber: res.totalHaber });
    } catch (err) {
      console.error('Error al procesar libro contable:', err);
    } finally {
      setIsProcessingLedger(false);
    }
  };

  const handleSaveQuickLedger = () => {
    if (!previewLedgerRows || previewLedgerRows.length === 0) return;

    const newLedgerItems: BankTransaction[] = previewLedgerRows.map((row, idx) => ({
      id: `led-tx-${Date.now()}-${idx}`,
      source: 'LEDGER',
      bankCode: row.bankCode,
      bankName: row.bankName,
      referenceNum: row.referenceNum,
      txDate: row.txDate,
      txType: row.txType,
      amountNominal: row.amountNominal,
      currency: row.currency,
      bcvRate,
      amountVes: row.currency === 'USD' ? row.amountNominal * bcvRate : row.amountNominal,
      rawDescription: row.rawDescription,
      counterpartyRif: row.counterpartyRif,
      accountCode: row.accountCode || '1.1.01.02.001',
      accountName: row.accountName || `${row.bankName} Cta Corriente`,
      matchingStatus: 'UNMATCHED',
      moduleTag: 'MOD_VENTAS',
      notes: row.rationale,
      createdAt: new Date().toISOString()
    }));

    if (onAddParsedTransactions) {
      onAddParsedTransactions(newLedgerItems);
    } else {
      onUpdateTransactions([...transactions, ...newLedgerItems]);
    }

    const otherSourceTx = transactions.filter(t => t.source === 'BANK' && t.currency === currency);
    const otherBankCodes = new Set(otherSourceTx.map(t => t.bankCode));
    if (otherSourceTx.length > 0 && ledgerBankCode && !otherBankCodes.has(ledgerBankCode)) {
      setSelectedBank('ALL');
    }

    setIsLedgerModalOpen(false);
    setLedgerPastedText('');
    setPreviewLedgerRows(null);
    setReconcileResultToast(`¡Se incorporaron exitosamente ${newLedgerItems.length} asientos al Mayor General de Bancos!`);
    setTimeout(() => setReconcileResultToast(null), 5000);
  };

  // Generar asientos contables automáticamente desde los movimientos bancarios cargados usando las reglas oficiales del banco (BDV, Mercantil, Plaza)
  const handleAutoGenerateLedgerFromBank = () => {
    if (bankTxList.length === 0) return;

    const targetBankCode = selectedBank !== 'ALL' ? selectedBank : (bankTxList[0]?.bankCode || '0102');

    const generated: BankTransaction[] = bankTxList.map((tx, idx) => {
      const bCode = tx.bankCode || targetBankCode;
      const bankRuleResult = classifyTransactionByBankRules(
        tx.rawDescription,
        tx.amountNominal,
        tx.txType,
        bCode
      );

      const isCredit = tx.txType === 'CREDIT' || tx.amountNominal > 0;
      const assignedAccountCode = tx.accountCode || (isCredit ? (bankRuleResult.contraAccountCode || '1.1.2.1.10') : bankRuleResult.accountCode);
      const assignedAccountName = tx.accountName || (isCredit ? (bankRuleResult.contraAccountName || 'Cuentas por Cobrar Clientes') : bankRuleResult.accountName);

      return {
        id: `led-gen-${Date.now()}-${idx}`,
        source: 'LEDGER' as const,
        bankCode: bCode,
        bankName: tx.bankName,
        referenceNum: tx.referenceNum,
        txDate: tx.txDate,
        txType: tx.txType,
        amountNominal: tx.amountNominal,
        currency: tx.currency,
        bcvRate,
        amountVes: tx.amountVes,
        rawDescription: `${tx.rawDescription} (Asiento Contable Interno)`,
        counterpartyRif: tx.counterpartyRif,
        counterpartyName: tx.counterpartyName,
        accountCode: assignedAccountCode,
        accountName: assignedAccountName,
        matchingStatus: 'UNMATCHED' as const,
        moduleTag: bankRuleResult.isUnclassified ? 'MOD_HUERFANOS' : (tx.moduleTag || bankRuleResult.moduleTag),
        notes: bankRuleResult.matchedRule
          ? `Generado según ${bankRuleResult.matchedRule.name}`
          : 'Generado automáticamente según reglas de banco (Pendiente en Huérfanos)',
        createdAt: new Date().toISOString()
      };
    });

    if (onAddParsedTransactions) {
      onAddParsedTransactions(generated);
    } else {
      onUpdateTransactions([...transactions, ...generated]);
    }

    setReconcileResultToast(`¡Se generaron ${generated.length} asientos contables en el Mayor de Bancos aplicando las reglas de ${targetBankCode}! Ahora puedes pulsar 'Conciliar Automáticamente'.`);
    setTimeout(() => setReconcileResultToast(null), 6000);
  };

  const handleLoadSampleLedgerData = () => {
    const sample = `10/05/2024\tTRF-0019283\tCobro Factura 00412 Distribuidora Los Andes\t45.000,00\t0,00
11/05/2024\tCHQ-0004521\tPago Proveedor Materiales Eléctricos C.A.\t0,00\t18.250,00
12/05/2024\tTRF-0084920\tNómina Primera Quincena Mayo Personal\t0,00\t12.800,00
13/05/2024\tPAGO-992182\tPago Impuesto Retención IVA SENIAT\t0,00\t4.500,00
14/05/2024\tDEP-0048192\tLiquidación Puntos de Venta (POS) Lote 492\t32.100,00\t0,00`;
    setLedgerPastedText(sample);
  };

  const sym = currency === 'VES' ? 'Bs.' : '$';

  return (
    <div className="space-y-4">
      
      {/* Guía Rápida & Acceso al Módulo de Diagnóstico / Resultados */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 rounded-2xl border border-emerald-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Orientación al Usuario
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                ¿Te sientes perdido o tienes dudas del proceso?
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-800 mt-0.5">
              Revisa si tu conciliación <strong>está bien o mal</strong> y aprende <strong>qué datos tomar de tu libro contable</strong> sin enredos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Botón de Reglas Oficiales de Bancos (Banesco, Bancamiga, BDV, Mercantil, Plaza) */}
          <button
            onClick={() => setIsBankRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200 shadow-2xs cursor-pointer transition-colors"
            title="Inspeccionar y aplicar Reglas Contables Oficiales por Banco (Banesco 0134 SGT, Bancamiga 0172, BDV 0102, Mercantil 0105, Plaza 0138) y exportar Libro de 3 Hojas"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
            <span>📖 Reglas de Bancos (Bancamiga, Banesco, BDV, Mercantil, Plaza)</span>
          </button>

          <button
            onClick={() => setIsWhatToTakeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>¿Qué datos tomar del Libro?</span>
          </button>

          {onNavigateToResults && (
            <button
              onClick={onNavigateToResults}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
            >
              <span>Ver Diagnóstico y Resultados →</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Controls: Bank Selector, Tolerance, Run Algorithm */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Selector de Banco Venezolano */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-500 mr-1">Banco:</span>
            <button
              onClick={() => setSelectedBank('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedBank === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              Todos los Bancos <span className="text-[10px] opacity-75 font-mono">({transactions.filter(t => t.currency === currency).length})</span>
            </button>
            {VENEZUELAN_BANKS.map(bank => {
              const isSelected = selectedBank === bank.code;
              const bCount = (bankCounts[bank.code]?.bankCount || 0) + (bankCounts[bank.code]?.ledgerCount || 0);
              return (
                <button
                  key={bank.code}
                  onClick={() => setSelectedBank(bank.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {bank.shortName} <span className="text-[10px] opacity-75 font-mono">({bCount > 0 ? bCount : bank.code})</span>
                </button>
              );
            })}
          </div>

          {/* Action buttons - Streamlined Hierarchy to eliminate visual clutter */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            
            {/* Primary Action 1: Import Excel / PDF */}
            <button
              onClick={() => {
                setUploadModalDefaultSource('BANK');
                setUploadModalInitialMode('FILE');
                setIsUploadModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Cargar Estado de Cuenta Bancario o Libro Mayor desde archivo Excel (.xlsx, .xls), CSV o PDF"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>+ Cargar Excel / PDF</span>
            </button>

            {/* Primary Action 2: Run Automated Reconciliation */}
            <button
              onClick={handleRunReconciliation}
              disabled={isReconciling}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white font-bold text-xs shadow-xs transition-all ${
                isReconciling
                  ? 'bg-emerald-700 cursor-wait ring-2 ring-emerald-400'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm'
              }`}
              title="Conciliar automáticamente usando inteligencia contable"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin text-emerald-200' : ''}`} />
              <span>
                {isReconciling
                  ? reconcileProgress
                    ? `${reconcileProgress.stageName} (${reconcileProgress.progress}%)`
                    : 'Conciliando...'
                  : '✨ Conciliar Automáticamente'}
              </span>
            </button>

            {/* Manual transaction creation */}
            <button
              onClick={() => handleOpenCreateTransaction('BANK')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
              title="Introducir una nueva transacción manualmente"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>+ Operación</span>
            </button>

            {/* Limpiar Conciliación */}
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
              title="Limpiar todo el estado de cuenta cargado y el libro contable para empezar de nuevo"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Limpiar</span>
            </button>

            {/* Asignación Masiva de Cuentas Contables */}
            <button
              onClick={() => {
                if (selectedPendingIds.length > 0) {
                  setSelectedPendingIds([]);
                } else {
                  handleSelectAllPendingBoth();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                selectedPendingIds.length > 0
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Selección y asignación contable masiva de cuentas para partidas pendientes"
            >
              <Tags className="w-3.5 h-3.5 text-indigo-600" />
              <span>Asignación Masiva</span>
              {(pendingBankTxList.length > 0 || pendingLedgerTxList.length > 0) && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedPendingIds.length > 0
                    ? 'bg-white text-indigo-800'
                    : 'bg-indigo-200/80 text-indigo-950'
                }`}>
                  {selectedPendingIds.length > 0
                    ? `${selectedPendingIds.length}`
                    : `${pendingBankTxList.length + pendingLedgerTxList.length}`}
                </span>
              )}
            </button>

            {/* Secondary Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsToolsMenuOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  isToolsMenuOpen
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
                }`}
              >
                <span>⚙️ Herramientas ▾</span>
                {healthIssuesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                    {healthIssuesCount}
                  </span>
                )}
              </button>

              {isToolsMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 space-y-1 text-xs animate-in fade-in duration-100"
                  onClick={() => setIsToolsMenuOpen(false)}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Opciones y Utilidades
                  </div>

                  <button
                    onClick={() => {
                      setIsBankRulesModalOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                      <span>Reglas de Bancos (Bancamiga, Banesco, BDV, Mercantil, Plaza)</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                      SGT • Oficiales
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      const targetBank = selectedBank !== 'ALL' ? selectedBank : '0102';
                      generateBankLedgerExcel(transactions, targetBank, company, currency);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Descargar Libro Bancos (3 Hojas Excel)</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold font-mono">5 Cols</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      generateBankLedgerExcel(transactions, '0102', company, currency);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    title="Generar archivo asientos_generados.xlsx según el prompt oficial de Banco de Venezuela (3 Hojas con Partida Doble)"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                      <span>Asientos BDV (asientos_generados.xlsx)</span>
                    </div>
                    <span className="text-[10px] text-rose-900 font-bold font-mono px-1.5 py-0.5 rounded bg-rose-100">BDV 0102</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      generateBankLedgerExcel(transactions, '0134', company, currency);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    title="Generar archivo asientos_generados.xlsx según el prompt oficial de Banesco"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                      <span>Asientos Banesco (asientos_generados.xlsx)</span>
                    </div>
                    <span className="text-[10px] text-amber-900 font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100">Banesco</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      const targetBank = selectedBank !== 'ALL' ? selectedBank : '0102';
                      generateStgAccountingJournalExcel(transactions, targetBank, company, currency);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    title="Exportar Asiento Contable completo estructurado para el Sistema Contable STG"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Asiento STG Contable (.xlsx)</span>
                    </div>
                    <span className="text-[10px] text-indigo-900 font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-100">STG</span>
                  </button>

                  <a
                    href="/assets/aistudio/1_ASIENTO_febrero_2025_vzla_y_banescoCOSTANERA_ff9cf26b.csv"
                    download="1_ASIENTO_febrero_2025_vzla_y_banescoCOSTANERA.csv"
                    onClick={() => setIsToolsMenuOpen(false)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    title="Descargar archivo CSV de modelo de producción Febrero 2025 (Banesco y Banco de Venezuela)"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Descargar Modelo Real CSV (Febrero 2025)</span>
                    </div>
                    <span className="text-[10px] text-cyan-900 font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-100">CSV Modelo</span>
                  </a>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      const targetBank = selectedBank !== 'ALL' ? selectedBank : '';
                      const proof = calculateProofOfCash(transactions, targetBank, currency, initialBalanceBank, initialBalanceLedger);
                      exportToReconciliationProofExcel({
                        proof,
                        company: company || { companyName: 'EMPRESA CONTRIBUYENTE C.A.', companyRif: 'J-00000000-0', bcvRate, isSpecialTaxpayer: true } as any,
                        transactions,
                        currency
                      });
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-teal-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer border-t border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                      <span className="font-bold text-teal-900">📗 Descargar Cuadre Conciliación (Excel)</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                      Portada • Cuadre
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectAllPendingBoth();
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Tags className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Asignación Masiva Cuentas</span>
                    </div>
                    {(pendingBankTxList.length + pendingLedgerTxList.length) > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                        {pendingBankTxList.length + pendingLedgerTxList.length}
                      </span>
                    )}
                  </button>

                  {onOpenHealthCheckup && (
                    <button
                      onClick={onOpenHealthCheckup}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                        <span>Checkup Saludable</span>
                      </div>
                      {healthIssuesCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                          {healthIssuesCount}
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setIsAdjustmentsAssistantOpen(prev => !prev)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ajustes Sugeridos</span>
                    </div>
                    {pendingAdjustments.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold">
                        {pendingAdjustments.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setUploadModalDefaultSource('BANK');
                      setUploadModalInitialMode('PASTE');
                      setIsUploadModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800 font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pegar Texto de PDF</span>
                  </button>

                  {onOpenExportModal && (
                    <button
                      onClick={onOpenExportModal}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Exportar a SGT / ERP</span>
                    </button>
                  )}

                  {onOpenRestoreModal && (
                    <button
                      onClick={onOpenRestoreModal}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Puntos de Restauración</span>
                    </button>
                  )}

                  {onOpenEncryptedBackup && (
                    <button
                      onClick={onOpenEncryptedBackup}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-700" />
                      <span>Bóveda Cifrada (AES-256)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Global Search & Filter Bar */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Main Search Input */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="🔍 Buscar por descripción, referencia, RIF o monto (ej. 72.800,00)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full p-0.5 cursor-pointer transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter (All / Debit / Credit) & Status Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              
              {/* Type Filter */}
              <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    typeFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setTypeFilter('DEBIT')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    typeFilter === 'DEBIT'
                      ? 'bg-rose-600 text-white font-bold shadow-2xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  Cargos (-)
                </button>
                <button
                  onClick={() => setTypeFilter('CREDIT')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    typeFilter === 'CREDIT'
                      ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  Abonos (+)
                </button>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'NO_CUADRAN', label: `⚠️ No Cuadran (${unreconciledCount})`, isAlert: true },
                  { id: 'UNMATCHED', label: 'Pendientes' },
                  { id: 'DISCREPANCY', label: `Variaciones (${discrepancyCount})` },
                  { id: 'MATCHED_EXACT', label: 'Exactos' },
                  { id: 'MATCHED_FUZZY', label: 'Fuzzy' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === f.id
                        ? f.isAlert
                          ? 'bg-rose-700 text-white font-bold ring-2 ring-rose-400 shadow-2xs'
                          : 'bg-slate-800 text-white font-semibold'
                        : f.isAlert && unreconciledCount > 0
                        ? 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

            </div>

          </div>

          {/* Active Search & Filters Indicator Badge */}
          {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl bg-slate-100/90 border border-slate-200/90 text-xs gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-700">
                  Filtros activos:
                </span>
                {searchTerm && (
                  <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md font-mono font-bold border border-emerald-300">
                    "{searchTerm}"
                  </span>
                )}
                {typeFilter !== 'ALL' && (
                  <span className="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md font-bold border border-sky-300">
                    Tipo: {typeFilter === 'DEBIT' ? 'Cargos (-)' : 'Abonos (+)'}
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md font-bold border border-purple-300">
                    Estado: {statusFilter}
                  </span>
                )}
                <span className="text-slate-600 font-medium ml-1">
                  • Encontrados: <strong className="text-slate-900">{bankTxList.length}</strong> en Banco / <strong className="text-slate-900">{ledgerTxList.length}</strong> en Libros
                </span>
              </div>

              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer shrink-0"
              >
                Limpiar Filtros
              </button>
            </div>
          )}

          {/* Manual pair button */}
          {selectedBankId && selectedLedgerId && (
            <div className="flex justify-end pt-1">
              <button
                onClick={handleManualPair}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shadow-xs cursor-pointer animate-pulse"
              >
                <GitCompare className="w-3.5 h-3.5" />
                Vincular Partidas Seleccionadas
              </button>
            </div>
          )}
        </div>

        {/* Banner de Operaciones que No Cuadran */}
        {statusFilter === 'NO_CUADRAN' && (
          <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">Mostrando operaciones que no cuadran ({unreconciledCount} registros):</span>
                <span className="text-amber-900 ml-1">
                  Aquí visualizas los movimientos con variaciones de monto o pendientes por conciliar. Haz clic en <strong>✏️ Corregir</strong> en cualquier tarjeta para ajustar su monto, fecha o referencia, o pulsa <strong>+ Introducir Operación</strong> para registrar una contrapartida omitida.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleOpenCreateTransaction('BANK')}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
              >
                + Movimiento Banco
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateTransaction('LEDGER')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
              >
                + Asiento Libro
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-[11px] cursor-pointer"
              >
                Ver Todas
              </button>
            </div>
          </div>
        )}

        {/* Notification Toast */}
        {reconcileResultToast && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reconcileResultToast}</span>
            </div>
            <button onClick={() => setReconcileResultToast(null)} className="text-emerald-700 font-bold ml-2">×</button>
          </div>
        )}
      </div>

      {/* Asistente de Ajustes Sugeridos (Panel Inteligente Desplegable) */}
      {isAdjustmentsAssistantOpen && (
        <SuggestedAdjustmentsAssistant
          transactions={transactions}
          currency={currency}
          bcvRate={bcvRate}
          selectedBank={selectedBank}
          company={company}
          initialBalanceBank={initialBalanceBank}
          initialBalanceLedger={initialBalanceLedger}
          onUpdateInitialBalances={onUpdateInitialBalances}
          onUpdateTransactions={onUpdateTransactions}
          onOpenExportModal={onOpenExportModal}
          onOpenRestoreModal={onOpenRestoreModal}
          onClose={() => setIsAdjustmentsAssistantOpen(false)}
        />
      )}

      {/* Asignación Masiva de Cuentas Contables (Barra cuando hay seleccionadas) */}
      {selectedPendingIds.length > 0 && (
        <BulkAccountAssignmentBar
          selectedCount={selectedPendingIds.length}
          selectedTotalAmount={selectedPendingTotalAmount}
          currency={currency}
          onApplyAccount={handleApplyBulkAccount}
          onSelectAllPendingBank={handleSelectAllPendingBank}
          onSelectAllPendingLedger={handleSelectAllPendingLedger}
          onSelectAllPendingBoth={handleSelectAllPendingBoth}
          onClearSelection={handleClearPendingSelection}
          totalPendingBankCount={pendingBankTxList.length}
          totalPendingLedgerCount={pendingLedgerTxList.length}
        />
      )}

      {/* Split Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* LEFT COLUMN: Extracto Bancario */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[650px]">
          <div className="p-3 bg-gradient-to-r from-sky-50/70 to-blue-50/70 border-b border-sky-100 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                Fuente Externa
              </span>
              <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                Extracto Bancario ({bankTxList.length} movimientos)
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[11px] font-mono font-bold text-sky-900 hidden sm:inline mr-1">
                Total: {sym} {bankTxList.reduce((acc, t) => acc + (t.txType === 'CREDIT' ? t.amountNominal : -t.amountNominal), 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
              {pendingBankTxList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allBankPendingSelected = pendingBankTxList.every(t => selectedPendingSet.has(t.id));
                    if (allBankPendingSelected) {
                      setSelectedPendingIds(prev => prev.filter(id => !pendingBankTxList.some(t => t.id === id)));
                    } else {
                      handleSelectAllPendingBank();
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] border cursor-pointer transition-colors ${
                    pendingBankTxList.some(t => selectedPendingSet.has(t.id))
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white hover:bg-sky-100 text-sky-900 border-sky-300'
                  }`}
                  title="Seleccionar todas las partidas pendientes del banco para asignación contable masiva"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Sel. Pendientes ({pendingBankTxList.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setUploadModalDefaultSource('BANK');
                  setUploadModalInitialMode('PASTE');
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 cursor-pointer transition-colors"
                title="Copiar y pegar texto de tu PDF o extracto bancario sin encabezados"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Pegar Texto PDF</span>
              </button>
              <button
                onClick={() => {
                  setUploadModalDefaultSource('BANK');
                  setUploadModalInitialMode('FILE');
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                title="Cargar Extracto Bancario en Excel (.xlsx, .xls), PDF o CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>+ Archivo</span>
              </button>
              <button
                onClick={() => handleOpenCreateTransaction('BANK')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-[11px] border border-sky-300 cursor-pointer transition-colors"
                title="Introducir un movimiento bancario manual faltante"
              >
                <Plus className="w-3.5 h-3.5 text-sky-700" />
                <span>+ Manual</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {bankTxList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-3 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-1 border border-sky-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Sin movimientos bancarios en este filtro</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">
                    Sube tu archivo de extracto bancario en Excel, PDF o CSV, o selecciona otro banco.
                  </p>
                </div>

                {/* Si hay transacciones en otro banco, avisar al usuario para que no crea que se borraron */}
                {transactions.some(t => t.source === 'BANK') && selectedBank !== 'ALL' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1 max-w-xs mx-auto">
                    <p className="text-[11px] font-bold text-amber-900">
                      ¡Tienes movimientos bancarios en otros bancos!
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedBank('ALL')}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Ver Todos los Bancos
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setUploadModalDefaultSource('BANK');
                      setUploadModalInitialMode('FILE');
                      setIsUploadModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Cargar Archivo (Excel / PDF / CSV)</span>
                  </button>

                  <button
                    onClick={() => {
                      setUploadModalDefaultSource('BANK');
                      setUploadModalInitialMode('PASTE');
                      setIsUploadModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>📋 Pegar Texto del PDF (Sin Encabezados)</span>
                  </button>
                </div>
              </div>
            ) : (
              bankTxList.map((tx) => {
                const isSelected = selectedBankId === tx.id;
                const isPending = tx.matchingStatus === 'UNMATCHED' || tx.matchingStatus === 'DISCREPANCY';
                const isBulkSelected = selectedPendingSet.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedBankId(isSelected ? null : tx.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isBulkSelected
                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-400/80 shadow-xs'
                        : isSelected
                        ? 'border-purple-400 bg-purple-50/50 ring-2 ring-purple-300'
                        : tx.matchingStatus === 'MATCHED_EXACT'
                        ? 'border-emerald-200/70 bg-emerald-50/30'
                        : tx.matchingStatus === 'MATCHED_FUZZY'
                        ? 'border-amber-200/70 bg-amber-50/30'
                        : tx.matchingStatus === 'DISCREPANCY'
                        ? 'border-rose-200/70 bg-rose-50/30'
                        : 'border-slate-200/60 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {/* Checkbox for Bulk Account Assignment */}
                        {isPending && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectPendingTx(tx.id);
                            }}
                            className="pt-0.5 cursor-pointer shrink-0"
                            title="Seleccionar para asignación masiva"
                          >
                            <input
                              type="checkbox"
                              checked={isBulkSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {tx.referenceNum}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {tx.txDate}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 font-medium line-clamp-2">
                            {tx.rawDescription}
                          </p>
                          {tx.notes && (
                            <p className="text-[10px] text-emerald-800 font-medium mt-0.5 italic bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-100 line-clamp-1">
                              💡 {tx.notes}
                            </p>
                          )}
                          {tx.counterpartyRif && (
                            <span className="inline-block mt-1 font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              RIF: {tx.counterpartyRif}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-bold block ${
                          tx.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-800'
                        }`}>
                          {tx.txType === 'CREDIT' ? '+' : '-'}{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                        
                        {/* Status Badge */}
                        <div className="mt-1">
                          {tx.matchingStatus === 'MATCHED_EXACT' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Exacto (100%)
                            </span>
                          )}
                          {tx.matchingStatus === 'MATCHED_FUZZY' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Fuzzy ({Math.round((tx.matchScore || 0.9) * 100)}%)
                            </span>
                          )}
                          {tx.matchingStatus === 'DISCREPANCY' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              Variación ({sym} {tx.discrepancyAmount?.toFixed(2)})
                            </span>
                          )}
                          {tx.matchingStatus === 'UNMATCHED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              Pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alerta de discrepancia si no cuadra el monto */}
                    {tx.matchingStatus === 'DISCREPANCY' && (
                      <div className="mt-2 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-900 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Variación de {sym} {Math.abs(tx.discrepancyAmount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} con libros</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTransaction(tx);
                          }}
                          className="font-bold underline text-rose-800 hover:text-rose-950 cursor-pointer ml-1"
                        >
                          Ajustar →
                        </button>
                      </div>
                    )}

                    {/* Quick actions per card */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {tx.accountCode && (
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                            {tx.accountCode}
                          </span>
                        )}
                        <span className="text-slate-600 text-[11px] truncate" title={tx.accountName}>
                          {tx.accountName || 'Sin asignar'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {tx.matchingStatus === 'MATCHED_FUZZY' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmFuzzyMatch(tx.id);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                          >
                            Aprobar
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTransaction(tx);
                          }}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] cursor-pointer transition-colors"
                          title="Corregir monto, referencia, fecha o concepto"
                        >
                          <Pencil className="w-2.5 h-2.5 text-amber-600" />
                          <span>Corregir</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransactionInternal(tx.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Eliminar este movimiento"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransactionForModule(tx);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] hover:bg-slate-200 cursor-pointer"
                        >
                          Justificar →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Mayor General de Bancos */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[650px]">
          <div className="p-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border-b border-emerald-100 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Registro Contable Interno
              </span>
              <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                Mayor General de Bancos ({ledgerTxList.length} asientos)
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[11px] font-mono font-bold text-emerald-900 hidden sm:inline mr-1">
                Total: {sym} {ledgerTxList.reduce((acc, t) => acc + (t.txType === 'CREDIT' ? t.amountNominal : -t.amountNominal), 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
              {pendingLedgerTxList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allLedgerPendingSelected = pendingLedgerTxList.every(t => selectedPendingSet.has(t.id));
                    if (allLedgerPendingSelected) {
                      setSelectedPendingIds(prev => prev.filter(id => !pendingLedgerTxList.some(t => t.id === id)));
                    } else {
                      handleSelectAllPendingLedger();
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] border cursor-pointer transition-colors ${
                    pendingLedgerTxList.some(t => selectedPendingSet.has(t.id))
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                  title="Seleccionar todas las partidas pendientes de este libro para asignación contable masiva"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Sel. Pendientes ({pendingLedgerTxList.length})</span>
                </button>
              )}
              <button
                onClick={() => setIsWhatToTakeModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] cursor-pointer transition-colors"
                title="¿Qué datos debo tomar de mi Libro Contable?"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">¿Qué datos tomar?</span>
              </button>
              <button
                onClick={() => {
                  setUploadModalDefaultSource('LEDGER');
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                title="Cargar Libro Mayor desde archivo Excel (.xlsx, .xls) o CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>+ Excel/CSV</span>
              </button>
              <button
                onClick={() => setIsLedgerModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                title="Pegar texto del libro contable de banco (Mayor de Bancos)"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>+ Pegar Texto</span>
              </button>
              <button
                onClick={() => handleOpenCreateTransaction('LEDGER')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] border border-emerald-300 cursor-pointer transition-colors"
                title="Introducir un asiento contable manual faltante"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                <span>+ Asiento Manual</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {ledgerTxList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-4 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">¿Cómo cargar tu Libro Contable de Banco?</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Aquí se refleja tu contabilidad interna (asientos de banco registrados en Profit Plus, Gálac, Saint, SAP o tu Excel) para contrastarlos automáticamente contra el extracto bancario.
                  </p>
                </div>

                {/* Si hay asientos en otro banco, avisar al usuario para que no crea que se borraron */}
                {transactions.some(t => t.source === 'LEDGER') && selectedBank !== 'ALL' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1 max-w-xs mx-auto">
                    <p className="text-[11px] font-bold text-amber-900">
                      ¡Tienes asientos de libro mayor en otros bancos!
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedBank('ALL')}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Ver Todos los Bancos
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setUploadModalDefaultSource('LEDGER');
                      setIsUploadModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all w-full sm:w-auto justify-center"
                    title="Cargar Libro Mayor desde archivo Excel (.xlsx, .xls) o CSV"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Cargar Excel / CSV</span>
                  </button>

                  <button
                    onClick={() => setIsLedgerModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 cursor-pointer transition-all w-full sm:w-auto justify-center"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pegar Asientos de Texto</span>
                  </button>

                  {bankTxList.length > 0 && (
                    <button
                      onClick={handleAutoGenerateLedgerFromBank}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 cursor-pointer transition-all w-full sm:w-auto justify-center"
                      title="Crea asientos equivalentes en el Mayor a partir de tu extracto para probar la conciliación inmediatamente"
                    >
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Generar Asientos con IA desde Extracto</span>
                    </button>
                  )}
                </div>

                {onNavigateToAssistant && (
                  <button
                    onClick={() => onNavigateToAssistant('LEDGER')}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline block mx-auto cursor-pointer"
                  >
                    O abrir el Asistente IA Contable Completo (Modo Libro) →
                  </button>
                )}
              </div>
            ) : (
              ledgerTxList.map((tx) => {
                const isSelected = selectedLedgerId === tx.id;
                const isPending = tx.matchingStatus === 'UNMATCHED' || tx.matchingStatus === 'DISCREPANCY';
                const isBulkSelected = selectedPendingSet.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedLedgerId(isSelected ? null : tx.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isBulkSelected
                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-400/80 shadow-xs'
                        : isSelected
                        ? 'border-purple-400 bg-purple-50/50 ring-2 ring-purple-300'
                        : tx.matchingStatus === 'MATCHED_EXACT'
                        ? 'border-emerald-200/70 bg-emerald-50/30'
                        : tx.matchingStatus === 'MATCHED_FUZZY'
                        ? 'border-amber-200/70 bg-amber-50/30'
                        : tx.matchingStatus === 'DISCREPANCY'
                        ? 'border-rose-200/70 bg-rose-50/30'
                        : 'border-slate-200/60 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {/* Checkbox for Bulk Account Assignment */}
                        {isPending && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectPendingTx(tx.id);
                            }}
                            className="pt-0.5 cursor-pointer shrink-0"
                            title="Seleccionar para asignación masiva"
                          >
                            <input
                              type="checkbox"
                              checked={isBulkSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {tx.referenceNum}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {tx.txDate}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 font-medium line-clamp-2">
                            {tx.rawDescription}
                          </p>
                          {tx.notes && (
                            <p className="text-[10px] text-emerald-800 font-medium mt-0.5 italic bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-100 line-clamp-1">
                              💡 {tx.notes}
                            </p>
                          )}
                          {tx.accountCode && (
                            <span className="inline-block mt-1 font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Cta: {tx.accountCode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-bold block ${
                          tx.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-800'
                        }`}>
                          {tx.txType === 'CREDIT' ? '+' : '-'}{sym} {tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                        
                        <div className="mt-1">
                          {tx.matchingStatus === 'MATCHED_EXACT' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Conciliado
                            </span>
                          )}
                          {tx.matchingStatus === 'MATCHED_FUZZY' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Por Confirmar
                            </span>
                          )}
                          {tx.matchingStatus === 'DISCREPANCY' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              Diferencia
                            </span>
                          )}
                          {tx.matchingStatus === 'UNMATCHED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              En Tránsito
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alerta de discrepancia si no cuadra el monto */}
                    {tx.matchingStatus === 'DISCREPANCY' && (
                      <div className="mt-2 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-900 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Variación de {sym} {Math.abs(tx.discrepancyAmount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} con extracto</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTransaction(tx);
                          }}
                          className="font-bold underline text-rose-800 hover:text-rose-950 cursor-pointer ml-1"
                        >
                          Ajustar →
                        </button>
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <span className="text-slate-500 font-mono text-[10px] shrink-0">
                          ID: {tx.id.slice(-6)}
                        </span>
                        {tx.accountName && (
                          <span className="text-slate-600 text-[10px] truncate" title={tx.accountName}>
                            • {tx.accountName}
                          </span>
                        )}
                        {tx.matchedWithId && (
                          <span className="text-emerald-700 font-mono text-[10px] font-semibold shrink-0">
                            ↔ {tx.matchedWithId.slice(-6)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTransaction(tx);
                          }}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] cursor-pointer transition-colors"
                          title="Corregir monto, referencia, fecha o concepto del asiento"
                        >
                          <Pencil className="w-2.5 h-2.5 text-amber-600" />
                          <span>Corregir</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransactionInternal(tx.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Eliminar este asiento contable"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* MODAL DE CARGA RÁPIDA DE LIBRO CONTABLE DE BANCO */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cargar Asientos del Libro Mayor de Banco
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pega los movimientos contables registrados por la empresa (Profit Plus, Gálac, Saint, SAP o Excel).
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLedgerModalOpen(false);
                  setPreviewLedgerRows(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Banco del Mayor:</label>
                  <select
                    value={ledgerBankCode}
                    onChange={(e) => setLedgerBankCode(e.target.value)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
                  >
                    {VENEZUELAN_BANKS.map(b => (
                      <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleLoadSampleLedgerData}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                >
                  Pegar Asientos de Ejemplo
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pega aquí las filas de tu hoja de cálculo o reporte contable:
                </label>
                <textarea
                  rows={6}
                  value={ledgerPastedText}
                  onChange={(e) => setLedgerPastedText(e.target.value)}
                  placeholder={`Ejemplo con columnas de Excel:\n10/05/2024\tTRF-0019283\tCobro Factura 00412 Cliente\t45.000,00\t0,00\n11/05/2024\tCHQ-0004521\tPago Proveedor Materiales\t0,00\t18.250,00`}
                  className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-400 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Reconoce fechas (DD/MM/AAAA), números de comprobante o cheque/transferencia, descripciones y montos Debe / Haber.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleProcessQuickLedger}
                  disabled={isProcessingLedger || !ledgerPastedText.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessingLedger ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Analizar Filas</span>
                </button>
              </div>

              {/* Preview table if parsed */}
              {previewLedgerRows && (
                <div className="border border-emerald-200 rounded-2xl bg-emerald-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span>{previewLedgerRows.length} Asientos Identificados</span>
                    {ledgerStats && (
                      <span className="font-mono text-[11px] text-emerald-800">
                        Debe: {sym} {ledgerStats.totalDebe.toFixed(2)} | Haber: {sym} {ledgerStats.totalHaber.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 text-xs">
                    {previewLedgerRows.map((row, rIdx) => (
                      <div key={rIdx} className="p-2 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-bold text-slate-900">{row.referenceNum}</span>
                            <span className="text-slate-400">{row.txDate}</span>
                            <span className={`text-[10px] px-1 rounded ${row.txType === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-slate-100 text-slate-700'}`}>
                              {row.txType === 'CREDIT' ? 'Debe (+)' : 'Haber (-)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 truncate max-w-sm">{row.rawDescription}</p>
                        </div>
                        <span className={`font-mono font-bold text-xs ${row.txType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {row.txType === 'CREDIT' ? '+' : '-'}{sym} {row.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveQuickLedger}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Incorporar al Mayor General de Bancos</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ¿QUÉ DATOS TOMAR DEL LIBRO CONTABLE? */}
      {isWhatToTakeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    ¿Qué datos debo tomar de mi Libro Contable?
                  </h3>
                  <span className="text-[10px] text-slate-500">Guía práctica sin complicaciones técnicas</span>
                </div>
              </div>
              <button
                onClick={() => setIsWhatToTakeModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-900 block text-[13px]">
                  1. ¿De dónde saco esta información?
                </span>
                <p>
                  De tu sistema administrativo o contable (<strong>Profit Plus, Gálac, Saint, SAP, Valery</strong> o de tu hoja de <strong>Excel</strong>). Busca el reporte llamado <strong>"Mayor Analítico"</strong> o <strong>"Movimientos de la Cuenta Bancaria"</strong> (código contable <code>1.1.01.02.xxx</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="font-bold text-slate-900 block text-[13px]">
                  2. Las 5 columnas que necesitas copiar
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-800 block">Fecha:</strong>
                    <span className="text-slate-500">Día de la operación</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-800 block">Referencia:</strong>
                    <span className="text-slate-500">N° de cheque/transferencia</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-800 block">Concepto:</strong>
                    <span className="text-slate-500">Tercero o motivo</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <strong className="text-emerald-800 block">Debe (+):</strong>
                    <span className="text-emerald-600">Entradas / Cobros</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <strong className="text-rose-800 block">Haber (-):</strong>
                    <span className="text-rose-600">Salidas / Pagos</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5 text-amber-950">
                <span className="font-bold block text-[13px]">
                  3. ¿Debo cambiar mi Libro Contable por lo que diga el Banco?
                </span>
                <p className="text-[11px] leading-relaxed">
                  <strong>Sí para las comisiones, IGTF y cargos directos del banco:</strong> Como el banco ya debitó esos montos de tu dinero real, tu empresa debe elaborar un asiento contable de ajuste cargando a <em>Gastos Bancarios (6.1.04)</em> y abonando a <em>Banco (1.1.01)</em>.
                </p>
                <p className="text-[11px] leading-relaxed">
                  <strong>No para los cheques / transferencias y depósitos en tránsito:</strong> Esos están bien anotados en tus libros; simplemente el banco los liquidará después.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {onNavigateToResults && (
                <button
                  type="button"
                  onClick={() => {
                    setIsWhatToTakeModalOpen(false);
                    onNavigateToResults();
                  }}
                  className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                >
                  Ver Diagnóstico y Semáforo →
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsWhatToTakeModalOpen(false);
                    setIsLedgerModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Pegar Asientos de mi Libro Ahora
                </button>
                <button
                  type="button"
                  onClick={() => setIsWhatToTakeModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CARGA DE ARCHIVO: EXCEL (.XLSX, .XLS), CSV O PDF */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultSource={uploadModalDefaultSource}
        initialMode={uploadModalInitialMode}
        currency={currency}
        bcvRate={bcvRate}
        selectedBankCode={selectedBank !== 'ALL' ? selectedBank : '0134'}
        onImportComplete={handleImportFromFile}
      />

      {/* MODAL DE LIMPIAR Y REINICIAR CONCILIACIÓN */}
      <ClearReconciliationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        transactions={transactions}
        selectedBank={selectedBank}
        currency={currency}
        onConfirmClear={handleExecuteClear}
      />

      {/* MODAL DE INTRODUCIR / CORREGIR OPERACIONES */}
      <TransactionEditorModal
        isOpen={isTxEditorOpen}
        onClose={() => {
          setIsTxEditorOpen(false);
          setEditingTx(null);
        }}
        mode={txEditorMode}
        initialTransaction={editingTx}
        defaultSource={txEditorDefaultSource}
        defaultBankCode={selectedBank !== 'ALL' ? selectedBank : '0134'}
        currency={currency}
        bcvRate={bcvRate}
        companyId={company?.id}
        onSave={handleSaveTransactionInternal}
        onDelete={handleDeleteTransactionInternal}
      />

      {/* MODAL DE REGLAS DE CONTABILIDAD BANCARIA POR BANCO (BDV, MERCANTIL, PLAZA) */}
      <BankAccountingRulesModal
        isOpen={isBankRulesModalOpen}
        onClose={() => setIsBankRulesModalOpen(false)}
        transactions={transactions}
        currency={currency}
        company={company}
        initialBankCode={selectedBank !== 'ALL' ? selectedBank : '0102'}
        onUpdateTransactions={onUpdateTransactions}
      />

    </div>
  );
};
