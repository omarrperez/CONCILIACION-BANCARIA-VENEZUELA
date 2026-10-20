/**
 * Servicio de Tasa de Cambio Oficial BCV (Banco Central de Venezuela)
 * Conexión gratuita con la API pública de dolarapi.com
 */

export interface BcvApiResponse {
  fuente: string;
  nombre: string;
  promedio: number;
  fechaActualizacion: string;
}

const DOLAR_API_PRIMARY = 'https://ve.dolarapi.com/v1/dolares/oficial';
const DOLAR_API_SECONDARY = 'https://pydolarve.org/api/v1/dollar?page=bcv';
const EXCHANGE_RATE_TERTIARY = 'https://open.er-api.com/v6/latest/USD';

const STORAGE_KEY_RATE = 'nominus_bcv_official_rate';
const STORAGE_KEY_DATE = 'nominus_bcv_last_updated';
const STORAGE_KEY_SOURCE = 'nominus_bcv_source';

/**
 * Consulta la tasa oficial del Banco Central de Venezuela en tiempo real con redundancia multi-servidor
 */
export async function fetchLiveBcvRate(): Promise<{
  rate: number;
  lastUpdated: string;
  source: string;
  isLive: boolean;
}> {
  // 1. Intentar API Principal: DolarApi Ve
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(DOLAR_API_PRIMARY, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.promedio === 'number' && data.promedio > 20) {
        const rate = Number(data.promedio.toFixed(4));
        const lastUpdated = data.fechaActualizacion || new Date().toISOString();
        const source = 'Banco Central de Venezuela (BCV vía DolarApi.com)';

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_RATE, rate.toString());
          localStorage.setItem(STORAGE_KEY_DATE, lastUpdated);
          localStorage.setItem(STORAGE_KEY_SOURCE, source);
        }

        return { rate, lastUpdated, source, isLive: true };
      }
    }
  } catch (err) {
    console.warn('API DolarApi no disponible, intentando servidor secundario PyDolarVe...', err);
  }

  // 2. Intentar API Secundaria: PyDolarVe
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(DOLAR_API_SECONDARY, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      let rate = 0;
      if (data && typeof data.promedio === 'number' && data.promedio > 20) {
        rate = data.promedio;
      } else if (data && data.monedas && data.monedas.usd && typeof data.monedas.usd.promedio === 'number') {
        rate = data.monedas.usd.promedio;
      }

      if (rate > 20) {
        const rounded = Number(rate.toFixed(4));
        const lastUpdated = new Date().toISOString();
        const source = 'Banco Central de Venezuela (BCV vía PyDolarVe)';

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_RATE, rounded.toString());
          localStorage.setItem(STORAGE_KEY_DATE, lastUpdated);
          localStorage.setItem(STORAGE_KEY_SOURCE, source);
        }

        return { rate: rounded, lastUpdated, source, isLive: true };
      }
    }
  } catch (err) {
    console.warn('API PyDolarVe no disponible, intentando OpenExchangeRate API...', err);
  }

  // 3. Intentar API Terciaria: Open ER
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(EXCHANGE_RATE_TERTIARY, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.VES === 'number' && data.rates.VES > 20) {
        const rate = Number(data.rates.VES.toFixed(4));
        const lastUpdated = data.time_last_update_utc || new Date().toISOString();
        const source = 'Tipo de Cambio USD/VES (OpenExchangeRate API)';

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_RATE, rate.toString());
          localStorage.setItem(STORAGE_KEY_DATE, lastUpdated);
          localStorage.setItem(STORAGE_KEY_SOURCE, source);
        }

        return { rate, lastUpdated, source, isLive: true };
      }
    }
  } catch (err) {
    console.warn('No se pudo conectar a fuentes externas de tasa en vivo:', err);
  }

  // 4. Respaldo en Caché Local si existe y es reciente
  if (typeof localStorage !== 'undefined') {
    const cachedRate = localStorage.getItem(STORAGE_KEY_RATE);
    const cachedDate = localStorage.getItem(STORAGE_KEY_DATE);
    const cachedSource = localStorage.getItem(STORAGE_KEY_SOURCE);

    if (cachedRate) {
      const parsed = parseFloat(cachedRate);
      if (!isNaN(parsed) && parsed > 20) {
        return {
          rate: parsed,
          lastUpdated: cachedDate || new Date().toISOString(),
          source: cachedSource || 'BCV en Caché Local',
          isLive: false
        };
      }
    }
  }

  // 5. Valor por defecto actualizado a Tasa BCV representativa de la jornada actual
  return {
    rate: 56.80,
    lastUpdated: new Date().toISOString(),
    source: 'Tasa BCV Oficial de Referencia (Auto-Resguardo)',
    isLive: false
  };
}

/**
 * Calcula el equivalente en Dólares (USD) a partir de un monto en Bolívares (VES)
 * Evita la pérdida de valor por inflación en cuentas de socios y flujos de caja
 */
export function calculateUsdEquivalent(amountVes: number, bcvRate: number): number {
  if (!bcvRate || bcvRate <= 0) return 0;
  return Number((Math.abs(amountVes) / bcvRate).toFixed(2));
}

/**
 * Convierte un monto nominal en VES o USD a su contraparte
 */
export function convertCurrency(
  amount: number,
  from: 'VES' | 'USD',
  to: 'VES' | 'USD',
  bcvRate: number
): number {
  if (from === to) return amount;
  if (!bcvRate || bcvRate <= 0) return amount;

  if (from === 'VES' && to === 'USD') {
    return Number((amount / bcvRate).toFixed(2));
  } else {
    return Number((amount * bcvRate).toFixed(2));
  }
}
