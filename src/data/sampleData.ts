import { CompanyProfile, CompanyBankAccount, BankTransaction, CashLogRecord, CashFlowTraceItem } from '../types/accounting';

export const SAMPLE_COMPANY_BANKS_1: CompanyBankAccount[] = [
  {
    id: 'bank-101',
    companyId: 'comp-san-jose',
    bankCode: '0134',
    bankName: 'Banesco Banco Universal',
    accountNumber: '0134-0102-33-0100123456',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: 15420.50,
    initialBalanceLedger: 15420.50,
    isActive: true,
    notes: 'Cuenta Principal Operativa VES'
  },
  {
    id: 'bank-102',
    companyId: 'comp-san-jose',
    bankCode: '0105',
    bankName: 'Mercantil Banco Universal',
    accountNumber: '0105-0012-44-0100654321',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: 8750.00,
    initialBalanceLedger: 8750.00,
    isActive: true,
    notes: 'Recaudación Punto de Venta'
  },
  {
    id: 'bank-103',
    companyId: 'comp-san-jose',
    bankCode: '0102',
    bankName: 'Banco de Venezuela (BDV)',
    accountNumber: '0102-0501-12-0000987654',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: 24100.30,
    initialBalanceLedger: 24100.30,
    isActive: true,
    notes: 'Nómina y Pago Móvil BDV'
  },
  {
    id: 'bank-104',
    companyId: 'comp-san-jose',
    bankCode: '0172',
    bankName: 'Bancamiga Banco Microfinanciero',
    accountNumber: '0172-0110-88-0200112233',
    accountType: 'MONEDA_EXTRANJERA_USD',
    currency: 'USD',
    initialBalanceBank: 1250.00,
    initialBalanceLedger: 1250.00,
    isActive: true,
    notes: 'Cuenta Custodia Divisas USD Convenio 1'
  }
];

export const SAMPLE_COMPANY_BANKS_2: CompanyBankAccount[] = [
  {
    id: 'bank-201',
    companyId: 'comp-dist-caracas',
    bankCode: '0108',
    bankName: 'BBVA Banco Provincial',
    accountNumber: '0108-0055-22-0100334455',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: 45000.00,
    initialBalanceLedger: 45000.00,
    isActive: true,
    notes: 'Cuenta Pagos Proveedores'
  },
  {
    id: 'bank-202',
    companyId: 'comp-dist-caracas',
    bankCode: '0191',
    bankName: 'Banco Nacional de Crédito (BNC)',
    accountNumber: '0191-0020-77-0100556677',
    accountType: 'CORRIENTE',
    currency: 'VES',
    initialBalanceBank: 18300.00,
    initialBalanceLedger: 18300.00,
    isActive: true,
    notes: 'Liquidación BioPago BNC'
  }
];

export const INITIAL_COMPANIES: CompanyProfile[] = [
  {
    id: 'comp-san-jose',
    uid: 'default-user',
    companyName: 'Comercializadora San José, C.A.',
    companyRif: 'J-31234567-8',
    address: 'Av. Francisco de Miranda, Edif. Galipán, Chacao, Caracas',
    isSpecialTaxpayer: true,
    vatRetentionRate: 75,
    defaultCurrency: 'VES',
    bcvRate: 56.80,
    accountingSystemTarget: 'PROFIT',
    bankAccounts: SAMPLE_COMPANY_BANKS_1,
    createdAt: new Date().toISOString()
  },
  {
    id: 'comp-dist-caracas',
    uid: 'default-user',
    companyName: 'Distribuidora Industrial Caracas, C.A.',
    companyRif: 'J-40987654-3',
    address: 'Zona Industrial La Yaguara, Calle Principal, Caracas',
    isSpecialTaxpayer: false,
    vatRetentionRate: 75,
    defaultCurrency: 'VES',
    bcvRate: 56.80,
    accountingSystemTarget: 'SGT',
    bankAccounts: SAMPLE_COMPANY_BANKS_2,
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_COMPANY_PROFILE = INITIAL_COMPANIES[0];

export const INITIAL_BANK_TRANSACTIONS: BankTransaction[] = [];
export const INITIAL_CASH_LOGS: CashLogRecord[] = [];
export const INITIAL_CASH_FLOW_TRACES: CashFlowTraceItem[] = [];
