/**
 * Telegram Bot API — serviço de notificações do Crunch System.
 *
 * Variáveis de ambiente necessárias:
 *   TELEGRAM_BOT_TOKEN  — token do BotFather
 *   TELEGRAM_CHAT_ID    — chat_id do destinatário (pessoa ou grupo)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

interface TelegramResult {
  ok: boolean
  description?: string
}

/**
 * Envia uma mensagem de texto via Telegram Bot API.
 * Suporta HTML parse_mode para formatação (negrito, itálico, links).
 */
export async function enviarMensagemTelegram(
  texto: string,
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] BOT_TOKEN ou CHAT_ID não configurados. Notificação ignorada.')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: texto,
        parse_mode: parseMode,
      }),
    })

    const result: TelegramResult = await res.json()

    if (!result.ok) {
      console.error('[Telegram] Erro ao enviar:', result.description)
      return false
    }

    return true
  } catch (err) {
    console.error('[Telegram] Erro de rede:', err)
    return false
  }
}

/**
 * Notifica que uma nova NF foi cadastrada no sistema.
 */
export async function notificarNovaNF(dados: {
  numero_nf: string
  fornecedor: string
  transportadora: string
  volumes: number
  itens: { produto: string; quantidade: number }[]
}): Promise<boolean> {
  const listaItens = dados.itens
    .map((it) => `  • ${it.produto} (×${it.quantidade})`)
    .join('\n')

  const msg = [
    '📦 <b>Nova Nota Fiscal Cadastrada</b>',
    '',
    `<b>NF:</b> ${dados.numero_nf}`,
    `<b>Fornecedor:</b> ${dados.fornecedor}`,
    `<b>Transportadora:</b> ${dados.transportadora || 'Não informada'}`,
    `<b>Volumes:</b> ${dados.volumes}`,
    '',
    `<b>Itens (${dados.itens.length}):</b>`,
    listaItens,
  ].join('\n')

  return enviarMensagemTelegram(msg)
}

/**
 * Notifica que uma entrega está prevista para amanhã.
 */
export async function notificarEntregaProxima(dados: {
  numero_nf: string
  fornecedor: string
  transportadora: string
  data_emissao: string
  estimativa_entrega: string
  dias_em_transito: number
}): Promise<boolean> {
  const msg = [
    '🚚 <b>Entrega prevista para AMANHÃ</b>',
    '',
    `<b>NF:</b> ${dados.numero_nf}`,
    `<b>Fornecedor:</b> ${dados.fornecedor}`,
    `<b>Transportadora:</b> ${dados.transportadora}`,
    `<b>Em trânsito há:</b> ${dados.dias_em_transito} dias`,
    `<b>Previsão:</b> ${dados.estimativa_entrega}`,
  ].join('\n')

  return enviarMensagemTelegram(msg)
}
