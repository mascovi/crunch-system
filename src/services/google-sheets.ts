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

// ============================================
// BANCO_DE_DADOS — a tabela de PROCV da planilha
// ============================================

/**
 * A aba BANCO_DE_DADOS e a tabela que a aba de envio consulta por PROCV.
 * O layout e fixo e o proprio cabecalho avisa "NAO ALTERAR":
 *
 *   A  indice sequencial
 *   B  DESCRICAO             nome curto em caixa alta
 *   C  FORNECEDOR
 *   D  PART NUMBER ANUNCIO   codigo ML — e a chave da busca
 *   E  VARIACAO              sabor/tamanho
 *   F  ITENS POR VOLUME      quantas unidades cabem na caixa
 *   G  Kg Unitario           NUMERO puro
 *
 * SOBRE A COLUNA G: ela aparece como "0,30 Kg" na tela, mas o "Kg" vem da
 * FORMATACAO da celula, nao do conteudo. Gravamos numero puro. Escrever a
 * string "0,30 Kg" faria a celula virar texto e quebrar toda formula que
 * some ou multiplique peso.
 *
 * Por isso tambem usamos RAW (e nao USER_ENTERED) na escrita: USER_ENTERED
 * reinterpreta o valor e pode trocar a formatacao existente da celula.
 *
 * Armadilha conhecida: codigo repetido. O PROCV devolve so a primeira
 * ocorrencia e ignora as outras em silencio — ja existem tres pares
 * duplicados na planilha. Antes de acrescentar sempre procuramos o codigo.
 */
const ABA_BANCO = 'BANCO_DE_DADOS'
/** Os dados comecam na linha 2; a 1 e o cabecalho. */
const PRIMEIRA_LINHA_BANCO = 2

export interface ProdutoBanco {
  /** Nome curto, caixa alta — coluna B */
  descricao: string
  /** Coluna C */
  fornecedor: string
  /** Codigo ML — coluna D */
  codigoMl: string
  /** Coluna E */
  variacao: string
  /** Coluna F */
  itensPorVolume: number
  /** Coluna G — numero puro. O "Kg" e formatacao da celula, nao conteudo. */
  kgUnitario: number
}

export interface ResultadoBanco {
  ok: boolean
  error?: string
  /** Linha onde o produto foi gravado */
  linha?: number
  /** Indice sequencial atribuido na coluna A */
  indice?: number
  /** true quando o codigo ja existia e a linha foi atualizada */
  atualizou?: boolean
  /** Link direto para a linha */
  url?: string
}

/**
 * Copia SO A FORMATACAO da linha de cima para a linha nova (colunas A a G).
 * E isso que faz o "Kg" aparecer na coluna G sem que ele seja texto: o
 * sufixo vem da mascara de numero da celula, que e formatacao.
 */
