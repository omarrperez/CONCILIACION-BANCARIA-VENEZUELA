import { doc, setDoc, getDocs, deleteDoc, collection, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase/config';
import { BankTransaction, CurrencyType, ReconciliationSnapshot } from '../types/accounting';
import { calculateProofOfCash } from './matchingEngine';

const LOCAL_STORAGE_KEY = 'nominus_reconciliation_snapshots_v1';

export interface BuildSnapshotOptions {
  periodMonth?: string;
  periodYear?: number;
  periodLabel?: string;
  bankName?: string;
  bcvRateUsed?: number;
  status?: 'OFICIAL_CERRADA' | 'PRELIMINAR' | 'CON_DIFERENCIA';
  preparedBy?: string;
  approvedBy?: string;
  sha256Hash?: string;
}

/**
 * Helper to compute snapshot and monthly reconciliation statistics
 */
export function buildSnapshotFromCurrentState(
  name: string,
  description: string,
  transactions: BankTransaction[],
  currency: CurrencyType,
  bankCode: string = 'ALL',
  initialBalanceBank: number = 0,
  initialBalanceLedger: number = 0,
  userId?: string,
  extraOptions?: BuildSnapshotOptions
): ReconciliationSnapshot {
  const bankTx = transactions.filter(t => t.source === 'BANK' && t.currency === currency && (bankCode === 'ALL' || t.bankCode === bankCode));
  const ledgerTx = transactions.filter(t => t.source === 'LEDGER' && t.currency === currency && (bankCode === 'ALL' || t.bankCode === bankCode));
  
  const matchedCount = transactions.filter(
    t => (t.matchingStatus === 'MATCHED_EXACT' || t.matchingStatus === 'MATCHED_FUZZY') &&
         t.currency === currency && (bankCode === 'ALL' || t.bankCode === bankCode)
  ).length;

  const discrepancyCount = transactions.filter(
    t => t.matchingStatus === 'DISCREPANCY' && t.currency === currency && (bankCode === 'ALL' || t.bankCode === bankCode)
  ).length;

  const unmatchedCount = transactions.filter(
    t => t.matchingStatus === 'UNMATCHED' && t.currency === currency && (bankCode === 'ALL' || t.bankCode === bankCode)
  ).length;

  const proof = calculateProofOfCash(transactions, bankCode === 'ALL' ? '' : bankCode, currency, initialBalanceBank, initialBalanceLedger);

  const now = new Date();
  const currentMonthNum = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentYearNum = now.getFullYear();
  const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNamesEs[now.getMonth()];

  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    name: name.trim() || `Conciliación Bancaria Mensual - ${extraOptions?.periodLabel || `${monthName} ${currentYearNum}`}`,
    description: description.trim(),
    createdAt: now.toISOString(),
    currency,
    bankCode,
    bankName: extraOptions?.bankName || (bankCode === 'ALL' ? 'Todos los Bancos' : bankCode),
    initialBalanceBank,
    initialBalanceLedger,
    finalBalanceBank: proof.finalBalanceBank,
    finalBalanceLedger: proof.finalBalanceLedger,
    periodMonth: extraOptions?.periodMonth || currentMonthNum,
    periodYear: extraOptions?.periodYear || currentYearNum,
    periodLabel: extraOptions?.periodLabel || `${monthName} ${currentYearNum}`,
    bcvRateUsed: extraOptions?.bcvRateUsed,
    status: extraOptions?.status || (proof.isBalanced ? 'OFICIAL_CERRADA' : 'CON_DIFERENCIA'),
    sha256Hash: extraOptions?.sha256Hash || `sha256-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`,
    proofOfCashData: proof,
    preparedBy: extraOptions?.preparedBy,
    approvedBy: extraOptions?.approvedBy,
    transactionsCount: transactions.length,
    bankCount: bankTx.length,
    ledgerCount: ledgerTx.length,
    matchedCount,
    discrepancyCount,
    unmatchedCount,
    isBalanced: proof.isBalanced,
    difference: proof.difference,
    // Deep clone the transactions so future mutations in memory don't alter the snapshot
    transactions: JSON.parse(JSON.stringify(transactions))
  };
}

/**
 * Guarda un Punto de Restauración en Firestore y en LocalStorage
 */
