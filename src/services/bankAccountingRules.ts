import * as XLSX from 'xlsx';
import { BankTransaction, CurrencyType, UserCompanyProfile } from '../types/accounting';

export interface BankRuleItem {
  id: string;
  order: number;
  name: string;
  ruleType: 'NC' | 'ND' | 'BOTH';
  targetAccountCode: string;
  targetAccountName: string;
  contraAccountCode?: string;
  contraAccountName?: string;
  descriptionPatterns: string[];
  notes?: string;
}

export interface BankRulesDefinition {
  bankCode: string;
  bankName: string;
  accountCodeBank: string;
  accountNameBank: string;
  rules: BankRuleItem[];
  promptTemplate?: string;
}

/**
 * Convierte cualquier fecha a formato oficial venezolano con guiones: XX-XX-XXXX (DD-MM-YYYY)
 * Ejemplo: 2026-10-24 -> 24-10-2026
 */
export function formatToVenezuelanDateHyphen(dateInput: string | Date | undefined | null): string {
  if (!dateInput) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}-${m}-${y}`;
  }

  if (dateInput instanceof Date) {
    const d = String(dateInput.getDate()).padStart(2, '0');
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const y = dateInput.getFullYear();
    return `${d}-${m}-${y}`;
  }

  const trimmed = String(dateInput).trim();
  // Formato ISO YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // Formato DD-MM-YYYY o DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return trimmed;
}

/**
 * Formatea un número al estándar contable de Venezuela:
 * Punto (.) para separación de miles y Coma (,) para decimales con 2 decimales fijos.
 * Valores negativos con signo menos al inicio (-).
 * Ejemplos:
 *  1234.1 -> "1.234,10"
 * -1234.1 -> "-1.234,10"
 *  0 -> "0,00"
 */
export function formatVenezuelanNumber(num: number | string | undefined | null): string {
  if (num === undefined || num === null || num === '') {
    return '0,00';
  }
  const n = typeof num === 'number' ? num : parseFloat(String(num).replace(/\./g, '').replace(/,/g, '.'));
  if (isNaN(n)) return '0,00';

  const isNeg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${withDots},${decPart}`;
}


// -------------------------------------------------------------
// 1. BANCO DE VENEZUELA (0102) - REGLAS SEGÚN PROMPT OFICIAL
// -------------------------------------------------------------
export const BDV_OFFICIAL_PROMPT = `Prompt Completo – Agente de Inteligencia Artificial para Generación de Asientos Contables
Rol:
Actúa como un experto en contabilidad con experiencia en conciliaciones bancarias, análisis de estados de cuenta bancarios, y generación de asientos contables en formato Excel para carga automática en un sistema contable.
Objetivo:
A partir de un estado de cuenta bancario cargado en formato Excel, CSV o PDF, clasificar todas las transacciones en notas de crédito (NC) (montos positivos) y notas débito (ND) (montos negativos), asignar las cuentas contables a cada fila del archivo y  generar un archivo Excel con las siguientes hojas:
Instrucciones:
Hoja 1 (NC) – Notas de Crédito (montos positivos):
1.	Filtrar todas las transacciones con monto positivo.
2.	Asignar cuenta contable: Para todas estas filas, la cuenta contable será 1.1.1.2.20 (Banco de Venezuela).
3.	Tipo de operación: Colocar NC (Nota de Crédito) en la columna "TIPO".
4.	Orden de columnas:
o	CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
5.	Contrapartida: Al final de la hoja, agregar una fila adicional con:
o	CUENTA CONTABLE: 1.1.2.1.10 (Cuentas por cobrar).
o	DESCRIPCION: "Cuentas por cobrar (contrapartida NC)".
o	TIPO: NC.
o	REFERENCIA: "RES-[fecha actual en formato DD-MM-AAAA]".
o	MONTO: La suma total de las NC, pero en negativo (para que el asiento cierre en cero).
6.	Validación: La suma de la columna MONTO debe ser exactamente cero (asegurar que el asiento esté balanceado).
7.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 1 titulada "Hoja 1 (NC)".
8.	La columna “Monto” debe incluir los valores en positivo (+) y negativos (-) que EXTRAISTES del estado de cuenta. En la hoja 1, deben aparecer todas las “NC”  de cada fila del estado de cuenta, asi como su fila de resumen al final y como contratipartida la cuenta 1.1.2.1.10 (cuentas por cobrar) en sino negativo.
________________________________________
Hoja 2 (ND) – Notas Débito (montos negativos):
1.	Filtrar todas las transacciones con monto negativo.
2.	Asignar cuenta contable: 
3.	Tipo de operación: Colocar ND (Nota Débito) en la columna "TIPO".
4.	Orden de columnas: En la hoja 2, el orden de las columnas del archivo a crear es el siguiente:
      CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
Regla 1: Comisiones Bancarias - Nota de Débito (ND)
o	Cuenta: 6.1.2.5.02 (Comisiones Bancarias)
o	Condiciones:
	Descripción contiene términos como: Toda descripción que tenga la palabra "COM ", “COBRO COMISION”, “COMIS”, “COMISION OPERACIÓN”, “COMISION PAGOMOVILBDV”, entre otros.
Contrapartida Automática: Generar asiento en el código 1.1.1.2.20 (Banco), y descripción BANCO VENEZUELA, referencia que este en la fila correspondiente del estado de cuenta y el monto que contiene la fila en negativo (-)
Regla 2: Compras/Servicios - Nota de Débito (ND)
o	Cuenta: 2.1.1.1.10 (Cuentas por Pagar)
o	Condiciones:
	Descripción contiene: “PAGO A OTROS BANCOS 0115 V4500052”, “PAGO A TERCEROS BDV V04500052”, 
o	Contrapartida Automática: Generar asiento en 1.1.1.2.40 (Banco), con el monto negativo y descripción BANCO VENEZUELA.
5.	Validación: La suma de la columna MONTO debe ser exactamente cero (asegurar que el asiento esté balanceado).
6.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 2 titulada "Hoja 2 (ND)".
________________________________________
Hoja 3 (ND + ND) – Unificación de NC y ND:
1.	Unificar las transacciones de NC y ND en un solo flujo de trabajo.
2.	Incluir las filas de la Hoja 1 (NC) y Hoja 2 (ND) juntas.
3.	Asegurar balance: Las contrapartidas deben estar ajustadas para que el asiento contable cierre en cero.
o	La suma total de NC debe balancear con la suma total de ND.
4.	Orden de columnas final:
      CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
5.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 3 titulada "Hoja 3 (ND + ND)".
________________________________________
Consideraciones Técnicas y Generales:
•	El archivo final será un Excel con tres hojas:
1.	Hoja 1 (NC): Contendrá las notas de crédito (montos positivos) y su contrapartida en la cuenta de Cuentas por cobrar.
2.	Hoja 2 (ND): Contendrá las notas débito (montos negativos) y su contrapartida en la cuenta de Banco de Venezuela o la cuenta que corresponda.
3.	Hoja 3 (ND + ND): Unificación de todas las transacciones de NC y ND con las contrapartidas balanceadas.
•	El formato de los montos debe estar en dos decimales.
•	El campo REFERENCIA debe mantener el valor original de la transacción.
•	Las descripciones deben mantenerse tal cual aparecen en el estado de cuenta.
________________________________________
Resultado Esperado:
El agente debe generar un archivo Excel con las tres hojas mencionadas, balanceando las transacciones correctamente y asegurando que el asiento quede en cero.
Cada hoja debe ser independiente pero seguir la misma estructura, para que al final puedas tener una vista general con todo el flujo de las notas de crédito (NC) y notas débito (ND) de manera organizada y lista para cargar en el sistema contable.`;

export const BDV_RULES_DEFINITION: BankRulesDefinition = {
  bankCode: '0102',
  bankName: 'Banco de Venezuela S.A.',
  accountCodeBank: '1.1.1.2.20',
  accountNameBank: 'Banco de Venezuela Cta Corriente',
  promptTemplate: BDV_OFFICIAL_PROMPT,
  rules: [
    {
      id: 'BDV_NC_R1_INGRESOS',
      order: 1,
      name: 'Hoja 1 (NC): Notas de Crédito (Montos Positivos) - Banco de Venezuela',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.20',
      targetAccountName: 'Banco de Venezuela Cta Corriente',
      contraAccountCode: '1.1.2.1.10',
      contraAccountName: 'Cuentas por cobrar (contrapartida NC)',
      descriptionPatterns: [
        'VENEZUELA',
        'ABONO RECIBIDO OTR BCOS',
        'LIQ MONEDERO PATRIA',
        'LIQUIDACION TDC BIOPAGOBDV',
        'BIOPAGOBDV',
        'OP PAGOMOVILBDV OTROS BAN',
        'OPERACION PAGOMOVIL BDV',
        'PAGO OTRAS CTAS JUR NAT',
        'PAGO RECIBIDO BDV',
        'PAGO RECIBIDO OTROS BANCOS',
        'PAGOMOVIL OTROS BANCOS',
        'PTO. LA CRUZ AV. MUNICIPA',
        'TRASPASO OTRAS CTAS BDV E',
        'PAGO MOVIL',
        'PAGOMOVIL',
        'DEPOSITO'
      ],
      notes: 'Monto positivo (+). Cuenta 1.1.1.2.20 con contrapartida final en 1.1.2.1.10 (Cuentas por cobrar) con referencia RES-[DD-MM-AAAA] y monto total en negativo para sumar exactamente 0.00.'
    },
    {
      id: 'BDV_ND_R1_COMISIONES',
      order: 2,
      name: 'Regla 1 (ND): Comisiones Bancarias - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.02',
      targetAccountName: 'Comisiones Bancarias',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Banco de Venezuela',
      descriptionPatterns: [
        'COBRO COMISION PAG MOVIL BDV A',
        'COBRO COMISION',
        'COM MANTENIMIENTO DE CUENTA',
        'COM MANTENIMIENTO DE CUEN',
        'COM PAGO OTRAS CTAS JUR NAT',
        'COM PAGO OTR BCOS JUR NAT',
        'COM TRANSF LINEA OT BCOS CTA P',
        'COM TRANSF EN LINEA OT BC',
        'COMIS SERVICIOS DE POS BCV',
        'COMISION OPERACION BIOMETRIA',
        'COMISION PAGOMOVILBDV',
        'COM BANCA MOVIL BDV',
        'COMISION OPERACIÓN',
        'COMISION OPERACION',
        'COM ',
        'COMIS',
        'COMISION PAGO A PROVEEDORES',
        'COMISION T FALLIDA P2P BD'
      ],
      notes: 'Comisiones bancarias. Fila positiva en 6.1.2.5.02 y contrapartida automática 1.1.1.2.20 BANCO VENEZUELA en negativo (-).'
    },
    {
      id: 'BDV_ND_R2_COMPRAS',
      order: 3,
      name: 'Regla 2 (ND): Compras / Servicios - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Cuentas por Pagar',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Banco de Venezuela',
      descriptionPatterns: [
        'PAGO A TERCEROS BDV V04500052 ENOELIA BARRIOS',
        'PAGO A TERCEROS BDV V04500052',
        'PAGO A TERCEROS BDV',
        'TRANSF EN LINEA OT BCOS CTA PR',
        'TRANSF EN LINEA OT BCOS',
        'TRANSF EN LINEA OTR BCOS',
        'PAGO A OTROS BANCOS 0115 V4500052',
        'DOMICILIACION OTROS BANCOS',
        'OPERACION PAGOMOVIL BDV',
        'OPERACION PAGOMOVILBDV OT',
        'PAGO A OTROS BANCOS',
        'PAGO A PROVEEDORES OTROS BANCOS',
        'PAGO IMPUESTOS INTERNET',
        'TRASPASO OTRAS CTAS BDV E'
      ],
      notes: 'Compras y servicios. Fila positiva en 2.1.1.1.10 y contrapartida automática 1.1.1.2.20 (o 1.1.1.2.40) BANCO VENEZUELA en negativo (-).'
    },
    {
      id: 'BDV_ND_R3_SOCIOS',
      order: 4,
      name: 'Regla 3 (ND): Cuentas por Cobrar Socios (Retiros Personales)',
      ruleType: 'ND',
      targetAccountCode: '1.1.2.2.30',
      targetAccountName: 'Cuentas por Cobrar Socios y Directores',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Banco de Venezuela',
      descriptionPatterns: [
        'PAGO A TERCEROS BDV V08973555 CARLOS ALFONZO',
        'PAGO A TERCEROS BDV V08973555',
        'PAGO A TERCEROS BDV CARLOS ALFONZO',
        'RETIRO SOCIO',
        'CUENTAS POR COBRAR SOCIO'
      ],
      notes: 'Retiro personal de socio imputado a cuenta de activo exigible 1.1.2.2.30.'
    }
  ]
};

