/**
 * Clasificador Contable Venezolano con IA (Gemini 2.5 Flash)
 * Analiza captures de pantalla de banca venezolana (Banesco, BDV, Mercantil, BNC, Bancamiga, Zelle, Binance),
 * comprobantes en PDF y notas de voz para extraer metadata contable estructurada en formato JSON estricto.
 */

import { GoogleGenAI } from '@google/genai';
import { calculateUsdEquivalent } from './bcvService';
import { getBeneficiaryRepository, learnBeneficiaryRepository } from './beneficiaryMemoryService';

export interface VenezuelanReceiptData {
  banco_origen: string;
  banco_destino: string;
  tipo_operacion:
    | 'Pago Móvil'
    | 'Transferencia'
    | 'Zelle'
    | 'Binance USDT'
    | 'Efectivo Divisas'
    | 'Comisión/IGTF'
    | 'Cierre Punto de Venta'
    | 'Otro';
  moneda: 'VES' | 'USD';
  monto: number;
  monto_usd_equivalente: number;
  referencia_completa: string;
  referencia_ultimos_4: string;
  fecha: string; // YYYY-MM-DD
  identificador_tercero: string; // RIF, Cédula, Teléfono o correo Zelle
  nombre_tercero?: string;
  concepto_detectado?: string;
  repositorio_sugerido: string; // ID del módulo: MOD_VENTAS, MOD_PROVEEDORES, MOD_CXC_SOCIOS, etc.
  nombre_repositorio_sugerido: string;
  audio_transcripcion?: string;
  explicacion_contable: string;
}

// Mapeo amigable de IDs de módulos
export const MODULE_MAP_NAMES: Record<string, string> = {
  MOD_VENTAS: 'Cobro de Facturas / Ventas',
  MOD_PROVEEDORES: 'Pago a Proveedores Locales',
  MOD_CXC_SOCIOS: 'Cuentas por Cobrar Socios (Gastos Personales)',
  MOD_SOCIOS_IN: 'Aportes y Préstamos a Socios',
  MOD_CXP_SOCIOS: 'Devolución Préstamos Socios',
  MOD_TFR_PROPIAS_IN: 'Transferencias Interbancarias Propias (Entrada)',
  MOD_TFR_PROPIAS_OUT: 'Transferencias Interbancarias Propias (Salida)',
  MOD_POS: 'Liquidación POS / Puntos de Venta',
  MOD_USD_IN: 'Ingresos en Divisas',
  MOD_USD_OUT: 'Salidas en Divisas / Importaciones',
  MOD_NOMINA: 'Nómina y Cargas Parafiscales',
  MOD_SENIAT_PAGO: 'Liquidación Tributos SENIAT',
  MOD_COMISIONES: 'Comisiones y Mantenimiento Bancario',
  MOD_ANTICIPOS: 'Anticipos y Retenciones',
  MOD_OTROS: 'Otros / No Identificados'
};

const getApiKey = (): string | undefined => {
  return (
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('user_gemini_api_key') || localStorage.getItem('gemini_api_key'))) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    undefined
  );
};

