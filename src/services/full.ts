import { supabase } from '@/lib/supabase'
import { buscarSaldoCodigo } from './estoque'
import type { EnvioFull, EnvioFullItem, CSVFullItem, CSVFullHeader } from '@/types'

/**
 * Confere os itens do CSV FULL contra o estoque disponível.
 *
 * ISSO NAO BLOQUEIA O ENVIO. Saldo insuficiente e informacao, nao impedimento:
 * o produto JA saiu fisicamente do galpao quando o Mercado Livre o recebeu, e
 * travar o lancamento nao desfaz isso — so faz a plataforma mentir, ficando
 * com saldo que nao existe mais na prateleira. Saldo negativo e a leitura
 * correta de "sai mais do que o sistema sabia que tinha", e aponta para a
 * causa real: entrada de NF que faltou lancar, ou contagem errada.
 *
 * Retorna avisos para a tela exibir antes de confirmar.
 */
export async function validarCSVFull(itens: CSVFullItem[]): Promise<string[]> {
  const avisos: string[] = []

  for (const item of itens) {
    if (!item.codigo_ml) {
      avisos.push(`Linha com Código ML vazio.`)
      continue
    }

    const saldo = await buscarSaldoCodigo(item.codigo_ml)
    const nome = item.descricao || '?'

    if (item.quantidade > saldo) {
      const ficara = saldo - item.quantidade
      avisos.push(
        `${item.codigo_ml} (${nome}): saldo ${saldo}, saindo ${item.quantidade} — ` +
          `ficara em ${ficara}.`
      )
    }
  }

  return avisos
}

/**
 * Processa envio FULL:
 * 1. Cria registro de envio com dados do cabeçalho CSV
 * 2. Cria itens do envio com descrição e fornecedor
 * 3. Gera movimentações de SAÍDA no estoque
 */
export async function processarEnvioFull(
  itens: CSVFullItem[],
  header?: CSVFullHeader
): Promise<EnvioFull> {
  const totalItens = itens.reduce((sum, i) => sum + i.quantidade, 0)
  const totalCodigos = itens.length

  // Converter data do CSV (DD/MM/YYYY) para ISO
  let dataEnvioCSV: string | null = null
  if (header?.data_envio) {
    const partes = header.data_envio.split('/')
    if (partes.length === 3) {
      dataEnvioCSV = `${partes[2]}-${partes[1]}-${partes[0]}`
    }
  }

  // A data do envio é a do CSV quando ela existe, não a de hoje. Envio
  // lançado com atraso tem que aparecer no histórico na data em que saiu,
  // senão a conferência com o Mercado Livre não fecha.
  const dataDoEnvio = dataEnvioCSV
    ? new Date(`${dataEnvioCSV}T12:00:00`).toISOString()
    : new Date().toISOString()

  // Criar envio
  const { data: envio, error: envioError } = await supabase
    .from('envios_full')
    .insert({
      data_envio: dataDoEnvio,
      total_itens: totalItens,
      total_codigos: totalCodigos,
      codigo_envio_ml: header?.codigo_envio_ml || null,
      numero_nf: header?.numero_nf || null,
      data_envio_csv: dataEnvioCSV,
    })
    .select()
    .single()

  if (envioError) throw new Error(`Erro ao criar envio: ${envioError.message}`)

  // Criar itens do envio (com descrição e fornecedor)
  const itensEnvio = itens.map((item) => ({
    envio_id: envio.id,
    codigo_ml: item.codigo_ml,
    quantidade: item.quantidade,
    descricao: item.descricao || null,
    fornecedor: item.fornecedor || null,
    variacao: item.variacao || null,
  }))

  const { error: itensError } = await supabase
    .from('envios_full_itens')
    .insert(itensEnvio)

  if (itensError) throw new Error(`Envio criado mas erro nos itens: ${itensError.message}`)

  // Gerar movimentações de saída, na mesma data do envio
  const movimentacoes = itens.map((item) => ({
    codigo_ml: item.codigo_ml,
    produto: item.descricao || item.codigo_ml,
    tipo: 'SAIDA',
    quantidade: item.quantidade,
    origem: 'ENVIO_FULL',
    referencia_id: envio.id,
    data: dataDoEnvio,
  }))

  const { error: movError } = await supabase
    .from('estoque_movimentacoes')
    .insert(movimentacoes)

  if (movError) throw new Error(`Envio processado mas erro nas movimentações: ${movError.message}`)

  return envio
}

