import { supabase } from '@/lib/supabase'

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
 * Lista todos os fornecedores cadastrados.
 */
export async function listarFornecedores(): Promise<{ razao_social: string; nome_fantasia: string }[]> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('razao_social, nome_fantasia')
    .order('nome_fantasia', { ascending: true })

  if (error) throw new Error(`Erro ao listar fornecedores: ${error.message}`)
  return data || []
}
