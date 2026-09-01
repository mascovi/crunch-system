/**
 * Le uma etiqueta ZPL gerada pelo Mercado Livre e extrai os dados do produto.
 *
 * ATENCAO — O CAMPO "SKU:" DA ETIQUETA E IGNORADO DE PROPOSITO.
 * Ele NAO e o codigo do fornecedor. Conferimos nos dados: em alguns produtos
 * ele coincide com o codigo que vem no XML da nota, em outros diverge (no
 * Bio Vit C+ a etiqueta traz 3000000119 e a nota traz 3000000157). Gravar
 * esse valor como `codigo_fornecedor` faria o casamento de itens de XML
 * acertar em uns e errar em outros, silenciosamente, contaminando a entrada
 * de estoque. O `codigo_fornecedor` continua vindo exclusivamente do XML.
 *
 * Da etiqueta so aproveitamos o que ela e fonte de verdade:
 *   - codigo ML  (do codigo de barras ^BC)
 *   - descricao  (do campo de texto ^FB)
 *   - o proprio ZPL, para impressao
 */

/** Codigo do Mercado Livre: 4 letras seguidas de 5 digitos. */
export const RE_CODIGO_ML = /^[A-Z]{4}\d{5}$/

/** Diz se um codigo tem o formato de codigo ML de verdade. */
export function ehCodigoML(codigo: string | null | undefined): boolean {
  return RE_CODIGO_ML.test(String(codigo || '').trim().toUpperCase())
}

export interface DadosEtiqueta {
  codigoMl: string
  descricao: string
  fornecedor: string
  zpl: string
  etiquetasNoBloco: number
}

/** Marcas conhecidas, para sugerir o fornecedor a partir da descricao. */
const MARCAS: { chave: string; nome: string }[] = [
  { chave: 'PURAVIDA', nome: 'PURAVIDA' },
  { chave: 'PURA VIDA', nome: 'PURAVIDA' },
  { chave: 'VITAFOR', nome: 'VITAFOR' },
  { chave: 'TRUE SOURCE', nome: 'TRUE SOURCE' },
  { chave: 'OCEAN DROP', nome: 'OCEAN DROP' },
  { chave: 'OCEANDROP', nome: 'OCEAN DROP' },
]

/**
 * Decodifica os escapes hexadecimais do ^FH do ZPL.
 * "N_2Dacetil L_2Dciste_C3_ADna" vira "N-acetil L-cisteína".
 */
function decodificarFH(texto: string): string {
  const bytes: number[] = []
  for (let i = 0; i < texto.length; i++) {
    const par = texto.substring(i + 1, i + 3)
    if (texto[i] === '_' && /^[0-9A-Fa-f]{2}$/.test(par)) {
      bytes.push(parseInt(par, 16))
      i += 2
    } else {
      // forEach em vez de for...of: o target do projeto nao itera
      // Uint8Array sem a flag downlevelIteration.
      new TextEncoder().encode(texto[i]).forEach((b) => bytes.push(b))
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

/**
 * Extrai os dados do produto a partir do ZPL colado.
 * Lanca erro com mensagem legivel quando o texto nao serve.
 */
export function lerEtiquetaML(zplColado: string): DadosEtiqueta {
  const texto = String(zplColado || '').trim()

  if (!texto) throw new Error('Cole o conteudo da etiqueta antes de puxar.')
  if (!texto.includes('^XA') || !texto.includes('^XZ')) {
    throw new Error('Isso nao parece uma etiqueta ZPL. Faltam os marcadores ^XA e ^XZ.')
  }

  // Codigo ML: sai do codigo de barras
  const bc = texto.match(/\^BC[^^]*\^FD([A-Za-z0-9]+)\^FS/)
  const codigoMl = bc ? bc[1].trim().toUpperCase() : ''
  if (!codigoMl) {
    throw new Error('Nao encontrei o codigo de barras na etiqueta.')
  }
  if (!ehCodigoML(codigoMl)) {
    throw new Error(
      `O codigo encontrado foi "${codigoMl}", que nao tem o formato de codigo ML (4 letras + 5 numeros). Confira se colou a etiqueta certa.`
    )
  }

  // Descricao: primeiro campo ^FB com conteudo.
  // exec em laco em vez de matchAll: o target do projeto nao itera o
  // resultado de matchAll sem a flag downlevelIteration.
  let descricao = ''
  const reCampo = /\^FB\d+,\d+,\d+,[A-Z]\^FH\^FD([^^]*)\^FS/g
  let campo: RegExpExecArray | null
  while ((campo = reCampo.exec(texto)) !== null) {
    if (campo[1] && campo[1].trim()) {
      descricao = decodificarFH(campo[1].trim())
      break
    }
  }
  if (!descricao) {
    throw new Error('Nao encontrei a descricao do produto na etiqueta.')
  }

  // O ML separa partes da descricao com " | " — vira espaco simples
  descricao = descricao.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim()

  // Fornecedor sugerido pela marca citada na descricao
  const emMaiusculas = descricao.toUpperCase()
  const marca = MARCAS.find((m) => emMaiusculas.includes(m.chave))
  const fornecedor = marca ? marca.nome : ''

  // Guardar apenas o primeiro bloco ^XA...^XZ — a unidade de repeticao
  const blocos = texto.match(/\^XA[\s\S]*?\^XZ/g)
  const zpl = blocos && blocos.length > 0 ? blocos[0].trim() : texto

  return {
    codigoMl,
    descricao,
    fornecedor,
    zpl,
    etiquetasNoBloco: (zpl.match(/\^BC/g) || []).length,
  }
}