/**
 * Lista histórico de envios FULL.
 */
export async function listarEnviosFull(): Promise<EnvioFull[]> {
  const { data, error } = await supabase
    .from('envios_full')
    .select('*')
    .order('data_envio', { ascending: false })

  if (error) throw new Error(`Erro ao listar envios: ${error.message}`)
  return data || []
}

/**
 * Desfaz um envio FULL por completo, devolvendo os itens ao estoque.
 *
 * COMO O ESTOQUE VOLTA SOZINHO:
 * O saldo nao e um numero guardado — ele e a soma das movimentacoes
 * (entradas menos saidas). Apagar as movimentacoes de SAIDA que este envio
 * gerou ja recoloca a quantidade no saldo. Nao existe, e nao deve existir,
 * um "update quantidade" em lugar nenhum.
 *
 * ORDEM DAS EXCLUSOES:
 * Movimentacoes e itens apontam para o envio, entao o envio e o ultimo a
 * sair. Se algo falhar no meio, o que ja foi desfeito e justamente a parte
 * que mais importa (o estoque volta), e o registro do envio continua
 * visivel na tela para voce terminar a limpeza.
 *
 * ISSO APAGA, NAO ESTORNA: o envio some do historico como se nunca tivesse
 * existido. Se um dia a auditoria importar mais que a limpeza, o caminho e
 * lancar movimentacoes de ENTRADA compensatorias e marcar o envio como
 * cancelado, em vez de apagar.
 */
export async function excluirEnvioFull(envioId: string): Promise<{
  itensDevolvidos: number
  unidadesDevolvidas: number
}> {
  if (!envioId) throw new Error('Envio nao informado.')

  // Fotografa o que vai voltar, para conseguir relatar depois
  const itens = await buscarItensEnvio(envioId)
  const unidades = itens.reduce((s, i) => s + (i.quantidade || 0), 0)

  // 1. As saidas de estoque — e isso que devolve o saldo
  const { error: erroMov } = await supabase
    .from('estoque_movimentacoes')
    .delete()
    .eq('referencia_id', envioId)
    .eq('origem', 'ENVIO_FULL')

  if (erroMov) {
    throw new Error(`Nada foi alterado. Erro ao remover as saidas: ${erroMov.message}`)
  }

  // 2. Os itens do envio
  const { error: erroItens } = await supabase
    .from('envios_full_itens')
    .delete()
    .eq('envio_id', envioId)

  if (erroItens) {
    throw new Error(
      `O estoque JA foi devolvido, mas os itens do envio nao saíram: ${erroItens.message}`
    )
  }

  // 3. O envio
  const { error: erroEnvio } = await supabase
    .from('envios_full')
    .delete()
    .eq('id', envioId)

  if (erroEnvio) {
    throw new Error(
      `O estoque JA foi devolvido e os itens removidos, mas o envio continua no historico: ${erroEnvio.message}`
    )
  }

  return { itensDevolvidos: itens.length, unidadesDevolvidas: unidades }
}

/**
 * Busca itens de um envio FULL específico.
 */
export async function buscarItensEnvio(envioId: string): Promise<EnvioFullItem[]> {
  const { data, error } = await supabase
    .from('envios_full_itens')
    .select('*')
    .eq('envio_id', envioId)

  if (error) throw new Error(`Erro ao buscar itens do envio: ${error.message}`)
  return data || []
}
