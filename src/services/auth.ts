import { supabase } from '@/lib/supabase'

export interface UsuarioLogado {
  id: string
  nome: string
}

/**
 * Tenta login por senha usando RPC no Supabase.
 * A comparação de hash acontece no servidor (mais seguro).
 */
export async function loginPorSenha(senha: string): Promise<UsuarioLogado> {
  const { data, error } = await supabase
    .rpc('login_por_senha', { senha_input: senha })

  if (error) throw new Error('Erro ao verificar senha.')
  if (!data || data.length === 0) throw new Error('Senha incorreta.')

  return { id: data[0].id, nome: data[0].nome }
}
