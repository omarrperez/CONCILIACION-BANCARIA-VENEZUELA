/**
 * Servicio de Sincronización Gratuita con Telegram Bot API
 * Utiliza Long Polling (getUpdates) sin necesidad de servidor intermedio ni webhook público.
 */

import { classifyReceiptWithGemini, VenezuelanReceiptData, MODULE_MAP_NAMES } from './geminiReceiptClassifier';
import { DigitalSupportAttachment, BankTransaction } from '../types/accounting';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  lastUpdateId: number;
  autoSync: boolean;
}

const STORAGE_KEYS = {
  BOT_TOKEN: 'nominus_telegram_bot_token',
  CHAT_ID: 'nominus_telegram_chat_id',
  LAST_UPDATE_ID: 'nominus_telegram_last_update_id',
  AUTO_SYNC: 'nominus_telegram_auto_sync',
  EVENT_HISTORY: 'nominus_telegram_event_history'
};

export interface TelegramSyncEvent {
  id: string;
  timestamp: string;
  formattedTime: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  title: string;
  message: string;
  details?: {
    processedCount?: number;
    clarificationsCount?: number;
    errorDescription?: string;
    botUsername?: string;
    updateOffset?: number;
    statusText?: string;
    rawError?: string;
  };
}

/**
 * Obtiene el historial de los últimos 5 eventos de sincronización guardados
 */
export function getTelegramEventHistory(): TelegramSyncEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENT_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

/**
 * Sanitiza cualquier texto, descripción o mensaje de error para evitar que tokens de bots,
 * API keys de Gemini o credenciales sensibles queden expuestas en pantalla, logs o almacenamiento.
 */
export function sanitizeSecretText(text: string, tokenToMask?: string): string {
  if (!text) return '';
  let cleaned = String(text);

  // Enmascarar token específico si se suministra
  if (tokenToMask && tokenToMask.length > 8) {
    const mask = `${tokenToMask.slice(0, 4)}...***`;
    cleaned = cleaned.replaceAll(tokenToMask, mask);
  }

  // Enmascarar cualquier patrón tipo Bot Token de Telegram en URLs o textos
  cleaned = cleaned.replace(/(\/bot)\d+:[A-Za-z0-9_-]{20,}(\/)/gi, '$1[TOKEN_ENMASCARADO]$2');
  cleaned = cleaned.replace(/\b\d{8,11}:[A-Za-z0-9_-]{30,}\b/g, '[TOKEN_ENMASCARADO]');

  // Enmascarar cualquier patrón de Google / Gemini API key
  cleaned = cleaned.replace(/AIzaSy[A-Za-z0-9_-]{30,}/g, '[GEMINI_KEY_ENMASCARADA]');

  return cleaned;
}

/**
 * Registra un nuevo evento de sincronización manteniendo estrictamente los últimos 5 intentos
 */
export function addTelegramEvent(
  event: Omit<TelegramSyncEvent, 'id' | 'timestamp' | 'formattedTime'>
): TelegramSyncEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const now = new Date();
    const formattedTime = `${now.toLocaleTimeString('es-VE')} - ${now.toLocaleDateString('es-VE')}`;
    const sanitizedTitle = sanitizeSecretText(event.title);
    const sanitizedMessage = sanitizeSecretText(event.message);
    const sanitizedDetails = event.details
      ? {
          ...event.details,
          errorDescription: event.details.errorDescription
            ? sanitizeSecretText(event.details.errorDescription)
            : undefined,
          rawError: event.details.rawError
            ? sanitizeSecretText(event.details.rawError)
            : undefined,
          statusText: event.details.statusText
            ? sanitizeSecretText(event.details.statusText)
            : undefined
        }
      : undefined;

    const newEntry: TelegramSyncEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      formattedTime,
      type: event.type,
      title: sanitizedTitle,
      message: sanitizedMessage,
      details: sanitizedDetails
    };

    const current = getTelegramEventHistory();
    const updated = [newEntry, ...current].slice(0, 5);
    localStorage.setItem(STORAGE_KEYS.EVENT_HISTORY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Error saving Telegram event history:', err);
    return [];
  }
}

