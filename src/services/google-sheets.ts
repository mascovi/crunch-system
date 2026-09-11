import crypto from 'crypto'

/**
 * Integracao com o Google Sheets usando conta de servico.
 *
 * POR QUE SEM A BIBLIOTECA `googleapis`:
 * So precisamos de tres chamadas REST. Assinar o JWT com o `crypto` nativo
 * evita somar um pacote grande ao bundle e ao tempo de build.
 *
 * CREDENCIAIS (variaveis de ambiente do servidor, nunca NEXT_PUBLIC_):
 *   GOOGLE_SHEETS_CLIENT_EMAIL  — e-mail da conta de servico
 *   GOOGLE_SHEETS_PRIVATE_KEY   — chave privada do JSON baixado
 *   GOOGLE_SHEETS_ID            — id da planilha de envio
 *
 * Lidas dentro das funcoes, nunca no escopo do modulo: constante de modulo e
 * avaliada uma unica vez e o Next.js pode congelar valor vazio em alguns
 * chunks. Ja nos custou uma sessao inteira de depuracao no Telegram.
 */

const ESCOPO = 'https://www.googleapis.com/auth/spreadsheets'
const URL_TOKEN = 'https://oauth2.googleapis.com/token'
const URL_API = 'https://sheets.googleapis.com/v4/spreadsheets'

export interface ResultadoEnvio {
  ok: boolean
  error?: string
  /** Nome da aba criada */
  aba?: string
  /** Link direto para a aba nova */
  url?: string
  /** Quantos produtos foram escritos */
  linhas?: number
}

function lerCredenciais() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || ''
  // A chave vem do JSON com quebras de linha escapadas quando colada no painel
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID || ''
  return { clientEmail, privateKey, spreadsheetId }
}

function base64url(entrada: string | Buffer): string {
  return Buffer.from(entrada)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Troca o JWT assinado por um access token de curta duracao. */
async function obterToken(clientEmail: string, privateKey: string): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: ESCOPO,
      aud: URL_TOKEN,
      iat: agora,
      exp: agora + 3600,
    })
  )

  const assinatura = base64url(
    crypto.createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(privateKey)
  )
  const jwt = `${cabecalho}.${corpo}.${assinatura}`

  const res = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const dados = await res.json()
  if (!res.ok || !dados.access_token) {
    throw new Error(
      `Falha ao autenticar no Google: ${dados.error_description || dados.error || res.status}`
    )
  }
  return dados.access_token as string
}

async function chamar(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const dados = await res.json()
  if (!res.ok) {
    const msg = dados?.error?.message || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return dados
}

/** Nome da aba nova: "ENVIO 11-09 14h32". Nunca colide entre envios. */
function nomeDaAba(): string {
  const agora = new Date()
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  const d = String(brt.getUTCDate()).padStart(2, '0')
  const m = String(brt.getUTCMonth() + 1).padStart(2, '0')
  const h = String(brt.getUTCHours()).padStart(2, '0')
  const min = String(brt.getUTCMinutes()).padStart(2, '0')
  return `ENVIO ${d}-${m} ${h}h${min}`
}

/**
 * Duplica a aba modelo e escreve os codigos na coluna D e as quantidades
 * na coluna F, ambas a partir da linha 8.
 *
 * As colunas nao sao vizinhas (a E fica entre elas), por isso sao duas
 * escritas separadas — o mesmo motivo pelo qual as listas saem separadas
 * na tela.
 */
export async function criarAbaDeEnvio(
  itens: { codigo: string; quantidade: number }[],
  abaModelo = 'COPIAR'
): Promise<ResultadoEnvio> {
  const { clientEmail, privateKey, spreadsheetId } = lerCredenciais()

  const faltando = [
    !clientEmail && 'GOOGLE_SHEETS_CLIENT_EMAIL',
    !privateKey && 'GOOGLE_SHEETS_PRIVATE_KEY',
    !spreadsheetId && 'GOOGLE_SHEETS_ID',
  ].filter(Boolean)

  if (faltando.length > 0) {
    return { ok: false, error: `Variavel de ambiente ausente: ${faltando.join(', ')}` }
  }
  if (itens.length === 0) {
    return { ok: false, error: 'Nenhum item para enviar.' }
  }

  try {
    const token = await obterToken(clientEmail, privateKey)

    // 1. Localizar a aba modelo pelo nome
    const planilha = await chamar(
      `${URL_API}/${spreadsheetId}?fields=sheets.properties`,
      token
    )
    const modelo = (planilha.sheets || []).find(
      (s: { properties: { title: string } }) =>
        s.properties.title.trim().toUpperCase() === abaModelo.toUpperCase()
    )
    if (!modelo) {
      return {
        ok: false,
        error: `Não encontrei a aba "${abaModelo}" na planilha. Confira se o nome está exato.`,
      }
    }

    // 2. Duplicar a aba
    const titulo = nomeDaAba()
    const copia = await chamar(`${URL_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: modelo.properties.sheetId,
              newSheetName: titulo,
              insertSheetIndex: 0,
            },
          },
        ],
      }),
    })

    const nova = copia.replies?.[0]?.duplicateSheet?.properties
    if (!nova) {
      return { ok: false, error: 'A aba foi duplicada mas o Google não retornou os dados dela.' }
    }

    // 3. Escrever as duas colunas — separadas, porque a E fica no meio
    const primeiraLinha = 8
    const ultimaLinha = primeiraLinha + itens.length - 1
    const aspas = `'${titulo}'`

    await chamar(
      `${URL_API}/${spreadsheetId}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: [
            {
              range: `${aspas}!D${primeiraLinha}:D${ultimaLinha}`,
              values: itens.map((i) => [i.codigo]),
            },
            {
              range: `${aspas}!F${primeiraLinha}:F${ultimaLinha}`,
              values: itens.map((i) => [i.quantidade]),
            },
          ],
        }),
      }
    )

    return {
      ok: true,
      aba: titulo,
      linhas: itens.length,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${nova.sheetId}`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
