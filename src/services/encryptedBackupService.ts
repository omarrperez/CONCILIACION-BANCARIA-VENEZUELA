import {
  BankTransaction,
  CompanyProfile,
  CurrencyType,
  DigitalSupportAttachment,
  CashLogRecord,
  CashFlowTraceItem
} from '../types/accounting';

export interface NominusDatabasePayload {
  version: string;
  createdAt: string;
  sourceSystem: string;
  company: CompanyProfile;
  companies: CompanyProfile[];
  transactions: BankTransaction[];
  currency: CurrencyType;
  bcvRate: number;
  initialBalanceBank: number;
  initialBalanceLedger: number;
  digitalSupports?: DigitalSupportAttachment[];
  cashLogs?: CashLogRecord[];
  cashTraces?: CashFlowTraceItem[];
  metadata: {
    exportedBy?: string;
    totalTransactions: number;
    bankTransactionsCount: number;
    ledgerTransactionsCount: number;
    matchedTransactionsCount: number;
    unmatchedTransactionsCount: number;
    activeCompanyRif?: string;
    activeCompanyName?: string;
  };
}

export interface EncryptedBackupEnvelope {
  format: 'NOMINUS_ENCRYPTED_BACKUP';
  version: '2.0';
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2';
  kdfHash: 'SHA-256';
  iterations: number;
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  exportedAt: string;
  summary: {
    companyName: string;
    companyRif?: string;
    totalTransactions: number;
    currency: string;
    bcvRate: number;
  };
}

// Conversiones seguras ArrayBuffer <-> Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Deriva una clave AES-GCM-256 utilizando PBKDF2 y 100,000 iteraciones
 */
async function deriveEncryptionKey(password: string, salt: Uint8Array, iterations: number = 100000): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra la base de datos completa de conciliación a un paquete JSON seguro
 */
export async function createEncryptedDatabaseBackup(
  payload: NominusDatabasePayload,
  password: string
): Promise<EncryptedBackupEnvelope> {
  if (!password || password.trim().length < 6) {
    throw new Error('La contraseña de seguridad debe contener al menos 6 caracteres.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100000;

  const key = await deriveEncryptionKey(password, salt, iterations);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    plaintext
  );

  const envelope: EncryptedBackupEnvelope = {
    format: 'NOMINUS_ENCRYPTED_BACKUP',
    version: '2.0',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2',
    kdfHash: 'SHA-256',
    iterations,
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    exportedAt: new Date().toISOString(),
    summary: {
      companyName: payload.company.companyName || 'Empresa',
      companyRif: payload.company.companyRif || undefined,
      totalTransactions: payload.transactions.length,
      currency: payload.currency,
      bcvRate: payload.bcvRate
    }
  };

  return envelope;
}

/**
 * Descifra e inspecciona un paquete de copia de seguridad cifrado
 */
export async function decryptDatabaseBackup(
  encryptedJsonString: string,
  password: string
): Promise<NominusDatabasePayload> {
  if (!password || password.trim().length === 0) {
    throw new Error('Debes ingresar la contraseña de seguridad para descifrar.');
  }

  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(encryptedJsonString);
  } catch {
    throw new Error('El archivo seleccionado no es un formato JSON válido.');
  }

  if (envelope.format !== 'NOMINUS_ENCRYPTED_BACKUP' || !envelope.ciphertext || !envelope.salt || !envelope.iv) {
    throw new Error('El archivo no corresponde a una copia de seguridad cifrada válida de Nominus.');
  }

  const saltBuffer = base64ToArrayBuffer(envelope.salt);
  const ivBuffer = base64ToArrayBuffer(envelope.iv);
  const ciphertextBuffer = base64ToArrayBuffer(envelope.ciphertext);

  const key = await deriveEncryptionKey(password, new Uint8Array(saltBuffer), envelope.iterations || 100000);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer)
      },
      key,
      ciphertextBuffer
    );
  } catch {
    throw new Error('Contraseña incorrecta o el archivo de seguridad ha sido modificado.');
  }

  const decoder = new TextDecoder();
  const jsonText = decoder.decode(decryptedBuffer);

  const payload: NominusDatabasePayload = JSON.parse(jsonText);
  if (!Array.isArray(payload.transactions) || !payload.company) {
    throw new Error('Los datos descifrados no contienen una estructura contable válida.');
  }

  return payload;
}

/**
 * Descarga el archivo JSON cifrado localmente en el navegador
 */
export function downloadEncryptedBackupFile(envelope: EncryptedBackupEnvelope): void {
  const jsonStr = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const compClean = (envelope.summary.companyName || 'EMPRESA').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 20);
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `NOMINUS_BACKUP_CIFRADO_${compClean}_${dateStr}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
