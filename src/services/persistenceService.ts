import { BankTransaction, CompanyProfile } from '../types/accounting';
import { INITIAL_COMPANIES, INITIAL_BANK_TRANSACTIONS } from '../data/sampleData';

const TX_KEY = 'nominus_active_transactions_v3';
const COMP_KEY = 'nominus_active_companies_v3';
const BAL_KEY = 'nominus_active_balances_v3';

// Clean out dummy test companies/transactions if present
const filterOutDummyItems = (items: BankTransaction[]): BankTransaction[] => {
  return items.filter(t => {
    if (!t || !t.id) return false;
    const isDummy =
      t.companyId === 'comp-san-jose' ||
      t.companyId === 'comp-dist-caracas' ||
      t.bankAccountId === 'bank-101' ||
      (t as any).accountNumber === '0134-0102-33-0100123456' ||
      t.referenceNum === '0019283';
    return !isDummy;
  });
};

const filterOutDummyCompanies = (comps: CompanyProfile[]): CompanyProfile[] => {
  return comps.filter(c => {
    if (!c || !c.id) return false;
    const isDummy =
      c.id === 'comp-san-jose' ||
      c.id === 'comp-dist-caracas' ||
      c.companyName?.includes('Comercializadora San José') ||
      c.companyName?.includes('Distribuidora Industrial Caracas') ||
      c.companyRif === 'J-31234567-8' ||
      c.companyRif === 'J-40987654-3';
    return !isDummy;
  });
};

export const loadLocalTransactions = (): BankTransaction[] => {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return filterOutDummyItems(parsed);
      }
    }
  } catch (err) {
    console.warn('Error al cargar transacciones locales de localStorage:', err);
  }
  return filterOutDummyItems(INITIAL_BANK_TRANSACTIONS);
};

export const saveLocalTransactions = (txs: BankTransaction[]) => {
  try {
    const cleaned = filterOutDummyItems(txs);
    localStorage.setItem(TX_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Error al guardar transacciones en localStorage:', err);
  }
};

export const loadLocalCompanies = (): CompanyProfile[] => {
  try {
    const raw = localStorage.getItem(COMP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = filterOutDummyCompanies(parsed);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch (err) {
    console.warn('Error al cargar empresas locales de localStorage:', err);
  }
  return filterOutDummyCompanies(INITIAL_COMPANIES);
};

export const saveLocalCompanies = (comps: CompanyProfile[]) => {
  try {
    const cleaned = filterOutDummyCompanies(comps);
    localStorage.setItem(COMP_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Error al guardar empresas en localStorage:', err);
  }
};

export const loadLocalBalances = (): { initialBalanceBank: number; initialBalanceLedger: number } => {
  try {
    const raw = localStorage.getItem(BAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        initialBalanceBank: typeof parsed.initialBalanceBank === 'number' ? parsed.initialBalanceBank : 0,
        initialBalanceLedger: typeof parsed.initialBalanceLedger === 'number' ? parsed.initialBalanceLedger : 0
      };
    }
  } catch (err) {
    console.warn('Error al cargar saldos locales de localStorage:', err);
  }
  return { initialBalanceBank: 0, initialBalanceLedger: 0 };
};

export const saveLocalBalances = (initialBalanceBank: number, initialBalanceLedger: number) => {
  try {
    localStorage.setItem(
      BAL_KEY,
      JSON.stringify({ initialBalanceBank, initialBalanceLedger })
    );
  } catch (err) {
    console.warn('Error al guardar saldos locales en localStorage:', err);
  }
};

/**
 * Fusiona transacciones existentes con transacciones recibidas de Firestore
 * preservando todas las modificaciones locales sin perder información ni borrar items.
 */
export const mergeTransactionsList = (
  localList: BankTransaction[],
  remoteList: BankTransaction[]
): BankTransaction[] => {
  const map = new Map<string, BankTransaction>();

  // Cargar primero remotas
  remoteList.forEach(t => {
    if (t && t.id) map.set(t.id, t);
  });

  // Sobrescribir / agregar locales (prevalece trabajo local reciente)
  localList.forEach(t => {
    if (t && t.id) map.set(t.id, t);
  });

  return filterOutDummyItems(Array.from(map.values()));
};
