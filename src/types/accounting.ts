export type CurrencyType = 'VES' | 'USD';

export type TransactionSource = 'BANK' | 'LEDGER';

export type TransactionType = 'CREDIT' | 'DEBIT';

export type MatchingStatus = 'MATCHED_EXACT' | 'MATCHED_FUZZY' | 'DISCREPANCY' | 'UNMATCHED';

export interface BankTransaction {
  id: string;
  userId?: string;
  companyId?: string;
  bankAccountId?: string;
  source: TransactionSource;
  bankCode: string; // e.g. '0134' Banesco, '0105' Mercantil, '0102' BDV, '0191' BNC, '0172' Bancamiga
  bankName: string;
  referenceNum: string;
  txDate: string; // YYYY-MM-DD
  txType: TransactionType;
  amountNominal: number;
  currency: CurrencyType;
  bcvRate: number;
  amountVes: number;
  rawDescription: string;
  counterpartyRif?: string;
  counterpartyName?: string;
  referenceLast4?: string;
  amountUsdEquivalent?: number;
  counterpartyPhoneOrId?: string;
  accountCode?: string;
  accountName?: string;
  matchingStatus: MatchingStatus;
  matchedWithId?: string;
  matchScore?: number; // 0 to 1
  moduleTag?: string; // One of the 15 modules
  autoReconciledBy?: 'EXACT_SUPPORT' | 'AUTO_BANK_FEE' | 'INTERNAL_TRANSFER' | 'BENEFICIARY_MEMORY' | 'MANUAL';
  retentionVatRate?: number; // 0.75 or 1.00
  retentionVatAmount?: number;
  retentionIslrAmount?: number;
  discrepancyAmount?: number;
  notes?: string;
  attachments?: DigitalSupportAttachment[];
  sha256Hash?: string;
  createdAt: string;
  telegramMessageId?: number;
  telegramChatId?: number | string;
  telegramAudioContext?: string;
}

export interface DigitalSupportAttachment {
  id: string;
  name: string;
  fileType: 'IMAGE' | 'PDF';
  dataUrl: string; // Base64 or object URL
  sizeBytes: number;
  uploadedAt: string;
  sha256Hash?: string;
  notes?: string;
  txId?: string; // Tied to specific transaction
  moduleTag?: string; // Tied to category
  extractedMetadata?: {
    banco_origen?: string;
    banco_destino?: string;
    tipo_operacion?: string;
    moneda?: 'VES' | 'USD';
    monto?: number;
    monto_usd_equivalente?: number;
    referencia_completa?: string;
    referencia_ultimos_4?: string;
    fecha?: string;
    identificador_tercero?: string;
    nombre_tercero?: string;
    concepto_detectado?: string;
    repositorio_sugerido?: string;
    audioContext?: string;
  };
}

export interface VenNifAccount {
  code: string;
  name: string;
  category: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESOS' | 'COSTOS' | 'GASTOS';
  nature: 'DEUDORA' | 'ACREEDORA';
  description: string;
}

export interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  debe: number;
  haber: number;
  rif?: string;
  concept: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalEntryLine[];
  totalDebe: number;
  totalHaber: number;
  isBalanced: boolean;
  moduleTag: string;
}

export interface ProofOfCash {
  period: string;
  bankCode: string;
  currency: CurrencyType;
  // 4 columns balance
  initialBalanceBank: number;
  inflowsBank: number;
  outflowsBank: number;
  finalBalanceBank: number;
  initialBalanceLedger: number;
  inflowsLedger: number;
  outflowsLedger: number;
  finalBalanceLedger: number;
  // Reconciling items
  depositsInTransit: number;
  outstandingChecks: number;
  unrecordedCredits: number;
  unrecordedDebits: number;
  reconciledBank: number;
  reconciledLedger: number;
  difference: number;
  isBalanced: boolean;
}

export interface ReconciliationSnapshot {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  createdAt: string;
  currency: CurrencyType;
  bankCode?: string;
  bankName?: string;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  finalBalanceBank?: number;
  finalBalanceLedger?: number;
  periodMonth?: string; // e.g. "01", "02", ..., "12"
  periodYear?: number;  // e.g. 2026
  periodLabel?: string; // e.g. "Enero 2026"
  bcvRateUsed?: number;
  status?: 'OFICIAL_CERRADA' | 'PRELIMINAR' | 'CON_DIFERENCIA';
  sha256Hash?: string;
  proofOfCashData?: ProofOfCash;
  preparedBy?: string;
  approvedBy?: string;
  transactionsCount: number;
  bankCount: number;
  ledgerCount: number;
  matchedCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
  isBalanced: boolean;
  difference: number;
  transactions: BankTransaction[];
}

export type MonthlyReconciliationRecord = ReconciliationSnapshot;

export type PaymentChannel =
  | 'TRANSFERENCIA_BANCARIA'
  | 'PAGO_MOVIL'
  | 'PUNTO_DE_VENTA'
  | 'BIO_PAGO'
  | 'TARJETA_DEBITO_CREDITO'
  | 'DIVISAS_CONVENIO_1'
  | 'EFECTIVO_FISICO';

