import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Landmark,
  Building2,
  Sparkles,
  Printer,
  ChevronDown,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  Zap,
  RefreshCw,
  Send,
  HelpCircle,
  Clock,
  DollarSign,
  Scale,
  Bot,
  MessageSquare,
  GitCompare,
  History,
  ReceiptText,
  ShieldAlert,
  Folders,
  ScrollText,
  Lock,
  LayoutDashboard,
  Banknote,
  Search,
  Check
} from 'lucide-react';
import { UserCompanyProfile } from '../types/accounting';
import { exportManualToWord } from '../services/exportService';

interface ErpProceduralManualProps {
  company: UserCompanyProfile;
  onOpenExportModal?: () => void;
  onOpenUploadModal?: () => void;
  onOpenBankRulesModal?: () => void;
}

export const ErpProceduralManual: React.FC<ErpProceduralManualProps> = ({
  company,
  onOpenExportModal,
  onOpenUploadModal,
  onOpenBankRulesModal
}) => {
  const [activeChapter, setActiveChapter] = useState<string>('CH_MODULES');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = () => {
    exportManualToWord(company);
  };

  const operationalModulesList = [
    {
      num: '1',
      id: 'PENDIENTES_ACLARAR',
      title: 'Movimientos Huérfanos por Aclarar (Modo Rápido 1 Clic)',
      category: 'Clasificación y Triaje',
      icon: Zap,
      color: 'amber',
      objective: 'Identificar y asignar cuenta contable a débitos y créditos del estado de cuenta que no tienen contrapartida o soporte conocido, evitando omisiones contables o fiscales ante el SENIAT.',
      howToUse: [
        'Accede al módulo desde el botón "Huérfanos por Aclarar" en el Navbar o desde la tarjeta en el panel de módulos.',
        'La pantalla muestra una bandeja con cada transacción no identificada, extrayendo el banco, la fecha, el concepto y el monto en Bolívares y Dólares.',
        'Haz clic en el botón de clasificación directa según la naturaleza real del movimiento: [Proveedor], [Préstamo de Socio], [Gasto Menor], [Venta no Registrada] o [Comisión Bancaria].',
        'Si no sabes a qué corresponde el pago, presiona el botón "Consultar por Telegram": el sistema enviará un mensaje interactivo con botones al celular del dueño de la empresa para que responda con 1 toque.'
      ],
      output: 'La transacción queda formalmente asignada a su cuenta contable y se traslada automáticamente a su repositorio temático definitivo, saliendo de la lista de huérfanos.',
      venezuelanRule: 'Evita que el SENIAT aplique la presunción de ingresos omitidos por depósitos no justificados (Código Orgánico Tributario, Art. 129).'
    },
    {
      num: '2',
      id: 'MONTHLY_RECONCILIATION_VAULT',
      title: 'Bóveda de Conciliaciones Mensuales (Histórico Mes a Mes)',
      category: 'Control Histórico',
      icon: History,
      color: 'blue',
      objective: 'Archivar y consultar de manera cronológica cada cierre contable mensual ya conciliado y cuadrado, garantizando la inmutabilidad y disponibilidad de ejercicios anteriores.',
      howToUse: [
        'Selecciona el año y mes contable que deseas inspeccionar (ejemplo: Enero 2026, Febrero 2026, Septiembre 2025).',
        'Visualiza el resumen consolidado del mes: Saldo Inicial Banco, Total Depósitos, Total Egresos, Saldo Final Banco, Saldo Libro Mayor y Diferencia (debe estar en Bs. 0,00).',
        'Descarga la Cédula oficial en PDF o Excel del mes seleccionado con sus firmas de auditoría registradas.',
        'Si requieres reabrir o auditar los movimientos de un mes anterior, utiliza el botón "Restaurar Punto de Control" para cargar el estado íntegro de ese período.'
      ],
      output: 'Expediente histórico auditado por mes con trazabilidad completa de los movimientos y respaldos de la empresa.',
      venezuelanRule: 'Cumplimiento de la obligación legal de conservar libros y respaldos contables por un mínimo de 10 años (Código de Comercio de Venezuela, Art. 44).'
    },
    {
      num: '3',
      id: 'RECONCILIATION',
      title: 'Mesa de Trabajo de Conciliación Bancaria (5 Etapas / Split-Screen)',
      category: 'Conciliación Principal',
      icon: GitCompare,
      color: 'sky',
      objective: 'Comparar simultáneamente el Extracto Bancario (lado izquierdo) contra el Libro Mayor Contable (lado derecho), permitiendo la verificación visual y el cruce manual o automático partida por partida.',
      howToUse: [
        'Revisa en el panel izquierdo las partidas del extracto bancario y en el panel derecho las partidas del libro contable.',
        'Utiliza el buscador por referencia o monto para localizar transacciones específicas en ambos lados.',
        'Para conciliar manualmente una partida que tenga una pequeña diferencia de céntimos o fecha desfasada, selecciónala en ambos paneles y presiona "Emparejar Selección".',
        'Observa en el panel inferior la actualización inmediata de la Ecuación Matemática de Conciliación en tiempo real.'
      ],
      output: 'Listado de partidas conciliadas (marcadas en verde) y separación precisa de partidas en tránsito (depósitos y cheques no cobrados).',
      venezuelanRule: 'Aplicación estricta de la norma Ven-NIF PYME Sección 7 (Estados de Flujos de Efectivo y Conciliación de Cuentas Bancarias).'
    },
    {
      num: '4',
      id: 'RECONCILIATION_RESULTS',
      title: 'Cédula Oficial de Conciliación Ven-NIF y Resultados',
      category: 'Reportes y Dictamen',
      icon: ShieldCheck,
      color: 'emerald',
      objective: 'Generar la carátula y el dictamen técnico de conciliación bancaria en formato formal de 4 columnas, requerida por comisarios mercantiles, bancos y auditores externos.',
      howToUse: [
        'Ingresa al módulo al finalizar el cruce para verificar el diagnóstico de cuadre: Estado "🟢 100% Cuadrada" con Diferencia Bs. 0,00.',
        'Inspecciona las 4 columnas de la ecuación: (1) Saldo según Banco + (2) Depósitos en Tránsito - (3) Cheques no Cobrados = (4) Saldo Conciliado de Libros.',
        'Presiona "Descargar Cédula Oficial Excel (.xlsx)" para obtener la hoja de portada con membrete de la empresa, RIF, fecha de corte y cuadro de firmas profesionales.',
        'Imprime el documento y recaba las firmas de la Gerencia de Administración y del Contador Público Colegiado (C.P.C.).'
      ],
      output: 'Cédula de Cuadre en formato Excel y PDF con portada ejecutiva, fórmula matemática de cuadre y espacios para sellos y firmas de auditoría.',
      venezuelanRule: 'Presentación reglamentaria de la conciliación bancaria para auditorías bajo normas de la Federación de Colegios de Contadores Públicos de Venezuela (FCCPV).'
    },
    {
      num: '5',
      id: 'AI_ASSISTANT',
      title: 'Asistente de Asientos Contables y Ajustes por IA',
      category: 'Procesamiento Inteligente',
      icon: Sparkles,
      color: 'purple',
      objective: 'Analizar descripciones bancarias complejas, corregir inconsistencias en extractos y proponer automáticamente asientos de ajuste en el Libro Diario para partidas bancarias no registradas en libros.',
      howToUse: [
        'Si dispones de un estado de cuenta en formato de texto libre o con conceptos confusos (ejemplo: "PAG PROV 0138 J411499", "TDY COM.P2C VZLA"), pégalo en el asistente.',
        'La Inteligencia Artificial identifica el tipo de operación, la contraparte y la cuenta contable aplicable según el banco.',
        'Revisa los asientos sugeridos generados por la IA en partida doble (Debe y Haber).',
        'Presiona "Aprobar e Incorporar a la Contabilidad" para registrar los asientos directamente en los libros sin tener que transcribirlos a mano.'
      ],
      output: 'Asientos contables en partida doble balanceada listos para exportar o sincronizar con el Libro Mayor.',
      venezuelanRule: 'Cumplimiento del principio de registro oportuno de todas las operaciones y comisiones bancarias del período (Ven-NIF PYME).'
    },
    {
      num: '6',
      id: 'CASH_TRAIL',
      title: 'Arqueos de Caja y Traza de Efectivo (Bolívares y Dólares)',
      category: 'Efectivo y Caja Chica',
      icon: Banknote,
      color: 'amber',
      objective: 'Controlar el flujo de dinero en efectivo (remesas físicas en Bs. y Divisas USD/EUR), arqueos de caja chica, conteo físico de billetes por denominación y su depósito posterior en taquilla bancaria.',
      howToUse: [
        'Apertura de Turno: Ingresa el Fondo Inicial de Caja Chica asignado al cajero.',
        'Registro del Día: Registra las ventas cobradas en efectivo físico y los pagos menores autorizados por caja chica con su respectivo vale o factura legal.',
        'Conteo Físico: Ingresa la cantidad de billetes por cada denominación ($100, $50, $20, $10, $5, $1 o piezas de Bolívares). La app calcula el subtotal y la variación de arqueo (sobrante o faltante).',
        'Despacho al Banco: Al enviar el efectivo a depositar en taquilla bancaria, ingresa el número de planilla o voucher bancario para vincular el depósito con el estado de cuenta.'
      ],
      output: 'Planilla oficial de Arqueo de Caja Chica en Excel (.xlsx) con desglose de billetes, relación de gastos con vale y soporte para el depósito bancario.',
      venezuelanRule: 'Blindaje ante revisiones del SENIAT sobre omisión de ingresos en divisas y cumplimiento de la Ley del IGTF sobre pagos en efectivo en moneda extranjera.'
    },
    {
      num: '7',
      id: 'SENIAT_TAX',
      title: 'Módulo Fiscal SENIAT e Impuestos (IVA, ISLR, IGTF, Pensiones)',
      category: 'Tributación Fiscal',
      icon: ReceiptText,
      color: 'teal',
      objective: 'Calcular, auditar y generar los archivos de retención tributaria exigidos por el SENIAT según la Providencia Administrativa SNAT/2025/000054 (Retenciones IVA 75%/100%), IGTF y Ley de Protección de Pensiones.',
      howToUse: [
        'El módulo analiza automáticamente todos los débitos bancarios que correspondan a pagos de impuestos al SENIAT (formas 99044, 99074, 99021, 99019, 99035) y pagos a proveedores sujetos a retención.',
        'Verifica que el comprobante de retención de IVA se encuentre emitido conforme a la alícuota aplicable (75% general o 100% especial).',
        'Presiona el botón "Generar TXT SENIAT" para compilar el archivo plano oficial de retenciones de IVA estructurado según la normativa del portal fiscal.',
        'Carga el archivo generado directamente en la página web del SENIAT (www.seniat.gob.ve) en la opción "Carga Masiva de Retenciones".'
      ],
      output: 'Archivo plano .TXT oficial para el portal del SENIAT y relación analítica de retenciones practicadas en el mes con su número de comprobante.',
      venezuelanRule: 'Providencia Administrativa SNAT/2025/000054 sobre Agentes de Retención de IVA y calendario especial de contribuyentes especiales.'
    },
    {
      num: '8',
      id: 'SUDEBAN_AML',
      title: 'Escudo SUDEBAN 010.25 y Prevención de Riesgos AML/CFT',
      category: 'Cumplimiento Bancario',
      icon: ShieldAlert,
      color: 'rose',
      objective: 'Blindar a la empresa ante bloqueos de cuentas bancarias y requerimientos de la Unidad de Inteligencia Financiera (UNIF / SUDEBAN) conforme a la Resolución 010.25 sobre Administración de Riesgos de Legitimación de Capitales.',
      howToUse: [
        'El sistema escanea de manera pasiva todas las transacciones que superen los umbrales de alerta regulatoria en Bolívares o Dólares.',
        'Para operaciones de monto significativo o transferencias de terceros no habituales, el módulo solicita asociar la ficha de debida diligencia de la contraparte (RIF, cédula, dirección y origen de fondos).',
        'Inspecciona el semáforo de riesgo: Verde (Bajo Riesgo / Operaciones Ordinarias), Amarillo (Riesgo Medio / Pendiente de Justificar) o Rojo (Alto Riesgo / Sin Identificación de Titular).',
        'Presiona "Generar Dossier de Cumplimiento SUDEBAN" para descargar el expediente consolidado listo para consignar ante el oficial de cumplimiento del banco si solicitan justificar fondos.'
      ],
      output: 'Dossier de Cumplimiento Bancario en PDF/Excel con ficha de la empresa, perfiles de contrapartes, justificación de origen y licitud de fondos.',
      venezuelanRule: 'Resolución SUDEBAN N° 010.25 (Normas relativas a la Administración y Fiscalización de los Riesgos de LC/FT/FPADM en el Sistema Bancario Nacional).'
    },
    {
      num: '9',
      id: 'JUSTIFICATION_MODULES',
      title: 'Justificación de Fondos y 16 Repositorios Digitales',
      category: 'Archivo Documental',
      icon: Folders,
      color: 'cyan',
      objective: 'Clasificar y organizar la totalidad de los movimientos bancarios de la empresa en 16 repositorios temáticos independientes, adjuntando a cada partida su soporte digital inmutable (factura, comprobante o capture).',
      howToUse: [
        'Al culminar el cuadre, presiona "Transferir a Repositorios de Justificación": el sistema distribuye cada débito y crédito en su carpeta correspondiente.',
        'Explora las 16 carpetas temáticas: Ventas, Proveedores, Pagos SENIAT, Socios, Nómina, Préstamos, Comisiones, etc.',
        'Haz clic sobre cualquier partida para ver o adjuntar su comprobante en formato imagen (JPG/PNG) o documento PDF.',
        'Descarga el reporte en Excel de 3 Hojas con la matriz de justificación para fiscalizaciones del SENIAT.'
      ],
      output: 'Reporte Excel ejecutivo con 3 Hojas: (1) Matriz Resumen de Repositorios, (2) Detalle de Operaciones Bancarias y (3) Inventario de Soportes Digitales.',
      venezuelanRule: 'Artículos 86 y 87 de la Ley de Impuesto sobre la Renta (ISLR) sobre la deducibilidad de costos y gastos respaldados por comprobantes válidos.'
    },
    {
      num: '10',
      id: 'LEGAL_CONTRACTS',
      title: 'Contratos Legales y Bóveda de Socios / Préstamos de Accionistas',
      category: 'Sustento Jurídico',
      icon: ScrollText,
      color: 'yellow',
      objective: 'Generar automáticamente contratos de mutuo y convenios de aportes de socios con formalidad mercantil, protegiendo las inyecciones y retiros de capital entre los accionistas y la empresa.',
      howToUse: [
        'Cuando se detecte una transferencia bancaria entre la cuenta de un accionista y la cuenta de la empresa (o viceversa), abre este módulo.',
        'Selecciona el tipo de instrumento jurídico: [Contrato de Mutuo sin Interés], [Préstamo con Interés Legal], [Aporte para Futuros Aumentos de Capital] o [Comisión Mercantil].',
        'Ingresa los datos de las partes (Cédula del socio, porcentaje accionario y plazo de restitución).',
        'El sistema redacta el contrato completo en formato legal venezolano listo para imprimir, firmar en original y autenticar ante Notaría Pública.'
      ],
      output: 'Contrato legal redactado en formato formal conforme al Código de Comercio de Venezuela y Código Civil, con cláusula de no gravabilidad tributaria.',
      venezuelanRule: 'Evita que el SENIAT tipifique los préstamos de accionistas como dividendos encubiertos o ingresos presuntos gravables con tarifa máxima de ISLR.'
    },
    {
      num: '11',
      id: 'AUDIT_VAULT',
      title: 'Expediente y Bóveda Criptográfica SHA-256',
      category: 'Seguridad Probatoria',
      icon: Lock,
      color: 'indigo',
      objective: 'Generar huellas digitales matemáticas (hashes criptográficos SHA-256) a cada cierre mensual, garantizando la inmutabilidad de los registros contables y el principio de no-repudio ante terceros.',
      howToUse: [
        'Al cerrar el mes, dirígete a la Bóveda de Auditoría y presiona "Sellar Cierre Mensual con SHA-256".',
        'El sistema procesa la matriz de transacciones y genera una huella alfanumérica única e irreversible de 64 caracteres.',
        'Cualquier alteración posterior que intente modificarse en una fila, referencia o monto cambiaría la huella matemática, alertando sobre manipulación indebida.',
        'Descarga el Certificado de Integridad Criptográfica para incluirlo en el expediente anual de asamblea de accionistas o auditoría externa.'
      ],
      output: 'Certificado de Sellado Criptográfico con huellas SHA-256 inmutables de los estados financieros y libros contables.',
      venezuelanRule: 'Ley sobre Mensajes de Datos y Firmas Electrónicas de Venezuela (Gaceta Oficial N° 37.148), otorgando plena validez probatoria a documentos electrónicos certificados.'
    },
    {
      num: '12',
      id: 'ERP_EXPORT',
      title: 'Centro de Exportación ERP y Sistemas Contables Venezolanos',
      category: 'Integración de Software',
      icon: Download,
      color: 'emerald',
      objective: 'Exportar los asientos de conciliación y movimientos bancarios en los formatos exactos de importación requeridos por los principales softwares contables utilizados en Venezuela.',
      howToUse: [
        'Verifica que el mes esté conciliado y cuadrado en la Cédula oficial.',
        'Selecciona la tarjeta correspondiente a tu sistema administrativo: SGT Contable (.xlsx 3 hojas), Profit Plus (.txt), Gálac Software (.csv), Saint Enterprise (.txt), Valery (.csv) o Ven-NIF universal.',
        'Presiona "Descargar Archivo": el sistema generará el archivo con la codificación de caracteres, delimitadores y fechas venezolanas correspondientes.',
        'Abre tu sistema contable, ve al menú de importación de comprobantes y selecciona el archivo descargado para registrar el libro diario en segundos.'
      ],
      output: 'Archivos de interfaz directa (.xlsx, .txt, .csv) estructurados por lotes y comprobantes contables balanceados a Bs. 0,00.',
      venezuelanRule: 'Estandarización de cuentas y catálogos contables para compatibilidad con sistemas homologados en Venezuela.'
    },
    {
      num: '13',
      id: 'BANK_RULES',
      title: 'Reglas Contables de Bancos Venezolanos (Planes de Cuentas)',
      category: 'Normativa Bancaria',
      icon: BookOpen,
      color: 'purple',
      objective: 'Consultar y auditar el diccionario de reglas maestras de contabilización para cada institución bancaria nacional (Mercantil, Bancamiga, BDV, BNC, Plaza, Banesco).',
      howToUse: [
        'Abre el catálogo para ver cómo clasifica la aplicación cada concepto bancario específico de tu banco.',
        'Consulta los códigos contables de Banco, Proveedores, Comisiones, Socios, Impuestos SENIAT, Servicios Públicos y Préstamos.',
        'Revisa los patrones de texto reconocidos automáticamente (ejemplo: SGLBTR, BioPago, CCE, Masterdebit, P2C, Domiciliaciones).',
        'Asegúrate de que el código de cuenta asignado a tu banco en la app coincida con tu Plan de Cuentas Maestro en tu ERP principal.'
      ],
      output: 'Diccionario normativo y visualizador de reglas contables de bancos venezolanos con estructura de 5 columnas para SGT Contable.',
      venezuelanRule: 'Planes de cuentas unificados bajo lineamientos de la SUDEBAN y estándares de la Federación de Colegios de Contadores Públicos.'
    }
  ];

  const filteredModules = selectedModuleFilter === 'ALL'
    ? operationalModulesList
    : operationalModulesList.filter(m => m.id === selectedModuleFilter);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
      
      {/* Header Principal del Manual */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-b border-emerald-100/90 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                Manual de Procedimientos y Políticas Contables
              </span>
              <span className="text-[10px] font-mono font-semibold text-slate-500">
                SOP-CON-2026-VEN
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
              Manual Operativo del Sistema, 13 Módulos SGT y Pipeline Telegram
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Guía paso a paso elaborada para personal administrativo, auditores y contadores en Venezuela.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas: Descargar Word e Imprimir */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Descargar Manual de Procedimientos completo en formato Microsoft Word (.doc)"
          >
            <Download className="w-4 h-4" />
            <span>Descargar en Word (.DOC)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer"
            title="Imprimir manual o guardar en PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Ficha Técnica de la Empresa */}
      <div className="bg-slate-50/90 px-5 sm:px-6 py-3 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span><strong>Empresa:</strong> {company.companyName || 'EMPRESA CONTRIBUYENTE, C.A.'}</span>
          <span><strong>RIF:</strong> {company.companyRif || 'J-00000000-0'}</span>
          <span><strong>Tasa Oficial BCV:</strong> Bs. {company.bcvRate ? company.bcvRate.toFixed(4) : 'Consultando...'} / USD</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Normas Ven-NIF PYME | Prov. SENIAT 0071 / 2025/000054 | SUDEBAN Res. 010.25</span>
        </div>
      </div>

      {/* Navegación por Capítulos y Contenido */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        
        {/* Barra Lateral Izquierda: Índice de Capítulos */}
        <div className="lg:col-span-4 border-r border-slate-200 bg-slate-50/40 p-4 space-y-1.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
            Índice de Capítulos Oficiales
          </span>

          {[
            { id: 'CH_MODULES', num: '1', title: '🧩 Manual de los 13 Módulos del Panel SGT', icon: LayoutDashboard, badge: 'Completo' },
            { id: 'CH_TELEGRAM', num: '2', title: '🤖 Conexión Telegram y Pipeline de Soportes', icon: Send, badge: 'SOP Clave' },
            { id: 'CH_SGT_SHEETS', num: '3', title: '📊 Asientos SGT Contable en 3 Hojas (Regla 0.00)', icon: Layers, badge: 'Excel SGT' },
            { id: 'CH_BANK_RULES', num: '4', title: '🏛️ Reglas Contables por Cada Banco Venezolano', icon: Landmark, badge: '6 Bancos' },
            { id: 'CH_DAILY_CLOSING', num: '5', title: '📋 Cierre Mensual, Cédula Ven-NIF y Firmas', icon: CheckCircle2, badge: 'Auditoría' },
            { id: 'CH_PURPOSE', num: '6', title: '🌟 Principios y Políticas de Control Interno', icon: Sparkles, badge: 'Normativo' }
          ].map(ch => {
            const Icon = ch.icon;
            const isActive = activeChapter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{ch.title}</span>
                </div>
                {ch.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 ${
                    isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {ch.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 border-t border-slate-200 mt-4 px-3 space-y-2">
            <span className="text-[11px] text-slate-500 block leading-relaxed">
              💡 <strong>Uso Oficial:</strong> Este manual sirve como protocolo ante auditorías internas, revisiones del SENIAT e inspecciones de cumplimiento bancario de la SUDEBAN.
            </span>
          </div>
        </div>

        {/* Panel Central de Lectura */}
        <div className="lg:col-span-8 p-5 sm:p-7 space-y-6 overflow-y-auto max-h-[750px]">
          
          {/* ========================================================================= */}
          {/* CAPÍTULO 1: MANUAL DE LOS 13 MÓDULOS DEL PANEL OPERATIVO SGT              */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_MODULES' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 1</span>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    Manual de Procedimientos: Los 13 Módulos del Panel Operativo SGT
                  </h3>
                </div>
                
                {/* Selector rápido de módulo para saltar */}
                <select
                  value={selectedModuleFilter}
                  onChange={(e) => setSelectedModuleFilter(e.target.value)}
                  className="text-xs font-semibold p-2 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs"
                >
                  <option value="ALL">Mostrar los 13 Módulos (Completo)</option>
                  {operationalModulesList.map(m => (
                    <option key={m.id} value={m.id}>{m.num}. {m.title}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                El Panel de Módulos Operativos organiza las herramientas especializadas de gestión contable, fiscal y probatoria en Venezuela. Cada módulo responde a una obligación legal, reglamentaria o de control interno:
              </p>

              {/* Lista Desglosada de Módulos */}
              <div className="space-y-5">
                {filteredModules.map(mod => {
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.id}
                      className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                    >
                      {/* Cabecera del Módulo */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm shrink-0">
                            <Icon className="w-5 h-5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                                Módulo #{mod.num}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {mod.category}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                              {mod.title}
                            </h4>
                          </div>
                        </div>
                      </div>

                      {/* Objetivo Contable */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                        <strong className="text-slate-900 block mb-0.5">🎯 Objetivo y Justificación Contable:</strong>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {mod.objective}
                        </p>
                      </div>

                      {/* Instrucciones Paso a Paso */}
                      <div className="text-xs space-y-1.5">
                        <strong className="text-slate-900 block">📝 Procedimiento de Uso Paso a Paso:</strong>
                        <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px] pl-1">
                          {mod.howToUse.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">{step}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Resultados y Norma Venezolana */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100 text-teal-950">
                          <strong>📤 Producto / Salida Generada:</strong>
                          <p className="text-teal-800 mt-0.5">{mod.output}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 text-sky-950">
                          <strong>⚖️ Fundamento Legal / Normativa:</strong>
                          <p className="text-sky-800 mt-0.5">{mod.venezuelanRule}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAPÍTULO 2: CONEXIÓN CON TELEGRAM Y PIPELINE DE SOPORTES DIGITALES        */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_TELEGRAM' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 2</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  Manual de Conexión de Telegram y Pipeline de Recepción de Soportes
                </h3>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Este capítulo describe el procedimiento operativo estandarizado para enlazar el bot de Telegram de la empresa con NOMINUS, recibir fotos de comprobantes de pago (Pago Móvil, transferencias y facturas), procesarlos con Inteligencia Artificial (OCR) y distribuirlos automáticamente en la contabilidad.
              </p>

              {/* FASE A: CONFIGURACIÓN DEL BOT */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-xs">
                    A
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Fase A: Creación y Conexión del Bot en Telegram (Paso a Paso)
                  </h4>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed pl-1">
                  <li>
                    <strong>Abrir Telegram y buscar a @BotFather:</strong> En la barra de búsqueda de Telegram, escribe <code>@BotFather</code> (asegúrate de que tenga la insignia de cuenta verificada).
                  </li>
                  <li>
                    <strong>Crear un nuevo Bot:</strong> Envía el comando <code>/newbot</code>. BotFather te pedirá un nombre público (ejemplo: <em>Cobranzas y Pagos Empresa C.A.</em>) y un nombre de usuario que termine obligatoriamente en "bot" (ejemplo: <code>empresa_cobranzas_bot</code>).
                  </li>
                  <li>
                    <strong>Copiar el Token de API HTTP:</strong> BotFather responderá con un mensaje de felicitación y te entregará el Token de Acceso, que luce similar a: <code>7123456789:AAHxx_xXxXxXxxXxx...</code>. Copia este texto completo.
                  </li>
                  <li>
                    <strong>Pegar el Token en NOMINUS:</strong> En la barra superior de la aplicación, haz clic en el botón de Telegram y ve a la pestaña <em>Configuración</em>. Pega el Token en la casilla correspondiente.
                  </li>
                  <li>
                    <strong>Obtener el Chat ID:</strong> Si deseas que los comprobantes provengan de un grupo de cobranza de la empresa, agrega al bot a ese grupo. El sistema detectará automáticamente el Chat ID del grupo o canal.
                  </li>
                  <li>
                    <strong>Probar Conexión:</strong> Presiona el botón <strong>"Probar Conexión"</strong>. El sistema enviará un mensaje de saludo a Telegram confirmando que el canal está enlazado y listo para recibir soportes.
                  </li>
                </ol>
              </div>

              {/* FASE B: PROCEDIMIENTO DE RECEPCIÓN */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs">
                    B
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Fase B: Procedimiento de Envío y Recepción de Soportes Digitales
                  </h4>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  ¿Cómo viaja un comprobante desde el celular de un cliente o vendedor hasta el libro contable de la empresa?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-[11px]">1. Envío al Bot</span>
                    <p className="text-slate-600 text-[10px]">
                      El cliente o cajero envía la captura de pantalla o foto de la factura por chat al bot de Telegram.
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-[11px]">2. Descarga Segura</span>
                    <p className="text-slate-600 text-[10px]">
                      NOMINUS intercepta la imagen, descarga el archivo en alta resolución y registra fecha, hora y remitente.
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-[11px]">3. Extracción OCR por IA</span>
                    <p className="text-slate-600 text-[10px]">
                      La IA lee la imagen y extrae Banco emisor/receptor, Referencia, Monto en Bs./USD y Cédula/RIF.
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-[11px]">4. Cruce y Sellado</span>
                    <p className="text-slate-600 text-[10px]">
                      El sistema busca la transacción bancaria por referencia y monto y le anexa la foto automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* FASE C: DISTRIBUCIÓN EN LA APP */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 font-extrabold flex items-center justify-center text-xs">
                    C
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Fase C: Cómo se Distribuyen los Soportes en las 16 Carpetas de la App
                  </h4>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  Una vez extraída la información, el motor de clasificación distribuye cada soporte en una de las 16 bóvedas contables según su naturaleza económica:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">1. Ventas y Facturas Fiscales (MOD_VENTAS):</strong>
                    <span className="text-[10px] text-slate-600">Captures de transferencias por ventas con su factura o nota de entrega.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">2. Puntos de Venta y BioPago (MOD_POS):</strong>
                    <span className="text-[10px] text-slate-600">Cierres de lote de puntos de venta y liquidaciones de tarjetas.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">3. Proveedores y Compras (MOD_PROVEEDORES):</strong>
                    <span className="text-[10px] text-slate-600">Pagos a suplidores con factura fiscal y comprobante de retención.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">4. Tributos SENIAT (MOD_SENIAT_PAGO):</strong>
                    <span className="text-[10px] text-slate-600">Planillas de pago de IVA, ISLR, IGTF, Pensiones y recibos de taquilla.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">5. Cuentas con Socios (MOD_SOCIOS_IN / MOD_CXC_SOCIOS):</strong>
                    <span className="text-[10px] text-slate-600">Transferencias de o hacia accionistas con su contrato de mutuo.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block text-[11px]">6. Nómina y Sueldos (MOD_NOMINA):</strong>
                    <span className="text-[10px] text-slate-600">Listados de transferencias a empleados y recibos firmados de pago.</span>
                  </div>
                </div>
              </div>

              {/* FASE D: SOPORTES HUÉRFANOS Y CONSULTA INTERACTIVA */}
              <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                <strong className="flex items-center gap-1.5 text-sm font-extrabold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Fase D: Protocolo para Soportes Huérfanos e Interacción con el Socio</span>
                </strong>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Si un cliente envía una foto de Pago Móvil pero el dinero aún no cae en el extracto, o si aparece un cobro en el banco que nadie ha justificado:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 pl-1">
                  <li>El comprobante pasa a la <strong>Carpeta de Huérfanos (MOD_HUERFANOS)</strong> para no mezclarlo con las operaciones cuadradas.</li>
                  <li>El sistema envía una consulta interactiva a Telegram al teléfono del socio: <em>"Se recibió el pago de Bs. 450 Ref. 8831. ¿A qué corresponde?"</em></li>
                  <li>El socio pulsa un botón en Telegram: <code>[1. Venta Cliente]</code>, <code>[2. Cobranza Factura]</code>, <code>[3. Préstamo Personal]</code>.</li>
                  <li>Al responder, la app de NOMINUS reclasifica el movimiento automáticamente sin intervención manual.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAPÍTULO 3: ESTRUCTURA SGT CONTABLE EN 3 HOJAS (REGLA 0.00)               */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_SGT_SHEETS' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 3</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  Generación de Asientos para SGT Contable (Estructura de 3 Hojas)
                </h3>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                El sistema compila el libro de asientos contables en un archivo Excel (<code>asientos_generados.xlsx</code>) organizado en 3 hojas de cálculo independientes con estricto balance a <strong>0,00 Bs.</strong> conforme al formato requerido por SGT Contable:
              </p>

              <div className="space-y-4 text-xs">
                
                {/* Hoja 1 */}
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900 text-xs">Hoja 1: Entrada Contable Completa (NC y ND)</strong>
                    <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Todos los movimientos</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Contiene la totalidad de los registros extraídos del estado de cuenta bancario, manteniendo los montos positivos (+) y negativos (-) en la misma columna.
                  </p>
                  <div className="font-mono text-[10px] bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700">
                    CUENTA CONTABLE | DESCRIPCION | TIPO (NC/ND) | REFERENCIA | MONTO
                  </div>
                </div>

                {/* Hoja 2 */}
                <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-emerald-950 text-xs">Hoja 2: Notas de Crédito (NC - Ingresos) con Contrapartida 0,00</strong>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">Suma = 0,00</span>
                  </div>
                  <ol className="list-decimal list-inside text-emerald-900 text-[11px] space-y-1">
                    <li>Filtra todas las transacciones con monto positivo extraídas del extracto.</li>
                    <li>Asigna el código de cuenta contable del Banco (ejemplo: <code>1.1.1.2.60</code> para Mercantil o <code>1.1.1.2.20</code> para Bancamiga) y Tipo <code>NC</code>.</li>
                    <li><strong>Fila de Contrapartida Obligatoria al Final:</strong> Se añade una fila adicional con Cuenta <code>1.1.2.1.10</code> (Cuentas por cobrar), Descripción <em>"Cuentas por cobrar (contrapartida NC)"</em>, Tipo <code>NC</code>, Referencia <code>RES-[FECHA]</code> y Monto igual a la suma total en <strong>negativo (-)</strong>.</li>
                    <li><strong>Validación:</strong> La suma total de la columna Monto es exactamente <strong>0,00</strong>.</li>
                  </ol>
                </div>

                {/* Hoja 3 */}
                <div className="p-4 rounded-3xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-blue-950 text-xs">Hoja 3: Notas de Débito (ND - Egresos) con Partida Doble 0,00</strong>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded">Suma = 0,00</span>
                  </div>
                  <ol className="list-decimal list-inside text-blue-900 text-[11px] space-y-1">
                    <li>Filtra todas las transacciones con monto negativo (salidas de dinero).</li>
                    <li>Primero se asientan las partidas de gasto/pasivo (Proveedores <code>2.1.1.1.10</code>, Comisiones <code>6.1.2.5.02</code>, Impuestos, etc.) con signo <strong>positivo (+)</strong> y Tipo <code>ND</code>.</li>
                    <li>A continuación, se duplican las mismas filas con signo <strong>negativo (-)</strong> y asignadas a la cuenta contable del Banco emisor.</li>
                    <li><strong>Validación:</strong> Se cumple la regla contable de la partida doble y la suma total cierra en <strong>0,00</strong>.</li>
                  </ol>
                </div>

                {/* Regla de formato */}
                <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs">
                  <strong>Formato Numérico Venezolano Estricto:</strong> Se utiliza obligatoriamente el formato <code>-1.234,10</code> y <code>1.234,10</code> (separador de miles con punto y decimales con coma a 2 dígitos).
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAPÍTULO 4: REGLAS CONTABLES POR CADA BANCO VENEZOLANO                    */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_BANK_RULES' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 4</span>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    Catálogo de Cuentas y Reglas por Cada Banco
                  </h3>
                </div>
                {onOpenBankRulesModal && (
                  <button
                    onClick={onOpenBankRulesModal}
                    className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl border border-purple-200 transition-colors cursor-pointer"
                  >
                    Abrir Visor Completo →
                  </button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                {/* Mercantil */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">Banco Mercantil (Código 0105):</strong>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-800">Cta. 1.1.1.2.60</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Ingresos (Crédito Inmediato, Pago Móvil, Transf CCE) a <code>1.1.1.2.60</code> contra CxC <code>1.1.2.1.10</code>. Proveedores (SGLBTR) a <code>2.1.1.1.10</code>. Comisiones a <code>6.1.2.5.02</code>. Timbres a <code>6.1.2.1.64</code>. SENIAT Anticipo ISLR a <code>1.2.4.2.30</code>, Retención IVA a <code>2.1.2.3.15</code>, Pensiones a <code>6.1.1.2.19</code>, Socios a <code>1.1.2.2.30</code>.
                  </p>
                </div>

                {/* Bancamiga */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">Bancamiga (Código 0172):</strong>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-800">Cta. 1.1.1.2.20</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Ingresos a <code>1.1.1.2.20</code> contra CxC <code>1.1.2.1.10</code>. Consumos Masterdebit Proveedores a <code>2.1.1.1.10</code>. Comisiones LBTR/SMS a <code>6.1.2.5.02</code>. Socios (Salida Fondos BCV) a <code>1.1.2.2.30</code>. Teléfono a <code>6.1.2.1.15</code>, Luz a <code>6.1.2.1.20</code>, Agua a <code>6.1.2.1.05</code>, Gasolina a <code>6.1.2.1.06</code>, FAOV a <code>6.1.1.2.16</code>.
                  </p>
                </div>

                {/* BDV */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">Banco de Venezuela (Código 0102):</strong>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-800">Cta. 1.1.1.2.30 / 1.1.1.2.20</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    BioPago, Patria, PagoMóvilBDV a <code>1.1.1.2.30</code> contra CxC <code>1.1.2.1.10</code>. Domiciliaciones y Proveedores a <code>2.1.1.1.10</code>. Cuentas Socios a <code>2.1.1.3.15</code> o <code>1.1.2.2.30</code>. Comisiones bancarias a <code>6.1.2.5.02</code>.
                  </p>
                </div>

                {/* Plaza */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">Banco Plaza (Código 0138):</strong>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-800">Cta. 1.1.1.2.10</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Ingresos a <code>1.1.1.2.10</code> contra CxC <code>1.1.2.1.10</code>. Proveedores a <code>2.1.1.1.10</code>. Gastos bancarios a <code>6.1.2.5.03</code>. Comisiones a <code>6.1.2.5.02</code>. Timbres a <code>6.1.2.1.64</code>. Seguros a <code>6.1.2.1.25</code>. Socios a <code>1.1.2.2.30</code>.
                  </p>
                </div>

                {/* BNC y Banesco */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">Banco BNC (0191) y Banesco (0134):</strong>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-800">Cta. 1.1.1.2.40 / 1.1.1.2.10</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Transferencias recibidas a cuenta banco contra CxC <code>1.1.2.1.10</code>. Anticipos ISLR 99044 (<code>1.2.4.2.30</code>), IGTF 99021 (<code>2.1.2.2.20</code>), Pensiones 99019 (<code>6.1.1.2.19</code>) y Retenciones ISLR 99074 (<code>2.1.2.3.10</code>).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAPÍTULO 5: CIERRE MENSUAL Y PROTOCOLO DE FIRMAS                          */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_DAILY_CLOSING' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 5</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  Protocolo de Cierre Mensual, Cédula Ven-NIF y Suscripción Formal
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
                  <strong className="text-slate-900 block text-xs">Pasos de Auditoría de Fin de Mes:</strong>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700 text-[11px] pl-1">
                    <li>Verificar que el saldo conciliado bancario coincida con el saldo del mayor contable (Diferencia = Bs. 0,00).</li>
                    <li>Descargar la Cédula de Cuadre y Portada de Conciliación en Excel (.xlsx) con la prueba de efectivo en 4 columnas.</li>
                    <li>Exportar el archivo <code>asientos_generados.xlsx</code> para cargar el comprobante contable mensual en SGT Contable o ERP.</li>
                    <li>Sellar el cierre en la Bóveda Criptográfica SHA-256 para generar el hash de seguridad inmutable.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <strong className="text-slate-900 block text-xs">Acta Formal de Conformidad y Firmas de Responsabilidad:</strong>
                  <div className="grid grid-cols-2 gap-3 pt-2 text-center text-[10px]">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="h-10 border-b border-slate-300 mb-1"></div>
                      <span className="font-bold text-slate-900 block">GERENCIA GENERAL / ADMINISTRACIÓN</span>
                      <span className="text-slate-500">Representante Legal</span>
                      <span className="text-slate-400 block mt-0.5">{company.companyName}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="h-10 border-b border-slate-300 mb-1"></div>
                      <span className="font-bold text-slate-900 block">CONTADOR PÚBLICO COLEGIADO (C.P.C.)</span>
                      <span className="text-slate-500">Auditor Interno / Contador General</span>
                      <span className="text-slate-400 block mt-0.5">Matrícula C.P.C. N° ______________</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAPÍTULO 6: PRINCIPIOS Y POLÍTICAS DE CONTROL INTERNO                     */}
          {/* ========================================================================= */}
          {activeChapter === 'CH_PURPOSE' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Capítulo 6</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  Principios Contables y Políticas de Control Interno
                </h3>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <strong className="text-slate-900 block">1. Principio de Registro Oportuno y No Compensación:</strong>
                  <p className="text-[11px] text-slate-600">
                    No se permite compensar ingresos con egresos en una sola cifra neta. Cada débito y cada crédito bancario debe tener su asiento individual.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <strong className="text-slate-900 block">2. Justificación Documental Mandatoria:</strong>
                  <p className="text-[11px] text-slate-600">
                    Ningún egreso mayor a la unidad tributaria puede registrarse como gasto deducible si no cuenta con factura fiscal legal bajo Providencia SENIAT 0071 o soporte bancario comprobable.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <strong className="text-slate-900 block">3. Resguardo de Copias de Seguridad Cifradas:</strong>
                  <p className="text-[11px] text-slate-600">
                    Al final de cada mes debe generarse una copia de seguridad en la Bóveda Cifrada AES-256 para preservar los datos de la empresa de forma local y soberana.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