// -------------------------------------------------------------
// 2. BANCO MERCANTIL (0105) - SEGÚN PROMPT OFICIAL PDF
// -------------------------------------------------------------
export const MERCANTIL_RULES_DEFINITION: BankRulesDefinition = {
  bankCode: '0105',
  bankName: 'Banco Mercantil C.A.',
  accountCodeBank: '1.1.1.2.60',
  accountNameBank: 'Banco Mercantil Cta Corriente',
  rules: [
    {
      id: 'MER_R1_INGRESOS',
      order: 1,
      name: 'Regla 1: Ingresos / Cobros Comerciales y Transferencias Recibidas',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.60',
      targetAccountName: 'Banco Mercantil Cta Corriente',
      contraAccountCode: '1.1.2.1.10',
      contraAccountName: 'Cuentas por Cobrar Clientes',
      descriptionPatterns: [
        'CRÉDITO INMEDIATO CÁMARA DE COMPENSACIÓN',
        'CREDITO INMEDIATO CAMARA DE COMPENSACION',
        'ORDEN DE PAGO SEGÚN INSTRUCCIONES',
        'ORDEN DE PAGO SEGUN INSTRUCCIONES',
        'PAGO MÓVIL COMERCIAL INTERBANCARIO',
        'PAGO MOVIL COMERCIAL INTERBANCARIO',
        'PAGO MÓVIL COMERCIAL',
        'PAGO MOVIL COMERCIAL',
        'RECEPCIÓN PAGO MÓVIL –',
        'RECEPCION PAGO MOVIL',
        'TRANSF. CCE – INVERSIONES TRANSVEAL 4X4 CA',
        'TRANSF. CCE – MENDEZ SERVICIOS CA',
        'TRANSF. CCE – MULTISERVICIOS GLOBAL MD CA',
        'TRANSF. RECIBIDA CCE – FRUITS ORIENTE CA',
        'TRANSF. CCE –',
        'TRANSF. RECIBIDA CCE',
        'TRANSFERENCIA CTA.***',
        'TRANSFERENCIA RECIBIDA CTA.***'
      ],
      notes: 'Monto positivo (+). Cuenta 1.1.1.2.60 con contrapartida totalizadora 1.1.2.1.10 en negativo.'
    },
    {
      id: 'MER_R2_PRESTAMOS',
      order: 2,
      name: 'Regla 2: Préstamos Bancarios por Pagar',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.60',
      targetAccountName: 'Banco Mercantil Cta Corriente',
      contraAccountCode: '2.1.1.1.20',
      contraAccountName: 'Préstamos Bancarios por Pagar',
      descriptionPatterns: [
        'PRÉSTAMO NRO.',
        'PRESTAMO NRO.'
      ],
      notes: 'Monto positivo (+). Liquidación de préstamo bancario con contrapartida a pasivo 2.1.1.1.20.'
    },
    {
      id: 'MER_R3_PROVEEDORES',
      order: 3,
      name: 'Regla 3: Proveedores y Egresos Operativos',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Cuentas por Pagar Proveedores',
      contraAccountCode: '1.1.1.2.60',
      contraAccountName: 'Banco Mercantil Cta Corriente',
      descriptionPatterns: [
        'SGLBTR – ROLL IT TIRES CA',
        'SGLBTR –',
        'OSGLBTR',
        'CRÉDITO INMEDIATO',
        'CREDITO INMEDIATO',
        'PAGO AL SENIAT RIF J504941352 - DOC. IVA30',
        'TRANSF. A OCEANO PACÍFICO SUR CA',
        'TRANSF. A SCORPION TYRES CA',
        'TRANSF. A WALID NIZAR EL FAKIH',
        'TRANSF. A YENNI PAVIQUE',
        'TRANSF. CRÉDITO INMEDIATO',
        'TRANSF. CREDITO INMEDIATO',
        'TRANSFERENCIA – ACUMULADORES DUNCAN CA',
        'TRANSFERENCIA – AGRORUEDAS CHAKAO CA',
        'TRANSFERENCIA – CAUCHOS LA MUNDIAL CA',
        'TRANSFERENCIA A BECERRA ANDRES',
        'TRANSFERENCIA A ACUMULADORES DUNCAN',
        'TRANSFERENCIA A AGRORUEDAS CHAKAO',
        'TRANSFERENCIA A CAUCHOS LA MUNDIAL',
        'TRANSFERENCIA A LLANTEX CA',
        'TRANSFERENCIA DESDE CUENTA ***8298 A CUENTA DE AGRORUEDAS CHAKAO',
        'TRANSF. A',
        'TRANSFERENCIA –',
        'TRANSFERENCIA A'
      ],
      notes: 'Monto negativo (-). Partida doble: 2.1.1.1.10 en positivo y 1.1.1.2.60 en negativo.'
    },
    {
      id: 'MER_R4_COMISIONES',
      order: 4,
      name: 'Regla 4: Comisiones Bancarias Ordinarias y Financieras',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.02',
      targetAccountName: 'Gastos por Comisiones Bancarias',
      contraAccountCode: '1.1.1.2.60',
      contraAccountName: 'Banco Mercantil Cta Corriente',
      descriptionPatterns: [
        'COMISIÓN CRÉDITO INMEDIATO',
        'COMISION CREDITO INMEDIATO',
        'COMISIÓN PAGO MÓVIL COMERCIAL',
        'COMISION PAGO MOVIL COMERCIAL',
        'COMISIÓN POR CRÉDITO INMEDIATO',
        'COMISION POR CREDITO INMEDIATO',
        'COMISIÓN POR OPERACIÓN DE ALTO VALOR',
        'COMISION POR OPERACION DE ALTO VALOR',
        'COMISIÓN POR TRANSFERENCIA A TERCEROS',
        'COMISION POR TRANSFERENCIA A TERCEROS',
        'COMISIÓN POR TRANSFERENCIA DE FONDOS',
        'COMISION POR TRANSFERENCIA DE FONDOS',
        'EMISION EDO. DE CTA. MONEDA NAC. / EXT.',
        'EMISIÓN ESTADO DE CUENTA MONEDA NACIONAL/EXT.',
        'TARIFA MANTENIMIENTO DE CUENTA',
        'COBRO COMISIÓN LCC',
        'COBRO COMISION LCC',
        'COMISIÓN FLAT CRÉDITO',
        'COMISION FLAT CREDITO',
        'COMISIÓN POR SERVICIO EN ME',
        'COMISION POR SERVICIO EN ME'
      ],
      notes: 'Monto negativo (-). Imputa a 6.1.2.5.02 (u 6.1.2.5.03 para flat/LCC/ME) contra Banco Mercantil 1.1.1.2.60.'
    },
    {
      id: 'MER_R5_TIMBRES',
      order: 5,
      name: 'Regla 5: Timbres Fiscales sobre Préstamos',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.64',
      targetAccountName: 'Impuestos Timbres Fiscales',
      contraAccountCode: '1.1.1.2.60',
      contraAccountName: 'Banco Mercantil Cta Corriente',
      descriptionPatterns: [
        'LEY DE TIMBRE FISCAL SOBRE PRÉSTAMO',
        'LEY DE TIMBRE FISCAL SOBRE PRESTAMO',
        'TIMBRE FISCAL SOBRE PRESTAMO'
      ],
      notes: 'Monto negativo (-). Débito por estampillas/timbres fiscales sobre operaciones crediticias.'
    },
    {
      id: 'MER_R6_IMPUESTOS',
      order: 6,
      name: 'Regla 6: Impuestos SENIAT, Retenciones y Parafiscales',
      ruleType: 'ND',
      targetAccountCode: '2.1.2.3.15',
      targetAccountName: 'Retenciones Tributarias SENIAT',
      contraAccountCode: '1.1.1.2.60',
      contraAccountName: 'Banco Mercantil Cta Corriente',
      descriptionPatterns: [
        'ISLR PERSONAS (ISLR26)',
        'IGTF21',
        'DOC. IGTF21',
        'DOC. ISLR74 - RETENCION DE SALARIOS',
        'RETENCIÓN SALARIOS ISLR74',
        'RETENCIÓN SALARIOS Y OTRAS RETENCIONES (FORMA 99074)',
        'RÉGIMEN RETENCIÓN IVA',
        'REGIMEN RETENCION IVA',
        'RETENCIÓN IVA35',
        'RETENCION IVA35',
        'DOC. IVA35 - REGIMEN DE RETENCION DE IVA',
        'DECLARACIÓN PROTECCIÓN PENSIONES DPP19',
        'PROTECCIÓN PENSIONES DPP19',
        'DOC. DPP19',
        'TRANSF. A ALCALDÍA SIMÓN BOLÍVAR',
        'ISLR ANTICIPO (IVA44)',
        'IISLR ANTICIPO IVA44',
        'DOC. IVA44 - ISLR DECLARADO POR ANTICIPADO',
        'PAGO SENIAT – IVA / ISLR ANTICIPADO'
      ],
      notes: 'Monto negativo (-). Subdivide en retenciones IVA (2.1.2.3.15), IGTF (2.1.2.2.20), ISLR (2.1.2.2.10/2.1.2.3.10), Pensiones (6.1.1.2.19), Alcaldía (6.1.2.1.40) y Anticipos (1.2.4.2.30).'
    },
    {
      id: 'MER_R7_CXC_SOCIOS',
      order: 7,
      name: 'Regla 7: Cuentas por Cobrar Socios (Transferencias al Dueño)',
      ruleType: 'ND',
      targetAccountCode: '1.1.2.2.30',
      targetAccountName: 'Cuentas por Cobrar Socios y Directores',
      contraAccountCode: '1.1.1.2.60',
      contraAccountName: 'Banco Mercantil Cta Corriente',
      descriptionPatterns: [
        'CRÉDITO INMEDIATO – ANGELO VANEGAS (PRÉSTAMO)',
        'TRANSFERENCIA – VANEGAS BECERRA CRISTIAN ANDRÉS',
        'TRANSFERENCIA A VANEGAS BECERRA CRISTIAN ANDRES',
        'TRANSFERENCIA DESDE CUENTA ***8298 A CUENTA DE CRISTIAN VANEGAS ***6530',
        'CRISTIAN VANEGAS',
        'ANGELO VANEGAS'
      ],
      notes: 'Monto negativo (-). Retiro personal de socio imputado a cuenta de activo exigible 1.1.2.2.30.'
    }
  ]
};