/**
 * Limpia el historial de eventos de Telegram
 */
export function clearTelegramEventHistory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.EVENT_HISTORY);
}

/**
 * Obtiene la configuración de Telegram almacenada
 */
export function getTelegramConfig(): TelegramConfig {
  if (typeof localStorage === 'undefined') {
    return { botToken: '', chatId: '', lastUpdateId: 0, autoSync: false };
  }

  const botToken = localStorage.getItem(STORAGE_KEYS.BOT_TOKEN) || '';
  const chatId = localStorage.getItem(STORAGE_KEYS.CHAT_ID) || '';
  const lastUpdateId = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_UPDATE_ID) || '0', 10) || 0;
  const autoSync = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC) === 'true';

  return { botToken, chatId, lastUpdateId, autoSync };
}

/**
 * Guarda la configuración de Telegram
 */
export function saveTelegramConfig(updates: Partial<TelegramConfig>): void {
  if (typeof localStorage === 'undefined') return;

  if (updates.botToken !== undefined) {
    localStorage.setItem(STORAGE_KEYS.BOT_TOKEN, updates.botToken.trim());
  }
  if (updates.chatId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.CHAT_ID, updates.chatId.trim());
  }
  if (updates.lastUpdateId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE_ID, updates.lastUpdateId.toString());
  }
  if (updates.autoSync !== undefined) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, updates.autoSync ? 'true' : 'false');
  }
}

/**
 * Convierte un Blob o File a Base64 puro (sin prefijo data URL)
 */
export function blobToBase64(blob: Blob): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Prueba la conexión con el bot de Telegram
 */
export async function testTelegramBotConnection(token: string): Promise<{
  success: boolean;
  botName?: string;
  username?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        botName: data.result.first_name,
        username: data.result.username
      };
    } else {
      return {
        success: false,
        error: sanitizeSecretText(data.description || 'Token inválido', token)
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: sanitizeSecretText(err.message || 'Error de conexión con Telegram API', token)
    };
  }
}

/**
 * Envía un mensaje de texto con o sin teclado inline al chat de Telegram
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>
): Promise<boolean> {
  if (!token || !chatId) return false;

  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };

    if (inlineKeyboard && inlineKeyboard.length > 0) {
      body.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    console.warn('Error enviando mensaje a Telegram:', err);
    return false;
  }
}

/**
 * Envía una consulta al dueño para que aclare un movimiento bancario huérfano con botones inline
 */