const SYSTEM_PROMPT = `Actúa como un Contador Público Colegiado y Auditor Forense experto en el sistema financiero y tributario de Venezuela (Ven-NIF, SUDEBAN, SENIAT).
Tu objetivo es analizar comprobantes de pago (captures de pantalla de Pago Móvil, transferencias bancarias, recibos de Zelle, Binance Pay o notas de voz del dueño) y extraer rigurosamente la metadata en JSON estructurado.

REGLAS DE CLASIFICACIÓN CONTABLE EN VENEZUELA:
1. BANCOS: Identifica el banco origen y destino entre:
   - Banesco Banco Universal
   - Banco Mercantil
   - Banco de Venezuela (BDV)
   - Banco Nacional de Crédito (BNC)
   - Bancamiga
   - Banco Provincial (BBVA)
   - Zelle / Bank of America / Wells Fargo
   - Banesco Panamá
   - Binance Pay (USDT)
   - Efectivo Divisas

2. TIPO DE OPERACIÓN:
   - "Pago Móvil" (P2P o C2P), "Transferencia", "Zelle", "Binance USDT", "Efectivo Divisas", "Comisión/IGTF", "Cierre Punto de Venta".

3. MONEDA Y MONTO:
   - Moneda: "VES" o "USD".
   - Monto: Número decimal limpio flotante (ej: Si dice 1.250,50 o Bs. 1.250,50 conviértelo estrictamente a 1250.50).

4. REFERENCIA:
   - "referencia_completa": Todos los dígitos o caracteres alfanuméricos encontrados.
   - "referencia_ultimos_4": EXACTAMENTE los últimos 4 dígitos numéricos de la referencia (ej: Si la referencia es 53653663474, los últimos 4 son "3474"). Si no tiene 4 dígitos, rellena los que tenga.

5. FECHA: Formato ISO YYYY-MM-DD.

6. IDENTIFICADOR DE TERCERO:
   - Extrae el RIF (J-, V-, G-, E-), Cédula, Teléfono de Pago Móvil (0414/0424/0412/0416/0426) o correo electrónico Zelle.

7. REPOSITORIO SUGERIDO (CRÍTICO):
   - "MOD_VENTAS": Cobros de facturas, ventas comerciales, clientes abonando.
   - "MOD_PROVEEDORES": Compras de mercancía, repuestos, fletes, servicios de proveedores con RIF de empresa.
   - "MOD_CXC_SOCIOS": ¡MUY IMPORTANTE! Si el gasto o pago es personal del socio o su familia (ej: Farmatodo, automercados, bodegones, colegios, universidades, clínicas, restaurantes, tiendas de ropa, delivery personal) O si el audio/caption del dueño dice "para mi casa", "gasto personal", "pago mío", clasifícalo INMEDIATAMENTE como "MOD_CXC_SOCIOS" (Cuentas por Cobrar Socios) para evitar contingencias fiscales por dividendos presuntos ante el SENIAT.
   - "MOD_SOCIOS_IN": Si el socio inyecta dinero a la cuenta de la empresa ("préstamo de socio", "aporte").
   - "MOD_TFR_PROPIAS_IN" o "MOD_TFR_PROPIAS_OUT": Transferencias entre cuentas bancarias de la misma razón social de la empresa.
   - "MOD_POS": Liquidación de lotes de puntos de venta (TMD, TDB CAPIT, Credicard).
   - "MOD_COMISIONES": Comisiones de Pago Móvil, comisiones bancarias, mantenimiento.
   - "MOD_OTROS": Si no se determina con certeza.

Responde ÚNICAMENTE un bloque JSON válido con esta estructura:
{
  "banco_origen": "Banesco Banco Universal",
  "banco_destino": "Banco Mercantil",
  "tipo_operacion": "Pago Móvil",
  "moneda": "VES",
  "monto": 1250.50,
  "referencia_completa": "60053819318",
  "referencia_ultimos_4": "9318",
  "fecha": "2026-01-05",
  "identificador_tercero": "04141234567",
  "nombre_tercero": "DISTRIBUIDORA CHINAKOREA MOTORS",
  "concepto_detectado": "Pago de repuestos",
  "repositorio_sugerido": "MOD_PROVEEDORES",
  "audio_transcripcion": "",
  "explicacion_contable": "Comprobante de Pago Móvil interbancario hacia proveedor con RIF comercial."
}`;

/**
 * Clasifica un comprobante (imagen o PDF en base64, audio en base64 y texto adjunto)
 */
