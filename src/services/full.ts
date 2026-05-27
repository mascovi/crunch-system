import { supabase } from '@/lib/supabase'
import { buscarSaldoCodigo } from './estoque'
import type { EnvioFull, EnvioFullItem, CSVFullItem, CSVFullHeader } from '@/types'

/**
 * Valida os itens do CSV FULL contra o estoque disponível.
 * Retorna erros encontrados.
 */
export async function validarCSVFull(itens: CSVFullItem[]): Promise<string[]> {
  const erros: string[] = []

  for (const item of itens) {
    if (!item.codigo_ml) {
      erros.push(`Linha com Código ML vazio.`)
      continue
    }

    const saldo = await buscarSaldoCodigo(item.codigo_ml)

    if (saldo <= 0) {
      erros.push(`${item.codigo_ml} (${item.descricao || '?'}): sem saldo em estoque (saldo: ${saldo}).`)
    } else if (item.quantidade > saldo) {
      erros.push(`${item.codigo_ml} (${item.descricao || '?'}): quantidade (${item.quantidade}) excede saldo (${saldo}).`)
    }
  }

  return erros
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

  // Criar envio
  const { data: envio, error: envioError } = await supabase
    .from('envios_full')
    .insert({
      data_envio: new Date().toISOString(),
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

  // Gerar movimentações de saída
  const movimentacoes = itens.map((item) => ({
    codigo_ml: item.codigo_ml,
    produto: item.descricao || item.codigo_ml,
    tipo: 'SAIDA',
    quantidade: item.quantidade,
    origem: 'ENVIO_FULL',
    referencia_id: envio.id,
    data: new Date().toISOString(),
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
