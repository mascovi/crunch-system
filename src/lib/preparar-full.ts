/**
 * Extrai codigo, quantidade, descricao e SKU do texto colado do Mercado Livre.
 *
 * DOIS FORMATOS DE ORIGEM, os dois aceitos no mesmo campo:
 *
 * 1. TELA DE ETIQUETAS — a quantidade vem como "N etiquetas":
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
 * 2. DETALHE DO ENVIO — quatro quantidades em sequencia, todas "N un.":
 *
 *   Código ML:
 *   TUHW45726
 *   +3
 *   Suplemento Alimentar Ferro Plus 30 Capsulas Vitafor
 *   203,04 cm
 *   3
 *   O produto na sua embalagem primaria mede: ...
 *   Como o volume do produto é calculado       <- ancora
 *   99 un.                                     <- declaradas
 *   101 un.                                    <- processadas
 *   2 un.                                      <- diferencas
 *   (a mais)
 *   101 un.                                    <- aptos para o Full
 *   2 un. mais do que as declaradas
 *
 * A BAIXA USA "PROCESSADAS", nao "declaradas": processadas e o que o Mercado
 * Livre contou ao receber, ou seja, o que de fato saiu do galpao. Quando os
 * dois numeros divergem, quem esta errado e a contagem declarada — baixar
 * pelas declaradas deixaria no saldo unidades que nao existem mais. A
 * divergencia vira aviso na tela em vez de passar calada.
 *
 * Para separar os quatro numeros sem contar posicao de linha, o reconhecimento
 * de "N un." e ESTRITO (nada depois do ponto). Assim "2 un. mais do que as
 * declaradas" e "(a mais)" nao entram na conta, e a sequencia fica sempre
 * exatamente [declaradas, processadas, diferencas, aptos].
 *
 * A varredura e sequencial: ao encontrar "Código ML:" guarda o codigo corrente,
 * vai coletando SKU e descricao pelo caminho, e fecha o item na quantidade.
 * Assim o lixo entre as linhas (codigo universal, volume em cm3, numeros de
 * anuncio com #, "+3") nunca e confundido com quantidade.
 */

export interface ItemFull {
  codigo: string
  /** A quantidade que vira baixa no estoque */
  quantidade: number
  descricao: string
  sku: string
  /** Declaradas, quando o texto vem do Detalhe do envio */
  declaradas?: number
  /** Processadas, quando o texto vem do Detalhe do envio */
  processadas?: number
  /** Aptos para o Full, quando o texto vem do Detalhe do envio */
  aptos?: number
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
  /** Os "N un." coletados do produto corrente, na ordem em que aparecem */
  let unidades: number[] = []

  const zerar = () => {
    codigo = null
    sku = ''
    descricao = ''
    unidades = []
  }

  /**
   * Fecha o produto corrente do formato "Detalhe do envio".
   * Espera os quatro numeros; com menos que isso, avisa em vez de adivinhar.
   */
  const fecharPorUnidades = () => {
    // Copia local: `codigo` e atribuido dentro de funcoes aninhadas, e nesse
    // caso o TypeScript nao consegue manter o estreitamento de tipo.
    const cod = codigo
    if (!cod) {
      unidades = []
      return
    }
    if (unidades.length < 2) {
      avisos.push(`${cod}: nao achei as quantidades — confira se o texto veio inteiro.`)
      zerar()
      return
    }

    const [declaradas, processadas] = unidades
    const aptos = unidades.length >= 4 ? unidades[3] : undefined

    if (!Number.isFinite(processadas) || processadas <= 0) {
      avisos.push(`${cod}: quantidade processada invalida — ignorado.`)
      zerar()
      return
    }

    if (Number.isFinite(declaradas) && declaradas !== processadas) {
      const dif = processadas - declaradas
      avisos.push(
        `${cod}: declaradas ${declaradas}, processadas ${processadas} ` +
          `(${dif > 0 ? '+' : ''}${dif}). A baixa usa ${processadas}.`
      )
    }

    itens.push({
      codigo: cod,
      quantidade: processadas,
      descricao,
      sku,
      declaradas,
      processadas,
      aptos,
    })
    zerar()
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha) continue

    // Novo codigo encontrado: fecha o anterior antes de trocar.
    // No Detalhe do envio as quantidades ja foram coletadas em `unidades`,
    // e e aqui que o produto se fecha — nao existe linha de "etiquetas".
    const trocarCodigo = (novo: string) => {
      if (codigo && unidades.length > 0) {
        fecharPorUnidades()
      } else if (codigo) {
        avisos.push(`${codigo} apareceu sem quantidade e foi ignorado.`)
        zerar()
      } else {
        zerar()
      }
      codigo = novo
    }

    // "Código ML: ABCD12345" na mesma linha
    const inline = linha.match(/^C[oó]digo ML:?\s*([A-Za-z]{4}\d{5})$/i)
    if (inline) {
      trocarCodigo(inline[1].toUpperCase())
      continue
    }

    // "Código ML:" e o codigo nas linhas seguintes (pode ter linha vazia no meio)
    if (/^C[oó]digo ML:?$/i.test(linha)) {
      let achado: string | null = null
      for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
        if (!linhas[j]) continue
        if (RE_CODIGO.test(linhas[j].toUpperCase())) achado = linhas[j].toUpperCase()
        break
      }
      if (achado) trocarCodigo(achado)
      continue
    }

    // "N un." — formato Detalhe do envio. O casamento e estrito de propósito:
    // "2 un. mais do que as declaradas" e "(a mais)" nao podem entrar na
    // sequencia, senao as colunas saem embaralhadas.
    const mUn = linha.match(/^([\d.]+)\s+un\.$/i)
    if (mUn && codigo) {
      const n = parseInt(mUn[1].replace(/\./g, ''), 10)
      if (Number.isFinite(n)) unidades.push(n)
      // Fecha no quarto numero. Sem isso, o bloco de totais do fim da pagina
      // ("Total: 22 produtos / 1017 un. / 1019 un. ...") entraria na conta do
      // ultimo produto, porque ele ainda estaria aberto.
      if (unidades.length >= 4) fecharPorUnidades()
      ultimaLinhaUtil = linha
      continue
    }

    // "+3" marca o fim do bloco do codigo; a descricao vem logo depois.
    // E o unico ancora de descricao no Detalhe do envio, que nao tem "Unidade".
    if (/^\+\d+$/.test(linha) && codigo && !descricao) {
      for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
        if (!linhas[j]) continue
        descricao = linhas[j]
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
      // Copia local pelo mesmo motivo do fecharPorUnidades
      const cod = codigo
      if (!cod) {
        avisos.push(`Quantidade "${linha}" sem codigo antes dela — ignorada.`)
      } else if (!Number.isFinite(n) || n <= 0) {
        avisos.push(`${cod}: quantidade invalida "${mQtd[1]}" — ignorado.`)
        zerar()
      } else {
        itens.push({ codigo: cod, quantidade: n, descricao, sku })
        zerar()
      }
      ultimaLinhaUtil = linha
      continue
    }

    ultimaLinhaUtil = linha
  }

  // Ultimo produto do Detalhe do envio, se o texto acabou antes dos 4 numeros
  if (codigo && unidades.length > 0) {
    fecharPorUnidades()
  } else if (codigo) {
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