export async function classifyReceiptWithGemini(params: {
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  textContext?: string;
  bcvRate: number;
}): Promise<VenezuelanReceiptData> {
  const { imageBase64, imageMimeType, audioBase64, audioMimeType, textContext, bcvRate } = params;
  const apiKey = getApiKey();

  // Si tenemos API Key de Gemini, invocamos el modelo gemini-2.5-flash
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];

      // Si hay imagen o PDF adjunto
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType || 'image/jpeg',
            data: imageBase64
          }
        });
      }

      // Si hay nota de voz adjunta
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType || 'audio/ogg',
            data: audioBase64
          }
        });
      }

      // Prompt de texto
      let userPrompt = `Analiza este comprobante bancario venezolano y genera la metadata contable requerida.`;
      if (textContext && textContext.trim()) {
        userPrompt += `\nContexto o mensaje adjunto proporcionado por el usuario en Telegram: "${textContext.trim()}"`;
      }

      parts.push({
        text: `${SYSTEM_PROMPT}\n\n${userPrompt}`
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const monto = typeof parsed.monto === 'number' ? parsed.monto : parseFloat(parsed.monto) || 0;
      const moneda = parsed.moneda === 'USD' ? 'USD' : 'VES';
      const montoUsd = moneda === 'USD' ? monto : calculateUsdEquivalent(monto, bcvRate);

      let refCompleta = String(parsed.referencia_completa || '').trim();
      let refLast4 = String(parsed.referencia_ultimos_4 || '').replace(/\D/g, '').slice(-4);
      if (!refLast4 && refCompleta) {
        const digits = refCompleta.replace(/\D/g, '');
        refLast4 = digits.slice(-4);
      }

      let repo = parsed.repositorio_sugerido || 'MOD_OTROS';

      // Verificar memoria histórica de beneficiarios
      if (parsed.identificador_tercero) {
        const memoryMatch = getBeneficiaryRepository(parsed.identificador_tercero);
        if (memoryMatch && memoryMatch.moduleTag) {
          repo = memoryMatch.moduleTag;
        } else {
          // Aprender para futuras ocasiones
          learnBeneficiaryRepository(
            parsed.identificador_tercero,
            repo,
            parsed.nombre_tercero
          );
        }
      }

      return {
        banco_origen: parsed.banco_origen || 'Banco Universal',
        banco_destino: parsed.banco_destino || 'Banco Universal',
        tipo_operacion: parsed.tipo_operacion || 'Pago Móvil',
        moneda,
        monto,
        monto_usd_equivalente: montoUsd,
        referencia_completa: refCompleta,
        referencia_ultimos_4: refLast4 || '0000',
        fecha: parsed.fecha || new Date().toISOString().split('T')[0],
        identificador_tercero: parsed.identificador_tercero || '',
        nombre_tercero: parsed.nombre_tercero,
        concepto_detectado: parsed.concepto_detectado,
        repositorio_sugerido: repo,
        nombre_repositorio_sugerido: MODULE_MAP_NAMES[repo] || 'Repositorio Digital',
        audio_transcripcion: parsed.audio_transcripcion,
        explicacion_contable: parsed.explicacion_contable || 'Procesado con Inteligencia Artificial Gemini.'
      };
    } catch (err) {
      console.warn('Error llamando a Gemini para clasificar comprobante, utilizando motor heurístico:', err);
    }
  }

  // Motor Heurístico de Respaldo Local (100% Funcional sin Internet ni API Key)
  return fallbackHeuristicClassifier(textContext || '', bcvRate);
}

/**
 * Motor heurístico de respaldo que clasifica usando expresiones regulares venezolanas
 */