export interface JustificationSeniat {
  isJustified: boolean;
  invoiceNumber?: string;
  invoiceControlNumber?: string;
  vatRetentionAmount?: number;
  vatRetentionVoucher?: string;
  islrRetentionAmount?: number;
  igtfAmount?: number;
  taxableBase?: number;
  notes?: string;
}

export interface JustificationBank {
  isJustified: boolean;
  amlDeclaredOrigin: string;
  contractOrOrderRef?: string;
  sudebanRiskTier: 'BAJO' | 'MEDIO' | 'ALTO';
  complianceSignedBy: string;
  sha256Proof: string;
  verifiedAt: string;
}

export interface CashFlowTraceItem {
  id: string;
  userId?: string;
  date: string;
  time?: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  channel: PaymentChannel;
  referenceNum: string;
  direction: 'ENTRADA' | 'SALIDA';
  amount: number;
  currency: CurrencyType;
  bcvRate: number;
  amountVes: number;
  counterpartyName: string;
  counterpartyRif: string;
  concept: string;
  matchingStatus: 'CONCILIADO' | 'PENDIENTE' | 'OBSERVADO';
  justificationSeniat: JustificationSeniat;
  justificationBank: JustificationBank;
  createdAt: string;
}

export interface CashDenominationCount {
  denomination: number;
  count: number;
  total: number;
}

export interface PettyCashExpenseItem {
  id: string;
  concept: string; // e.g. "Agua potable", "Resma de papel", "Timbre fiscal", "Pasaje empleado"
  amount: number;
  category?: string;
  receiptNum?: string;
}

export interface CashLogRecord {
  id: string;
  userId?: string;
  date: string;
  currency: CurrencyType;
  cashier: string;
  shift: string;
  initialBalance: number;
  totalSales: number;
  pettyCashExpenses: number;
  expenseItems?: PettyCashExpenseItem[];
  expectedTotal: number;
  physicalCount: number;
  difference: number; // physical - expected
  billsDetails: CashDenominationCount[];
  usdSerialNumbers: string[]; // SUDEBAN AML traceability
  bankDepositRef?: string;
  bankTarget?: string;
  depositStatus: 'EN_CAJA' | 'PLANILLA_DESPACHO' | 'CONFIRMADO_BANCO';
  dispatchSlipId?: string;
  notes?: string;
  createdAt: string;
}

export interface CompanyBankAccount {
  id: string;
  companyId: string;
  bankCode: string; // e.g. '0134' Banesco, '0105' Mercantil, '0102' BDV, '0191' BNC, '0172' Bancamiga
  bankName: string; // e.g. 'Banesco Banco Universal'
  accountNumber: string; // 20-digit format e.g. '0134-0123-45-6789012345'
  accountType: 'CORRIENTE' | 'AHORRO' | 'MONEDA_EXTRANJERA_USD' | 'CUSTODIA';
  currency: CurrencyType;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  isActive: boolean;
  notes?: string;
}

export interface CompanyProfile {
  id: string;
  uid?: string;
  email?: string;
  companyName: string;
  companyRif: string; // e.g. J-12345678-9
  address: string;
  isSpecialTaxpayer: boolean; // Sujeto Pasivo Especial
  vatRetentionRate: number; // 75 or 100
  defaultCurrency: CurrencyType;
  bcvRate: number;
  accountingSystemTarget: 'SGT' | 'PROFIT' | 'GALAC' | 'SAINT' | 'VALERY' | 'EXCEL_VEN_NIF';
  bankAccounts: CompanyBankAccount[];
  createdAt: string;
  updatedAt?: string;
}

export interface UserCompanyProfile extends CompanyProfile {
  bankAccountBanesco?: string;
  bankAccountMercantil?: string;
  bankAccountBDV?: string;
  initialBalanceBank?: number;
  initialBalanceLedger?: number;
}

export interface AuditVaultItem {
  id: string;
  userId?: string;
  documentType: 'FACTURA_VENTA' | 'FACTURA_COMPRA' | 'COMPROBANTE_RETENCION' | 'CONTRATO_MUTUO' | 'CONTRATO_COMISION' | 'PLANILLA_DEPOSITO' | 'ESTADO_CUENTA';
  title: string;
  sha256Hash: string;
  relatedReference: string;
  counterpartyRif: string;
  amount: number;
  currency: CurrencyType;
  date: string;
  notes: string;
  createdAt: string;
}

export interface ComplianceDossier {
  id: string;
  transactionRef: string;
  bankName: string;
  amount: number;
  currency: CurrencyType;
  txDate: string;
  rif: string;
  partyName: string;
  operationType: string;
  originOfFundsDeclared: string;
  contractRef?: string;
  invoiceRef?: string;
  riskRating: 'BAJO' | 'MEDIO' | 'ALTO';
  sha256Proof: string;
  verifiedAt: string;
}