// -------------------------------------------------------------
// 3. BANCO PLAZA (0138) - SEGÚN PROMPT OFICIAL PDF
// -------------------------------------------------------------
export const PLAZA_RULES_DEFINITION: BankRulesDefinition = {
  bankCode: '0138',
  bankName: 'Banco Plaza C.A.',
  accountCodeBank: '1.1.1.2.10',
  accountNameBank: 'Banco Plaza Cta Corriente',
  rules: [
    {
      id: 'PLZ_R1_INGRESOS',
      order: 1,
      name: 'Regla 1: Ingresos / Depósitos, POS y Transferencias Recibidas',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.10',
      targetAccountName: 'Banco Plaza Cta Corriente',
      contraAccountCode: '1.1.2.1.10',
      contraAccountName: 'Cuentas por Cobrar Clientes',
      descriptionPatterns: [
        'DEPOSITO ',
        'LIQUID ',
        'POS CRE ',
        'POS ELE ',
        'POS MAE ',
        'TDY COM.P2C VZLA',
        'TDY PAGO DE 100%B',
        'TDY PAGO DE ACTIVO',
        'TDY PAGO DE B.EXTE',
        'TDY PAGO DE B.PLUS',
        'TDY PAGO DE BAMIGA',
        'TDY PAGO DE BANCRE',
        'TDY PAGO DE BANESC',
        'TDY PAGO DE BANFAN',
        'TDY PAGO DE BDT',
        'TDY PAGO DE BFC',
        'TDY PAGO DE BNC',
        'TDY PAGO DE CARIBE',
        'TDY PAGO DE MERCAN',
        'TDY PAGO DE PLAZA',
        'TDY PAGO DE PROVIN',
        'TDY PAGO DE TESORO',
        'TDY PAGO DE V.CRED',
        'TDY PAGO DE VZLA',
        'TDY PAGO DE ',
        'TRF BAMIGA',
        'TRF BANESC',
        'TRF MERCAN',
        'TRF PROVIN V',
        'TRF VZLA G',
        'TRF VZLA J'
      ],
      notes: 'Monto positivo (+). Cuenta 1.1.1.2.10 y al pie contrapartida 1.1.2.1.10 en negativo para cuadre exacto a 0.00.'
    },
    {
      id: 'PLZ_R2_CXP_SOCIOS',
      order: 2,
      name: 'Regla 2: Cuenta por Pagar Socios (Aportes del Dueño)',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.10',
      targetAccountName: 'Banco Plaza Cta Corriente',
      contraAccountCode: '2.1.1.3.15',
      contraAccountName: 'Cuentas por Pagar Socios',
      descriptionPatterns: [
        'TRF BANESC V008973555 ALFONZO',
        'TRF PLAZA V008973555 ALFONZO',
        'TRF VZLA VXXXXXXXXX CARLOS A',
        'TRF PLAZA V008973555'
      ],
      notes: 'Monto positivo (+). Aporte o préstamo del accionista a la cuenta de la empresa.'
    },
    {
      id: 'PLZ_R3_PROVEEDORES',
      order: 3,
      name: 'Regla 3: Proveedores y Pagos Comerciales',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Cuentas por Pagar Proveedores',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'COMPRA MAESTRO',
        'DOM POS',
        'DOM POS BPL',
        'DOM POS MST',
        'NOTA DEBITO ',
        'PAG BAMIGA',
        'PAG BAMIGA TRANSF',
        'PAG BANESC',
        'PAG CARIBE ',
        'PAG MERCAN ',
        'PAG PLAZA ',
        'PAG PROV PLAZA REF',
        '0138 ',
        'PAG PROV REF',
        'PAG SENIAT ',
        'PAGO SENIAT PROPIO',
        'PAG VZLA ',
        'TDY COM.P2C ',
        'TDY PAGO DE VZLA',
        'TRF BANCRE V',
        'TRF BANESC ',
        'TRF VZLA ',
        'TRF PROVIN ',
        'PAG CAPIT '
      ],
      notes: 'Monto negativo (-). Partida doble: 2.1.1.1.10 en positivo y 1.1.1.2.10 en negativo. PAG CAPIT imputa a 2.1.1.1.20.'
    },
    {
      id: 'PLZ_R4_GASTOS_BANCARIOS',
      order: 4,
      name: 'Regla 4: Gastos Bancarios Especiales',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.03',
      targetAccountName: 'Gastos Bancarios',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'BIOM .CUPO ',
        'PAG RENDI '
      ],
      notes: 'Monto negativo (-). Cargos por cupos biométricos y rendimientos bancarios.'
    },
    {
      id: 'PLZ_R5_COMISIONES',
      order: 5,
      name: 'Regla 5: Comisiones Bancarias y Emisión de Documentos',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.02',
      targetAccountName: 'Gastos por Comisiones Bancarias',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'CARGO EMISION EDO DE CUENTA',
        'CARGO POR MANTENIMIENTO CTA',
        'EMISION Y REPOSICION TDD',
        'COM FLAT POS',
        'COM PAG PROV REF',
        'COM TRF ',
        'COM TRF PLAZA REF',
        'COM. PAG REF.',
        'COM. TRF REF.',
        'COM. COM REF.',
        'COM.RECH TRF REF',
        'COMISION V '
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.5.02 en positivo y 1.1.1.2.10 en negativo.'
    },
    {
      id: 'PLZ_R6_TIMBRES',
      order: 6,
      name: 'Regla 6: Timbres Fiscales',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.64',
      targetAccountName: 'Impuestos Timbres Fiscales',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'TIMBRES FI '
      ],
      notes: 'Monto negativo (-). Retención o cargo de estampillas y timbres fiscales.'
    },
    {
      id: 'PLZ_R7_SEGUROS',
      order: 7,
      name: 'Regla 7: Pólizas de Seguro',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.25',
      targetAccountName: 'Gastos de Pólizas de Seguro',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'PRIMAS SEGUR',
        'TRF PLAZA J000389233',
        'TRF PLAZA J000389233 Seguros',
        'SEGUROS PLAZA'
      ],
      notes: 'Monto negativo (-). Débitos por cobertura de primas de seguros y pólizas patrimoniales.'
    },
    {
      id: 'PLZ_R8_CXC_SOCIOS',
      order: 8,
      name: 'Regla 8: Cuentas por Cobrar Socios (Retiros del Dueño)',
      ruleType: 'ND',
      targetAccountCode: '1.1.2.2.30',
      targetAccountName: 'Cuentas por Cobrar Socios y Directores',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banco Plaza Cta Corriente',
      descriptionPatterns: [
        'PAG BANESC CARLOS ALFONZO',
        'PAG BANESC DAVID JABER',
        'TRF BANESC XXXXXXXXXX CARLOS A',
        'TRF MERCAN V006362534 CARLOS',
        'TRF PLAZA V008973555 ALFONZO',
        'TRF PLAZA V008973555 ALFONZO R',
        'TRF VZLA V008220911 CARLOS'
      ],
      notes: 'Monto negativo (-). Retiro personal de socio imputado a cuenta de activo exigible 1.1.2.2.30.'
    }
  ]
};

