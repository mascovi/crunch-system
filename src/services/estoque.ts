import { supabase } from '@/lib/supabase'
import type { SaldoEstoque, EstoqueMovimentacao } from '@/types'

/**
 * Busca o saldo atual de estoque calculado por movimentações.
 * Agrupa por codigo_ml, soma entradas e subtrai saídas.
 */
export async function listarEstoque(): Promise<SaldoEstoque[]> {
  // Buscar todas as movimentações
  const { data: movimentacoes, error } = await supabase
    .from('estoque_movimentacoes')
    .select('*')
    .order('data', { ascending: false })

  if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`)

  // Agrupar por codigo_ml
  const mapa = new Map<string, {
    produto: string
    entradas: number
    saidas: number
    ultima_mov: string
    fornecedor: string
  }>()

  for (const mov of (movimentacoes || []) as EstoqueMovimentacao[]) {
    const atual = mapa.get(mov.codigo_ml) || {
      produto: mov.produto,
      entradas: 0,
      saidas: 0,
      ultima_mov: mov.data,
      fornecedor: '',
    }

    if (mov.tipo === 'ENTRADA') {
      atual.entradas += mov.quantidade
      // O fornecedor mais recente é o principal
      if (!atual.fornecedor || mov.data > atual.ultima_mov) {
        atual.fornecedor = mov.origem
      }
    } else {
      atual.saidas += mov.quantidade
    }

    if (mov.data > atual.ultima_mov) {
      atual.ultima_mov = mov.data
    }

    atual.produto = mov.produto
    mapa.set(mov.codigo_ml, atual)
  }

  // Converter para array de SaldoEstoque
  const resultado: SaldoEstoque[] = []
  mapa.forEach((val, codigo_ml) => {
    resultado.push({
      codigo_ml,
      produto: val.produto,
      quantidade_disponivel: val.entradas - val.saidas,
      ultima_movimentacao: val.ultima_mov,
      fornecedor_principal: val.fornecedor,
    })
  })

  // Ordenar por nome do produto
  resultado.sort((a, b) => a.produto.localeCompare(b.produto))

  return resultado
}

/**
 * Busca o saldo de um código ML específico.
 */
export async function buscarSaldoCodigo(codigoMl: string): Promise<number> {
  const { data, error } = await supabase
    .from('estoque_movimentacoes')
    .select('tipo, quantidade')
    .eq('codigo_ml', codigoMl)

  if (error) throw new Error(`Erro ao buscar saldo: ${error.message}`)

  let saldo = 0
  for (const mov of data || []) {
    if (mov.tipo === 'ENTRADA') saldo += mov.quantidade
    else saldo -= mov.quantidade
  }

  return saldo
}

/**
 * Busca histórico de movimentações de um código ML.
 */
export async function buscarHistoricoCodigo(codigoMl: string): Promise<EstoqueMovimentacao[]> {
  const { data, error } = await supabase
    .from('estoque_movimentacoes')
    .select('*')
    .eq('codigo_ml', codigoMl)
    .order('data', { ascending: false })

  if (error) throw new Error(`Erro ao buscar histórico: ${error.message}`)
  return data || []
}
