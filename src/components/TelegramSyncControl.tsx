import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sliders,
  X,
  Sparkles,
  Bot,
  HelpCircle,
  Clock,
  ExternalLink,
  History,
  Trash2,
  Terminal,
  Info,
  Activity,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  getTelegramConfig,
  saveTelegramConfig,
  testTelegramBotConnection,
  syncTelegramUpdates,
  sendTelegramMessage,
  TelegramConfig,
  TelegramSyncEvent,
  getTelegramEventHistory,
  addTelegramEvent,
  clearTelegramEventHistory
} from '../services/telegramSyncService';
import { runVenezuelanAutoMatcher } from '../services/venezuelanAutoMatcher';
import { BankTransaction, DigitalSupportAttachment } from '../types/accounting';

interface TelegramSyncControlProps {
  bcvRate: number;
  transactions: BankTransaction[];
  onUpdateTransactions: (updated: BankTransaction[]) => void;
  onNewSupportsAdded?: (supports: DigitalSupportAttachment[]) => void;
}

export const TelegramSyncControl: React.FC<TelegramSyncControlProps> = ({
  bcvRate,
  transactions,
  onUpdateTransactions,
  onNewSupportsAdded
}) => {
  const [config, setConfig] = useState<TelegramConfig>(getTelegramConfig());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'HISTORY'>('CONFIG');
  const [testResult, setTestResult] = useState<{ success?: boolean; text?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [eventHistory, setEventHistory] = useState<TelegramSyncEvent[]>(() => getTelegramEventHistory());
  const [showBotToken, setShowBotToken] = useState(false);

  // Form state
  const [tempToken, setTempToken] = useState(config.botToken);
  const [tempChatId, setTempChatId] = useState(config.chatId);

  const autoSyncIntervalRef = useRef<any>(null);

  // Recargar config y eventos al montar
  useEffect(() => {
    setConfig(getTelegramConfig());
    setEventHistory(getTelegramEventHistory());
  }, [isModalOpen]);

  // Función de Sincronización
  const handleSyncNow = async () => {
    const currentCfg = getTelegramConfig();
    if (!currentCfg.botToken) {
      setActiveTab('CONFIG');
      setIsModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg('Conectando a Telegram...');

    try {
      const res = await syncTelegramUpdates({
        botToken: currentCfg.botToken,
        lastUpdateId: currentCfg.lastUpdateId,
        bcvRate,
        defaultChatId: currentCfg.chatId
      });

      // Actualizar historial local
      setEventHistory(getTelegramEventHistory());

      if (res.errors.length > 0) {
        setSyncStatusMsg(`Aviso: ${res.errors[0]}`);
      } else if (res.processedCount > 0 || res.clarificationsReceived.length > 0) {
        setSyncStatusMsg(
          `¡Éxito! Se procesaron ${res.processedCount} soportes y ${res.clarificationsReceived.length} respuestas del dueño.`
        );

        // Si llegaron nuevos soportes, notificar y auto-conciliar
        const newAttachments = res.newSupports.map((s) => s.attachment);
        if (onNewSupportsAdded && newAttachments.length > 0) {
          onNewSupportsAdded(newAttachments);
        }

        // Ejecutar cruce automático venezolano
        let currentTxs = [...transactions];

        // Aplicar respuestas del dueño
        if (res.clarificationsReceived.length > 0) {
          currentTxs = currentTxs.map((t) => {
            const clr = res.clarificationsReceived.find((c) => c.txId === t.id);
            if (clr) {
              return {
                ...t,
                moduleTag: clr.selectedModuleTag,
                matchingStatus: 'MATCHED_EXACT',
                autoReconciledBy: 'MANUAL',
                notes: 'Clasificado por el dueño mediante botones interactivos de Telegram.'
              };
            }
            return t;
          });
        }

        const matchReport = runVenezuelanAutoMatcher({
          transactions: currentTxs,
          availableSupports: newAttachments
        });

        onUpdateTransactions(matchReport.updatedTransactions);
      } else {
        setSyncStatusMsg('Al día: no hay nuevos mensajes ni comprobantes pendientes.');
      }

      setConfig(getTelegramConfig());
    } catch (err: any) {
      setSyncStatusMsg(`Error: ${err.message || 'Fallo de conexión'}`);
      setEventHistory(getTelegramEventHistory());
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  // Manejo de Auto-Sync (cada 30 seg)
  useEffect(() => {
    if (config.autoSync && config.botToken) {
      autoSyncIntervalRef.current = setInterval(() => {
        handleSyncNow();
      }, 30000);
    } else {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [config.autoSync, config.botToken, transactions, bcvRate]);

  const handleToggleAutoSync = () => {
    const nextVal = !config.autoSync;
    saveTelegramConfig({ autoSync: nextVal });
    setConfig((prev) => ({ ...prev, autoSync: nextVal }));
  };

  const handleSaveSettings = () => {
    saveTelegramConfig({
      botToken: tempToken,
      chatId: tempChatId
    });
    setConfig(getTelegramConfig());
    setIsModalOpen(false);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!tempToken.trim()) {
      setTestResult({ success: false, text: 'Introduce primero el Bot Token.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const res = await testTelegramBotConnection(tempToken.trim());
    setIsTesting(false);
    if (res.success) {
      addTelegramEvent({
        type: 'SUCCESS',
        title: 'Prueba de Bot (getMe)',
        message: `Token verificado con éxito. Bot: @${res.username} (${res.botName}).`,
        details: { botUsername: res.username, statusText: '200 OK' }
      });
      setEventHistory(getTelegramEventHistory());
      setTestResult({
        success: true,
        text: `✅ Conexión exitosa con el bot "@${res.username}" (${res.botName}).`
      });
    } else {
      addTelegramEvent({
        type: 'ERROR',
        title: 'Prueba de Bot Fallida',
        message: `Fallo al verificar token: ${res.error || 'Token inválido'}`,
        details: { errorDescription: res.error }
      });
      setEventHistory(getTelegramEventHistory());
      setTestResult({
        success: false,
        text: `❌ Error: ${res.error || 'Token inválido'}`
      });
    }
  };

  // Detecta el Chat ID del último mensaje enviado al bot
  const handleDetectChatId = async () => {
    if (!tempToken.trim()) {
      setTestResult({ success: false, text: 'Introduce primero el Bot Token.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tempToken.trim()}/getUpdates?limit=5`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        const lastMsg = data.result[data.result.length - 1];
        const foundChatId = lastMsg.message?.chat?.id || lastMsg.callback_query?.message?.chat?.id;
        const senderName = lastMsg.message?.from?.first_name || lastMsg.message?.chat?.title || 'Usuario';
        if (foundChatId) {
          setTempChatId(foundChatId.toString());
          addTelegramEvent({
            type: 'SUCCESS',
            title: 'Chat ID Detectado',
            message: `Chat ID ${foundChatId} (${senderName}) detectado y asignado exitosamente.`,
            details: { statusText: '200 OK (getUpdates)' }
          });
          setEventHistory(getTelegramEventHistory());
          setTestResult({
            success: true,
            text: `✅ Chat ID detectado: ${foundChatId} (${senderName}). ¡Guardado en el formulario!`
          });
          setIsTesting(false);
          return;
        }
      }
      setTestResult({
        success: false,
        text: 'Abre Telegram, dale "/start" o escribe "Hola" a tu bot y vuelve a pulsar "Detectar mi Chat ID".'
      });
    } catch (err: any) {
      setTestResult({ success: false, text: `Error al detectar: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  // Envía un mensaje real de prueba a Telegram
  const handleSendTestMessage = async () => {
    if (!tempToken.trim() || !tempChatId.trim()) {
      setTestResult({
        success: false,
        text: '❌ Debes ingresar tanto el Bot Token como el Chat ID para enviar un mensaje de prueba.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const text = `🚀 <b>¡Prueba de Conexión Exitosa con NOMINUS Conciliación!</b>\n\nTu bot está correctamente vinculado a tu estación de trabajo contable.\n\n✨ <b>¿Cómo probar ahora mismo?</b>\nEnvía una foto de un capture de Pago Móvil o transferencia bancaria aquí mismo y pulsa <i>"🔄 Sincronizar"</i> en el sistema para verlo procesado y archivado al instante.\n\n📅 <i>${new Date().toLocaleDateString('es-VE')} - Venezuela</i>`;

    const sent = await sendTelegramMessage(tempToken.trim(), tempChatId.trim(), text);
    setIsTesting(false);

    if (sent) {
      addTelegramEvent({
        type: 'SUCCESS',
        title: 'Mensaje de Prueba Enviado',
        message: `Mensaje de prueba entregado con éxito al chat ${tempChatId}.`,
        details: { statusText: '200 OK (sendMessage)' }
      });
      setEventHistory(getTelegramEventHistory());
      setTestResult({
        success: true,
        text: '📲 ¡Mensaje de prueba enviado con éxito! Revisa tu aplicación de Telegram.'
      });
    } else {
      addTelegramEvent({
        type: 'ERROR',
        title: 'Fallo al Enviar Mensaje',
        message: `No se pudo enviar el mensaje al chat ${tempChatId}.`,
        details: { errorDescription: 'Verifica si el usuario le dio /start al bot' }
      });
      setEventHistory(getTelegramEventHistory());
      setTestResult({
        success: false,
        text: '❌ Error enviando mensaje. Asegúrate de haberle escrito "/start" a tu bot primero si es un chat privado.'
      });
    }
  };

  const handleClearHistory = () => {
    clearTelegramEventHistory();
    setEventHistory([]);
  };

  const handleRefreshHistory = () => {
    setEventHistory(getTelegramEventHistory());
  };

  const hasErrorsInHistory = eventHistory.some((e) => e.type === 'ERROR');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Botón Prominente: Sincronizar Soportes desde Telegram */}
      <button
        onClick={handleSyncNow}
        disabled={isSyncing}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-2xs transition-all cursor-pointer ${
          config.botToken
            ? 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
        }`}
        title="Descargar comprobantes fotos, PDFs y audios enviados al bot de Telegram"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Soportes desde Telegram'}
        </span>
      </button>

      {/* Switch Opcional: Auto-sincronizar cada 30 seg */}
      {config.botToken && (
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50/80 border border-sky-200 rounded-lg text-xs font-bold text-sky-950 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.autoSync}
            onChange={handleToggleAutoSync}
            className="w-3.5 h-3.5 text-sky-600 rounded focus:ring-sky-500"
          />
          <span className="text-[11px]">Auto (30s)</span>
        </label>
      )}

      {/* Botón Historial de Eventos (Diagnóstico Técnico) */}
      <button
        onClick={() => {
          setActiveTab('HISTORY');
          setTempToken(config.botToken);
          setTempChatId(config.chatId);
          setEventHistory(getTelegramEventHistory());
          setIsModalOpen(true);
        }}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
        title="Ver historial de los últimos 5 intentos de sincronización (éxitos y errores)"
      >
        <History className="w-3.5 h-3.5 text-slate-600" />
        <span>Historial ({eventHistory.length})</span>
        {hasErrorsInHistory && (
          <span
            className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
            title="Hay errores registrados en los últimos intentos"
          />
        )}
      </button>

      {/* Botón de Ajustes de Telegram */}
      <button
        onClick={() => {
          setActiveTab('CONFIG');
          setTempToken(config.botToken);
          setTempChatId(config.chatId);
          setEventHistory(getTelegramEventHistory());
          setIsModalOpen(true);
        }}
        className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-300"
        title="Configurar Bot Token y Chat ID de Telegram"
      >
        <Bot className="w-4 h-4" />
      </button>

      {/* Mensaje de estado flotante */}
      {syncStatusMsg && (
        <span className="text-[11px] font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md animate-fade-in">
          {syncStatusMsg}
        </span>
      )}

      {/* Modal de Configuración e Historial de Telegram Bot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Módulo Telegram Bot (Sincronización Gratuita)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Captures, fotos, notas de voz y diagnóstico de comunicación en tiempo real.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Navegación: Configuración vs Historial de Eventos */}
            <div className="flex items-center gap-2 border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('CONFIG')}
                className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'CONFIG'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>Configuración & Pruebas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('HISTORY');
                  setEventHistory(getTelegramEventHistory());
                }}
                className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Historial de Eventos (Últimos 5)</span>
                {eventHistory.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    hasErrorsInHistory
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {eventHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* CONTENIDO TAB 1: Configuración & Pruebas */}
            {activeTab === 'CONFIG' && (
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 text-xs">
                {/* Instrucciones 1-2-3 */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>¿Cómo activar tu bot en 30 segundos (100% Gratis)?:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                    <li>Abre Telegram y busca al usuario oficial <strong>@BotFather</strong>.</li>
                    <li>Escribe <code>/newbot</code> y dale un nombre a tu bot (ej: <em>ConciliacionMiEmpresaBot</em>).</li>
                    <li>Copia el <strong>HTTP API Token</strong> que te entrega y pégalo abajo.</li>
                    <li>Escribe <code>/start</code> a tu nuevo bot o agrégalo a un grupo con el dueño para enviar los soportes.</li>
                  </ol>
                </div>

                {/* Formulario */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold block">
                        Telegram Bot Token (HTTP API de @BotFather):
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        Protegido en pantalla
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showBotToken ? 'text' : 'password'}
                        placeholder="ej. 7839218392:AAHdxx_kLz99..."
                        value={tempToken}
                        onChange={(e) => setTempToken(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBotToken(!showBotToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title={showBotToken ? 'Ocultar token' : 'Mostrar token'}
                      >
                        {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold block">
                        Chat ID o ID de Grupo:
                      </label>
                      <button
                        type="button"
                        onClick={handleDetectChatId}
                        disabled={isTesting}
                        className="text-[10px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer bg-sky-50 px-2 py-0.5 rounded border border-sky-200"
                        title="Lee el último mensaje enviado al bot para obtener tu Chat ID automáticamente"
                      >
                        <span>Detectar mi Chat ID Automáticamente</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="ej. 123456789 o -100123456789 (para grupos)"
                      value={tempChatId}
                      onChange={(e) => setTempChatId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Si no lo sabes, dale "/start" o escribe cualquier cosa a tu bot en Telegram y pulsa el botón de arriba.
                    </span>
                  </div>

                  {/* Botones de Prueba y Verificación */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-slate-300"
                      >
                        {isTesting ? 'Probando...' : '🔍 Probar Token con Telegram'}
                      </button>

                      <button
                        type="button"
                        onClick={handleSendTestMessage}
                        disabled={isTesting}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>📲 Enviar Mensaje de Prueba a mi Telegram</span>
                      </button>
                    </div>

                    {testResult && (
                      <div className={`p-2.5 rounded-xl text-xs font-semibold border ${
                        testResult.success
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {testResult.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 2: Historial de Eventos (Últimos 5) */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs">
                {/* Banner de Diagnóstico */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-sky-700 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        Panel de Diagnóstico Técnico (Últimos 5 Intentos)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Registra llamadas a Telegram API (getUpdates/sendMessage), éxitos, comprobantes leídos y errores.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefreshHistory}
                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                      title="Refrescar historial de eventos"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {eventHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                        title="Borrar historial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de Eventos */}
                {eventHistory.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <History className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      No hay eventos registrados en este momento
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Pulsa <strong>"🔄 Sincronizar Soportes desde Telegram"</strong> o <strong>"🔍 Probar Token"</strong> para ejecutar la primera prueba y ver su diagnóstico técnico aquí.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {eventHistory.map((evt, idx) => {
                      const isSuccess = evt.type === 'SUCCESS';
                      const isError = evt.type === 'ERROR';

                      return (
                        <div
                          key={evt.id || idx}
                          className={`p-3 rounded-xl border transition-all ${
                            isError
                              ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                              : isSuccess
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : 'bg-sky-50/60 border-sky-200 text-sky-950'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isError ? (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : isSuccess ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Info className="w-4 h-4 text-sky-600 shrink-0" />
                              )}
                              <span className="font-extrabold text-xs">
                                {evt.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                  isError
                                    ? 'bg-rose-200 text-rose-800'
                                    : isSuccess
                                    ? 'bg-emerald-200 text-emerald-800'
                                    : 'bg-sky-200 text-sky-800'
                                }`}
                              >
                                {isError ? 'Error' : isSuccess ? 'Éxito' : 'Al Día'}
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {evt.formattedTime}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] mt-1.5 leading-relaxed text-slate-700">
                            {evt.message}
                          </p>

                          {/* Detalles Técnicos */}
                          {evt.details && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-600">
                              {evt.details.statusText && (
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  <strong>Status:</strong> {evt.details.statusText}
                                </span>
                              )}
                              {evt.details.updateOffset !== undefined && (
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  <strong>Offset:</strong> {evt.details.updateOffset}
                                </span>
                              )}
                              {evt.details.processedCount !== undefined && (
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  <strong>Soportes:</strong> {evt.details.processedCount}
                                </span>
                              )}
                              {evt.details.botUsername && (
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  <strong>Bot:</strong> @{evt.details.botUsername}
                                </span>
                              )}
                              {evt.details.errorDescription && (
                                <span className="bg-rose-100/80 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                                  <strong>Error API:</strong> {evt.details.errorDescription}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer Modal */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">
                Telegram Bot API • Long Polling sin servidor intermedio
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                {activeTab === 'CONFIG' && (
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Guardar Configuración
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
