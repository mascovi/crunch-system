/**
 * Telegram Bot API — serviço de notificações do Crunch System.
 *
 * Variáveis de ambiente necessárias:
 *   TELEGRAM_BOT_TOKEN          — token do BotFather
 *   TELEGRAM_CHAT_ID            — destinatário padrão (NF nova, entregas previstas)
 *   TELEGRAM_CHAT_ID_ENTREGUE   — destinatário do aviso de NF entregue
 *
 * SOBRE O SEGUNDO DESTINATÁRIO:
 * Ele NÃO cai de volta no TELEGRAM_CHAT_ID quando está vazio. Um fallback
 * silencioso aqui mandaria o aviso para a pessoa errada e ninguém perceberia —
 * a mensagem chegaria, só que para quem não devia. Faltando a variável, o
 * envio falha com o motivo na tela.
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
    chatIdEntregue: process.env.TELEGRAM_CHAT_ID_ENTREGUE || '',
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
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML',
  /**
   * Para quem mandar. Omitido = destinatário padrão (TELEGRAM_CHAT_ID).
   * Quem passa um valor explícito já resolveu de onde ele veio.
   */
  destinatario?: string
): Promise<EnvioResult> {
  const { botToken, chatId } = lerCredenciais()
  const alvo = destinatario !== undefined ? destinatario : chatId

  if (!botToken || !alvo) {
    const faltando = [
      !botToken && 'TELEGRAM_BOT_TOKEN',
      !alvo && (destinatario !== undefined ? 'destinatario' : 'TELEGRAM_CHAT_ID'),
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
        chat_id: alvo,
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
 * Avisa que uma NF foi marcada como entregue.
 *
 * Vai para o TELEGRAM_CHAT_ID_ENTREGUE — um destinatário separado do padrão,
 * porque quem confere recebimento não é necessariamente quem acompanha o
 * cadastro de notas. Sem essa variável o envio falha em vez de cair no
 * destinatário padrão: mandar para a pessoa errada seria pior que não mandar,
 * porque ninguém perceberia o engano.
 */
export async function notificarNFEntregue(dados: {
  numero_nf: string
  fornecedor: string
  transportadora: string
  volumes: number
  data_emissao?: string
  dias_em_transito?: number | null
  itens: { produto: string; quantidade: number }[]
}): Promise<EnvioResult> {
  const { chatIdEntregue } = lerCredenciais()

  if (!chatIdEntregue) {
    const msg = 'Variavel de ambiente ausente: TELEGRAM_CHAT_ID_ENTREGUE'
    console.warn('[Telegram]', msg)
    return { ok: false, error: msg }
  }

  const totalUnidades = dados.itens.reduce((s, i) => s + (i.quantidade || 0), 0)

  // Lista longa vira resumo: mensagem do Telegram tem limite de 4096
  // caracteres, e NF com 40 itens estoura isso e some sem avisar.
  const LIMITE = 15
  const listaItens = dados.itens
    .slice(0, LIMITE)
    .map((it) => `  • ${it.produto} (×${it.quantidade})`)
    .join('\n')
  const resto =
    dados.itens.length > LIMITE
      ? `\n  … e mais ${dados.itens.length - LIMITE} ${
          dados.itens.length - LIMITE === 1 ? 'item' : 'itens'
        }`
      : ''

  const linhas = [
    '✅ <b>Nota Fiscal Entregue</b>',
    '',
    `<b>NF:</b> ${dados.numero_nf}`,
    `<b>Fornecedor:</b> ${dados.fornecedor}`,
    `<b>Transportadora:</b> ${dados.transportadora || 'Não informada'}`,
    `<b>Volumes:</b> ${dados.volumes}`,
  ]

  if (dados.dias_em_transito !== undefined && dados.dias_em_transito !== null) {
    linhas.push(
      `<b>Em trânsito:</b> ${dados.dias_em_transito} ${
        dados.dias_em_transito === 1 ? 'dia' : 'dias'
      }`
    )
  }

  linhas.push(
    '',
    `<b>Entrada no estoque — ${dados.itens.length} ${
      dados.itens.length === 1 ? 'item' : 'itens'
    }, ${totalUnidades} ${totalUnidades === 1 ? 'unidade' : 'unidades'}:</b>`,
    listaItens + resto
  )

  return enviarMensagemTelegramDetalhado(linhas.join('\n'), 'HTML', chatIdEntregue)
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
