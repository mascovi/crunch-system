import { supabase } from '@/lib/supabase'

/**
 * Resolve razão social para nome fantasia usando a tabela fornecedores.
 * Se não encontrar mapeamento, retorna a própria razão social.
 * Se a razão social for nova, cadastra automaticamente.
 */
export async function resolverFornecedor(razaoSocial: string): Promise<string> {
  if (!razaoSocial || razaoSocial.trim() === '') return ''

  const razaoUpper = razaoSocial.trim().toUpperCase()

  // Buscar na tabela fornecedores (match parcial — razão social pode ter cortes)
  const { data } = await supabase
    .from('fornecedores')
    .select('nome_fantasia, razao_social')

  if (data && data.length > 0) {
    for (const f of data) {
      // Match se a razão social da NF contém a razão social cadastrada ou vice-versa
      if (
        razaoUpper.includes(f.razao_social.toUpperCase()) ||
        f.razao_social.toUpperCase().includes(razaoUpper)
      ) {
        return f.nome_fantasia
      }
    }
  }

  // Se não encontrou mapeamento, cadastrar automaticamente com razão social = nome fantasia
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