function fallbackHeuristicClassifier(
  text: string,
  bcvRate: number
): VenezuelanReceiptData {
  const upper = text.toUpperCase();

  // Detección de monto
  let monto = 0;
  const montoMatch = text.match(/(?:BS\.?|USD|\$|MONTO[:\s]*)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
  if (montoMatch) {
    const rawVal = montoMatch[1].replace(/\./g, '').replace(',', '.');
    monto = parseFloat(rawVal) || 0;
  }

  const isUsd = upper.includes('USD') || upper.includes('$') || upper.includes('ZELLE') || upper.includes('BINANCE');
  const moneda = isUsd ? 'USD' : 'VES';
  const montoUsd = moneda === 'USD' ? monto : calculateUsdEquivalent(monto, bcvRate);

  // Detección de referencia
  const refMatch = text.match(/(?:REF|REFERENCIA|DOC|OP)[:\s#]*([0-9]{4,15})/i) ||
    text.match(/\b([0-9]{6,12})\b/);
  const refCompleta = refMatch ? refMatch[1] : `REF-${Date.now().toString().slice(-6)}`;
  const refLast4 = refCompleta.replace(/\D/g, '').slice(-4) || '0000';

  // Detección de banco
  let banco = 'Banco Universal';
  if (upper.includes('BANESCO')) banco = 'Banesco Banco Universal';
  else if (upper.includes('MERCANTIL')) banco = 'Banco Mercantil';
  else if (upper.includes('VENEZUELA') || upper.includes('BDV')) banco = 'Banco de Venezuela';
  else if (upper.includes('BNC')) banco = 'Banco Nacional de Crédito BNC';
  else if (upper.includes('BANCAMIGA')) banco = 'Bancamiga';
  else if (upper.includes('PROVINCIAL')) banco = 'Banco Provincial';
  else if (upper.includes('ZELLE')) banco = 'Zelle';
  else if (upper.includes('BINANCE')) banco = 'Binance Pay';

  // Detección de tercero
  const phoneMatch = text.match(/\b(0414|0424|0412|0416|0426)[0-9]{7}\b/);
  const rifMatch = text.match(/\b[VJEGP]-?[0-9]{7,9}-?[0-9]?\b/i);
  const identificador = phoneMatch ? phoneMatch[0] : (rifMatch ? rifMatch[0].toUpperCase() : '');

  // Clasificación por palabras clave personales vs comerciales
  let repo = 'MOD_OTROS';
  if (
    upper.includes('FARMATODO') ||
    upper.includes('AUTOMERCADO') ||
    upper.includes('SUPERMERCADO') ||
    upper.includes('COLEGIO') ||
    upper.includes('CLINICA') ||
    upper.includes('RESTAURANT') ||
    upper.includes('CASA') ||
    upper.includes('PERSONAL') ||
    upper.includes('SOCIO')
  ) {
    repo = 'MOD_CXC_SOCIOS';
  } else if (upper.includes('PROVEEDOR') || upper.includes('COMPRA') || upper.includes('REPUESTO') || upper.includes('SERVICIO')) {
    repo = 'MOD_PROVEEDORES';
  } else if (upper.includes('FACTURA') || upper.includes('VENTA') || upper.includes('COBRO') || upper.includes('CLIENTE')) {
    repo = 'MOD_VENTAS';
  } else if (upper.includes('ENTRE CUENTAS') || upper.includes('PROPIA') || upper.includes('TRASPASO')) {
    repo = 'MOD_TFR_PROPIAS_IN';
  } else if (upper.includes('COMISION') || upper.includes('PAGO MOVIL CCE') || upper.includes('MANTENIMIENTO')) {
    repo = 'MOD_COMISIONES';
  }

  // Comprobar memoria
  if (identificador) {
    const mem = getBeneficiaryRepository(identificador);
    if (mem && mem.moduleTag) {
      repo = mem.moduleTag;
    }
  }

  return {
    banco_origen: banco,
    banco_destino: banco,
    tipo_operacion: isUsd ? 'Zelle' : 'Pago Móvil',
    moneda,
    monto,
    monto_usd_equivalente: montoUsd,
    referencia_completa: refCompleta,
    referencia_ultimos_4: refLast4,
    fecha: new Date().toISOString().split('T')[0],
    identificador_tercero: identificador,
    repositorio_sugerido: repo,
    nombre_repositorio_sugerido: MODULE_MAP_NAMES[repo] || 'Repositorio Digital',
    explicacion_contable: 'Procesado mediante análisis heurístico de reglas bancarias venezolanas.'
  };
}