// -------------------------------------------------------------
// 4. BANESCO BANCO UNIVERSAL (0134) - REGLAS SEGÚN PROMPT OFICIAL
// -------------------------------------------------------------
export const BANESCO_OFFICIAL_PROMPT = `Rol:
Actúa como un experto en contabilidad con experiencia en conciliaciones bancarias, análisis de estados de cuenta bancarios, y generación de asientos contables en formato Excel para carga automática en un sistema contable.
Objetivo:
A partir de un estado de cuenta bancario cargado en formato Excel, CSV o PDF, clasificar todas las transacciones en notas de crédito (NC) (montos positivos) y notas débito (ND) (montos negativos), asignar las cuentas contables a cada fila del archivo y generar un archivo Excel con las siguientes hojas:
Instrucciones:
Hoja 1 (NC) – Notas de Crédito (montos positivos):
1.	Filtrar todas las transacciones con monto positivo.
2.	Asignar cuenta contable: Para todas estas filas, la cuenta contable será 1.1.1.2.10 (Banco Banesco).
3.	Tipo de operación: Colocar NC (Nota de Crédito) en la columna "TIPO".
4.	Orden de columnas:
o	CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
5.	Contrapartida: Al final de la hoja, agregar una fila adicional con:
o	CUENTA CONTABLE: 1.1.2.1.10 (Cuentas por cobrar).
o	DESCRIPCION: "Cuentas por cobrar (contrapartida NC)".
o	TIPO: NC.
o	REFERENCIA: "RES-[fecha actual en formato DD-MM-AAAA]".
o	MONTO: La suma total de las NC, pero en negativo (para que el asiento cierre en cero).
6.	Validación: La suma de la columna MONTO debe ser exactamente cero (asegurar que el asiento esté balanceado).
7.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 1 titulada "Hoja 1 (NC)".
8.	La columna “Monto” debe incluir los valores en positivo (+) que EXTRAISTES del estado de cuenta. Asegúrate que la hoja 1, tenga la contrapartida correspondiente en negativo, con el fin de que el asiento contable sume cero.
9.	 En la hoja 1, deben aparecer todas las “NC” de cada fila del estado de cuenta, así como su fila de resumen al final y como contrapartida la cuenta 1.1.2.1.10 (cuentas por cobrar) en sino negativo.
________________________________________

Hoja 2 (ND) – Notas Débito (montos negativos):
1.	Filtrar todas las transacciones con monto negativo.
2.	Asignar cuenta contable: 
3.	Tipo de operación: Colocar ND (Nota Débito) en la columna "TIPO".
4.	Orden de columnas: En la hoja 2, el orden de las columnas del archivo a crear es el siguiente:
      CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
ASIGNACION DE CUENTAS CONTABLES:
Regla 1: Cuenta Contable : Comisiones Bancarias - Nota de Débito (ND)
o	Cuenta: 6.1.2.5.02 (Comisiones Bancarias)
o	Condiciones:
	Descripción contiene términos como: Toda descripción que tenga la palabra: “Com, Banesco Pago Movil”, “COM, TRF. CR.INM.OB”, “Comision Servicio SMS”, “EMISION DE ESTADO DE CUENTA”, “MantÿySÿerv  Aplc  POS”, SERV MTTO, POS/NATIVA,  entre otros.
Contrapartida Automática: Generar asiento en el código 1.1.1.2.10 (Banco), y descripción BANESCO, referencia que este en la fila correspondiente del estado de cuenta y el monto que contiene la fila en negativo (-)
Regla 2: Compras/Servicios - Nota de Débito (ND)
o	Cuenta: 2.1.1.1.10 (Cuentas por Pagar)
o	Condiciones:
	Descripción contiene: “TRF CR INM 0102 V004500052”, “TRF CR INM 0191 J070003448”
•	Contrapartida Automática: Generar asiento en 1.1.1.2.10 (Banco), con el monto negativo y descripción BANESCO.
Regla 3: Servicios - Nota de Débito (ND)
o	Cuenta: 6.1.2.1.20 (Electricidad)
o	Condiciones:
	Descripción contiene: “ELECTRICIDAD CARGO C/CTA”
•	Contrapartida Automática: Generar asiento en 1.1.1.2.10 (Banco), con el monto negativo y descripción BANESCO.
Regla 4: Nomina - Nota de Débito (ND)
o	Cuenta: 2.1.3.2.10 (Nomina Por Pagar)
o	Condiciones:
	Descripción contiene: “TRANS,CTAS. A TERCEROS BANESCO”
•	Contrapartida Automática: Generar asiento en 1.1.1.2.10 (Banco), con el monto negativo y descripción BANESCO.
Regla 5: Impuestos- Nota de Débito (ND)
o	Cuenta: 2.1.2.2.20 (iva Por Pagar)
o	Condiciones:
	Descripción contiene: “INCLUSION DE PLANILLA SENIAT C”
•	Contrapartida Automática: Generar asiento en 1.1.1.2.10 (Banco), con el monto negativo y descripción BANESCO.

5.	Validación: La suma de la columna MONTO debe ser exactamente cero (asegurar que el asiento esté balanceado).
6.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 2 titulada "Hoja 2 (ND)".
7.	En la hoja 2 debes asegúrate de que en cada fila aparezca un monto en positivo que siempre iría cargada a la cuenta 6.1.2.5.02, 2.1.1.1.10, 6.1.2.1.20, 2.1.3.2.10, etc., dependiendo de la descripción de cada  UNA, “SIN EXCEPCION” TODAS LAS CUENTAS QUE TENGAN “REGLAS”, DEBEN IR EN POSITIVO (+) EN EL ASIENTO CONTABLE Y SU CONTRAPARTIDA BANCO VA EN NEGATIVO (-), ESTO ES UNICAMENTE PARA LA HOJA 2.
Luego de haber asignado cada fila a su cuenta contable correspondiente, de acuerdo a la descripción de la fila, vas a copiar todas las filas nuevamente a partir de la primera fila en blanco, allí vas copiar la descripción, el tipo, la referencia de cada fila, vas a asignar a todo ese copy a la cuenta contable 1.1.1.2.10 (Banco). Y en la columna monto vas a copiar todos los montos de las filas en signo negativo (-)

________________________________________
Hoja 3 (ND + ND) – Unificación de NC y ND:
1.	Unificar las transacciones de NC y ND en un solo flujo de trabajo.
2.	Incluir las filas de la Hoja 1 (NC) y Hoja 2 (ND) juntas.
3.	Asegurar balance: Las contrapartidas deben estar ajustadas para que el asiento contable cierre en cero.
o	La suma total de NC debe balancear con la suma total de ND.
4.	Orden de columnas final:
      CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
5.	Formato de archivo final: Guardar el archivo Excel como asientos_generados.xlsx, con la Hoja 3 titulada "Hoja 3 (ND + ND)".
________________________________________
Consideraciones Técnicas y Generales:
•	El archivo final será un Excel con tres hojas:
1.	Hoja 1 (NC): Contendrá las notas de crédito (montos positivos) y su contrapartida en la cuenta de Cuentas por cobrar.
2.	Hoja 2 (ND): Contendrá las notas débito (montos negativos) y su contrapartida en la cuenta de Banco de Venezuela o la cuenta que corresponda.
3.	Hoja 3 (ND + ND): Unificación de todas las transacciones de NC y ND con las contrapartidas balanceadas.
•	El formato de los montos debe estar en dos decimales.
•	El campo REFERENCIA debe mantener el valor original de la transacción.
•	Las descripciones deben mantenerse tal cual aparecen en el estado de cuenta.
________________________________________
Resultado Esperado:
El agente debe generar un archivo Excel con las tres hojas mencionadas.
El encabezado de cada página debe ser: Columna 1 = CUENTA CONTABLE; Columna 2 = DESCRIPCION; Columna 3: TIPO; Columna 4 = REFERENCIA y Columna 5 = MONTO.
asegúrate que el asiento quede en cero y de no incluir una columna “fecha” en el asiento.
Cada hoja debe ser independiente, pero seguir la misma estructura.
Debes responder siempre en español.`;

