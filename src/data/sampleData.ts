import { CompanyProfile, CompanyBankAccount, BankTransaction, CashLogRecord, CashFlowTraceItem } from '../types/accounting';

/**
 * Plantilla limpia inicial para que el usuario ingrese sus datos reales
 * Sin empresas ni cuentas bancarias ficticias o inventadas
 */
export const DEFAULT_CLEAN_COMPANY: CompanyProfile = {
  id: 'comp-principal',
  uid: 'default-user',
  companyName: 'Mi Empresa',
  companyRif: '',
  address: '',
  isSpecialTaxpayer: true,
  vatRetentionRate: 75,
  defaultCurrency: 'VES',
  bcvRate: 56.80,
  accountingSystemTarget: 'PROFIT',
  bankAccounts: [], // Lista vacía: el usuario agrega sus bancos reales
  createdAt: new Date().toISOString()
};

export const INITIAL_COMPANIES: CompanyProfile[] = [
  DEFAULT_CLEAN_COMPANY
];

export const DEFAULT_COMPANY_PROFILE = DEFAULT_CLEAN_COMPANY;

export const INITIAL_BANK_TRANSACTIONS: BankTransaction[] = [];
export const INITIAL_CASH_LOGS: CashLogRecord[] = [];
export const INITIAL_CASH_FLOW_TRACES: CashFlowTraceItem[] = [];