async function copiarFormatacaoDaLinhaAcima(
  spreadsheetId: string,
  token: string,
  linha: number
) {
  const planilha = await chamar(
    `${URL_API}/${spreadsheetId}?fields=sheets.properties`,
    token
  )
  const aba = (planilha.sheets || []).find(
    (s: { properties: { title: string } }) =>
      s.properties.title.trim().toUpperCase() === ABA_BANCO
  )
  if (!aba) return

  const sheetId = aba.properties.sheetId
  // A API conta linhas a partir do zero e o fim e exclusivo
  const origem = linha - 2
  const destino = linha - 1

  await chamar(`${URL_API}/${spreadsheetId}:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: origem,
              endRowIndex: origem + 1,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            destination: {
              sheetId,
              startRowIndex: destino,
              endRowIndex: destino + 1,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            pasteType: 'PASTE_FORMAT',
          },
        },
      ],
    }),
  })
}

/**
 * Le a aba inteira e devolve as linhas ja indexadas, para a gente saber onde
 * escrever e se o codigo ja existe.
 */
async function lerBanco(spreadsheetId: string, token: string) {
  const dados = await chamar(
    `${URL_API}/${spreadsheetId}/values/${encodeURIComponent(`${ABA_BANCO}!A:G`)}`,
    token
  )
  const linhas: string[][] = dados.values || []

  let ultimoIndice = 0
  const primeiraVazia = Math.max(linhas.length + 1, PRIMEIRA_LINHA_BANCO)
  const porCodigo = new Map<string, number>()

  for (let i = PRIMEIRA_LINHA_BANCO - 1; i < linhas.length; i++) {
    const linha = linhas[i] || []
    const codigo = String(linha[3] || '').trim().toUpperCase()
    if (codigo && !porCodigo.has(codigo)) {
      // Guarda a PRIMEIRA ocorrencia: e ela que o PROCV enxerga
      porCodigo.set(codigo, i + 1)
    }
    const indice = parseInt(String(linha[0] || '').trim(), 10)
    if (!isNaN(indice) && indice > ultimoIndice) ultimoIndice = indice
  }

  return { linhas, ultimoIndice, primeiraVazia, porCodigo }
}

/**
 * Acrescenta um produto na aba BANCO_DE_DADOS, ou atualiza a linha existente
 * quando o codigo ML ja esta la.
 *
 * Nunca cria uma segunda linha para um codigo que ja existe: isso geraria
 * mais uma duplicata invisivel ao PROCV.
 */
export async function salvarNoBancoDeDados(
  produto: ProdutoBanco,
  permitirAtualizar = true
): Promise<ResultadoBanco> {
  const { clientEmail, privateKey, spreadsheetId } = lerCredenciais()

  const faltando = [
    !clientEmail && 'GOOGLE_SHEETS_CLIENT_EMAIL',
    !privateKey && 'GOOGLE_SHEETS_PRIVATE_KEY',
    !spreadsheetId && 'GOOGLE_SHEETS_ID',
  ].filter(Boolean)

  if (faltando.length > 0) {
    return { ok: false, error: `Variavel de ambiente ausente: ${faltando.join(', ')}` }
  }

  const codigo = produto.codigoMl.trim().toUpperCase()
  if (!codigo) return { ok: false, error: 'Codigo ML vazio.' }

  try {
    const token = await obterToken(clientEmail, privateKey)
    const { ultimoIndice, primeiraVazia, porCodigo } = await lerBanco(spreadsheetId, token)

    const jaExiste = porCodigo.get(codigo)

    if (jaExiste && !permitirAtualizar) {
      return {
        ok: false,
        error: `O codigo ${codigo} ja esta na linha ${jaExiste} da aba ${ABA_BANCO}.`,
      }
    }

    const linha = jaExiste || primeiraVazia
    const indice = jaExiste ? undefined : ultimoIndice + 1

    // Quando atualiza, nao mexe na coluna A: a numeracao existente e do Pedro
    const range = jaExiste
      ? `${ABA_BANCO}!B${linha}:G${linha}`
      : `${ABA_BANCO}!A${linha}:G${linha}`

    // Numeros vao como numero (F e G) e o resto como texto. RAW preserva a
    // formatacao que a celula ja tem — e o formato da coluna G que desenha
    // o "Kg" na tela, sem contaminar o valor.
    const miolo = [
      produto.descricao,
      produto.fornecedor,
      codigo,
      produto.variacao,
      produto.itensPorVolume,
      produto.kgUnitario,
    ]
    const valores = jaExiste ? [miolo] : [[indice, ...miolo]]

    await chamar(
      `${URL_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      token,
      { method: 'PUT', body: JSON.stringify({ range, values: valores }) }
    )

    // Linha nova nasce sem a formatacao da tabela — inclusive sem o "Kg" da
    // coluna G, que e mascara de numero. Copiamos a formatacao da linha de
    // cima em vez de chutar um padrao: assim vale o que o Pedro ja usa.
    // Falha aqui e cosmetica, entao nao derruba o cadastro.
    if (!jaExiste && linha > PRIMEIRA_LINHA_BANCO) {
      try {
        await copiarFormatacaoDaLinhaAcima(spreadsheetId, token, linha)
      } catch (e) {
        console.warn('[BANCO_DE_DADOS] nao consegui copiar a formatacao:', e)
      }
    }

    return {
      ok: true,
      linha,
      indice,
      atualizou: Boolean(jaExiste),
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
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