export async function sendQuestionToOwner(
  token: string,
  chatId: string,
  tx: BankTransaction,
  currencySymbol: string = 'Bs.'
): Promise<boolean> {
  const montoFmt = `${currencySymbol} ${tx.amountNominal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
  const text = `❓ <b>Consulta de Conciliación Bancaria:</b>
El banco registra un movimiento sin soporte digital:

📅 <b>Fecha:</b> ${tx.txDate}
💰 <b>Monto:</b> <b>${montoFmt}</b> (${tx.txType === 'DEBIT' ? 'Salida/Débito' : 'Entrada/Crédito'})
🏦 <b>Banco:</b> ${tx.bankName}
🔢 <b>Referencia:</b> <code>${tx.referenceNum}</code>
📝 <b>Concepto Bancario:</b> <i>"${tx.rawDescription}"</i>

¿A qué corresponde este movimiento para asignarlo a su repositorio contable?`;

  const inlineKeyboard = [
    [
      { text: '👤 Cuenta Socio (Gasto Personal)', callback_data: `CLARIFY:${tx.id}:MOD_CXC_SOCIOS` },
      { text: '📦 Proveedor / Compras', callback_data: `CLARIFY:${tx.id}:MOD_PROVEEDORES` }
    ],
    [
      { text: '🔄 Transferencia Entre Cuentas', callback_data: `CLARIFY:${tx.id}:MOD_TFR_PROPIAS_OUT` },
      { text: '🧾 Gasto Operativo / General', callback_data: `CLARIFY:${tx.id}:MOD_ANTICIPOS` }
    ],
    [
      { text: '💵 Cobro de Factura / Venta', callback_data: `CLARIFY:${tx.id}:MOD_VENTAS` },
      { text: '🤝 Aporte de Socio', callback_data: `CLARIFY:${tx.id}:MOD_SOCIOS_IN` }
    ]
  ];

  return sendTelegramMessage(token, chatId, text, inlineKeyboard);
}

/**
 * Descarga un archivo de Telegram a través de getFile y lo devuelve en Base64
 */
export async function downloadTelegramFile(
  token: string,
  fileId: string
): Promise<{ base64: string; dataUrl: string; mimeType: string; sizeBytes: number } | null> {
  try {
    // 1. Obtener file_path
    const fileMetaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileMetaData = await fileMetaRes.json();
    if (!fileMetaData.ok || !fileMetaData.result?.file_path) {
      console.warn('No se pudo obtener file_path de Telegram:', fileMetaData);
      return null;
    }

    const filePath = fileMetaData.result.file_path;
    const sizeBytes = fileMetaData.result.file_size || 0;

    // 2. Descargar el binario
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    const blob = await downloadRes.blob();

    // Determinar mimeType
    let mimeType = blob.type || 'image/jpeg';
    if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (filePath.endsWith('.png')) mimeType = 'image/png';
    else if (filePath.endsWith('.oga') || filePath.endsWith('.ogg')) mimeType = 'audio/ogg';

    const { base64, dataUrl } = await blobToBase64(blob);

    return { base64, dataUrl, mimeType, sizeBytes };
  } catch (err) {
    console.warn('Error descargando archivo de Telegram:', err);
    return null;
  }
}

export interface TelegramSyncResult {
  processedCount: number;
  newSupports: Array<{
    attachment: DigitalSupportAttachment;
    receiptData: VenezuelanReceiptData;
    targetModuleTag: string;
  }>;
  clarificationsReceived: Array<{
    txId: string;
    selectedModuleTag: string;
  }>;
  errors: string[];
}

/**
 * Función principal: Realiza Long Polling a Telegram vía getUpdates y procesa fotos, PDFs y audios
 */
export async function syncTelegramUpdates(params: {
  botToken: string;
  lastUpdateId: number;
  bcvRate: number;
  defaultChatId?: string;
}): Promise<TelegramSyncResult> {
  const { botToken, lastUpdateId, bcvRate, defaultChatId } = params;
  const result: TelegramSyncResult = {
    processedCount: 0,
    newSupports: [],
    clarificationsReceived: [],
    errors: []
  };

  if (!botToken) {
    const errMsg = 'No se ha configurado el Bot Token de Telegram.';
    result.errors.push(errMsg);
    addTelegramEvent({
      type: 'ERROR',
      title: 'Token no configurado',
      message: errMsg,
      details: { errorDescription: 'Falta Bot Token en configuración' }
    });
    return result;
  }

  try {
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0;
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10&allowed_updates=["message","callback_query"]`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.result)) {
      const desc = data.description || 'Error obteniendo actualizaciones de Telegram';
      result.errors.push(desc);
      addTelegramEvent({
        type: 'ERROR',
        title: 'Error Telegram API (HTTP getUpdates)',
        message: desc,
        details: {
          errorDescription: desc,
          updateOffset: offset,
          statusText: `API Response: ${JSON.stringify(data).slice(0, 80)}`
        }
      });
      return result;
    }

    const updates = data.result;
    let highestUpdateId = lastUpdateId;

    for (const update of updates) {
      if (update.update_id > highestUpdateId) {
        highestUpdateId = update.update_id;
      }

      // Caso A: El usuario presionó un botón inline en Telegram (Callback Query)
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbData: string = cb.data || '';
        if (cbData.startsWith('CLARIFY:')) {
          const parts = cbData.split(':');
          const txId = parts[1];
          const moduleTag = parts[2];
          if (txId && moduleTag) {
            result.clarificationsReceived.push({ txId, selectedModuleTag: moduleTag });

            // Responder al botón de Telegram
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: `✅ Asignado a ${MODULE_MAP_NAMES[moduleTag] || moduleTag}`
                })
              });

              if (cb.message?.chat?.id) {
                await sendTelegramMessage(
                  botToken,
                  cb.message.chat.id.toString(),
                  `✅ <b>Movimiento clasificado:</b> Guardado en <b>${MODULE_MAP_NAMES[moduleTag] || moduleTag}</b> con éxito.`
                );
              }
            } catch (err) {
              console.warn('Error respondiendo callback query:', err);
            }
          }
        }
        continue;
      }

      // Caso B: Mensaje entrante con foto, documento o nota de voz
      const message = update.message;
      if (!message) continue;

      const chatId = message.chat?.id ? message.chat.id.toString() : defaultChatId;
      const captionText = message.caption || message.text || '';

      let imageBase64: string | undefined = undefined;
      let imageMimeType: string = 'image/jpeg';
      let imageSize = 0;
      let imageDataUrl = '';

      let audioBase64: string | undefined = undefined;
      let audioMimeType: string = 'audio/ogg';

      // 1. Verificar si tiene foto (tomar la de mayor resolución)
      if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
        const bestPhoto = message.photo[message.photo.length - 1];
        const downloaded = await downloadTelegramFile(botToken, bestPhoto.file_id);
        if (downloaded) {
          imageBase64 = downloaded.base64;
          imageMimeType = downloaded.mimeType;
          imageSize = downloaded.sizeBytes;
          imageDataUrl = downloaded.dataUrl;
        }
      }

      // 2. Verificar si tiene documento (PDF o imagen adjunta como archivo)
      else if (message.document) {
        const doc = message.document;
        const downloaded = await downloadTelegramFile(botToken, doc.file_id);
        if (downloaded) {
          imageBase64 = downloaded.base64;
          imageMimeType = downloaded.mimeType;
          imageSize = downloaded.sizeBytes;
          imageDataUrl = downloaded.dataUrl;
        }
      }

      // 3. Verificar si tiene nota de voz o audio
      if (message.voice) {
        const downloadedAudio = await downloadTelegramFile(botToken, message.voice.file_id);
        if (downloadedAudio) {
          audioBase64 = downloadedAudio.base64;
          audioMimeType = downloadedAudio.mimeType;
        }
      } else if (message.audio) {
        const downloadedAudio = await downloadTelegramFile(botToken, message.audio.file_id);
        if (downloadedAudio) {
          audioBase64 = downloadedAudio.base64;
          audioMimeType = downloadedAudio.mimeType;
        }
      }

      // Si no hay archivo ni texto con datos bancarios, saltar
      if (!imageBase64 && !audioBase64 && captionText.length < 5) {
        continue;
      }

      // 4. Procesar con Gemini (o motor heurístico si no hay key)
      const receiptData = await classifyReceiptWithGemini({
        imageBase64,
        imageMimeType,
        audioBase64,
        audioMimeType,
        textContext: captionText,
        bcvRate
      });

      const supportAttachment: DigitalSupportAttachment = {
        id: `tg-${message.message_id}-${Date.now()}`,
        name: `Soporte_TG_${receiptData.banco_origen.replace(/\s+/g, '_')}_Ref${receiptData.referencia_ultimos_4}`,
        fileType: imageMimeType === 'application/pdf' ? 'PDF' : 'IMAGE',
        dataUrl: imageDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="10" y="50" font-family="sans-serif" font-size="12" fill="%2364748b">Telegram</text></svg>',
        sizeBytes: imageSize || 1024,
        uploadedAt: new Date().toISOString(),
        notes: `Recibido por Telegram de @${message.from?.username || message.from?.first_name || 'Usuario'}. ${captionText ? `Texto: "${captionText}"` : ''}`,
        moduleTag: receiptData.repositorio_sugerido,
        extractedMetadata: {
          banco_origen: receiptData.banco_origen,
          banco_destino: receiptData.banco_destino,
          tipo_operacion: receiptData.tipo_operacion,
          moneda: receiptData.moneda,
          monto: receiptData.monto,
          monto_usd_equivalente: receiptData.monto_usd_equivalente,
          referencia_completa: receiptData.referencia_completa,
          referencia_ultimos_4: receiptData.referencia_ultimos_4,
          fecha: receiptData.fecha,
          identificador_tercero: receiptData.identificador_tercero,
          repositorio_sugerido: receiptData.repositorio_sugerido,
          audioContext: receiptData.audio_transcripcion
        }
      };

      result.newSupports.push({
        attachment: supportAttachment,
        receiptData,
        targetModuleTag: receiptData.repositorio_sugerido
      });
      result.processedCount++;

      // 5. Responder confirmación en Telegram al chat_id:
      // "✅ Soporte procesado: [Banco] - Monto: [Monto] - Ref: [Referencia] -> Guardado en repositorio: [Repositorio]"
      if (chatId) {
        const repoName = MODULE_MAP_NAMES[receiptData.repositorio_sugerido] || receiptData.repositorio_sugerido;
        const sym = receiptData.moneda === 'USD' ? '$' : 'Bs.';
        const confirmationMsg = `✅ <b>Soporte procesado:</b> ${receiptData.banco_origen}
💰 <b>Monto:</b> ${sym} ${receiptData.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Equiv. $${receiptData.monto_usd_equivalente.toFixed(2)})
🔢 <b>Ref:</b> <code>${receiptData.referencia_completa || receiptData.referencia_ultimos_4}</code>
📁 <b>Guardado en repositorio:</b> <b>${repoName}</b>
ℹ️ <i>${receiptData.explicacion_contable}</i>`;

        await sendTelegramMessage(botToken, chatId, confirmationMsg);
      }
    }

    // Actualizar offset de Telegram
    if (highestUpdateId > lastUpdateId) {
      saveTelegramConfig({ lastUpdateId: highestUpdateId });
    }

    // Registrar en el historial de eventos
    if (result.errors.length > 0) {
      addTelegramEvent({
        type: 'ERROR',
        title: 'Aviso en Procesamiento de Soportes',
        message: result.errors.join('; '),
        details: { errorDescription: result.errors[0] }
      });
    } else if (result.processedCount > 0 || result.clarificationsReceived.length > 0) {
      addTelegramEvent({
        type: 'SUCCESS',
        title: 'Sincronización Exitosa',
        message: `Se procesaron ${result.processedCount} comprobante(s) y ${result.clarificationsReceived.length} aclaratoria(s) del dueño.`,
        details: {
          processedCount: result.processedCount,
          clarificationsCount: result.clarificationsReceived.length,
          updateOffset: highestUpdateId,
          statusText: '200 OK'
        }
      });
    } else {
      addTelegramEvent({
        type: 'INFO',
        title: 'Consulta al Día (Sin Nuevos Mensajes)',
        message: 'Conexión a Telegram Bot API exitosa. No hay nuevos comprobantes ni fotos pendientes.',
        details: {
          processedCount: 0,
          updateOffset: highestUpdateId,
          statusText: '200 OK (0 mensajes pendientes)'
        }
      });
    }
  } catch (err: any) {
    console.error('Error durante la sincronización de Telegram:', err);
    const msg = err.message || 'Error general en sincronización';
    result.errors.push(msg);
    addTelegramEvent({
      type: 'ERROR',
      title: 'Error de Red / Conexión Fallida',
      message: msg,
      details: {
        rawError: String(err)
      }
    });
  }

  return result;
}
