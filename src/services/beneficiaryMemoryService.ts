/**
 * Servicio de Memoria Histórica de Beneficiarios en Venezuela
 * Guarda asociaciones entre RIF, Cédula, Teléfono de Pago Móvil o correo Zelle
 * y el repositorio contable habitual para autocompletar transferencias futuras sin fricción.
 */

export interface BeneficiaryMemoryEntry {
  identifier: string; // Normalizado: ej. "04141234567", "J123456789", "V12345678", "usuario@gmail.com"
  rawIdentifier: string;
  moduleTag: string; // ej. "MOD_PROVEEDORES", "MOD_CXC_SOCIOS", "MOD_VENTAS"
  beneficiaryName?: string;
  notes?: string;
  frequencyCount: number;
  lastUsedAt: string;
}

const STORAGE_KEY = 'nominus_beneficiary_memory';

/**
 * Normaliza un identificador venezolano (teléfono, RIF, cédula o correo)
 */
export function normalizeIdentifier(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Si es correo electrónico
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  // Si es número telefónico (Pago Móvil: 0414, 0424, 0412, 0416, 0426, o +58)
  const phoneClean = trimmed.replace(/\D/g, '');
  if (phoneClean.startsWith('58') && phoneClean.length === 12) {
    return '0' + phoneClean.slice(2);
  }
  if (phoneClean.length === 11 && phoneClean.startsWith('04')) {
    return phoneClean;
  }

  // Si es RIF o Cédula (V, J, E, G, P)
  const alphanumeric = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return alphanumeric;
}

/**
 * Obtiene toda la memoria de beneficiarios almacenada en localStorage
 */
export function getAllBeneficiaryMemory(): Record<string, BeneficiaryMemoryEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (err) {
    console.warn('Error leyendo memoria de beneficiarios:', err);
    return {};
  }
}

/**
 * Consulta si un beneficiario ya tiene un repositorio histórico asociado
 */
export function getBeneficiaryRepository(identifier: string): BeneficiaryMemoryEntry | null {
  if (!identifier) return null;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const memory = getAllBeneficiaryMemory();
  return memory[normalized] || null;
}

/**
 * Aprende y actualiza la asociación de un beneficiario con su repositorio contable
 */
export function learnBeneficiaryRepository(
  identifier: string,
  moduleTag: string,
  beneficiaryName?: string,
  notes?: string
): void {
  if (!identifier || !moduleTag) return;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;

  if (typeof localStorage === 'undefined') return;

  try {
    const memory = getAllBeneficiaryMemory();
    const existing = memory[normalized];

    memory[normalized] = {
      identifier: normalized,
      rawIdentifier: identifier,
      moduleTag,
      beneficiaryName: beneficiaryName || existing?.beneficiaryName || '',
      notes: notes || existing?.notes || '',
      frequencyCount: (existing?.frequencyCount || 0) + 1,
      lastUsedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch (err) {
    console.warn('Error guardando en memoria de beneficiarios:', err);
  }
}

/**
 * Elimina una entrada de la memoria de beneficiarios
 */
export function removeBeneficiaryMemory(identifier: string): void {
  if (!identifier || typeof localStorage === 'undefined') return;
  const normalized = normalizeIdentifier(identifier);
  const memory = getAllBeneficiaryMemory();
  if (memory[normalized]) {
    delete memory[normalized];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  }
}
