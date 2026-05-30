'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginPorSenha } from '@/services/auth'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!senha.trim()) return

    setLoading(true)
    setErro('')

    try {
      const usuario = await loginPorSenha(senha)
      login(usuario)
      router.push('/')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo e título */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-xl overflow-hidden">
            <img
              src="/crunch-logo.png"
              alt="Crunch Online"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">CRUNCH</h1>
          <p className="mt-2 text-crunch-ink-dim text-sm">
            Hub Operacional
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="senha"
                className="block text-[10px] font-semibold uppercase tracking-widest text-crunch-ink-mute mb-3"
              >
                Senha de Acesso
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro('') }}
                placeholder="Digite sua senha"
                autoFocus
                className="w-full px-4 py-3 bg-crunch-bg border border-crunch-line rounded-xl text-sm text-crunch-ink placeholder:text-crunch-ink-mute/50 focus:outline-none focus:border-crunch-accent focus:ring-1 focus:ring-crunch-accent transition-colors"
              />
            </div>

            {erro && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-900/30 rounded-lg px-4 py-2.5">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !senha.trim()}
              className="w-full py-3 px-4 bg-crunch-accent text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-crunch-ink-mute">
          Crunch Online &mdash; Acesso Restrito
        </p>
      </div>
    </div>
  )
}