export const BANESCO_RULES_DEFINITION: BankRulesDefinition = {
  bankCode: '0134',
  bankName: 'Banesco Banco Universal',
  accountCodeBank: '1.1.1.2.10',
  accountNameBank: 'Banesco Banco Universal Cta Corriente',
  promptTemplate: BANESCO_OFFICIAL_PROMPT,
  rules: [
    {
      id: 'BNS_NC_R1_INGRESOS',
      order: 1,
      name: 'Hoja 1 (NC): Notas de Crédito (Montos Positivos) - Banco Banesco',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.10',
      targetAccountName: 'Banesco Banco Universal Cta Corriente',
      contraAccountCode: '1.1.2.1.10',
      contraAccountName: 'Cuentas por cobrar (contrapartida NC)',
      descriptionPatterns: [
        'BANESCO PAGO MOVIL',
        'BANESCO',
        'TDB CAPIT',
        'TDB ',
        'TDC ',
        'TMD ',
        'TT ',
        'TVD ',
        'ABONO RECIBIDO',
        'PAGO MOVIL',
        'PAGOMOVIL',
        'TRANSFERENCIA RECIBIDA',
        'TRF RECIBIDA',
        'DEPOSITO EN EFECTIVO',
        'DEPOSITO DE CHEQUE',
        'PAGO RECIBIDO',
        'LIQUIDACION POS',
        'PUNTOS DE VENTA',
        'CREDITO'
      ],
      notes: 'Monto positivo (+). Cuenta 1.1.1.2.10 con contrapartida final en 1.1.2.1.10 (Cuentas por cobrar) con referencia RES-[DD-MM-AAAA] y monto total en negativo para sumar exactamente 0.00.'
    },
    {
      id: 'BNS_ND_R1_COMISIONES',
      order: 2,
      name: 'Regla 1 (ND): Comisiones Bancarias - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.02',
      targetAccountName: 'Comisiones Bancarias',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'Com, Banesco Pago Movil',
        'COM, TRF. CR.INM.OB',
        'COM,SERV.MTTO CTA',
        'Comision Servicio SMS',
        'EMISION DE ESTADO DE CUENTA',
        'MantÿySÿerv  Aplc  POS',
        'MantÿySÿerv Aplc POS',
        'Mant  ySÿerv  Aplc  POS',
        'Mant ySÿerv Aplc POS',
        'Mant  ySÿerv  Aplc  POS  ENE',
        'Mant ySÿerv Aplc POS ENE 25',
        'SERV MTTO, POS/NATIVA',
        'SERV MTTO, POS/NATIVA  45',
        'SERV MTTO',
        'POS/NATIVA',
        'COMISIONES BANCARIAS',
        'COMISION BANCARIA',
        'COM. PAGO MOVIL',
        'COMISION PAGO MOVIL',
        'COM. TRF',
        'COMISION POR TRANSFERENCIA',
        'COM. POS',
        'MANTENIMIENTO DE CUENTA',
        'CARGO MENSUAL'
      ],
      notes: 'Gasto por comisiones bancarias. Fila positiva en 6.1.2.5.02 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R9_MUNICIPALES',
      order: 3,
      name: 'Regla 3 (ND): Impuestos Municipales y Patente (Alcaldía)',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.40',
      targetAccountName: 'Impuestos Municipales y Patente',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'COMPRA POS CTA/CTE ALCALDIA DE',
        'ALCALDIA DEL MUNI',
        'ALCALDIA',
        'IMPUESTO MUNICIPAL'
      ],
      notes: 'Tributos municipales. Fila positiva en 6.1.2.1.40 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R2_COMPRAS',
      order: 4,
      name: 'Regla 4 (ND): Compras / Servicios y Proveedores - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Cuentas por Pagar',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'COMPRA POS CTA/CTE PANADERIA Y',
        'COMPRA POS CTA/CTE',
        'COMPRA POS',
        'TRF CR INM 0102 J309201522',
        'TRF CR INM 0102 V004500052',
        'TRF CR INM 0102',
        'TRF CR INM 0108 V004500052',
        'TRF CR INM 0108',
        'TRF CR INM 0115 V004500052',
        'TRF CR INM 0115',
        'TRF CR INM 0191 J070003448',
        'TRF CR INM 0191',
        'TRF CR INM',
        'PAGO PROVEEDOR',
        'PAGO A TERCEROS',
        'TRANSFERENCIA A TERCEROS',
        'TRANS,CTAS. A TERCEROS BANESCO',
        'MULTIPAGOS',
        'ZOOM INTERNATIONA',
        'SISTEALARMAS'
      ],
      notes: 'Compras y servicios proveedores. Fila positiva en 2.1.1.1.10 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R3_ELECTRICIDAD',
      order: 5,
      name: 'Regla 5 (ND): Servicios (Electricidad) - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.20',
      targetAccountName: 'Electricidad',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'ELECTRICIDAD CARGO C/CTA',
        'ELECTRICIDAD',
        'CORPOELEC'
      ],
      notes: 'Servicio eléctrico. Fila positiva en 6.1.2.1.20 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R4_NOMINA',
      order: 6,
      name: 'Regla 6 (ND): Nomina - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '2.1.3.2.10',
      targetAccountName: 'Nomina Por Pagar',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'PAGO NOMINA',
        'NOMINA',
        'SUELDOS Y SALARIOS',
        'SUELDO'
      ],
      notes: 'Nómina de personal. Fila positiva en 2.1.3.2.10 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R5_IMPUESTOS',
      order: 7,
      name: 'Regla 7 (ND): Impuestos (IVA Por Pagar) - Nota de Débito',
      ruleType: 'ND',
      targetAccountCode: '2.1.2.2.20',
      targetAccountName: 'iva Por Pagar',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: [
        'INCLUSION DE PLANILLA SENIAT C',
        'INCLUSION DE PLANILLA',
        'PLANILLA SENIAT',
        'SENIAT IVA',
        'PLANILLA IVA'
      ],
      notes: 'Tributos SENIAT. Fila positiva en 2.1.2.2.20 y contrapartida automática 1.1.1.2.10 BANESCO en negativo (-).'
    },
    {
      id: 'BNS_ND_R6_BANAVIH',
      order: 8,
      name: 'Regla 8 (ND): Aportes Parafiscales BANAVIH (FAOV)',
      ruleType: 'ND',
      targetAccountCode: '6.1.1.2.16',
      targetAccountName: 'Gastos de Personal BANAVIH / FAOV',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: ['BANAVIH REC. EN LINEA', 'BANAVIH', 'FAOV']
    },
    {
      id: 'BNS_ND_R7_IVSS',
      order: 9,
      name: 'Regla 9 (ND): Seguridad Social IVSS',
      ruleType: 'ND',
      targetAccountCode: '6.1.1.2.14',
      targetAccountName: 'Gastos de Personal Seguro Social IVSS',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: ['IVSS', 'SEGURO SOCIAL', 'TIUNA']
    },
    {
      id: 'BNS_ND_R8_TELEFONIA',
      order: 10,
      name: 'Regla 10 (ND): Telefonía e Internet',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.15',
      targetAccountName: 'Gastos de Comunicaciones y Telefonía',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: ['MOVISTAR CARGO C/CTA', 'MOVISTAR', 'DIGITEL', 'CANTV']
    },
    {
      id: 'BNS_ND_R10_SEGUROS',
      order: 11,
      name: 'Regla 11 (ND): Pólizas de Seguro',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.25',
      targetAccountName: 'Gastos de Pólizas de Seguro',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: ['ESTAR SEGUROS', 'SEGUROS', 'POLIZA DE SEGURO']
    },
    {
      id: 'BNS_ND_R11_SOCIOS',
      order: 12,
      name: 'Regla 12 (ND): Retiros de Socios / Directores',
      ruleType: 'ND',
      targetAccountCode: '1.1.2.2.30',
      targetAccountName: 'Cuentas por Cobrar Socios y Directores',
      contraAccountCode: '1.1.1.2.10',
      contraAccountName: 'Banesco Banco Universal',
      descriptionPatterns: ['RETIRO SOCIO', 'PAGO SOCIO', 'PRESTAMO A SOCIO', 'RETIRO PERSONAL']
    }
  ]
};

/**
 * Aplica formato numérico estándar de 2 decimales a la columna MONTO (E)
 * garantizando compatibilidad con fórmulas de suma en Excel y sistemas contables.
 */
function applyNumericFormatToColumnE(worksheet: XLSX.WorkSheet): void {
  Object.keys(worksheet).forEach(cellRef => {
    if (cellRef.startsWith('E') && cellRef !== 'E1' && worksheet[cellRef]) {
      worksheet[cellRef].z = '#,##0.00;(#,##0.00);0.00';
    }
  });
}

/**
 * GENERADOR EXACTO DE ASIENTOS CONTABLES PARA BANCO BANESCO (0134)
 * Según el prompt oficial y el modelo de referencia: genera asientos_generados.xlsx con:
 * - Hoja 1 (NC): Notas de crédito y contrapartida Cuentas por Cobrar 1.1.2.1.10
 * - Hoja 2 (ND): Notas débito clasificadas en positivo (+) y contrapartidas de Banco 1.1.1.2.10 en negativo (-)
 * - Hoja 3 (ND + ND): Unificación de todas las transacciones de NC y ND con las contrapartidas balanceadas a 0.00
 * - Columnas: CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
 * - Sin columna Fecha
 */
