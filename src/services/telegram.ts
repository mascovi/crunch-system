/**
 * Telegram Bot API — serviço de notificações do Crunch System.
 *
 * Variáveis de ambiente necessárias:
 *   TELEGRAM_BOT_TOKEN  — token do BotFather
 *   TELEGRAM_CHAT_ID    — chat_id do destinatário (pessoa ou grupo)
 */

/**
 * Le as credenciais NA HORA DA CHAMADA — nunca no escopo do modulo.
 *
 * POR QUE ISSO IMPORTA:
 * Antes isso era `const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN` no topo do
 * arquivo. Constante de modulo e avaliada uma unica vez, quando o modulo e
 * carregado — e o Next.js pode congelar esse valor vazio em alguns chunks.
 * O resultado foi um bug em que o cron enxergava as variaveis e a rota de
 * salvar NF nao, com o mesmo codigo e o mesmo deployment. Lendo dentro da
 * funcao, o valor vem sempre do ambiente vivo da execucao.
 */
function lerCredenciais() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  }
}

interface TelegramResult {
  ok: boolean
  description?: string
  error_code?: number
}

/** Resultado detalhado do envio — carrega o motivo em caso de falha. */
export interface EnvioResult {
  ok: boolean
  error?: string
}

/**
 * Envia uma mensagem de texto via Telegram Bot API.
 * Retorna o motivo da falha em vez de falhar em silêncio.
 */
export async function enviarMensagemTelegramDetalhado(
  texto: string,
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
): Promise<EnvioResult> {
  const { botToken, chatId } = lerCredenciais()

  if (!botToken || !chatId) {
    const faltando = [
      !botToken && 'TELEGRAM_BOT_TOKEN',
      !chatId && 'TELEGRAM_CHAT_ID',
    ]
      .filter(Boolean)
      .join(' e ')
    const msg = `Variavel de ambiente ausente: ${faltando}`
    console.warn('[Telegram]', msg)
    return { ok: false, error: msg }
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: parseMode,
      }),
    })

    const result: TelegramResult = await res.json()

    if (!result.ok) {
      const msg = `Telegram recusou (${result.error_code}): ${result.description}`
      console.error('[Telegram]', msg)
      return { ok: false, error: msg }
    }

    return { ok: true }
  } catch (err) {
    const msg = `Erro de rede: ${err instanceof Error ? err.message : String(err)}`
    console.error('[Telegram]', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Wrapper booleano — mantido para os chamadores que só precisam de sim/nao.
 */
export async function enviarMensagemTelegram(
  texto: string,
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
): Promise<boolean> {
  const r = await enviarMensagemTelegramDetalhado(texto, parseMode)
  return r.ok
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
}): Promise<EnvioResult> {
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

  return enviarMensagemTelegramDetalhado(msg)
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
