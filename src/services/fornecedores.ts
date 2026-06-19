import { supabase } from '@/lib/supabase'
import type { Fornecedor } from '@/types'

// ============================================
// CRUD DE FORNECEDORES
// ============================================

/**
 * Lista todos os fornecedores com todos os campos.
 */
export async function listarFornecedoresCompleto(): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .order('nome_fantasia', { ascending: true })

  if (error) throw new Error(`Erro ao listar fornecedores: ${error.message}`)
  return data || []
}

/**
 * Busca um fornecedor pelo ID.
 */
export async function buscarFornecedorPorId(id: string): Promise<Fornecedor | null> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

/**
 * Atualiza dados de um fornecedor.
 */
export async function atualizarFornecedor(
  id: string,
  dados: Partial<Omit<Fornecedor, 'id' | 'created_at'>>
): Promise<Fornecedor> {
  const { data, error } = await supabase
    .from('fornecedores')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar fornecedor: ${error.message}`)
  return data
}

/**
 * Busca todas as NFs vinculadas a um fornecedor pelo nome_fantasia.
 */
export async function buscarNFsPorFornecedor(nomeFantasia: string) {
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('id, numero_nf, data_emissao, data_recebimento, status, volumes, fornecedor, cnpj')
    .eq('fornecedor', nomeFantasia)
    .order('data_emissao', { ascending: false })

  if (error) throw new Error(`Erro ao buscar NFs do fornecedor: ${error.message}`)
  return data || []
}

// ============================================
// FUNÇÕES DE RESOLUÇÃO (existentes)
// ============================================

/**
 * Resolve razao social para nome fantasia usando a tabela fornecedores.
 * Se nao encontrar mapeamento, retorna a propria razao social.
 * Se a razao social for nova, cadastra automaticamente.
 */
export async function resolverFornecedor(razaoSocial: string): Promise<string> {
  if (!razaoSocial || razaoSocial.trim() === '') return ''

  const razaoUpper = razaoSocial.trim().toUpperCase()

  // Buscar na tabela fornecedores (match parcial)
  const { data } = await supabase
    .from('fornecedores')
    .select('nome_fantasia, razao_social')

  if (data && data.length > 0) {
    for (const f of data) {
      if (
        razaoUpper.includes(f.razao_social.toUpperCase()) ||
        f.razao_social.toUpperCase().includes(razaoUpper)
      ) {
        return f.nome_fantasia
      }
    }
  }

  // Se nao encontrou mapeamento, cadastrar automaticamente
  await supabase
    .from('fornecedores')
    .insert({
      razao_social: razaoSocial.trim(),
      nome_fantasia: razaoSocial.trim(),
    })
    .select()

  return razaoSocial.trim()
}

/**
 * Resolve codigo do fornecedor para codigo ML.
 * Quando o XML traz um codigo interno do fornecedor (ex: IMT120),
 * busca na tabela produtos se algum produto tem esse codigo_fornecedor.
 * Se encontrar, retorna o codigo_ml real. Se nao, retorna o proprio codigo.
 */
export async function resolverCodigoFornecedor(
  codigoXML: string
): Promise<{ codigo_ml: string; produto_existente: boolean }> {
  if (!codigoXML || codigoXML.trim() === '') {
    return { codigo_ml: '', produto_existente: false }
  }

  const codigo = codigoXML.trim()

  // 1. Verificar se ja e um codigo_ml valido (produto existe com esse codigo_ml)
  const { data: produtoML } = await supabase
    .from('produtos')
    .select('codigo_ml')
    .eq('codigo_ml', codigo)
    .limit(1)

  if (produtoML && produtoML.length > 0) {
    return { codigo_ml: codigo, produto_existente: true }
  }

  // 2. Buscar por codigo_fornecedor
  const { data: produtoFornecedor } = await supabase
    .from('produtos')
    .select('codigo_ml')
    .eq('codigo_fornecedor', codigo)
    .limit(1)

  if (produtoFornecedor && produtoFornecedor.length > 0) {
    return { codigo_ml: produtoFornecedor[0].codigo_ml, produto_existente: true }
  }

  // 3. Nao encontrou - retorna o codigo original (sera tratado como novo produto)
  return { codigo_ml: codigo, produto_existente: false }
}

/**
 * Lista todos os fornecedores cadastrados (versão simples).
 */
export async function listarFornecedores(): Promise<{ razao_social: string; nome_fantasia: string }[]> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('razao_social, nome_fantasia')
    .order('nome_fantasia', { ascending: true })

  if (error) throw new Error(`Erro ao listar fornecedores: ${error.message}`)
  return data || []
}