export function generateBanescoAsientosExcel(
  transactions: BankTransaction[],
  company?: Partial<UserCompanyProfile>,
  currency: CurrencyType = 'VES'
): void {
  const wb = XLSX.utils.book_new();

  // Filtrar movimientos bancarios de Banesco o del estado de cuenta activo
  const banescoTxs = transactions.filter(t =>
    t.source === 'BANK' &&
    t.currency === currency &&
    (!t.bankCode || t.bankCode === '0134' || t.bankCode === 'ALL' || t.bankName?.toLowerCase().includes('banesco'))
  );

  const headerRow = ['CUENTA CONTABLE', 'DESCRIPCION', 'TIPO', 'REFERENCIA', 'MONTO'];
  const todayFormatted = formatToVenezuelanDateHyphen(new Date());

  // -------------------------------------------------------------
  // HOJA 1 (NC) – Notas de Crédito (montos positivos)
  // -------------------------------------------------------------
  const ncList = banescoTxs.filter(t => t.txType === 'CREDIT' || t.amountNominal > 0);
  const sheet1Rows: (string | number)[][] = [headerRow];
  let totalNC = 0;

  ncList.forEach(tx => {
    const amtPos = Number(Math.abs(tx.amountNominal).toFixed(2));
    totalNC += amtPos;
    sheet1Rows.push([
      '1.1.1.2.10',
      tx.rawDescription,
      'NC',
      tx.referenceNum,
      amtPos
    ]);
  });

  // Contrapartida al final de la Hoja 1 (según modelo CSV y prompt oficial):
  // CUENTA CONTABLE: 1.1.2.1.10 (Cuentas por cobrar).
  // DESCRIPCION: "CUENTAS POR COBRAR" (o "Cuentas por cobrar (contrapartida NC)").
  // TIPO: NC.
  // REFERENCIA: "RES-[fecha actual en formato DD-MM-AAAA]".
  // MONTO: La suma total de las NC, en negativo para que el asiento cierre en cero exacto.
  if (ncList.length > 0) {
    sheet1Rows.push([
      '1.1.2.1.10',
      'CUENTAS POR COBRAR',
      'NC',
      `RES-${todayFormatted}`,
      -Number(totalNC.toFixed(2))
    ]);
  }

  const wsSheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  applyNumericFormatToColumnE(wsSheet1);
  wsSheet1['!cols'] = [
    { wch: 18 }, // CUENTA CONTABLE
    { wch: 48 }, // DESCRIPCION
    { wch: 10 }, // TIPO
    { wch: 20 }, // REFERENCIA
    { wch: 18 }  // MONTO
  ];

  // -------------------------------------------------------------
  // HOJA 2 (ND) – Notas Débito (montos negativos)
  // -------------------------------------------------------------
  const ndList = banescoTxs.filter(t => t.txType === 'DEBIT' || t.amountNominal < 0);
  const sheet2Rows: (string | number)[][] = [headerRow];

  // Bloque 1: Cuentas según reglas en positivo (+)
  ndList.forEach(tx => {
    const res = classifyTransactionByBankRules(tx.rawDescription, tx.amountNominal, 'DEBIT', '0134');
    const amtPos = Number(Math.abs(tx.amountNominal).toFixed(2));
    sheet2Rows.push([
      res.accountCode,
      tx.rawDescription,
      'ND',
      tx.referenceNum,
      amtPos
    ]);
  });

  // Bloque 2: Copia a partir de la primera fila en blanco (según modelo CSV de producción):
  // Cuenta contable 1.1.1.2.10 (Banco), descripción de la fila correspondiente, tipo ND, referencia original, monto en negativo (-)
  ndList.forEach(tx => {
    const amtNeg = Number((-Math.abs(tx.amountNominal)).toFixed(2));
    sheet2Rows.push([
      '1.1.1.2.10',
      tx.rawDescription || 'BANESCO',
      'ND',
      tx.referenceNum,
      amtNeg
    ]);
  });

  const wsSheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  applyNumericFormatToColumnE(wsSheet2);
  wsSheet2['!cols'] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // -------------------------------------------------------------
  // HOJA 3 (ND + ND) – Unificación de NC y ND
  // -------------------------------------------------------------
  const sheet3Rows: (string | number)[][] = [headerRow];

  // Filas de Hoja 1 (NC)
  for (let i = 1; i < sheet1Rows.length; i++) {
    sheet3Rows.push(sheet1Rows[i]);
  }

  // Filas de Hoja 2 (ND)
  for (let i = 1; i < sheet2Rows.length; i++) {
    sheet3Rows.push(sheet2Rows[i]);
  }

  const wsSheet3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  applyNumericFormatToColumnE(wsSheet3);
  wsSheet3['!cols'] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // Agregar las 3 hojas al Libro Excel
  XLSX.utils.book_append_sheet(wb, wsSheet1, 'Hoja 1 (NC)');
  XLSX.utils.book_append_sheet(wb, wsSheet2, 'Hoja 2 (ND)');
  XLSX.utils.book_append_sheet(wb, wsSheet3, 'Hoja 3 (ND + ND)');

  // Descarga como asientos_generados.xlsx
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asientos_generados.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * GENERADOR EXACTO DE ASIENTOS CONTABLES PARA BANCO DE VENEZUELA (0102)
 * Según el prompt oficial y el modelo de referencia: genera asientos_generados.xlsx con:
 * - Hoja 1 (NC): Notas de crédito y contrapartida Cuentas por Cobrar 1.1.2.1.10
 * - Hoja 2 (ND): Notas débito clasificadas en positivo (+) y contrapartidas de Banco (1.1.1.2.20) en negativo (-)
 * - Hoja 3 (ND + ND): Unificación de todas las transacciones de NC y ND con las contrapartidas balanceadas a 0.00
 * - Columnas: CUENTA CONTABLE | DESCRIPCION | TIPO | REFERENCIA | MONTO
 * - Sin columna Fecha
 */
export function generateBdvAsientosExcel(
  transactions: BankTransaction[],
  company?: Partial<UserCompanyProfile>,
  currency: CurrencyType = 'VES'
): void {
  const wb = XLSX.utils.book_new();

  // Filtrar movimientos bancarios de Banco de Venezuela
  const bdvTxs = transactions.filter(t =>
    t.source === 'BANK' &&
    t.currency === currency &&
    (!t.bankCode || t.bankCode === '0102' || t.bankCode === 'ALL' || t.bankName?.toLowerCase().includes('venezuela') || t.bankName?.toLowerCase().includes('bdv'))
  );

  const headerRow = ['CUENTA CONTABLE', 'DESCRIPCION', 'TIPO', 'REFERENCIA', 'MONTO'];
  const todayFormatted = formatToVenezuelanDateHyphen(new Date());

  // -------------------------------------------------------------
  // HOJA 1 (NC) – Notas de Crédito (montos positivos)
  // Cuenta contable: 1.1.1.2.20 (Banco de Venezuela)
  // -------------------------------------------------------------
  const ncList = bdvTxs.filter(t => t.txType === 'CREDIT' || t.amountNominal > 0);
  const sheet1Rows: (string | number)[][] = [headerRow];
  let totalNC = 0;

  ncList.forEach(tx => {
    const amtPos = Number(Math.abs(tx.amountNominal).toFixed(2));
    totalNC += amtPos;
    sheet1Rows.push([
      '1.1.1.2.20',
      tx.rawDescription || 'VENEZUELA',
      'NC',
      tx.referenceNum,
      amtPos
    ]);
  });

  // Contrapartida al final de la Hoja 1 (según modelo CSV):
  // CUENTA CONTABLE: 1.1.2.1.10 (Cuentas por cobrar).
  // DESCRIPCION: "CUENTAS POR COBRAR".
  // TIPO: NC.
  // REFERENCIA: "RES-[fecha actual en formato DD-MM-AAAA]".
  // MONTO: La suma total de las NC, en negativo para que el asiento cierre en cero exacto.
  if (ncList.length > 0) {
    sheet1Rows.push([
      '1.1.2.1.10',
      'CUENTAS POR COBRAR',
      'NC',
      `RES-${todayFormatted}`,
      -Number(totalNC.toFixed(2))
    ]);
  }

  const wsSheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  applyNumericFormatToColumnE(wsSheet1);
  wsSheet1['!cols'] = [
    { wch: 18 }, // CUENTA CONTABLE
    { wch: 48 }, // DESCRIPCION
    { wch: 10 }, // TIPO
    { wch: 20 }, // REFERENCIA
    { wch: 18 }  // MONTO
  ];

  // -------------------------------------------------------------
  // HOJA 2 (ND) – Notas Débito (montos negativos)
  // Regla 1 (Comisiones): 6.1.2.5.02 (contra 1.1.1.2.20 VENEZUELA)
  // Regla 2 (Compras/Servicios): 2.1.1.1.10 (contra 1.1.1.2.20 VENEZUELA)
  // -------------------------------------------------------------
  const ndList = bdvTxs.filter(t => t.txType === 'DEBIT' || t.amountNominal < 0);
  const sheet2Rows: (string | number)[][] = [headerRow];

  // Bloque 1: Cuentas según reglas en positivo (+)
  ndList.forEach(tx => {
    const res = classifyTransactionByBankRules(tx.rawDescription, tx.amountNominal, 'DEBIT', '0102');
    const amtPos = Number(Math.abs(tx.amountNominal).toFixed(2));
    sheet2Rows.push([
      res.accountCode, // 6.1.2.5.02, 2.1.1.1.10, etc.
      tx.rawDescription,
      'ND',
      tx.referenceNum,
      amtPos
    ]);
  });

  // Bloque 2: Copia a partir de la primera fila en blanco (según modelo CSV lines 494-573):
  // Contrapartida automática: código 1.1.1.2.20 (Banco), descripción VENEZUELA, tipo ND, referencia original, monto en negativo (-)
  ndList.forEach(tx => {
    const amtNeg = Number((-Math.abs(tx.amountNominal)).toFixed(2));
    sheet2Rows.push([
      '1.1.1.2.20',
      'VENEZUELA',
      'ND',
      tx.referenceNum,
      amtNeg
    ]);
  });

  const wsSheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  applyNumericFormatToColumnE(wsSheet2);
  wsSheet2['!cols'] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // -------------------------------------------------------------
  // HOJA 3 (ND + ND) – Unificación de NC y ND
  // -------------------------------------------------------------
  const sheet3Rows: (string | number)[][] = [headerRow];

  // Filas de Hoja 1 (NC)
  for (let i = 1; i < sheet1Rows.length; i++) {
    sheet3Rows.push(sheet1Rows[i]);
  }

  // Filas de Hoja 2 (ND)
  for (let i = 1; i < sheet2Rows.length; i++) {
    sheet3Rows.push(sheet2Rows[i]);
  }

  const wsSheet3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  applyNumericFormatToColumnE(wsSheet3);
  wsSheet3['!cols'] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // Agregar las 3 hojas al Libro Excel
  XLSX.utils.book_append_sheet(wb, wsSheet1, 'Hoja 1 (NC)');
  XLSX.utils.book_append_sheet(wb, wsSheet2, 'Hoja 2 (ND)');
  XLSX.utils.book_append_sheet(wb, wsSheet3, 'Hoja 3 (ND + ND)');

  // Descarga como asientos_generados.xlsx
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asientos_generados.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 5. BANCAMIGA BANCO UNIVERSAL (0172) - SEGÚN PROMPT OFICIAL
// -------------------------------------------------------------
export const BANCAMIGA_RULES_DEFINITION: BankRulesDefinition = {
  bankCode: '0172',
  bankName: 'Bancamiga Banco Universal',
  accountCodeBank: '1.1.1.2.20',
  accountNameBank: 'Bancamiga Banco Universal Cta Corriente',
  rules: [
    {
      id: 'BAM_R1_INGRESOS',
      order: 1,
      name: 'Regla 1: Ingresos / Depósitos y Transferencias Recibidas',
      ruleType: 'NC',
      targetAccountCode: '1.1.1.2.20',
      targetAccountName: 'Bancamiga Banco Universal Cta Corriente',
      contraAccountCode: '1.1.2.1.10',
      contraAccountName: 'Cuentas por Cobrar Clientes',
      descriptionPatterns: [
        'Entradas de Fondos BCV',
        'NC Credito Inmediato',
        'NC Fondos Recibidos P2C',
        'NC pago de proveedores otros bancos',
        'NC Transf. Distinto cliente Internet',
        'NC Transf. Terc. Mismo Banco P2C',
        'ABONO RECIBIDO',
        'PAGO MOVIL',
        'DEPOSITO'
      ],
      notes: 'Monto positivo (+). En la Hoja de Ingresos se totaliza contra 1.1.2.1.10 (CUENTAS POR COBRAR) en negativo para cuadrar a 0.00.'
    },
    {
      id: 'BAM_R2_PROVEEDORES',
      order: 2,
      name: 'Regla 2: Proveedores y Consumos Comerciales',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Cuentas por Pagar Proveedores',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'Consumo Masterdebit Nacional',
        'ND Consumo Masterdebit Propio Nacional',
        'ND Credito Inmediato Dist Cliente',
        'ND Credito Inmediato',
        'Transf. Internet Terceros',
        'ND Transf. Terc. Otros Bancos P2C',
        'ND Transf. Terc. Otros Bancos Pago Movil',
        'ND Transf. Terc. Mismo Banco P2C',
        'ND Transf. Terc. Mismo Banco Pago Movil',
        'BARRETOS POLLO',
        'AGRO PDK',
        'AGRO PETS',
        'AGRO TIENDA LA ECONOMI',
        'APLYYCARS',
        'ARQUIPURO',
        'AUTO ELECTRIC GUAICAIP',
        'AUTO TORNILLOS AREMIL',
        'CERRAJERIA LA LLAVE MA',
        'CHIDIAK ZEGNEN EMILIO',
        'COATINGS DE ORIENTE',
        'COMERCIALIZADORA ANCAM',
        'COMERCIALIZADORA SUKAS',
        'CONSTRUGANGA',
        'DISTRIBUIDORA OFIPLAST',
        'EL RINCON DEL PAN',
        'ELECTRO AUTO MARIO',
        'FERRE KSA JM',
        'FERRE SOLAR',
        'FERREAGRO CRISTO DE JO',
        'FERREHIERROS URDAN',
        'FERRETODO',
        'GRUPO ULTRA LED',
        'HIMALAYA BATHS',
        'HIPERMERCADO FAMOSO',
        'INDUSTRIAL DEVELOPMENT',
        'INVERSIONES PUERTO COL',
        'JD AUTOACCESORIOS',
        'LUBRIGAMA SERVICES',
        'MULTI ACCESORIOS CARIB',
        'MULTI MANGUERAS',
        'MULTIMAGUERAS',
        'OTECO',
        'PEINADO ROJAS ALICKSON',
        'PRODUCTOS D LIMPIEZA',
        'RODAPUERTO',
        'RODAVEN',
        'ROJAS LUNA CHARLIE JOE',
        'RUSSELL GUANARES',
        'SUMIGASES ORIENTE',
        'SUPERMARKET BOGET',
        'TORTAS ROXY',
        'TRAIGA SU ENVASE',
        'TRANRED 4108',
        'UNIFORMES Y SEGURIDAD',
        'WU SUPERMERCADO MAX',
        'ZONA CHERY',
        'AVE EXPRESS',
        'FERRECASA FC',
        'FERRETERIA EPA',
        'LJB MARKET',
        'ROBERTO ANDRES PIZARRO',
        'JORGE LUIS MACUARE',
        'JOSE DAVID GONZALEZ',
        'JUAN CARLOS CARRION',
        'CESAR AUGUSTO RINCONES',
        'ALBERTO ALEXANDER MART',
        'WALTHER JOSE ALBERTO',
        'DOUGLAS MICHELL URRIET',
        'GUZMAN PEREZ RAFAEL',
        'RAMON ESTEBAN YANEZ',
        'REBECA SARAI BRITO JIM',
        'MARY CARMEN ARUSPON',
        'MARIANI DE LOS ANGELES',
        'FARMACIA ARABELLA',
        'FARMACIA MARIA MERCHAN',
        'FARMACIA MARIAS',
        'FARMACIA ORTOPEDICA'
      ],
      notes: 'Monto negativo (-). Partida doble: 2.1.1.1.10 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R3_COMISIONES',
      order: 3,
      name: 'Regla 3: Comisiones Bancarias',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.5.02',
      targetAccountName: 'Gastos por Comisiones Bancarias',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'Emision Estado de Cuenta',
        'Envio de SMS',
        'Mantenimiento de Cuenta',
        'ND Comisión Transferencia LBTR',
        'Comisión Crédito Inmediato',
        'Comision Fallida P2C',
        'Comision Otros Bancos P2C',
        'Comision Solicitud Transf. Otros Bancos',
        'COMISION'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.5.02 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R4_CXC_SOCIOS',
      order: 4,
      name: 'Regla 4: Cuentas por Cobrar Socios (Retiros a Cuenta Personal)',
      ruleType: 'ND',
      targetAccountCode: '1.1.2.2.30',
      targetAccountName: 'Cuentas por Cobrar Socios y Directores',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'ND Credito Inmediato Mismo Cliente',
        'Salida de Fondos BCV mismo titular',
        'RETIRO SOCIO',
        'TRANSFERENCIA SOCIO'
      ],
      notes: 'Monto negativo (-). El dueño se transfiere fondos de la empresa a su cuenta personal.'
    },
    {
      id: 'BAM_R5_TELEFONO',
      order: 5,
      name: 'Regla 5: Consumo de Teléfono y Recargas',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.15',
      targetAccountName: 'Gastos de Comunicaciones y Telefonía',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'Recarga Digitel',
        'Recarga Movistar Movil',
        'RECARGA MOVISTAR',
        'RECARGA DIGITEL',
        'DIGITEL',
        'MOVISTAR',
        'CANTV'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.1.15 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R6_ELECTRICIDAD',
      order: 6,
      name: 'Regla 6: Consumo de Electricidad (Corpoelec)',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.20',
      targetAccountName: 'Gastos de Electricidad y Servicios Públicos',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'ND Corpoelec Energía/Aseo/Relleno WEB',
        'ND Pago Serv. Electrico Web',
        'CORPOELEC'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.1.20 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R8_AGUA',
      order: 8,
      name: 'Regla 8: Consumo de Agua (Hidrológica)',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.05',
      targetAccountName: 'Gastos de Agua y Servicios Hidrológicos',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'C.A HIDROLOGICA DEL CARIBE',
        'HIDROLOGICA',
        'HIDROCARIBE',
        'AGUAS DE'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.1.05 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R9_COMBUSTIBLES',
      order: 9,
      name: 'Regla 9: Combustibles y Lubricantes (Estaciones de Servicio)',
      ruleType: 'ND',
      targetAccountCode: '6.1.2.1.06',
      targetAccountName: 'Gastos de Combustibles y Lubricantes',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'E S LA REDOMA',
        'E/S ARAGUANEY',
        'EST D SERV ORIENTE',
        'ESTACION DE SERVICIO',
        'SERVICENTRO POZUELOS',
        'BOMBA DE GASOLINA',
        'COMBUSTIBLE'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.2.1.06 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R10_FAOV',
      order: 10,
      name: 'Regla 10: Aporte FAOV / BANAVIH (Ley Política Habitacional)',
      ruleType: 'ND',
      targetAccountCode: '6.1.1.2.16',
      targetAccountName: 'Gastos de Personal FAOV / BANAVIH',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'ND pago Aporte FAOV',
        'APORTE FAOV',
        'BANAVIH'
      ],
      notes: 'Monto negativo (-). Partida doble: 6.1.1.2.16 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R11_PRESTAMO',
      order: 11,
      name: 'Regla 11: Préstamo por Pagar',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.20',
      targetAccountName: 'Préstamos y Obligaciones por Pagar',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'ALVA FLOTA C A',
        'PAGO PRESTAMO',
        'AMORTIZACION PRESTAMO'
      ],
      notes: 'Monto negativo (-). Partida doble: 2.1.1.1.20 (+) y Bancamiga 1.1.1.2.20 (-).'
    },
    {
      id: 'BAM_R12_IMPUESTOS_SENIAT',
      order: 12,
      name: 'Regla 12: Impuestos SENIAT',
      ruleType: 'ND',
      targetAccountCode: '2.1.1.1.10',
      targetAccountName: 'Impuestos por Pagar SENIAT',
      contraAccountCode: '1.1.1.2.20',
      contraAccountName: 'Bancamiga Banco Universal Cta Corriente',
      descriptionPatterns: [
        'SENIAT Pagos Web',
        'SENIAT PAGO',
        'SENIAT'
      ],
      notes: 'Monto negativo (-). Partida doble: 2.1.1.1.10 (+) y Bancamiga 1.1.1.2.20 (-).'
    }
  ]
};