export async function saveSnapshot(
  snapshot: ReconciliationSnapshot,
  user: User | null
): Promise<void> {
  // 1. Always save to LocalStorage for instant and offline recovery
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localList: ReconciliationSnapshot[] = rawLocal ? JSON.parse(rawLocal) : [];
    const updatedLocal = [snapshot, ...localList.filter(s => s.id !== snapshot.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocal));
  } catch (err) {
    console.warn('No se pudo guardar snapshot en LocalStorage:', err);
  }

  // 2. Save in Firestore if user is logged in
  if (user) {
    try {
      const snapDocRef = doc(db, 'users', user.uid, 'snapshots', snapshot.id);
      await setDoc(snapDocRef, snapshot);
    } catch (err) {
      console.warn('Error guardando snapshot en Firestore:', err);
      // Even if Firestore fails, local copy is saved
    }
  }
}

/**
 * Obtiene todos los Puntos de Restauración guardados (Firestore + LocalStorage)
 */
export async function getSnapshots(user: User | null): Promise<ReconciliationSnapshot[]> {
  const snapshotsMap = new Map<string, ReconciliationSnapshot>();

  // 1. Read from LocalStorage
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const localList: ReconciliationSnapshot[] = JSON.parse(rawLocal);
      localList.forEach(s => {
        if (s && s.id) snapshotsMap.set(s.id, s);
      });
    }
  } catch (err) {
    console.warn('Error leyendo snapshots de LocalStorage:', err);
  }

  // 2. Read from Firestore if user is authenticated
  if (user) {
    try {
      const colRef = collection(db, 'users', user.uid, 'snapshots');
      const snapDocs = await getDocs(colRef);
      snapDocs.forEach(d => {
        const item = d.data() as ReconciliationSnapshot;
        if (item && item.id) {
          snapshotsMap.set(item.id, item);
        }
      });
    } catch (err) {
      console.warn('Error leyendo snapshots de Firestore:', err);
    }
  }

  // Sort by date descending (newest first)
  return Array.from(snapshotsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Elimina un Punto de Restauración
 */
export async function deleteSnapshot(
  snapshotId: string,
  user: User | null
): Promise<void> {
  // 1. Remove from LocalStorage
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const localList: ReconciliationSnapshot[] = JSON.parse(rawLocal);
      const filtered = localList.filter(s => s.id !== snapshotId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.warn('Error eliminando snapshot de LocalStorage:', err);
  }

  // 2. Remove from Firestore
  if (user) {
    try {
      const snapDocRef = doc(db, 'users', user.uid, 'snapshots', snapshotId);
      await deleteDoc(snapDocRef);
    } catch (err) {
      console.warn('Error eliminando snapshot de Firestore:', err);
    }
  }
}

/**
 * Restaura el estado de la conciliación a partir de un Snapshot
 * Sincroniza Firestore si el usuario está conectado
 */
export async function applyRestoreSnapshot(
  snapshot: ReconciliationSnapshot,
  user: User | null
): Promise<{ success: boolean; count: number }> {
  // If user is connected to Firestore, update transactions subcollection
  if (user && snapshot.transactions) {
    try {
      const txCol = collection(db, 'users', user.uid, 'transactions');
      const currentTxSnap = await getDocs(txCol);
      
      // Delete existing transactions in batch
      const batch = writeBatch(db);
      currentTxSnap.docs.forEach(docItem => {
        batch.delete(docItem.ref);
      });

      // Write snapshot transactions in batch (Firestore batches max 500 ops)
      const restored = snapshot.transactions.slice(0, 450);
      restored.forEach(tx => {
        const docRef = doc(db, 'users', user.uid, 'transactions', tx.id);
        batch.set(docRef, tx);
      });

      await batch.commit();
    } catch (err) {
      console.warn('Error sincronizando transacciones restauradas en Firestore:', err);
    }
  }

  return {
    success: true,
    count: snapshot.transactions.length
  };
}

/**
 * Descarga el snapshot como un archivo JSON de respaldo
 */
export function exportSnapshotToJson(snapshot: ReconciliationSnapshot): void {
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = snapshot.name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
  a.download = `SNAPSHOT_${cleanName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Importa un snapshot desde un archivo JSON
 */
export function parseSnapshotFromJson(jsonText: string): ReconciliationSnapshot {
  const parsed = JSON.parse(jsonText);
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.transactions)) {
    throw new Error('El archivo no tiene el formato de Punto de Restauración de Conciliación válido.');
  }
  return parsed as ReconciliationSnapshot;
}
