/**
 * Montagem do ZPL para impressao de etiquetas.
 *
 * POR QUE NAO USAR ^PQ:
 * O metodo antigo pegava um bloco ^XA...^XZ e injetava ^PQ{n} para pedir n
 * copias. Com ^PQ a impressora reimprime o mesmo buffer sem reprocessar o
 * formato, e o erro de registro da midia vai acumulando — as etiquetas
 * "caminham" para a esquerda e as ultimas saem cortadas.
 *
 * O ZPL que o Mercado Livre gera (e que imprime perfeito na mesma impressora)
 * nao usa ^PQ: ele repete fisicamente o bloco ^XA...^XZ inteiro, uma vez por
 * par de etiquetas. Cada bloco e um formato novo, entao nao ha acumulo.
 * Este modulo faz exatamente isso.
 *
 * CONTAGEM DE ETIQUETAS:
 * O template padrao traz DUAS etiquetas dentro do mesmo ^XA...^XZ (uma em
 * ^FO30 e outra em ^FO350). Repetir o bloco 48 vezes imprimiria 96 etiquetas.
 * Por isso contamos quantas etiquetas cabem no bloco (pelo numero de codigos
 * de barras) e dividimos a quantidade pedida.
 */

export interface ResultadoZpl {
  /** ZPL final, pronto para enviar a impressora */
  zpl: string
  /** Quantas etiquetas existem dentro de um bloco ^XA...^XZ */
  etiquetasPorBloco: number
  /** Quantos blocos foram gerados */
  blocosGerados: number
  /** Total de etiquetas que serao impressas de fato */
  etiquetasGeradas: number
}

/**
 * Monta o ZPL final repetindo o bloco do template ate cobrir a quantidade
 * pedida. Remove qualquer ^PQ herdado do template.
 *
 * @param zplBase  ZPL do template (um ou mais blocos ^XA...^XZ)
 * @param qtdDesejada  Quantidade de etiquetas que o usuario quer imprimir
 */
export function montarZplParaImpressao(
  zplBase: string,
  qtdDesejada: number
): ResultadoZpl {
  if (!zplBase || !zplBase.trim()) {
    throw new Error('Template ZPL vazio.')
  }
  if (!Number.isFinite(qtdDesejada) || qtdDesejada <= 0) {
    throw new Error('Quantidade de etiquetas deve ser maior que zero.')
  }

  // Tirar ^PQ do template — a repeticao de bloco substitui esse comando
  const semPQ = zplBase.replace(/\^PQ[^\^\r\n]*/gi, '')

  // Isolar os blocos ^XA...^XZ
  const blocos = semPQ.match(/\^XA[\s\S]*?\^XZ/gi)
  if (!blocos || blocos.length === 0) {
    throw new Error('Template ZPL invalido: nenhum bloco ^XA...^XZ encontrado.')
  }

  // O primeiro bloco e a unidade de repeticao. Quando o template ja vem
  // repetido, os blocos seguintes sao identicos — usar o primeiro basta.
  const unidade = blocos[0].trim()

  // Quantas etiquetas cabem num bloco: uma por codigo de barras (^BC).
  // Se o template nao tiver codigo de barras, assumimos uma etiqueta.
  const codigosDeBarras = unidade.match(/\^BC/gi)
  const etiquetasPorBloco = Math.max(1, codigosDeBarras ? codigosDeBarras.length : 1)

  const blocosGerados = Math.ceil(qtdDesejada / etiquetasPorBloco)
  const zpl = Array(blocosGerados).fill(unidade).join('\n')

  return {
    zpl,
    etiquetasPorBloco,
    blocosGerados,
    etiquetasGeradas: blocosGerados * etiquetasPorBloco,
  }
}