// -------------------------------------------------------------
// DICCIONARIO GENERAL DE BANCOS CON SUS REGLAS
// -------------------------------------------------------------
export const ALL_BANK_RULES: Record<string, BankRulesDefinition> = {
  '0102': BDV_RULES_DEFINITION,
  '0105': MERCANTIL_RULES_DEFINITION,
  '0138': PLAZA_RULES_DEFINITION,
  '0134': BANESCO_RULES_DEFINITION,
  '0172': BANCAMIGA_RULES_DEFINITION,
  // Fallbacks estándar para otros bancos venezolanos
  '0191': {
    bankCode: '0191',
    bankName: 'Banco Nacional de Crédito BNC',
    accountCodeBank: '1.1.1.2.91',
    accountNameBank: 'BNC Cta Corriente',
    rules: BDV_RULES_DEFINITION.rules.map(r => ({
      ...r,
      targetAccountCode: r.targetAccountCode === '1.1.1.2.30' ? '1.1.1.2.91' : r.targetAccountCode,
      contraAccountCode: r.contraAccountCode === '1.1.1.2.30' ? '1.1.1.2.91' : r.contraAccountCode
    }))
  }
};

export function getBankRulesDefinition(bankCode?: string): BankRulesDefinition {
  if (bankCode && ALL_BANK_RULES[bankCode]) {
    return ALL_BANK_RULES[bankCode];
  }
  // Default fallback to Banco de Venezuela
  return BDV_RULES_DEFINITION;
}

/**
 * Clasifica una transacción según las reglas del banco especificado.
 * Aplica en el orden estricto de las reglas (1-N).
 */
