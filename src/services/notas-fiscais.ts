import { supabase } from '@/lib/supabase'
import type { NotaFiscal, ItemNF, XMLParsedNF, NotaEmTransito } from '@/types'
import { calcularDiasUteis } from '@/lib/business-days'
import { resolverFornecedor, resolverCodigoFornecedor } from './fornecedores'

/**
 * Busca todas as NFs em transito.
 */
export async function listarNotasEmTransito(): Promise<NotaEmTransito[]> {
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('*')
    .eq('status', 'EM_TRANSITO')
    .order('data_emissao', { ascending: false })

  if (error) throw new Error(`Erro ao buscar notas: ${error.message}`)

  return (data || []).map((nf: NotaFiscal) => ({
    ...nf,
    dias_uteis: calcularDiasUteis(nf.data_emissao),
  }))
}

/**
 * Busca os itens de uma NF especifica.
 */
export async function buscarItensNF(nfId: string): Promise<ItemNF[]> {
  const { data, error } = await supabase
    .from('itens_nf')
    .select('*')
    .eq('nf_id', nfId)

  if (error) throw new Error(`Erro ao buscar itens: ${error.message}`)
  return data || []
}

/**
 * Verifica se uma NF ja existe (duplicata).
 */
export async function verificarNFDuplicada(numero_nf: string, cnpj: string): Promise<boolean> {
  const { data } = await supabase
    .from('notas_fiscais')
    .select('id')
    .eq('numero_nf', numero_nf)
    .eq('cnpj', cnpj)
    .limit(1)

  return (data?.length || 0) > 0
}

/**
 * Salva uma NF e seus itens no banco (apos upload XML).
 * NAO atualiza estoque - so entra no painel de transito.
 * Resolve codigos de fornecedor para codigos ML automaticamente.
 */
export async function salvarNotaFiscal(
  parsedNF: XMLParsedNF,
  xmlUrl: string
): Promise<NotaFiscal> {
  // Resolver nome fantasia do fornecedor (auto-cadastra se novo)
  const nomeFantasia = await resolverFornecedor(parsedNF.fornecedor)

  // Resolver codigos: verificar se algum codigo do XML eh codigo_fornecedor
  const itensResolvidos = await Promise.all(
    parsedNF.itens.map(async (item) => {
      const { codigo_ml, produto_existente } = await resolverCodigoFornecedor(item.codigo_ml)
      return {
        ...item,
        codigo_ml_original: item.codigo_ml, // guardar o codigo original do XML
        codigo_ml,                           // codigo ML real (resolvido)
        produto_existente,
      }
    })
  )

  // Inserir NF
  const { data: nf, error: nfError } = await supabase
    .from('notas_fiscais')
    .insert({
      fornecedor: parsedNF.fornecedor,
      cnpj: parsedNF.cnpj,
      numero_nf: parsedNF.numero_nf,
      data_emissao: parsedNF.data_emissao,
      data_upload: new Date().toISOString(),
      status: 'EM_TRANSITO',
      volumes: parsedNF.volumes,
      transportadora: parsedNF.transportadora,
      xml_url: xmlUrl,
    })
    .select()
    .single()

  if (nfError) throw new Error(`Erro ao salvar NF: ${nfError.message}`)

  // Inserir itens (com codigo_ml resolvido)
  const itensParaInserir = itensResolvidos.map((item) => ({
    nf_id: nf.id,
    codigo_ml: item.codigo_ml,
    produto: item.produto,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario,
    valor_total: item.valor_total,
  }))

  const { error: itensError } = await supabase
    .from('itens_nf')
    .insert(itensParaInserir)

  if (itensError) throw new Error(`NF salva mas erro nos itens: ${itensError.message}`)

  // Auto-cadastrar produtos novos na tabela produtos
  for (const item of itensResolvidos) {
    if (!item.produto_existente) {
      // Produto novo - cadastrar com codigo_fornecedor = codigo original do XML
      const { data: existente } = await supabase
        .from('produtos')
        .select('codigo_ml')
        .eq('codigo_ml', item.codigo_ml)
        .limit(1)

      if (!existente || existente.length === 0) {
        await supabase
          .from('produtos')
          .insert({
            codigo_ml: item.codigo_ml,
            descricao: item.produto,
            fornecedor: nomeFantasia,
            codigo_fornecedor: item.codigo_ml_original !== item.codigo_ml
              ? item.codigo_ml_original
              : null,
          })
      }
    }
  }

  return nf
}

/**
 * Confirmar recebimento de uma NF.
 * 1. Altera status para ENTREGUE
 * 2. Gera movimentacoes de ENTRADA no estoque
 */
export async function confirmarRecebimento(nfId: string): Promise<void> {
  // Buscar itens da NF
  const itens = await buscarItensNF(nfId)
  if (itens.length === 0) throw new Error('NF sem itens para dar entrada.')

  // Atualizar status da NF
  const { error: updateError } = await supabase
    .from('notas_fiscais')
    .update({
      status: 'ENTREGUE',
      data_recebimento: new Date().toISOString(),
    })
    .eq('id', nfId)

  if (updateError) throw new Error(`Erro ao atualizar NF: ${updateError.message}`)

  // Gerar movimentacoes de entrada (com preco de compra do XML)
  const movimentacoes = itens.map((item) => ({
    codigo_ml: item.codigo_ml,
    produto: item.produto,
    tipo: 'ENTRADA',
    quantidade: item.quantidade,
    origem: 'NF_RECEBIMENTO',
    referencia_id: nfId,
    data: new Date().toISOString(),
    preco_compra: item.valor_unitario || 0,
  }))

  const { error: movError } = await supabase
    .from('estoque_movimentacoes')
    .insert(movimentacoes)

  if (movError) throw new Error(`NF recebida mas erro nas movimentacoes: ${movError.message}`)
}
