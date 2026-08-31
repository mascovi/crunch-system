/**
 * Extrai codigo, quantidade, descricao e SKU do texto colado do Mercado Livre.
 *
 * Estrutura observada no texto do ML:
 *
 *   Código ML:
 *   ALWO97425                                  <- codigo
 *   +3
 *   Código universal: 7898665434130
 *   SKU: VDZ60                                 <- codigo do fornecedor
 *   Anúncios com este produto: #5324932964
 *   Suplemento Vitaminico Vita D3 + C + Zinco  <- descricao (linha antes de "Unidade")
 *   Unidade
 *   60 etiquetas                               <- quantidade
 *
 * A varredura e sequencial: ao encontrar "Código ML:" guarda o codigo corrente,
 * vai coletando SKU e descricao pelo caminho, e fecha o item quando acha
 * "N etiquetas". Assim o lixo entre as linhas (codigo universal, numeros de
 * anuncio com #, "+3") nunca e confundido com quantidade.
 */

export interface ItemFull {
  codigo: string
  quantidade: number
  descricao: string
  sku: string
}

export interface ResultadoFull {
  itens: ItemFull[]
  avisos: string[]
  totalItens: number
  totalEtiquetas: number
}

const RE_CODIGO = /^[A-Z]{4}\d{5}$/

export function extrairFull(texto: string): ResultadoFull {
  const linhas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())

  const itens: ItemFull[] = []
  const avisos: string[] = []

  let codigo: string | null = null
  let sku = ''
  let descricao = ''
  let ultimaLinhaUtil = ''

  const zerar = () => {
    codigo = null
    sku = ''
    descricao = ''
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha) continue

    // "Código ML: ABCD12345" na mesma linha
    const inline = linha.match(/^C[oó]digo ML:?\s*([A-Za-z]{4}\d{5})$/i)
    if (inline) {
      if (codigo) avisos.push(`${codigo} apareceu sem quantidade e foi ignorado.`)
      zerar()
      codigo = inline[1].toUpperCase()
      continue
    }

    // "Código ML:" e o codigo na linha seguinte
    if (/^C[oó]digo ML:?$/i.test(linha)) {
      if (codigo) avisos.push(`${codigo} apareceu sem quantidade e foi ignorado.`)
      zerar()
      for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
        if (!linhas[j]) continue
        if (RE_CODIGO.test(linhas[j].toUpperCase())) codigo = linhas[j].toUpperCase()
        break
      }
      continue
    }

    // SKU do fornecedor
    const mSku = linha.match(/^SKU:\s*(.+)$/i)
    if (mSku) {
      sku = mSku[1].trim()
      continue
    }

    // "Unidade" vem logo depois da descricao
    if (/^Unidade$/i.test(linha)) {
      if (ultimaLinhaUtil && !/^\+\d+$/.test(ultimaLinhaUtil)) descricao = ultimaLinhaUtil
      continue
    }

    // Quantidade fecha o item
    const mQtd = linha.match(/^([\d.,]+)\s+etiquetas?$/i)
    if (mQtd) {
      const n = parseInt(mQtd[1].replace(/[.,]/g, ''), 10)
      if (!codigo) {
        avisos.push(`Quantidade "${linha}" sem codigo antes dela — ignorada.`)
      } else if (!Number.isFinite(n) || n <= 0) {
        avisos.push(`${codigo}: quantidade invalida "${mQtd[1]}" — ignorado.`)
        zerar()
      } else {
        itens.push({ codigo, quantidade: n, descricao, sku })
        zerar()
      }
      ultimaLinhaUtil = linha
      continue
    }

    ultimaLinhaUtil = linha
  }

  if (codigo) {
    avisos.push(`${codigo} ficou sem quantidade — confira se o texto foi colado inteiro.`)
  }

  // Codigos repetidos: somar quantidades e avisar
  const mapa = new Map<string, ItemFull>()
  for (const it of itens) {
    const existente = mapa.get(it.codigo)
    if (existente) {
      existente.quantidade += it.quantidade
      if (!existente.descricao) existente.descricao = it.descricao
      if (!existente.sku) existente.sku = it.sku
      avisos.push(`${it.codigo} apareceu mais de uma vez — as quantidades foram somadas.`)
    } else {
      mapa.set(it.codigo, { ...it })
    }
  }

  // Array.from em vez de spread: o target do projeto nao permite iterar
  // um Map com spread sem a flag downlevelIteration.
  const finais = Array.from(mapa.values())
  return {
    itens: finais,
    avisos,
    totalItens: finais.length,
    totalEtiquetas: finais.reduce((s, i) => s + i.quantidade, 0),
  }
}