export function classifyTransactionByBankRules(
  description: string,
  amount: number,
  txType: 'CREDIT' | 'DEBIT',
  bankCode: string = '0102'
): {
  matchedRule: BankRuleItem | null;
  accountCode: string;
  accountName: string;
  contraAccountCode: string;
  contraAccountName: string;
  classificationType: 'NC' | 'ND';
  signedAmount: number;
  moduleTag: string;
  isUnclassified: boolean;
} {
  const bankDef = getBankRulesDefinition(bankCode);
  const upper = description.toUpperCase().trim();
  const isCredit = txType === 'CREDIT' || amount > 0;
  const classificationType = isCredit ? 'NC' : 'ND';
  const signedAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

  // Evaluar reglas en el orden numérico establecido (1, 2, 3...)
  for (const rule of bankDef.rules) {
    if (rule.ruleType !== 'BOTH') {
      if (rule.ruleType === 'NC' && !isCredit) continue;
      if (rule.ruleType === 'ND' && isCredit) continue;
    }

    const matched = rule.descriptionPatterns.some(pattern => {
      const pUpper = pattern.toUpperCase().trim();
      // Si el patrón tiene asteriscos o X's, comparar el prefijo
      const cleanPattern = pUpper.replace(/[X*]+$/, '').trim();
      return upper.includes(cleanPattern);
    });

    if (matched) {
      let moduleTag = 'MOD_VENTAS';
      if (rule.targetAccountCode.startsWith('6.1.2.5')) moduleTag = 'MOD_COMISIONES';
      else if (rule.targetAccountCode.startsWith('2.1.1.1.10') || rule.targetAccountCode.startsWith('2.1.02')) moduleTag = 'MOD_PROVEEDORES';
      else if (rule.targetAccountCode.startsWith('2.1.1.3') || rule.targetAccountCode.startsWith('2.1.03')) moduleTag = 'MOD_SOCIOS_IN';
      else if (rule.targetAccountCode.startsWith('1.1.2.2') || rule.targetAccountCode.startsWith('1.1.03')) moduleTag = 'MOD_CXC_SOCIOS';
      else if (
        rule.targetAccountCode.startsWith('2.1.2.3') ||
        rule.targetAccountCode.startsWith('2.1.2.2') ||
        rule.targetAccountCode.startsWith('2.1.2.1') ||
        rule.targetAccountCode.startsWith('6.1.1.2.19') ||
        rule.targetAccountCode.startsWith('6.1.2.1.40') ||
        rule.targetAccountCode.startsWith('6.1.2.1.64') ||
        rule.targetAccountCode.startsWith('1.2.4.2') ||
        rule.targetAccountCode.startsWith('1.1.4.1')
      ) moduleTag = 'MOD_SENIAT_PAGO';
      else if (rule.targetAccountCode.startsWith('6.1.1.2')) moduleTag = 'MOD_PROVEEDORES'; // Parafiscales BANAVIH / IVSS
      else if (rule.targetAccountCode.startsWith('6.1.2.1')) moduleTag = 'MOD_PROVEEDORES'; // Movistar / Seguros
      else if (rule.targetAccountCode.startsWith('2.1.1.1.20')) moduleTag = 'MOD_PRESTAMOS_IN';
      else if (rule.targetAccountCode.startsWith('1.1.1.2')) moduleTag = isCredit ? 'MOD_VENTAS' : 'MOD_PROVEEDORES';

      return {
        matchedRule: rule,
        accountCode: isCredit ? bankDef.accountCodeBank : rule.targetAccountCode,
        accountName: isCredit ? bankDef.accountNameBank : rule.targetAccountName,
        contraAccountCode: isCredit ? (rule.contraAccountCode || '1.1.2.1.10') : bankDef.accountCodeBank,
        contraAccountName: isCredit ? (rule.contraAccountName || 'Cuentas por Cobrar Clientes') : bankDef.accountNameBank,
        classificationType,
        signedAmount,
        moduleTag,
        isUnclassified: false
      };
    }
  }

  // Si no coincide con ninguna regla, se clasifica como SIN CLASIFICAR / HUÉRFANOS
  return {
    matchedRule: null,
    accountCode: isCredit ? bankDef.accountCodeBank : '2.1.1.1.10',
    accountName: isCredit ? bankDef.accountNameBank : 'Partida Huérfana sin Clasificar',
    contraAccountCode: isCredit ? '1.1.2.1.10' : bankDef.accountCodeBank,
    contraAccountName: isCredit ? 'Cuentas por Cobrar Clientes' : bankDef.accountNameBank,
    classificationType,
    signedAmount,
    moduleTag: 'MOD_HUERFANOS',
    isUnclassified: true
  };
}

/**
 * GENERADOR OFICIAL DEL LIBRO DE BANCOS EN EXCEL (.XLSX)
 * Implementa estrictamente la especificación requerida en los 3 PDFs:
 * 5 Columnas:
 *  1. Cuenta Contable
 *  2. Descripción
 *  3. Tipo (NC para crédito, ND para débito)
 *  4. Referencia
 *  5. Monto (positivo o negativo en una sola columna)
 *
 * 3 Hojas:
 *  - Hoja 1: Todas las transacciones clasificadas
 *  - Hoja 2: Ingresos y Depósitos (NC) totalizados contra Cuentas por Cobrar (1.1.2.1.10) en negativo (Partida Doble = 0.00)
 *  - Hoja 3: Egresos y Débitos (ND) con Partida Doble (filas positivas de gasto/pasivo y filas negativas de banco = 0.00)
 */
export function generateBankLedgerExcel(
  transactions: BankTransaction[],
  bankCode: string = '0102',
  company?: Partial<UserCompanyProfile>,
  currency: CurrencyType = 'VES'
): void {
  // Para Banco de Venezuela (0102), generar según el prompt oficial: asientos_generados.xlsx con las 3 hojas requeridas
  if (bankCode === '0102') {
    generateBdvAsientosExcel(transactions, company, currency);
    return;
  }

  // Para Banesco (0134), generar según el prompt oficial: asientos_generados.xlsx con las 3 hojas requeridas
  if (bankCode === '0134') {
    generateBanescoAsientosExcel(transactions, company, currency);
    return;
  }

  const bankDef = getBankRulesDefinition(bankCode);
  const wb = XLSX.utils.book_new();

  // Filtrar movimientos bancarios de la moneda y banco correspondiente
  const bankTxList = transactions.filter(t =>
    t.source === 'BANK' &&
    t.currency === currency &&
    (!bankCode || bankCode === 'ALL' || t.bankCode === bankCode)
  );

  const cleanCompanyName = company?.companyName || 'EMPRESA CONTRIBUYENTE C.A.';
  const cleanRif = (company?.companyRif || 'J-00000000-0').replace(/[^A-Za-z0-9]/g, '');

  // ==============================================================
  // HOJA 1: RESUMEN GENERAL / ASIENTOS DE ENTRADA CONTABLE
  // ==============================================================
  const sheet1Rows: (string | number)[][] = [
    ['Cuenta Contable', 'Descripción', 'Tipo', 'Referencia', 'Monto']
  ];

  bankTxList.forEach(tx => {
    const res = classifyTransactionByBankRules(tx.rawDescription, tx.amountNominal, tx.txType, tx.bankCode || bankCode);
    const accountCode = res.accountCode;
    const desc = tx.rawDescription;
    const tipo = res.classificationType;
    const ref = tx.referenceNum;
    const monto = res.signedAmount;

    sheet1Rows.push([accountCode, desc, tipo, ref, formatVenezuelanNumber(monto)]);
  });

  const wsSheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  wsSheet1['!cols'] = [
    { wch: 18 }, // Cuenta Contable
    { wch: 45 }, // Descripción
    { wch: 10 }, // Tipo
    { wch: 20 }, // Referencia
    { wch: 18 }  // Monto
  ];

  // ==============================================================
  // HOJA 2: INGRESOS (NC - NOTAS DE CRÉDITO)
  // Totaliza contra 1.1.2.1.10 (Cuentas por Cobrar) en negativo para cuadre a 0.00
  // ==============================================================
  const sheet2Rows: (string | number)[][] = [
    ['CUENTA CONTABLE', 'Descripción', 'TIPO', 'Referencia', 'MONTO']
  ];

  const ncTxList = bankTxList.filter(t => t.txType === 'CREDIT');
  let totalNC = 0;

  ncTxList.forEach(tx => {
    const montoNum = Number(Math.abs(tx.amountNominal).toFixed(2));
    totalNC += montoNum;
    const isBanesco = bankDef.bankCode === '0134';

    sheet2Rows.push([
      bankDef.accountCodeBank,
      isBanesco ? 'BANESCO' : tx.rawDescription,
      'NC',
      tx.referenceNum,
      formatVenezuelanNumber(montoNum)
    ]);
  });

  // Fila totalizadora en negativo (Partida Doble)
  if (ncTxList.length > 0) {
    sheet2Rows.push([
      '1.1.2.1.10',
      'CUENTAS POR COBRAR',
      'NC',
      ncTxList[0]?.referenceNum || '0',
      formatVenezuelanNumber(-totalNC)
    ]);
    sheet2Rows.push(['', 'SALDO NETO PARTIDA DOBLE', '', '', formatVenezuelanNumber(0)]);
  }

  const wsSheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  wsSheet2['!cols'] = [
    { wch: 18 },
    { wch: 45 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // ==============================================================
  // HOJA 3: EGRESOS (ND - NOTAS DE DÉBITO)
  // Primero las filas positivas con su cuenta contable de destino,
  // luego las filas negativas con la cuenta de banco para cumplir partida doble
  // ==============================================================
  const sheet3Rows: (string | number)[][] = [
    ['Cuenta Contable', 'descripcion', 'tipo nd/mc', 'referencia', 'Monto (Bs)']
  ];

  const ndTxList = bankTxList.filter(t => t.txType === 'DEBIT');

  // Bloque A: Filas positivas con cuenta de gasto/pasivo
  ndTxList.forEach(tx => {
    const res = classifyTransactionByBankRules(tx.rawDescription, tx.amountNominal, 'DEBIT', tx.bankCode || bankCode);
    const montoPositivo = Number(Math.abs(tx.amountNominal).toFixed(2));

    sheet3Rows.push([
      res.accountCode, // ej: 6.1.2.5.02 (Comisiones), 2.1.1.1.10 (Proveedores), etc.
      tx.rawDescription,
      'ND',
      tx.referenceNum,
      formatVenezuelanNumber(montoPositivo)
    ]);
  });

  // Bloque B: Mismas filas en negativo con la cuenta de banco (1.1.1.2.10 BANESCO / 1.1.1.2.30 / 1.1.1.2.60)
  ndTxList.forEach(tx => {
    const montoNegativo = Number((-Math.abs(tx.amountNominal)).toFixed(2));
    const isBanesco = bankDef.bankCode === '0134';

    sheet3Rows.push([
      bankDef.accountCodeBank,
      isBanesco ? 'BANESCO' : tx.rawDescription,
      'ND',
      tx.referenceNum,
      formatVenezuelanNumber(montoNegativo)
    ]);
  });

  if (ndTxList.length > 0) {
    sheet3Rows.push(['', 'SALDO NETO PARTIDA DOBLE (SUMA = 0.00)', '', '', formatVenezuelanNumber(0)]);
  }

  const wsSheet3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  wsSheet3['!cols'] = [
    { wch: 18 },
    { wch: 45 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  // Agregar las 3 hojas reglamentarias al Libro Excel
  XLSX.utils.book_append_sheet(wb, wsSheet1, 'Hoja 1 - Entrada Contable');
  XLSX.utils.book_append_sheet(wb, wsSheet2, 'Hoja 2 - Ingresos NC');
  XLSX.utils.book_append_sheet(wb, wsSheet3, 'Hoja 3 - Egresos ND');

  // Descarga del archivo Excel
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const bankShortName = bankDef.bankName.replace(/[^A-Za-z0-9]/g, '_');
  a.download = `LIBRO_DE_BANCOS_${bankShortName}_${cleanRif}_${timestamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
