import { supabase } from '@/lib/supabase'
import type { SaldoEstoque, EstoqueMovimentacao, Produto, MotivoAjuste } from '@/types'

/**
 * Busca o saldo atual de estoque calculado por movimentações.
 * Cruza com tabela produtos para pegar fornecedor real.
 * Calcula preço médio de compra ponderado pelas entradas.
 */
export async function listarEstoque(): Promise<SaldoEstoque[]> {
  // Buscar todas as movimentações
  const { data: movimentacoes, error } = await supabase
    .from('estoque_movimentacoes')
    .select('*')
    .order('data', { ascending: false })

  if (error) throw new Error(`Erro ao buscar movimentações: ${error.message}`)

  // Buscar catálogo de produtos para fornecedor
  const { data: produtos } = await supabase
    .from('produtos')
    .select('codigo_ml, fornecedor, descricao')

  const produtoMap = new Map<string, { fornecedor: string; descricao: string }>()
  for (const p of produtos || []) {
    produtoMap.set(p.codigo_ml, { fornecedor: p.fornecedor, descricao: p.descricao })
  }

  // Agrupar por codigo_ml
  const mapa = new Map<string, {
    produto: string
    entradas: number
    saidas: number
    ultima_mov: string
    fornecedor: string
    preco_total: number
    qtd_com_preco: number
  }>()

  for (const mov of (movimentacoes || []) as (EstoqueMovimentacao & { preco_compra?: number })[]) {
    const atual = mapa.get(mov.codigo_ml) || {
      produto: mov.produto,
      entradas: 0,
      saidas: 0,
      ultima_mov: mov.data,
      fornecedor: '',
      preco_total: 0,
      qtd_com_preco: 0,
    }

    if (mov.tipo === 'ENTRADA') {
      atual.entradas += mov.quantidade
      // Acumular preço ponderado (só entradas com preço > 0)
      const preco = mov.preco_compra || 0
      if (preco > 0) {
        atual.preco_total += preco * mov.quantidade
        atual.qtd_com_preco += mov.quantidade
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
    // Fornecedor vem da tabela produtos (fonte confiável)
    const prod = produtoMap.get(codigo_ml)
    const fornecedor = prod?.fornecedor || ''

    // Preço médio ponderado
    const precoMedio = val.qtd_com_preco > 0
      ? val.preco_total / val.qtd_com_preco
      : 0

    resultado.push({
      codigo_ml,
      produto: prod?.descricao || val.produto,
      quantidade_disponivel: val.entradas - val.saidas,
      ultima_movimentacao: val.ultima_mov,
      fornecedor_principal: fornecedor,
      preco_compra: precoMedio,
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

/**
 * Ajuste manual de estoque (devolução, consumo, problema, etc).
 * Cria uma movimentação de ENTRADA (positivo) ou SAIDA (negativo).
 */
export async function ajustarEstoque(params: {
  codigo_ml: string
  produto: string
  quantidade: number // positivo = entrada, negativo = saída
  motivo: MotivoAjuste
  observacao?: string
}): Promise<void> {
  const tipo = params.quantidade > 0 ? 'ENTRADA' : 'SAIDA'
  const qtdAbsoluta = Math.abs(params.quantidade)
  const origemLabel = `AJUSTE_${params.motivo}`

  const { error } = await supabase
    .from('estoque_movimentacoes')
    .insert({
      codigo_ml: params.codigo_ml,
      produto: params.produto,
      tipo,
      quantidade: qtdAbsoluta,
      origem: origemLabel,
      referencia_id: crypto.randomUUID(),
      data: new Date().toISOString(),
      preco_compra: 0,
      observacao: params.observacao || null,
    })

  if (error) throw new Error(`Erro ao ajustar estoque: ${error.message}`)
}

/**
 * Cadastrar novo produto na tabela produtos.
 */
export async function cadastrarProduto(produto: Produto): Promise<void> {
  // Verificar se já existe
  const { data: existente } = await supabase
    .from('produtos')
    .select('codigo_ml')
    .eq('codigo_ml', produto.codigo_ml)
    .limit(1)

  if (existente && existente.length > 0) {
    throw new Error(`Produto ${produto.codigo_ml} já existe no cadastro.`)
  }

  const { error } = await supabase
    .from('produtos')
    .insert({
      codigo_ml: produto.codigo_ml,
      descricao: produto.descricao,
      fornecedor: produto.fornecedor,
      codigo_fornecedor: produto.codigo_fornecedor || null,
    })

  if (error) throw new Error(`Erro ao cadastrar produto: ${error.message}`)
}

/**
 * Listar todos os produtos cadastrados.
 */
export async function listarProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('descricao', { ascending: true })

  if (error) throw new Error(`Erro ao listar produtos: ${error.message}`)
  return data || []
}
